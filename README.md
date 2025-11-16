# VitalGeo Naturals Backend API

Backend API for VitalGeo Naturals built with Node.js, Express, MongoDB, and Passport.js.

## Features

- ✅ User authentication (Signup/Login/Logout) using Passport.js
- ✅ MongoDB database with Mongoose ODM
- ✅ Session-based authentication
- ✅ Password hashing with bcryptjs
- ✅ Input validation with express-validator
- ✅ CORS enabled for frontend communication
- ✅ Error handling middleware

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/vitalgeonaturals
SESSION_SECRET=your-super-secret-session-key
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:8080
ADMIN_URL=http://localhost:8080
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Endpoints

### Authentication Routes

#### POST `/api/auth/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

#### POST `/api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

#### POST `/api/auth/logout`
Logout the current user.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### GET `/api/auth/me`
Get the current authenticated user.

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

#### GET `/api/auth/status`
Check authentication status.

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "_id": "...",
    "email": "user@example.com"
  }
}
```

#### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## Project Structure

```
Backend/
├── config/
│   ├── database.js          # MongoDB connection
│   └── passport.config.js   # Passport.js configuration
├── controllers/
│   └── auth.controller.js   # Authentication controllers
├── middleware/
│   └── auth.middleware.js   # Authentication middleware
├── models/
│   └── User.model.js        # User model
├── routes/
│   └── auth.routes.js       # Authentication routes
├── .env.example             # Environment variables example
├── .gitignore               # Git ignore file
├── package.json             # Dependencies
├── README.md                # This file
└── server.js                # Main server file
```

## Security Notes

1. **Never commit `.env` file** - It contains sensitive information
2. **Change default secrets** - Generate strong random strings for SESSION_SECRET and JWT_SECRET
3. **Use HTTPS in production** - Set `secure: true` in session cookie configuration
4. **Rate limiting** - Consider adding rate limiting for production
5. **Input validation** - All user inputs are validated using express-validator

## Database Schema

### User Model
- `email`: String (required, unique, lowercase)
- `password`: String (required, hashed)
- `firstName`: String (optional)
- `lastName`: String (optional)
- `role`: String (enum: 'user', 'admin', default: 'user')
- `isActive`: Boolean (default: true)
- `createdAt`: Date
- `updatedAt`: Date

## Future Enhancements

- [ ] JWT token authentication option
- [ ] Email verification
- [ ] Password reset functionality
- [ ] OAuth integration (Google, Facebook)
- [ ] Rate limiting
- [ ] API documentation with Swagger
- [ ] Unit and integration tests

