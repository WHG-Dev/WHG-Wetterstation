const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    next(createError(404));
});

//Initi db
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

//API endp.
app.post('/api/weather', async (req, res) => {
    const { temperature, humidity, gasval, time, hour, name } = req.body;
    const senderId = name;

    if (!senderId || !senderId.match(/^H\d{3}$/)) {
        return res.status(400).json({ error: 'Invalid sender name format' });
    }

    try {
        await ensureSenderTable(senderId);

        const dataJson = JSON.stringify(req.body);

        db.run(
            `INSERT INTO sender_${senderId} (temperature, humidity, gasval, time, hour, data_json) 
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

app.get('/', (req, res) => {
    res.render('index.html');
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
