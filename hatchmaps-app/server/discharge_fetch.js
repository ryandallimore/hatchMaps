import https from 'https';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
// USGS NWIS Instantaneous Values (IV) service
// Discharge parameter: 00060 => Discharge, cubic feet per second
// stateCd=or => Oregon
// siteStatus=all => include all sites (active/inactive)
const USGS_DISCHARGE_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=or&parameterCd=00060&siteStatus=all';

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

function extractLatestWaterDischarge(nwisJson) {
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
      const varDesc = variable.variableDescription || 'Water discharge';

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

async function waterDischarge() {
  
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
  const deleteData = 'DELETE FROM discharge_data';
  await connection.execute(deleteData);
  
  try {
    console.log('Requesting latest water discharge data for all USGS monitoring sites in Oregon...');
    console.log(`GET discharge: ${USGS_DISCHARGE_URL}`);

    const dischargeJson = await fetchUSGS(USGS_DISCHARGE_URL);
    const discharges = extractLatestWaterDischarge(dischargeJson);

    console.log(`\nFound ${discharges.length} sites with water discharge data.\n`);

    for (let row of discharges) {
      const {
        siteCode = null,
        siteName = null,
        time = null,
        value: discharge = null,
        unit: dischargeUnit = null,
      } = row || {};

      console.log(
        `${siteCode} ${siteName} | discharge=${discharge} ${dischargeUnit || ''} at ${time}`
      );
    }
    
    for (let row of discharges) {
      const {
        siteCode = null,
        siteName = null,
        time = null,
        value = null,
      } = row || {};
      console.log(siteCode, siteName, time, value);
      const query = `INSERT INTO discharge_data (siteCode, siteName, time, value) VALUES (?, ?, ?, ?)`;
      await connection.execute(query, [
        siteCode ?? null,
        siteName ?? null,
        time ?? null,
        value ?? null,
      ]);
    }
  } catch (err) {
    console.error('Error fetching USGS water discharge data:', err.message || err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

export default waterDischarge;

console.log('DEBUG - import.meta.url:', import.meta.url);
console.log('DEBUG - process.argv[1]:', process.argv[1]);
console.log('DEBUG - file URL:', `file://${process.argv[1]}`);
console.log('DEBUG - Match?', import.meta.url === `file://${process.argv[1]}`);

const currentFileUrl = new URL(import.meta.url).pathname;
const argvPath = process.argv[1].replace(/\\/g, '/');
if (currentFileUrl.endsWith(argvPath) || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  waterDischarge().catch((err) => {
    console.error('waterDischarge run failed:', err);
    process.exitCode = 1;
  });
}