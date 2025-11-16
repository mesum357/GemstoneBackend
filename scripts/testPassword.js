import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.model.js';

dotenv.config();

const testPassword = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals'
    );
    console.log('✅ Connected to MongoDB');

    const adminUser = await User.findOne({ email: 'admin@gemstones.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log('✅ Admin user found');
    console.log('   Email:', adminUser.email);
    
    // Test password
    const testPassword = 'admin123';
    const isMatch = await adminUser.comparePassword(testPassword);
    
    console.log(`\n🔐 Testing password: "${testPassword}"`);
    if (isMatch) {
      console.log('✅ Password is correct!');
    } else {
      console.log('❌ Password is incorrect!');
      
      // Let's verify by creating a new hash and comparing
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(testPassword, salt);
      console.log('\n🔍 Debug info:');
      console.log('   Stored hash:', adminUser.password.substring(0, 20) + '...');
      console.log('   New hash:', newHash.substring(0, 20) + '...');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testPassword();

