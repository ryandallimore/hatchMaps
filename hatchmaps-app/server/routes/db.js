import mysql from "mysql2"
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  port: 3306
});

/*
const connection = mysql.createConnection({
  host: process.env.DB_HOST,  // 'db' from docker-compose
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306
});
*/
/*
pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to MySQL:', err.stack);
      return;
    }
    console.log('Connected to MySQL as id ' + connection.threadId);
  });
*/
export default pool;
