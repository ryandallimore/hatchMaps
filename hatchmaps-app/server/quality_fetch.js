import https from 'https';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
// USGS NWIS Instantaneous Values (IV) service
// Example water-quality parameter: 00400 => pH
// Water temperature parameter: 00010 => Temperature, water, degrees Celsius
// stateCd=or => Oregon
// siteStatus=all => include all sites (active/inactive)
const USGS_WQ_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=or&parameterCd=00400&siteStatus=all';
const USGS_TEMP_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=or&parameterCd=00010&siteStatus=all';

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

function extractLatestWaterQuality(nwisJson) {
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
      const varDesc = variable.variableDescription || 'Water quality';

      const geoLocation = (siteInfo.geoLocation && siteInfo.geoLocation.geogLocation) || {};
      const latitude = geoLocation.latitude ?? null;
      const longitude = geoLocation.longitude ?? null;

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

async function waterQuality() {
  /*
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  console.log('DB config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    db: process.env.DB_NAME,
  });
  const deleteData = 'DELETE FROM quality_data';
  await connection.execute(deleteData);
  */
  try {
    console.log('Requesting latest water quality data (pH) and water temperature for all USGS monitoring sites in Oregon...');
    console.log(`GET quality: ${USGS_WQ_URL}`);
    console.log(`GET temperature: ${USGS_TEMP_URL}`);

    const [qualityJson, tempJson] = await Promise.all([
      fetchUSGS(USGS_WQ_URL),
      fetchUSGS(USGS_TEMP_URL),
    ]);

    const qualities = extractLatestWaterQuality(qualityJson);
    const temps = extractLatestTemperatures(tempJson);

    console.log(`\nFound ${qualities.length} sites with water quality data.`);
    console.log(`Found ${temps.length} sites with water temperature data.\n`);

    const tempsBySite = new Map();
    for (const t of temps) {
      if (t && t.siteCode) {
        tempsBySite.set(t.siteCode, t);
      }
    }

    for (let row of qualities) {
      const {
        siteCode = null,
        siteName = null,
        time = null,
        value: pH = null,
        unit: pHUnit = null,
      } = row || {};

      const temp = siteCode ? tempsBySite.get(siteCode) : null;
      const tempValue = temp?.value ?? 'N/A';
      const tempUnit = temp?.unit ?? '';
      const tempTime = temp?.time ?? '';

      console.log(
        `${siteCode} ${siteName} | pH=${pH} ${pHUnit || ''} at ${time} | temp=${tempValue} ${tempUnit} at ${tempTime}`
      );
    }
    /*
    for (let row of qualities) {
      const {
        siteCode = null,
        siteName = null,
        time = null,
        value = null,
      } = row || {};
      console.log(siteCode, siteName, time, value);
      const query = `INSERT INTO quality_data (siteCode, siteName, time, value) VALUES (?, ?, ?, ?)`;
      await connection.execute(query, [
        siteCode ?? null,
        siteName ?? null,
        time ?? null,
        value ?? null,
      ]);
    }*/
  } catch (err) {
    console.error('Error fetching USGS water quality data:', err.message || err);
    process.exitCode = 1;
  }/* finally {
    await connection.end();
  }*/
}

export default waterQuality;

if (import.meta.url === `file://${process.argv[1]}`) {
  waterQuality().catch((err) => {
    console.error('waterQuality run failed:', err);
    process.exitCode = 1;
  });
}