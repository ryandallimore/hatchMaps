import express from 'express';
const router = express.Router();
import pool from './db.js';

router.get('/', (req, res)=>{
    res.status(200);
    res.send("Reached root URL of backend");
})

router.get("/temps", async (req,res)=>{
    pool.query('SELECT * FROM usgsdb.temp_data', (error, results, fields) =>{
        if (error) throw error;
        console.log("Database Results:", results);
        res.json(results);
    })
});



export default router;
