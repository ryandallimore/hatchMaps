import express from 'express';
const app = express();
import dotenv from 'dotenv'; // Simplifies use of environment variables
import router from './routes/routes.js';
import mysql from 'mysql2';
import temps from './data_fetch.js';
import cron from 'node-cron';
import cors from 'cors';

app.use(cors());
dotenv.config();
app.use(express.json()); //So that you are abloe to use JSON

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);

async function connectWithRetry() {
  let attempts = 5;

  while (attempts) {
      try {
          const connection = await mysql.createConnection({
              host: process.env.DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
          });
          console.log('Connected to the database');
          return connection;
      } catch (error) {
          console.error('Database connection failed. Retrying...');
          attempts -= 1;
          await new Promise(res => setTimeout(res, 5000)); // Wait for 5 seconds before retrying
      }
  }

  throw new Error('Could not connect to the database after multiple attempts');
}
/*
const connection = mysql.createConnection({
  host: process.env.DB_HOST,  // 'db' from docker-compose
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306
});
*/

try {
    await temps();  // Await the async function
    console.log("Web scraper completed successfully");
} catch (error) {
    console.error("Error running the web scraper:", error);
}



cron.schedule('0 * * * *', async () => {
    console.log("Running the web scraper");
    try {
        await temps();  // Await the async function
        console.log("Web scraper completed successfully");
    } catch (error) {
        console.error("Error running the web scraper:", error);
    }
});

// process.env from dotenv, to prevent link from beign displayable on git

app.use('/', router);

app.listen(3000, '0.0.0.0', () =>{
    console.log(`Backend server is running at http://0.0.0.0:3000`);
});
