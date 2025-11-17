/**
 * Check a specific session in MongoDB
 * Usage: node check-specific-session.js <sessionId>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node check-specific-session.js <sessionId>');
  process.exit(1);
}

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

async function checkSession() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals';
    log(`\nConnecting to MongoDB...`, 'cyan');
    
    await mongoose.connect(mongoUrl);
    log('✓ Connected to MongoDB\n', 'green');
    
    const db = mongoose.connection.db;
    const sessionsCollection = db.collection('sessions');
    
    log(`Looking for session: ${sessionId}`, 'blue');
    const sessionDoc = await sessionsCollection.findOne({ _id: sessionId });
    
    if (!sessionDoc) {
      log(`\n✗ Session not found!`, 'red');
      log('  The session may not have been saved yet, or it may have expired.', 'yellow');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    log(`\n✓ Session found!`, 'green');
    log(`  ID: ${sessionDoc._id}`, 'cyan');
    log(`  Expires: ${sessionDoc.expires}`, 'cyan');
    
    if (sessionDoc.session) {
      // Handle different session formats
      let sessionData = sessionDoc.session;
      
      // If it's a string, try to parse it
      if (typeof sessionData === 'string') {
        log(`  ⚠ Session data is stored as STRING (should be object)`, 'yellow');
        try {
          sessionData = JSON.parse(sessionData);
        } catch (e) {
          log(`  ✗ Cannot parse session string: ${e.message}`, 'red');
          await mongoose.connection.close();
          process.exit(1);
        }
      }
      
      if (Array.isArray(sessionData)) {
        log(`  ⚠ Session data is an ARRAY (corrupted format)!`, 'red');
        log(`  Array length: ${sessionData.length}`, 'yellow');
      } else if (typeof sessionData === 'object') {
        log(`  Session data keys: ${Object.keys(sessionData).join(', ')}`, 'cyan');
        
        if (sessionData.passport) {
          log(`  ✓ PASSPORT DATA FOUND!`, 'green');
          log(`  Passport: ${JSON.stringify(sessionData.passport)}`, 'green');
          
          if (sessionData.passport.user) {
            log(`  ✓ User ID in passport: ${sessionData.passport.user}`, 'green');
          } else {
            log(`  ✗ No user ID in passport!`, 'red');
          }
        } else {
          log(`  ✗ NO PASSPORT DATA!`, 'red');
          log(`  This session will NOT persist authentication.`, 'yellow');
        }
        
        if (sessionData.userId) {
          log(`  ✓ User ID: ${sessionData.userId}`, 'green');
        }
        
        if (sessionData.userEmail) {
          log(`  ✓ User Email: ${sessionData.userEmail}`, 'green');
        }
        
        if (sessionData.cookie) {
          log(`  ✓ Cookie data exists`, 'green');
        }
      } else {
        log(`  ⚠ Session data type: ${typeof sessionData}`, 'yellow');
      }
    } else {
      log(`  ✗ No session data!`, 'red');
    }
    
    await mongoose.connection.close();
    log('\n✓ Disconnected from MongoDB', 'green');
    
    // Final verdict
    if (sessionDoc.session && 
        (typeof sessionDoc.session === 'object' || typeof sessionDoc.session === 'string')) {
      let sessionData = sessionDoc.session;
      if (typeof sessionData === 'string') {
        try {
          sessionData = JSON.parse(sessionData);
        } catch {}
      }
      
      if (sessionData && sessionData.passport && sessionData.passport.user) {
        log('\n✅ SUCCESS: Session has passport data and should persist authentication!', 'green');
        process.exit(0);
      } else {
        log('\n❌ FAILURE: Session is missing passport data!', 'red');
        process.exit(1);
      }
    } else {
      log('\n❌ FAILURE: Session data format is invalid!', 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    if (error.stack) {
      log(error.stack.substring(0, 300), 'yellow');
    }
    process.exit(1);
  }
}

checkSession();


