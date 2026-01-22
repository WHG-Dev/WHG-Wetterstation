const db = require('../database/db');
const { ensureSender, insertWeatherData, createAlert } = require('../database/queries');

// ============================================================================
// Test Data Insertion Script
// ============================================================================

/**
 * Inserts test data into the database
 * Run this script with: node scripts/insertTestData.js
 */
async function insertTestData() {
  try {
    console.log('🔄 Inserting test data...\n');
    
    // ============================================================================
    // 1. Create Test Senders
    // ============================================================================
    console.log('📍 Creating test senders...');
    
    await ensureSender('1', 'Schulgarten');
    await ensureSender('2', 'Dach Nord');
    await ensureSender('H001', 'Klassenzimmer 101');
    
    console.log('   ✅ 3 senders created\n');
    
    // ============================================================================
    // 2. Insert Weather Data for Sender 1 (Schulgarten)
    // ============================================================================
    console.log('🌡️  Inserting weather data for Schulgarten...');
    
    const promises = [];
    const now = Math.floor(Date.now() / 1000);
    
    // Last 24 hours of data (one entry per hour)
    for (let i = 0; i < 24; i++) {
      const timestamp = now - (i * 3600);
      const hour = new Date(timestamp * 1000).getHours();
      
      // Simulate realistic temperature curve (warmer during day)
      const baseTemp = 15;
      const timeOfDay = Math.sin((hour - 6) * Math.PI / 12); // Peak at 14:00
      const temperature = (baseTemp + timeOfDay * 8 + Math.random() * 2).toFixed(2);
      
      // Inverse humidity (higher at night)
      const humidity = (70 - timeOfDay * 20 + Math.random() * 10).toFixed(2);
      
      const pressure = Math.floor(1013 + Math.random() * 20 - 10);
      const battery = (95 - i * 0.5).toFixed(1); // Slowly decreasing
      
      promises.push(
        insertWeatherData('1', {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          pressure: pressure,
          battery_level: parseFloat(battery),
          unix: timestamp,
          hour: hour,
          name: 'Schulgarten'
        })
      );
    }
    
    await Promise.all(promises);
    console.log(`   ✅ ${promises.length} entries inserted\n`);
    
    // ============================================================================
    // 3. Insert Data for Sender 2 (Dach Nord)
    // ============================================================================
    console.log('🌡️  Inserting weather data for Dach Nord...');
    
    const promises2 = [];
    
    for (let i = 0; i < 24; i++) {
      const timestamp = now - (i * 3600);
      const hour = new Date(timestamp * 1000).getHours();
      
      // Roof is generally warmer during day, colder at night
      const baseTemp = 16;
      const timeOfDay = Math.sin((hour - 6) * Math.PI / 12);
      const temperature = (baseTemp + timeOfDay * 10 + Math.random() * 3).toFixed(2);
      
      const humidity = (60 - timeOfDay * 15 + Math.random() * 10).toFixed(2);
      const pressure = Math.floor(1013 + Math.random() * 15);
      
      promises2.push(
        insertWeatherData('2', {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          pressure: pressure,
          unix: timestamp,
          hour: hour,
          name: 'Dach Nord'
        })
      );
    }
    
    await Promise.all(promises2);
    console.log(`   ✅ ${promises2.length} entries inserted\n`);
    
    // ============================================================================
    // 4. Insert Data for Sender H001 (Classroom)
    // ============================================================================
    console.log('🌡️  Inserting weather data for Klassenzimmer...');
    
    const promises3 = [];
    
    for (let i = 0; i < 24; i++) {
      const timestamp = now - (i * 3600);
      const hour = new Date(timestamp * 1000).getHours();
      
      // Classroom: stable temperature, higher during school hours
      const isSchoolHours = hour >= 8 && hour <= 16;
      const baseTemp = isSchoolHours ? 22 : 20;
      const temperature = (baseTemp + Math.random() * 1).toFixed(2);
      
      // Higher humidity when students are present
      const humidity = (isSchoolHours ? 50 : 45 + Math.random() * 5).toFixed(2);
      const pressure = Math.floor(isSchoolHours ? 1015 : 1013 + Math.random() * 5);
      
      promises3.push(
        insertWeatherData('H001', {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          pressure: pressure,
          unix: timestamp,
          hour: hour,
          name: 'Klassenzimmer 101'
        })
      );
    }
    
    await Promise.all(promises3);
    console.log(`   ✅ ${promises3.length} entries inserted\n`);
    
    // ============================================================================
    // 5. Create Example Alerts
    // ============================================================================
    console.log('⚠️  Creating example alerts...');
    
    await createAlert({
      sender_id: '1',
      alert_type: 'temperature',
      condition: 'above',
      threshold_value: 30.0
    });
    
    await createAlert({
      sender_id: '1',
      alert_type: 'humidity',
      condition: 'below',
      threshold_value: 20.0
    });
    
    await createAlert({
      sender_id: '1',
      alert_type: 'battery',
      condition: 'below',
      threshold_value: 15.0
    });
    
    await createAlert({
      sender_id: 'H001',
      alert_type: 'temperature',
      condition: 'above',
      threshold_value: 26.0
    });
    
    console.log('   ✅ 4 alerts created\n');
    
    // ============================================================================
    // Summary
    // ============================================================================
    console.log('✅ Test data insertion completed!\n');
    console.log('📊 Summary:');
    console.log('   - 3 Senders created');
    console.log('   - 72 Weather data entries (24 per sender)');
    console.log('   - 4 Alerts configured');
    console.log('\n💡 Try these API calls:');
    console.log(`   curl http://localhost:5000/api/weather/current/1`);
    console.log(`   curl http://localhost:5000/api/weather/1`);
    console.log(`   curl http://localhost:5000/api/weather/senders/all`);
    console.log(`   curl http://localhost:5000/api/weather/alerts/1`);
    console.log('');
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
    
  } catch (err) {
    console.error('❌ Error inserting test data:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  // Wait for DB initialization
  setTimeout(() => {
    insertTestData();
  }, 1000);
}

module.exports = insertTestData;