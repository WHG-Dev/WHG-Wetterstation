const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

app.get('/', (req, res) => {
  res.send('Hello HTTPS');
});

https.createServer(options, app).listen(443,'localhost', () => {
  console.log('HTTPS Server läuft auf Port 443');
});
