const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ============================================================================
// Database Connection & Initialization
// ============================================================================

const dbPath = path.join(__dirname, '..', 'weather.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

/**
 * Initialize database with schema
 */
async function initializeDatabase() {
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon but be careful with triggers
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    schema.split('\n').forEach(line => {
      currentStatement += line + '\n';
      
      // Check if we're entering a trigger
      if (line.trim().toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
      }
      
      // Check if we're ending a trigger
      if (inTrigger && line.trim().toUpperCase() === 'END;') {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inTrigger = false;
      } 
      // Regular statement ending
      else if (!inTrigger && line.trim().endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    });
    
    // Execute statements sequentially (wait for each one)
    let executed = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement && statement.length > 10 && !statement.startsWith('--')) {
        try {
          await new Promise((resolve, reject) => {
            db.run(statement, (err) => {
              if (err) {
                // Ignore "already exists" errors
                if (err.message.includes('already exists')) {
                  resolve();
                } else {
                  reject(err);
                }
              } else {
                executed++;
                resolve();
              }
            });
          });
        } catch (err) {
          console.error(`❌ Error executing statement ${i + 1}:`, err.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log(`✅ Database schema initialized (${executed}/${statements.length} statements executed)`);
    
  } catch (err) {
    console.error('❌ Error reading schema file:', err);
  }
}

module.exports = db;