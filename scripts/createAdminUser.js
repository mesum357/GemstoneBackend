import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.model.js';

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals'
    );
    console.log('✅ Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@gemstones.com' });
    
    if (existingAdmin) {
      // Update existing user to admin if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      } else {
        console.log('ℹ️  Admin user already exists');
      }
    } else {
      // Create new admin user
      // Note: Don't hash password manually - the User model's pre-save hook will handle it
      const adminUser = new User({
        email: 'admin@gemstones.com',
        password: 'admin123', // Let the pre-save hook hash it
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully!');
      console.log('   Email: admin@gemstones.com');
      console.log('   Password: admin123');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Run the script
createAdminUser();

