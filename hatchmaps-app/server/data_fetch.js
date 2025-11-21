import https from 'https';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
// USGS NWIS Instantaneous Values (IV) service
// parameterCd=00010 => Water temperature
// stateCd=or => Oregon
// siteStatus=all => include all sites (active/inactive)
const USGS_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=or&parameterCd=00010&siteStatus=all';

function fetchUSGS(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'] || '';

        if (statusCode !== 200) {
          reject(new Error(`Request Failed. Status Code: ${statusCode}`));
          res.resume();
          return;
        }

        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            // Some servers may prepend non-JSON chars; trim just in case
            const trimmed = rawData.trim();
            const parsedData = JSON.parse(trimmed);
            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', (e) => {
        reject(e);
      });
  });
}

function extractLatestTemperatures(nwisJson) {
  if (!nwisJson || !nwisJson.value || !Array.isArray(nwisJson.value.timeSeries)) {
    return [];
  }

  return nwisJson.value.timeSeries
    .map((series) => {
      const siteInfo = series.sourceInfo || {};
      const variable = series.variable || {};
      const siteName = siteInfo.siteName || 'Unknown site';
      const siteCode =
        (siteInfo.siteCode && siteInfo.siteCode[0] && siteInfo.siteCode[0].value) || 'Unknown code';
      const varDesc = variable.variableDescription || 'Water temperature';

      const geoLocation = (siteInfo.geoLocation && siteInfo.geoLocation.geogLocation) || {};
      const latitude = geoLocation.latitude ?? null;
      const longitude = geoLocation.longitude ?? null;

      // Very rough "city" extraction: take text after last "AT" or "NEAR" in the site name, if present
      let city = null;
      const upperName = siteName.toUpperCase();
      const atIndex = upperName.lastIndexOf(' AT ');
      const nearIndex = upperName.lastIndexOf(' NEAR ');
      const splitIndex = Math.max(atIndex, nearIndex);
      if (splitIndex !== -1) {
        city = siteName.substring(splitIndex + 4).trim();
      }

      const valuesArr = series.values && series.values[0] && series.values[0].value;
      if (!valuesArr || !valuesArr.length) {
        return null;
      }

      const latest = valuesArr[valuesArr.length - 1];
      const value = latest.value;
      const unit = (variable.unit && variable.unit.unitCode) || '';
      const time = latest.dateTime;

      return {
        siteCode,
        siteName,
        description: varDesc,
        value,
        unit,
        time,
        latitude,
        longitude,
        city,
      };
    })
    .filter(Boolean);
}

async function temps() {
  const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
  });
  console.log('DB config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  db: process.env.DB_NAME,
});
  const deleteData = 'DELETE FROM temp_data';
  await connection.execute(deleteData);
  try {
    console.log('Requesting latest water temperatures for all USGS monitoring sites in Oregon...');
    console.log(`GET ${USGS_URL}`);

    const data = await fetchUSGS(USGS_URL);
    const temps = extractLatestTemperatures(data);

    console.log(`\nFound ${temps.length} sites with water temperature data.\n`);
    /*
    temps.forEach((t) => {
      console.log(
        `${t.siteCode} | ${t.siteName.split(',')[0]}\n` +
          (t.city ? `  Location (approx city): ${t.city}\n` : '') +
          (t.latitude != null && t.longitude != null
            ? `  Coordinates: ${t.latitude}, ${t.longitude}\n`
            : '') +
          `  ${t.description}: ${t.value} ${t.unit} at ${t.time}\n`
      );
    }); */
    for (let row of temps) {
        const {
            siteCode = null,
            siteName = null,
            time = null,
            value = null,
        } = row || {};
        //const formattedDateTime = parseDateTime(dateTime);
        console.log(siteCode, siteName, time, value); //Log the data found
        const query = `INSERT INTO temp_data (siteCode, siteName, time, value) VALUES (?, ?, ?, ?)`;
        await connection.execute(query, [
            siteCode ?? null,
            siteName ?? null,
            time ?? null,
            value ?? null,
        ]);
    }
  } catch (err) {
    console.error('Error fetching USGS data:', err.message || err);
    process.exitCode = 1;
  } finally {
    await connection.end();   // <-- important
  }
}

export default temps;