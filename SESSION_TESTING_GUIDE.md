# Session Persistence Testing Guide

## Summary of Changes Made

We've implemented comprehensive fixes to ensure session persistence:

1. **Login Route** (`routes/auth.routes.js`):
   - Added logging before and after `req.login()`
   - Ensured `req.session.save()` is called in the `req.login()` callback
   - Added logging in `session.save()` callback to verify session was saved

2. **Passport Serialization** (`config/passport.config.js`):
   - Added logging to `serializeUser` to confirm it runs and returns user ID

3. **Session Store** (`middleware/sanitizedMongoStore.js`):
   - Enhanced logging to show full `session.passport` object when saving
   - Logs what the store receives to verify passport data is present

4. **Session Middleware** (`middleware/session.middleware.js`):
   - Set `touchAfter: 0` for immediate persistence (disabled lazy updates for debugging)

5. **Signup Controller** (`controllers/auth.controller.js`):
   - Updated to follow same pattern with `req.session.save()`

## How to Test Session Persistence

### Step 1: Restart the Server

Make sure the server is running with the new code:

```bash
cd Backend
npm start
# or
npm run dev
```

### Step 2: Perform a Fresh Login

Use your frontend or make a login request. Watch the server console for these logs in order:

1. `[passport] serializeUser user: <userId>` - Confirms serializeUser ran
2. `[Login Route] before req.login session: {...}` - Session state before login
3. `[Login Route] after req.login req.session: {...}` - Should show `passport: {"user": "<userId>"}`
4. `[SanitizedMongoStore] Saving session id: ... session.passport: {"user":"<userId>"}` - Confirms store receives passport data
5. `[Login Route] session saved - session id: ...` - Confirms save completed
6. `[Login Route] session.save callback session: {...}` - Final verification

### Step 3: Check MongoDB

Run the MongoDB check script:

```bash
cd Backend
node check-sessions-mongo.js
```

This will show:
- Total sessions in database
- How many have passport data
- Recent sessions with their passport status

### Step 4: Check a Specific Session

If you have a session ID from the login response, check it specifically:

```bash
cd Backend
node check-specific-session.js <sessionId>
```

This will show detailed information about that specific session, including whether it has passport data.

## Expected Results

### ✅ Success Indicators:

1. **Server Logs**: All 6 log messages appear in order
2. **MongoDB Check**: New sessions show `passport: {"user": "<userId>"}`
3. **Session Persistence**: Subsequent requests with the session cookie authenticate correctly

### ❌ Failure Indicators:

1. **Missing serializeUser log**: Passport serialization isn't running
2. **No passport data after req.login**: `req.login()` callback isn't setting passport data
3. **No passport data in MongoDB**: Session isn't being saved with passport data
4. **Session data is a string**: Serialization format issue

## Current MongoDB Status

From our last check:
- **Total sessions**: 702
- **Sessions with passport data**: 29 (4%)
- **Sessions missing passport data**: 673 (96%)

This indicates the problem existed before our fixes. After implementing the fixes and performing fresh logins, new sessions should have passport data.

## Manual Testing Steps

1. **Clear old sessions** (optional):
   ```javascript
   // In MongoDB shell or Compass
   db.sessions.deleteMany({})
   ```

2. **Perform a login** through your frontend or API

3. **Check server logs** for the expected log sequence

4. **Verify in MongoDB**:
   ```javascript
   // Find the most recent session
   db.sessions.findOne({}, {sort: {expires: -1}})
   
   // Check if it has passport data
   db.sessions.findOne({_id: "<sessionId>"})
   ```

5. **Test session persistence**:
   - Make a request to `/api/auth/status` with the session cookie
   - Should return `authenticated: true` and user data

## Troubleshooting

### If passport data is still missing:

1. **Check server logs** - Look for errors in the login route
2. **Verify serializeUser is called** - Should see `[passport] serializeUser user: <id>`
3. **Check session.save() is called** - Should see `[Login Route] session saved`
4. **Verify MongoDB connection** - Check if sessions are being saved at all
5. **Check session middleware order** - Must be before passport middleware

### If sessions aren't being saved:

1. **Check MongoDB connection** - Verify `MONGODB_URI` is correct
2. **Check session store** - Verify `createSanitizedMongoStore` is working
3. **Check for errors** - Look for MongoDB connection errors in server logs

## Files Modified

- `Backend/routes/auth.routes.js` - Login route with proper session saving
- `Backend/config/passport.config.js` - Added serializeUser logging
- `Backend/middleware/sanitizedMongoStore.js` - Enhanced session save logging
- `Backend/middleware/session.middleware.js` - Disabled touchAfter for debugging
- `Backend/controllers/auth.controller.js` - Updated signup to follow same pattern

## Test Scripts Created

- `check-sessions-mongo.js` - Check all sessions in MongoDB
- `check-specific-session.js` - Check a specific session by ID
- `test-fresh-login.js` - Automated test (may have connection issues)


