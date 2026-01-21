const db = require('../database/db');
const { ensureSenderTable, runQuery } = require('../database/queries');

// ============================================================================
// Test Data Insertion Script
// ============================================================================

/**
 * Inserts test data into the database
 * Run this script with: node scripts/insertTestData.js
 */
async function insertTestData() {
  try {
    console.log('🔄 Dropping existing test table...');
    await runQuery('DROP TABLE IF EXISTS sender_1');
    
    console.log('🔄 Creating sender_1 table...');
    await ensureSenderTable(1);
    
    console.log('🔄 Inserting test data...');
    const promises = [];
    
    for (let i = 0; i <= 6; i++) {
      const currentUnixTime = Math.floor(Date.now() / 1000);
      const timestamp = currentUnixTime - (i * 3600);
      const hour = new Date(timestamp * 1000).getHours();
      const temperature = (Math.random() * 15 + 10).toFixed(2);
      const humidity = (Math.random() * 50 + 30).toFixed(2);
      const gasval = Math.floor(Math.random() * 50 + 950);
      const name = 'Schulgarten';
      const data_json = JSON.stringify({ test: '6767', iteration: i });
      
      promises.push(
        runQuery(
          `INSERT INTO sender_1 (temperature, humidity, gasval, unix, hour, name, data_json) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [temperature, humidity, gasval, timestamp, hour, name, data_json]
        )
      );
    }
    
    await Promise.all(promises);
    console.log('✅ Test data inserted successfully!');
    console.log(`   - ${promises.length} entries created`);
    console.log('   - Sender: Schulgarten (ID: 1)');
    
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
  insertTestData();
}

module.exports = insertTestData;