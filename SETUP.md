# Setup Instructions

## Environment Variables

Create a `.env` file in the Backend directory with the following content:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/vitalgeonaturals
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vitalgeonaturals

# Session Secret (generate a random string for production)
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# JWT Secret (generate a random string for production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Configuration
FRONTEND_URL=http://localhost:8080
ADMIN_URL=http://localhost:8080
```

## Installation Steps

1. Navigate to the Backend directory:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with the configuration above

4. Make sure MongoDB is running (local or Atlas)

5. Start the server:
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

