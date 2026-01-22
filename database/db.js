const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ============================================================================
// Database Connection & Initialization
// ============================================================================

const dbPath = path.join(__dirname, '..', 'weather.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const indexesPath = path.join(__dirname, 'indexes.sql');

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
 * Execute SQL file
 */
async function executeSqlFile(filePath, description) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon but be careful with triggers
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    sql.split('\n').forEach(line => {
      // Skip comment-only lines
      if (line.trim().startsWith('--')) {
        return;
      }
      
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
          console.error(`❌ Error in ${description} statement ${i + 1}:`, err.message);
          // Don't throw - continue with other statements
        }
      }
    }
    
    console.log(`✅ ${description} completed (${executed} statements)`);
    
  } catch (err) {
    console.error(`❌ Error reading ${description} file:`, err);
    throw err;
  }
}

/**
 * Initialize database with schema and indexes
 */
async function initializeDatabase() {
  try {
    // Step 1: Create tables (schema.sql)
    await executeSqlFile(schemaPath, 'Schema');
    
    // Step 2: Create indexes (indexes.sql)
    if (fs.existsSync(indexesPath)) {
      await executeSqlFile(indexesPath, 'Indexes');
    }
    
    console.log('✅ Database initialization complete\n');
    
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
  }
}

module.exports = db;