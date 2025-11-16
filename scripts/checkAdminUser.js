import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';

dotenv.config();

const checkAdminUser = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals'
    );
    console.log('✅ Connected to MongoDB');

    // Check for admin user
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (adminUser) {
      console.log('✅ Admin user found:');
      console.log('   Email:', adminUser.email);
      console.log('   Role:', adminUser.role);
      console.log('   Active:', adminUser.isActive);
      console.log('   Created:', adminUser.createdAt);
      
      // Try to find by different email formats
      const emailVariants = [
        'admin@gemstones.com',
        'admin@gemstones',
        'ADMIN@GEMSTONES.COM',
        'ADMIN@GEMSTONES'
      ];
      
      console.log('\n📋 Checking email variants:');
      for (const email of emailVariants) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          console.log(`   ✅ Found: ${email} -> ${user.email}`);
        } else {
          console.log(`   ❌ Not found: ${email}`);
        }
      }
    } else {
      console.log('❌ No admin user found');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAdminUser();

