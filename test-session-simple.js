/**
 * Simple Session Persistence Test
 * Tests login and verifies session is saved to MongoDB
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const API_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const TEST_EMAIL = `test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'testpassword123';

// Color codes for terminal output
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

// Helper to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: port,
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
    
    req.on('error', (error) => {
      log(`Request error: ${error.message}`, 'red');
      if (error.code === 'ECONNREFUSED') {
        log(`  Connection refused to ${urlObj.hostname}:${port}`, 'yellow');
        log(`  Make sure the server is running on port ${port}`, 'yellow');
      }
      reject(error);
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Check MongoDB for session
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
  log('\n=== Simple Session Persistence Test ===\n', 'cyan');
  
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
    
    if (signupResponse.status !== 201 && signupResponse.status !== 200) {
      log(`✗ Signup failed: ${signupResponse.status} - ${JSON.stringify(signupResponse.body)}`, 'red');
      return;
    }
    log(`✓ User created: ${TEST_EMAIL}`, 'green');
    
    // Step 2: Login
    log('\nStep 2: Logging in...', 'blue');
    const loginResponse = await makeRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });
    
    if (loginResponse.status !== 200 || !loginResponse.body?.success) {
      log(`✗ Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`, 'red');
      return;
    }
    
    log('✓ Login successful', 'green');
    const sessionId = loginResponse.body.sessionId;
    log(`  Session ID: ${sessionId}`, 'cyan');
    
    // Check for cookie
    const cookie = loginResponse.cookies.find(c => c.startsWith('connect.sid='));
    if (cookie) {
      log(`✓ Cookie received: ${cookie.substring(0, 60)}...`, 'green');
    } else {
      log('⚠ No cookie in response', 'yellow');
    }
    
    // Step 3: Wait a moment for session to be saved
    log('\nStep 3: Waiting for session to be saved...', 'blue');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Check MongoDB
    log('\nStep 4: Checking MongoDB for session...', 'blue');
    const sessionDoc = await checkMongoSession(sessionId);
    
    if (sessionDoc) {
      log('✓ Session found in MongoDB!', 'green');
      log(`  Session ID: ${sessionDoc._id}`, 'cyan');
      
      if (sessionDoc.session) {
        log(`  Session data exists: ${JSON.stringify(Object.keys(sessionDoc.session))}`, 'cyan');
        
        if (sessionDoc.session.passport) {
          log(`  ✓ Passport data found: ${JSON.stringify(sessionDoc.session.passport)}`, 'green');
        } else {
          log(`  ✗ No passport data in session!`, 'red');
        }
        
        if (sessionDoc.session.userId) {
          log(`  ✓ User ID in session: ${sessionDoc.session.userId}`, 'green');
        }
      } else {
        log('  ✗ Session object is missing!', 'red');
      }
    } else {
      log('✗ Session NOT found in MongoDB!', 'red');
      log('  This means the session was not persisted.', 'yellow');
    }
    
    // Step 5: Test session persistence with cookie
    if (cookie) {
      log('\nStep 5: Testing session persistence with cookie...', 'blue');
      const cookieValue = cookie.split(';')[0];
      
      const statusResponse = await makeRequest(`${API_URL}/auth/status`, {
        method: 'GET',
        headers: {
          Cookie: cookieValue
        }
      });
      
      if (statusResponse.status === 200) {
        if (statusResponse.body?.authenticated && statusResponse.body?.user) {
          log('✓ Session is persistent! User authenticated:', 'green');
          log(`  User: ${statusResponse.body.user.email}`, 'cyan');
        } else {
          log('✗ Session not authenticated', 'red');
          log(`  Response: ${JSON.stringify(statusResponse.body)}`, 'yellow');
        }
      } else {
        log(`✗ Status check failed: ${statusResponse.status}`, 'red');
      }
    }
    
    log('\n=== Test Complete ===\n', 'cyan');
    
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

