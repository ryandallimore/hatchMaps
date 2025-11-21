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

router.get("/qualities", async (req,res)=>{
    pool.query('SELECT * FROM usgsdb.quality_data', (error, results, fields) =>{
        if (error) throw error;
        console.log("Database Results:", results);
        res.json(results);
    })
});

router.get("/discharges", async (req,res)=>{
    pool.query('SELECT * FROM usgsdb.discharge_data', (error, results, fields) =>{
        if (error) throw error;
        console.log("Database Results:", results);
        res.json(results);
    })
});

router.get("/data", async (req, res)=> {
    // Extract query parameters with default values
    const tempThreshold = parseFloat(req.query.temp) || 0;
    const qualityThreshold = parseFloat(req.query.quality) || 0;
    const dischargeThreshold = parseFloat(req.query.discharge) || 0;
    
    const query = `
        SELECT 
            t.siteCode,
            t.siteName,
            t.value AS Temperature,
            q.value AS Quality,
            d.value AS DischargeRate,
            t.time AS temp_time,
            q.time AS quality_time,
            d.time AS discharge_time
        FROM usgsdb.temp_data t
        LEFT JOIN usgsdb.quality_data q ON t.siteCode = q.siteCode
        LEFT JOIN usgsdb.discharge_data d ON t.siteCode = d.siteCode
        WHERE (t.value IS NULL OR t.value > ?)
          AND (q.value IS NULL OR q.value > ?)
          AND (d.value IS NULL OR d.value > ?)
        ORDER BY t.siteCode
    `;
    
    pool.query(query, [tempThreshold, qualityThreshold, dischargeThreshold], (error, results, fields) => {
        if (error) {
            console.error('Error executing join query:', error);
            res.status(500).json({ error: 'Database query failed' });
            return;
        }
        console.log(`Filtered Database Results (temp>${tempThreshold}, quality>${qualityThreshold}, discharge>${dischargeThreshold}):`, results.length, 'records');
        res.json(results);
    });
})



export default router;
