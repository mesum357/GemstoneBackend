/**
 * Check MongoDB for sessions
 * This script connects to MongoDB and checks if sessions are being saved
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkSessions() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals';
    log(`\nConnecting to MongoDB: ${mongoUrl.replace(/\/\/.*@/, '//***@')}`, 'cyan');
    
    await mongoose.connect(mongoUrl);
    log('✓ Connected to MongoDB\n', 'green');
    
    const db = mongoose.connection.db;
    
    // Check sessions collection
    log('Checking sessions collection...', 'blue');
    const sessionsCollection = db.collection('sessions');
    const sessionCount = await sessionsCollection.countDocuments();
    log(`Total sessions in database: ${sessionCount}`, 'cyan');
    
    if (sessionCount > 0) {
      // Get the most recent sessions
      const recentSessions = await sessionsCollection
        .find({})
        .sort({ expires: -1 })
        .limit(5)
        .toArray();
      
      log(`\nRecent sessions (last 5):`, 'blue');
      recentSessions.forEach((session, index) => {
        log(`\nSession ${index + 1}:`, 'cyan');
        log(`  ID: ${session._id}`, 'cyan');
        log(`  Expires: ${session.expires}`, 'cyan');
        
        if (session.session) {
          // Check if session is an array (corrupted) or object
          if (Array.isArray(session.session)) {
            log(`  ⚠ Session data is an ARRAY (corrupted format)!`, 'red');
            log(`  Array length: ${session.session.length}`, 'yellow');
            // Try to find passport in array
            const passportIndex = session.session.findIndex(item => 
              item && typeof item === 'object' && item.passport
            );
            if (passportIndex >= 0) {
              log(`  Found passport at index ${passportIndex}`, 'yellow');
            }
          } else if (typeof session.session === 'object') {
            log(`  Session data keys: ${Object.keys(session.session).join(', ')}`, 'cyan');
            
            if (session.session.passport) {
              log(`  ✓ Passport data: ${JSON.stringify(session.session.passport)}`, 'green');
            } else {
              log(`  ✗ No passport data!`, 'red');
            }
            
            if (session.session.userId) {
              log(`  ✓ User ID: ${session.session.userId}`, 'green');
            }
            
            if (session.session.userEmail) {
              log(`  ✓ User Email: ${session.session.userEmail}`, 'green');
            }
          } else {
            log(`  ⚠ Session data is not an object or array! Type: ${typeof session.session}`, 'red');
          }
        } else {
          log(`  ✗ No session data!`, 'red');
        }
      });
      
      // Check for sessions with passport data
      const sessionsWithPassport = await sessionsCollection
        .countDocuments({ 'session.passport': { $exists: true } });
      
      log(`\nSessions with passport data: ${sessionsWithPassport}/${sessionCount}`, 
          sessionsWithPassport > 0 ? 'green' : 'yellow');
      
      // Check for sessions without passport data
      const sessionsWithoutPassport = await sessionsCollection
        .countDocuments({ 'session.passport': { $exists: false } });
      
      if (sessionsWithoutPassport > 0) {
        log(`Sessions WITHOUT passport data: ${sessionsWithoutPassport}`, 'red');
        log('  ⚠ These sessions may not persist authentication!', 'yellow');
      }
      
    } else {
      log('\n⚠ No sessions found in database', 'yellow');
      log('  This could mean:', 'yellow');
      log('    1. No one has logged in yet', 'yellow');
      log('    2. Sessions are not being saved', 'yellow');
      log('    3. Sessions expired and were cleaned up', 'yellow');
    }
    
    // Check admin_sessions collection
    log('\n\nChecking admin_sessions collection...', 'blue');
    const adminSessionsCollection = db.collection('admin_sessions');
    const adminSessionCount = await adminSessionsCollection.countDocuments();
    log(`Total admin sessions: ${adminSessionCount}`, 'cyan');
    
    await mongoose.connection.close();
    log('\n✓ Disconnected from MongoDB', 'green');
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    if (error.stack) {
      log(error.stack.substring(0, 300), 'yellow');
    }
    process.exit(1);
  }
}

checkSessions()
  .then(() => {
    log('\n=== Check Complete ===\n', 'cyan');
    process.exit(0);
  })
  .catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });

