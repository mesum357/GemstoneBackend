/**
 * Test fresh login and verify session has passport data
 * This script creates a user, logs in, and checks MongoDB
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const API_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const TEST_EMAIL = `test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'testpassword123';

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

// Simple fetch using http module
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            cookies: res.headers['set-cookie'] || []
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            cookies: res.headers['set-cookie'] || []
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function checkMongoSession(sessionId) {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals';
    await mongoose.connect(mongoUrl);
    
    const db = mongoose.connection.db;
    const sessionsCollection = db.collection('sessions');
    
    const sessionDoc = await sessionsCollection.findOne({ _id: sessionId });
    
    await mongoose.connection.close();
    
    return sessionDoc;
  } catch (error) {
    log(`Error checking MongoDB: ${error.message}`, 'red');
    return null;
  }
}

async function runTest() {
  log('\n=== Fresh Login Session Test ===\n', 'cyan');
  log(`Test Email: ${TEST_EMAIL}`, 'cyan');
  log('');
  
  try {
    // Step 1: Create test user
    log('Step 1: Creating test user...', 'blue');
    const signupResponse = await makeRequest(`${API_URL}/auth/signup`, {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User'
      }
    });
    
    if (signupResponse.status === 201 || signupResponse.status === 200) {
      log('✓ User created successfully', 'green');
    } else {
      log(`✗ Signup failed: ${signupResponse.status}`, 'red');
      log(`  Response: ${JSON.stringify(signupResponse.body)}`, 'yellow');
      return;
    }
    
    // Step 2: Login
    log('\nStep 2: Logging in...', 'blue');
    log('  (Check server console for logging output)', 'yellow');
    
    const loginResponse = await makeRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });
    
    if (loginResponse.status === 200 && loginResponse.body?.success) {
      log('✓ Login successful', 'green');
      const sessionId = loginResponse.body.sessionId;
      log(`  Session ID: ${sessionId}`, 'cyan');
      
      // Check for cookie
      const cookie = loginResponse.cookies.find(c => c.startsWith('connect.sid='));
      if (cookie) {
        log(`✓ Cookie received`, 'green');
      } else {
        log('⚠ No cookie in response', 'yellow');
      }
      
      // Step 3: Wait for session to be saved
      log('\nStep 3: Waiting for session to be saved to MongoDB...', 'blue');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Check MongoDB
      log('\nStep 4: Checking MongoDB for session...', 'blue');
      const sessionDoc = await checkMongoSession(sessionId);
      
      if (sessionDoc) {
        log('✓ Session found in MongoDB!', 'green');
        log(`  Session ID: ${sessionDoc._id}`, 'cyan');
        
        if (sessionDoc.session) {
          let sessionData = sessionDoc.session;
          
          // Handle string format
          if (typeof sessionData === 'string') {
            log(`  ⚠ Session data is stored as STRING`, 'yellow');
            try {
              sessionData = JSON.parse(sessionData);
            } catch (e) {
              log(`  ✗ Cannot parse session: ${e.message}`, 'red');
            }
          }
          
          if (typeof sessionData === 'object' && !Array.isArray(sessionData)) {
            log(`  Session keys: ${Object.keys(sessionData).join(', ')}`, 'cyan');
            
            if (sessionData.passport) {
              log(`  ✅ PASSPORT DATA FOUND!`, 'green');
              log(`  Passport: ${JSON.stringify(sessionData.passport)}`, 'green');
              
              if (sessionData.passport.user) {
                log(`  ✅ User ID in passport: ${sessionData.passport.user}`, 'green');
                log(`\n🎉 SUCCESS: Session has passport data!`, 'green');
                log(`   Authentication should persist correctly.`, 'green');
              } else {
                log(`  ✗ No user ID in passport!`, 'red');
              }
            } else {
              log(`  ❌ NO PASSPORT DATA!`, 'red');
              log(`  This session will NOT persist authentication.`, 'yellow');
            }
            
            if (sessionData.userId) {
              log(`  ✓ User ID: ${sessionData.userId}`, 'green');
            }
          } else {
            log(`  ⚠ Session data format is invalid (type: ${typeof sessionData})`, 'red');
          }
        } else {
          log(`  ✗ No session data!`, 'red');
        }
      } else {
        log('✗ Session NOT found in MongoDB!', 'red');
        log('  The session may not have been saved yet.', 'yellow');
      }
      
      log('\n=== Test Complete ===\n', 'cyan');
      log('Check the server console logs for:', 'yellow');
      log('  - [passport] serializeUser user: <userId>', 'yellow');
      log('  - [Login Route] after req.login req.session: {...}', 'yellow');
      log('  - [SanitizedMongoStore] Saving session ... session.passport: {...}', 'yellow');
      log('');
      
    } else {
      log(`✗ Login failed: ${loginResponse.status}`, 'red');
      log(`  Response: ${JSON.stringify(loginResponse.body)}`, 'yellow');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('\n✗ Cannot connect to backend server!', 'red');
      log('  Make sure the server is running:', 'yellow');
      log('    cd Backend', 'yellow');
      log('    npm start\n', 'yellow');
    } else {
      log(`\n✗ Test error: ${error.message}`, 'red');
      if (error.stack) {
        log(error.stack.substring(0, 300), 'yellow');
      }
    }
  }
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });

