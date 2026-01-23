# WHG-Wetterstation

Moderne Wetterstation des Werner-Heisenberg-Gymnasiums Leverkusen mit REST API und 3D-Visualisierung.

## 🌟 Features

- 📊 REST API für Wetterdaten (Temperatur, Luftfeuchtigkeit, Luftdruck)
- 🎨 Interaktive 3D-Visualisierung mit Three.js
- 🔒 Sicherheit mit Helmet.js und Rate Limiting
- 📱 Responsive Design für Desktop und Mobile
- 🗄️ SQLite Datenbank für Datenpersistenz
- ⚡ Performance-optimiert mit Compression und Caching

## 🚀 Quick Start

### Voraussetzungen

- Node.js >= 18.0.0
- npm oder yarn

### Installation

1. **Repository klonen**
   ```bash
   git clone https://github.com/WHG-Dev/WHG-Wetterstation.git
   cd WHG-Wetterstation
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Environment-Variablen einrichten**
   ```bash
   cp .env.example .env
   # .env nach Bedarf anpassen
   ```

4. **Server starten**
   ```bash
   # Production
   npm start
   
   # Development mit Auto-Reload
   npm run dev
   ```

5. **Server läuft auf:** `http://localhost:5000`

## 📖 API Dokumentation

Vollständige API-Dokumentation verfügbar unter: `http://localhost:5000/api`

### Wichtigste Endpoints

- `GET /health` - Health Check
- `GET /api/weather/senders/all` - Alle Sensoren abrufen
- `POST /api/weather` - Wetterdaten senden
- `GET /api/weather/:senderId` - Wetterdaten abrufen
- `GET /3d` - 3D-Visualisierung

## 🔧 Configuration

Konfiguration über `.env` Datei:

```env
# Server
NODE_ENV=development
PORT=5000
HOST=localhost

# HTTPS (optional)
ENABLE_HTTPS=false

# Database
DB_PATH=./database/weather.db

# Security
RATE_LIMIT_WINDOW_MS=900000    # 15 Minuten
RATE_LIMIT_MAX_REQUESTS=100    # Max Requests pro Window
```

## 🛠️ Development

### Scripts

```bash
npm start       # Server starten
npm run dev     # Development-Modus mit nodemon
npm test        # Tests ausführen
npm run lint    # Code-Linting
```

### Datenbank

Die SQLite-Datenbank wird automatisch beim ersten Start initialisiert:
- Schema-Migration
- Index-Erstellung
- Beispieldaten (optional)

## 📁 Projekt-Struktur

```
WHG-Wetterstation/
├── app.js                 # Haupt-Server-Datei
├── package.json           # Dependencies und Scripts
├── .env.example          # Environment-Template
├── database/
│   ├── db.js             # Datenbankverbindung
│   ├── queries.js        # SQL-Queries
│   └── weather.db        # SQLite-Datenbank
├── routes/
│   └── weather.js        # API-Routes
├── public/
│   └── 3d-visualization.html  # 3D-Visualisierung
└── website/              # Frontend-Dateien
```

## 🔒 Sicherheit

- ✅ Helmet.js für Security-Headers
- ✅ Rate Limiting gegen DDoS
- ✅ Input-Validierung
- ✅ CORS-Konfiguration
- ✅ Graceful Shutdown

## 🌐 Browser-Support

- Chrome (empfohlen)
- Firefox
- Safari
- Edge

## 📝 License

MIT License - siehe [LICENSE](LICENSE) Datei

## 👥 Team

WHG-Dev Team - Werner-Heisenberg-Gymnasium Leverkusen

## 🤝 Contributing

Contributions sind willkommen! Bitte öffne ein Issue oder Pull Request.

## 📞 Support

Bei Fragen oder Problemen bitte ein Issue auf GitHub öffnen.

