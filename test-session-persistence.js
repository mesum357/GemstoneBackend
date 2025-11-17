/**
 * Session Persistence Test Script
 * Tests if sessions persist across multiple requests
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'massux357@gmail.com'; // Update with actual test user
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password'; // Update with actual password

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

log(`Using API URL: ${API_URL}`, 'cyan');
log(`Using test email: ${TEST_EMAIL}`, 'cyan');
log('Note: Set TEST_EMAIL and TEST_PASSWORD environment variables to use different credentials\n', 'yellow');

// Helper to make HTTP/HTTPS requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = client.request(requestOptions, (res) => {
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
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Extract cookie value from Set-Cookie header
function extractCookie(cookies, cookieName) {
  if (!cookies || cookies.length === 0) return null;
  
  for (const cookie of cookies) {
    if (cookie.startsWith(cookieName + '=')) {
      // Extract the full cookie value (everything after '=' until first ';')
      const cookieValue = cookie.split(';')[0].substring(cookieName.length + 1);
      // Return the full cookie string with name (for sending back)
      return cookie.split(';')[0];
    }
  }
  
  return null;
}

// Check if server is available
async function checkServerAvailability() {
  try {
    // Just try to connect - any response means server is up
    const response = await makeRequest(`${API_URL}/auth/status`, {
      headers: {}
    });
    return true; // Got a response, server is up
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      log('\n✗ Cannot connect to backend server!', 'red');
      log(`  Make sure the server is running at ${API_URL.replace('/api', '')}`, 'yellow');
      log('  Start the server with: npm start (or node server.js)\n', 'yellow');
      return false;
    }
    // For other errors (like timeout), assume server is up and continue
    log('  Warning: Could not verify server, but continuing anyway...', 'yellow');
    return true;
  }
}

// Main test function
async function testSessionPersistence() {
  log('\n=== Session Persistence Test ===\n', 'cyan');
  
  let cookies = {};
  let sessionIds = [];
  let testResults = {
    login: { passed: false, error: null },
    cookieReceived: { passed: false, error: null },
    sessionIdExtracted: { passed: false, error: null },
    authStatus: { passed: false, error: null },
    sessionConsistency: { passed: false, error: null },
    multipleRequests: { passed: false, error: null }
  };
  
  try {
    // Test 1: Login (or signup if needed)
    log('Test 1: Attempting login...', 'blue');
    let loginResponse = await makeRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });
    
    // If login fails, try to signup first (if user doesn't exist)
    if (loginResponse.status === 401) {
      log('  Login failed, attempting to create test user...', 'yellow');
      const signupResponse = await makeRequest(`${API_URL}/auth/signup`, {
        method: 'POST',
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        }
      });
      
      if (signupResponse.status === 201 || signupResponse.status === 200) {
        log('  ✓ Test user created, attempting login again...', 'green');
        // Try login again after signup
        loginResponse = await makeRequest(`${API_URL}/auth/login`, {
          method: 'POST',
          body: {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
          }
        });
      } else if (signupResponse.body?.message?.includes('already exists')) {
        log('  User already exists, but login still failed. Please check password.', 'yellow');
        log(`  Using TEST_EMAIL and TEST_PASSWORD environment variables with correct credentials`, 'yellow');
        testResults.login.error = 'User exists but login failed - check password';
        return testResults;
      } else {
        log(`  ✗ Signup failed: ${signupResponse.status} - ${JSON.stringify(signupResponse.body)}`, 'red');
        log(`  Please provide valid credentials using TEST_EMAIL and TEST_PASSWORD environment variables`, 'yellow');
        testResults.login.error = `Signup failed: ${signupResponse.status}`;
        return testResults;
      }
    }
    
    if (loginResponse.status === 200 && loginResponse.body?.success) {
      log('✓ Login successful', 'green');
      testResults.login.passed = true;
      sessionIds.push(loginResponse.body.sessionId);
      log(`  Session ID: ${loginResponse.body.sessionId}`, 'cyan');
    } else {
      log(`✗ Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`, 'red');
      log(`  Please provide valid credentials using TEST_EMAIL and TEST_PASSWORD environment variables`, 'yellow');
      testResults.login.error = `Status: ${loginResponse.status}`;
      return testResults;
    }
    
    // Test 2: Check if cookie was received
    log('\nTest 2: Checking for session cookie...', 'blue');
    const sessionCookie = extractCookie(loginResponse.cookies, 'connect.sid');
    
    if (sessionCookie) {
      log('✓ Session cookie received', 'green');
      log(`  Cookie: ${sessionCookie.substring(0, 80)}...`, 'cyan');
      cookies['connect.sid'] = sessionCookie;
      testResults.cookieReceived.passed = true;
    } else {
      log('✗ No session cookie received!', 'red');
      log(`  Set-Cookie headers: ${JSON.stringify(loginResponse.cookies)}`, 'yellow');
      testResults.cookieReceived.error = 'No cookie in Set-Cookie header';
      // Continue testing even without cookie to see what happens
    }
    
    // Test 3: Extract session ID from cookie if available
    if (sessionCookie) {
      log('\nTest 3: Extracting session ID from cookie...', 'blue');
      // express-session cookies are signed: s:sessionId.signature
      // They may be URL-encoded: s%3AsessionId.signature
      const cookieValue = sessionCookie.split('=')[1];
      
      // Try to decode if URL-encoded
      let decodedValue;
      try {
        decodedValue = decodeURIComponent(cookieValue);
      } catch {
        decodedValue = cookieValue;
      }
      
      // Extract session ID from signed cookie format (s:sessionId.signature)
      const sessionIdMatch = decodedValue.match(/^s:([^.]+)/);
      if (sessionIdMatch) {
        const extractedSessionId = sessionIdMatch[1];
        log(`✓ Session ID extracted from cookie: ${extractedSessionId.substring(0, 20)}...`, 'green');
        sessionIds.push(extractedSessionId);
        testResults.sessionIdExtracted.passed = true;
      } else {
        // Cookie might already be just the session ID (unsigned)
        log(`⚠ Cookie format: ${decodedValue.substring(0, 50)}...`, 'yellow');
        log('  Note: Cookie might be unsigned or in different format', 'yellow');
        testResults.sessionIdExtracted.error = 'Cookie format unexpected';
      }
    }
    
    // Test 4: Check auth status with cookie
    log('\nTest 4: Checking auth status with cookie...', 'blue');
    const authStatusResponse = await makeRequest(`${API_URL}/auth/status`, {
      method: 'GET',
      headers: {
        Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      }
    });
    
    if (authStatusResponse.status === 200) {
      log('✓ Auth status check successful', 'green');
      if (authStatusResponse.body?.user) {
        log(`  User: ${authStatusResponse.body.user.email}`, 'cyan');
        testResults.authStatus.passed = true;
      } else {
        log('⚠ User not authenticated in status check', 'yellow');
        testResults.authStatus.error = 'User not found in response';
      }
      
      // Extract session ID from response if available
      if (authStatusResponse.body?.sessionId) {
        sessionIds.push(authStatusResponse.body.sessionId);
      }
    } else {
      log(`✗ Auth status check failed: ${authStatusResponse.status}`, 'red');
      testResults.authStatus.error = `Status: ${authStatusResponse.status}`;
    }
    
    // Test 5: Check session consistency across multiple requests
    log('\nTest 5: Testing session consistency across multiple requests...', 'blue');
    const consistencyRequests = [];
    
    for (let i = 0; i < 5; i++) {
      const req = makeRequest(`${API_URL}/auth/status`, {
        method: 'GET',
        headers: {
          Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
        }
      });
      consistencyRequests.push(req);
    }
    
    const consistencyResponses = await Promise.all(consistencyRequests);
    const consistencySessionIds = consistencyResponses
      .map(r => r.body?.sessionId)
      .filter(id => id);
    
    if (consistencySessionIds.length > 0) {
      const uniqueSessionIds = new Set(consistencySessionIds);
      
      if (uniqueSessionIds.size === 1) {
        log('✓ All requests returned the same session ID', 'green');
        log(`  Session ID: ${Array.from(uniqueSessionIds)[0].substring(0, 20)}...`, 'cyan');
        testResults.sessionConsistency.passed = true;
        sessionIds.push(...consistencySessionIds);
      } else {
        log(`✗ Different session IDs detected: ${uniqueSessionIds.size} unique IDs`, 'red');
        log(`  Session IDs: ${Array.from(uniqueSessionIds).map(id => id.substring(0, 20)).join(', ')}`, 'yellow');
        testResults.sessionConsistency.error = `${uniqueSessionIds.size} different session IDs`;
      }
    } else {
      log('⚠ Could not extract session IDs from consistency test', 'yellow');
      testResults.sessionConsistency.error = 'No session IDs in responses';
    }
    
    // Test 6: Test over time (with delays)
    log('\nTest 6: Testing session persistence over time...', 'blue');
    const timeTestSessionIds = [];
    
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      
      const timeResponse = await makeRequest(`${API_URL}/auth/status`, {
        method: 'GET',
        headers: {
          Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
        }
      });
      
      if (timeResponse.body?.sessionId) {
        timeTestSessionIds.push(timeResponse.body.sessionId);
      }
    }
    
    if (timeTestSessionIds.length > 0) {
      const uniqueTimeSessionIds = new Set(timeTestSessionIds);
      
      if (uniqueTimeSessionIds.size === 1) {
        log('✓ Session persisted across time-delayed requests', 'green');
        testResults.multipleRequests.passed = true;
        sessionIds.push(...timeTestSessionIds);
      } else {
        log(`✗ Session ID changed over time: ${uniqueTimeSessionIds.size} unique IDs`, 'red');
        testResults.multipleRequests.error = `${uniqueTimeSessionIds.size} different session IDs over time`;
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log(`\n✗ Cannot connect to backend server!`, 'red');
      log(`  Error: Connection refused at ${API_URL}`, 'yellow');
      log(`  Make sure the server is running:`, 'yellow');
      log(`    cd Backend`, 'yellow');
      log(`    npm start`, 'yellow');
      log(`  Or check if it's running on a different port\n`, 'yellow');
    } else {
      log(`\n✗ Test error: ${error.message}`, 'red');
      if (error.code) {
        log(`  Error code: ${error.code}`, 'yellow');
      }
      if (error.stack) {
        log(error.stack.substring(0, 200), 'yellow');
      }
    }
  }
  
  // Summary
  log('\n=== Test Summary ===\n', 'cyan');
  
  const allTests = Object.keys(testResults);
  const passedTests = allTests.filter(test => testResults[test].passed);
  const failedTests = allTests.filter(test => !testResults[test].passed);
  
  allTests.forEach(test => {
    const result = testResults[test];
    if (result.passed) {
      log(`✓ ${test}: PASSED`, 'green');
    } else {
      log(`✗ ${test}: FAILED`, 'red');
      if (result.error) {
        log(`  Error: ${result.error}`, 'yellow');
      }
    }
  });
  
  log(`\nPassed: ${passedTests.length}/${allTests.length}`, passedTests.length === allTests.length ? 'green' : 'yellow');
  
  // Check if all session IDs are the same
  const uniqueSessionIds = new Set(sessionIds.filter(id => id));
  log(`\nUnique Session IDs detected: ${uniqueSessionIds.size}`, uniqueSessionIds.size === 1 ? 'green' : 'red');
  
  if (uniqueSessionIds.size === 1) {
    log('✓ Session is PERSISTENT!', 'green');
  } else if (uniqueSessionIds.size > 1) {
    log('✗ Session is NOT persistent - different session IDs detected', 'red');
    log(`Session IDs: ${Array.from(uniqueSessionIds).map(id => id.substring(0, 30)).join(', ')}`, 'yellow');
  } else {
    log('⚠ Could not determine session persistence - no session IDs collected', 'yellow');
  }
  
  log('\n');
  
  return {
    testResults,
    sessionIds: Array.from(uniqueSessionIds),
    isPersistent: uniqueSessionIds.size === 1 && passedTests.length === allTests.length
  };
}

// Run the test
testSessionPersistence()
  .then((result) => {
    process.exit(result.isPersistent ? 0 : 1);
  })
  .catch((error) => {
    log(`\n✗ Test script error: ${error.message}`, 'red');
    process.exit(1);
  });

