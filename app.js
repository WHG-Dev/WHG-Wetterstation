
const createError = require('http-errors');
const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const e = require("express");
const server = express();
const http = require('http');
const https = require('https');
const fs = require('fs');
const compr = require('compression');

var domain = '87.106.45.28';

server.use(compr());
server.use(cors());
server.use(bodyParser.json());
server.use(logger('dev'));
server.use(cookieParser());
server.use(express.urlencoded({ extended: false }));
server.use(express.static("./website/dist/"));


const db = new sqlite3.Database('./weather.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to the SQLite database.');
    }
});


function ensureSenderTable(senderId) {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS sender_${senderId}
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                temperature
                REAL,
                humidity
                REAL,
                bar
                INTEGER,
                unix
                BIGINT,
                hour
                INTEGER,
                timestamp
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP,
                name
                TEXT,
                data_json
                TEXT
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function insertTestData() {
    await db.run('DROP TABLE IF EXISTS sender_1');
    await ensureSenderTable(1);
    for (let i = 0; i <= 6; i++) {
        const hours_ago = i;
        let currentUnixTime = Math.floor(Date.now() / 1000);
        let timestamp = currentUnixTime - (i * 3600);
        let hour = new Date(timestamp * 1000).getHours();
        let temperature = (Math.random() * 15 + 10).toFixed(2);
        let humidity = (Math.random() * 50 + 30).toFixed(2);
        let bar = Math.floor(Math.random() * 50 + 950);
        let name = 'test_entry';
        let data_json = JSON.stringify({ test: '6767' })
        await db.run(
            `INSERT INTO sender_1 (temperature, humidity, bar, unix, hour, name, data_json) VALUES (?,?,?,?,?,?,?)`,
            [temperature, humidity, bar, timestamp, hour, name, data_json]
        )
    }
    
}

insertTestData();

function getSenderName(table) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT *
                FROM ${table}
                ORDER BY id DESC`, [], (err, row) => {
            if (err) {
                reject(err);
            } else resolve(row.name);
        });
    });
}

server.post('/api/weather', async (req, res) => {
    const { id, temperature, humidity, gasval, time, hour, name } = req.body;
    const senderId = id;

    //if (!senderId || !senderId.match(/^H\d{3}$/)) {
    //   return res.status(400).json({ error: 'Invalid sender name format' });
    //}

    try {
        await ensureSenderTable(senderId);

        const dataJson = JSON.stringify(req.body);

        db.run(
            `INSERT INTO sender_${senderId} (temperature, humidity, gasval, time, hour, data_json,name)
             VALUES (?, ?, ?, ?, ?, ?,?)`,
            [temperature, humidity, gasval, time, hour, dataJson, name],
            function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ status: 303, error: err.message });
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
        res.status(500).json({ status: 303, error: err.message });
    }
});

server.post('/api/weatherbatch/', async (req, res, next) => {
    try {
        for (const entry of req.body) {
            const { id, temperature, humidity, gasval, unix, hour, name } = entry;
            const senderId = id;
            if (id === -1) continue;

            //if (!senderId || !senderId.match(/^H\d{3}$/)) {
            //   return res.status(400).json({ error: 'Invalid sender name format' });
            //}

            await ensureSenderTable(senderId);

            const dataJson = JSON.stringify(entry);

            db.run(
                `INSERT INTO sender_${senderId} (temperature, humidity, gasval, unix, hour, name, data_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [temperature, humidity, gasval, unix, hour, name, dataJson],
                function (err) {
                    if (err) {
                        console.error('Database error:', err);
                        return next(createError(500, err.message));
                    }
                }
            );
        }
    } catch (err) {
        console.error('Error processing data:', err);
        return next(createError(500, err.message));
    }
    res.status(200).json({
        status: 'success',
    });
});

server.get('/names', async (req, res, next) => {
    const query = `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%';
    `;

    db.all(query, [], async (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            return next(createError(402, err.message));
        }
        let names = {};
        const tableNames = rows.map(row => row.name);
        for (const table of tableNames) {
            names[table] = await getSenderName(table);
        }
        res.status(200).json(names);

    });
});
server.get('/api/weather/current/:name', async (req, res, next) => {
    const senderId = req.params.name;

    try {
        const tableExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT name
                 FROM sqlite_master
                 WHERE type = 'table'
                   AND name = ?`,
                [senderId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });

        if (!tableExists) {
            next(createError(404, `Keine Daten gefunden fuer Sender ID: ${senderId}`));
            return;
        }

        db.get(
            `SELECT *
             FROM ${senderId}
             ORDER BY id DESC LIMIT 1`,
            (err, row) => {
                if (err) {
                    next(createError(500, 'Fehler beim Abrufen der Daten'));
                    return;
                }
                if (!row) {
                    next(createError(404, 'Keine aktuellen Daten gefunden'));
                    return;
                }
                res.status(200).json(row);
            }
        );
    } catch (error) {
        next(createError(500, 'Interner Serverfehler'));
    }
});
server.get('/api/weather/:name', async (req, res, next) => {
    const senderId = req.params.name;

    try {
        const tableExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
                [senderId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });

        if (!tableExists) {
            next(createError(404, `Keine Daten gefunden fuer Sender ID: ${senderId}`));
            return;
        }

        db.all(
            `SELECT t.*
FROM ${senderId} t
JOIN (
    SELECT strftime('%Y-%m-%d %H', unix, 'unixepoch') AS stunde,
           MIN(unix) AS min_unix
    FROM ${senderId}
    WHERE unix >= strftime('%s', 'now') - 5*3600
    GROUP BY stunde
) s ON strftime('%Y-%m-%d %H', t.unix, 'unixepoch') = s.stunde
     AND t.unix = s.min_unix
ORDER BY t.unix ASC;
`,
            [],
            (err, rows) => {
                if (err) {
                    next(createError(500, err));
                    return;
                }
                console.log('Gefundene Einträge:', rows.length);
                res.status(200).json({ data: rows });
            }
        );
    } catch (error) {
        next(createError(500, error));
    }
});
server.use((req, res, next) => {
    next(createError(404));
});

server.use((err, req, res, next) => {
    res.status(err.status || 500).send(`<h1>${err.message}</h1><h2>${err.status}</h2><pre>${err.stack}</pre>`);
});

var options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};
http.createServer(server).listen(5000, 'localhost', function () {
    console.log('HTTPS listening on port 443');
});