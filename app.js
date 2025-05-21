const createError = require('http-errors');
const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const server = express();

server.use(cors());
server.use(bodyParser.json());
server.use(logger('dev'));
server.use(cookieParser());
server.use(express.urlencoded({extended: false}));
server.use(express.static("public"));

//server.use((req, res, next) => {
//    next(createError(404));
//});

const db = new sqlite3.Database('./weather.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to the SQLite database.');
    }
});


for (let i = 1; i <= 5; i++) {
    const hours_ago = i;
    db.run(
        `INSERT INTO sender_test (time, temperature, humidity) VALUES (datetime('now', ?), ?, ?)`,
        [`-${hours_ago} hours`, 20 + i, 50 + i]
    );
}


function ensureSenderTable(senderId) {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS sender_${senderId} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperature REAL,
                humidity REAL,
                gasval INTEGER,
                time TEXT,
                hour INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_json TEXT
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


server.post('/api/weather', async (req, res) => {
    const { temperature, humidity, gasval, time, hour, name } = req.body;
    const senderId = name;

    //if (!senderId || !senderId.match(/^H\d{3}$/)) {
    //   return res.status(400).json({ error: 'Invalid sender name format' });
    //}

    try {
        await ensureSenderTable(senderId);

        const dataJson = JSON.stringify(req.body);

        db.run(
            `INSERT INTO sender_${senderId} ( temperature, humidity, gasval, time, hour, data_json) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [temperature, humidity, gasval, time, hour, dataJson],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({
                    status: 'success',
                    sender: senderId,
                    id: this.lastID
                });
            }
        );
    } catch (err) {
        console.error('Error processing data:', err);
        res.status(500).json({ error: err.message });
    }
});

server.post('/api/weatherbatch/', async (req, res) => {
    try {
        for(const entry of req.body){
            const { temperature, humidity, gasval, time, hour, name } = entry;
            const senderId = name;

            //if (!senderId || !senderId.match(/^H\d{3}$/)) {
            //   return res.status(400).json({ error: 'Invalid sender name format' });
            //}

            await ensureSenderTable(senderId);

            const dataJson = JSON.stringify(entry);

            db.run(
                `INSERT INTO sender_${senderId} ( temperature, humidity, gasval, time, hour, data_json) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [temperature, humidity, gasval, time, hour, dataJson],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        throw new Error();;
                        //return res.status(500).json({ error: err.message });
                    }
                }
            );
        }
    } catch (err) {
        console.error('Error processing data:', err);
        res.status(500).json({ error: err.message });
    }
    res.json({
        status: 'success',
    });
});

server.get('/names', async (req, res) => {
  const query = `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%';
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve table names' });
    }

    const tableNames = rows.map(row => row.name);
    res.json({ tables: tableNames });
  });
});

server.get('/api/weather/:name', async (req, res) => {
    const senderId = req.params.name;

    // if (!senderId || !senderId.match(/^H\d{3}$/)) {
    //     return res.status(400).json({ error: 'Invalid sender name format' });
    // }

    const tableName = `sender_${senderId}`;

    try {
        const tableExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
                [tableName],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });

        if (!tableExists) {
            return res.status(404).json({ error: `Keine Daten gefunden fuer Sender ID: ${senderId}` });
        }

        db.all(
            `
            SELECT * FROM (
                SELECT 
                    *, 
                    strftime('%Y-%m-%d %H:00:00', timestamp) as hour_group
                FROM ${tableName}
                WHERE time >= datetime('now', '-6 hours')
                ORDER BY time DESC
            )
            GROUP BY hour_group
            ORDER BY hour_group DESC
            LIMIT 5;
            `,
            [],
            (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: err.message });
                }

                res.json({ sender: senderId, count: rows.length, data: rows });
            }
        );
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ error: err.message });
    }
});



server.listen(8080,() =>
    {console.log("Server gestartet auf port 8080")}
);
