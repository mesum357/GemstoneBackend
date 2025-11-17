/**
 * Sanitized MongoStore Wrapper
 * Wraps MongoStore to sanitize corrupted sessions before they reach express-session
 */

import MongoStore from 'connect-mongo';

/**
 * Create a sanitized MongoStore that fixes corrupted sessions
 */
export const createSanitizedMongoStore = (options) => {
  // Create the underlying MongoStore
  const store = MongoStore.create(options);
  
  // Store reference to original get method
  const originalGet = store.get.bind(store);
  
  // Override get method to sanitize sessions and add logging
  store.get = function(sessionId, callback) {
    console.log('[SanitizedMongoStore] Loading session:', sessionId.substring(0, 20) + '...');
    originalGet(sessionId, (err, session) => {
      if (err) {
        console.error('[SanitizedMongoStore] Error loading session:', err.message);
        return callback(err);
      }
      
      if (!session) {
        console.log('[SanitizedMongoStore] Session not found in MongoDB:', sessionId.substring(0, 20) + '...');
        return callback(null, null);
      }
      
      // If session exists but is corrupted (missing cookie object), delete it
      if (session && (!session.cookie || typeof session.cookie !== 'object' || !session.cookie.expires)) {
        console.warn('[SanitizedMongoStore] Detected corrupted session (missing/invalid cookie object):', sessionId.substring(0, 10) + '...');
        
        // Delete the corrupted session
        store.destroy(sessionId, (destroyErr) => {
          if (destroyErr) {
            console.error('[SanitizedMongoStore] Error deleting corrupted session:', destroyErr);
          } else {
            console.log('[SanitizedMongoStore] Deleted corrupted session:', sessionId.substring(0, 10) + '...');
          }
          
          // Return null (no session) instead of corrupted session
          // express-session will create a new session
          return callback(null, null);
        });
        return;
      }
      
      // Session is valid, return it as-is
      console.log('[SanitizedMongoStore] ✅ Session loaded successfully:', sessionId.substring(0, 20) + '...', 'User:', session.passport?.user || session.userId || 'none');
      callback(null, session);
    });
  };
  
  // Override set method to log session saves
  const originalSet = store.set.bind(store);
  store.set = function(sessionId, session, callback) {
    // Log the entire session.passport object to see what the store receives
    console.log('[SanitizedMongoStore] Saving session id:', sessionId.substring(0, 20) + '...', 'session.passport:', session && session.passport ? JSON.stringify(session.passport) : 'undefined');
    console.log('[SanitizedMongoStore] Saving session:', sessionId.substring(0, 20) + '...', 'User:', session.passport?.user || session.userId || 'none');
    originalSet(sessionId, session, (err) => {
      if (err) {
        console.error('[SanitizedMongoStore] Error saving session:', err.message);
      } else {
        console.log('[SanitizedMongoStore] ✅ Session saved successfully:', sessionId.substring(0, 20) + '...');
      }
      if (callback) callback(err);
    });
  };
  
  return store;
};

