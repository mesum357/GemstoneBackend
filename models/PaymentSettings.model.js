import mongoose from 'mongoose';

const paymentSettingsSchema = new mongoose.Schema(
  {
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true
    },
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true
    },
    iban: {
      type: String,
      required: false,
      trim: true
    },
    qrCode: {
      type: String,
      required: false // QR code image URL
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one payment settings document exists
paymentSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ isActive: true });
  
  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      accountNumber: '1234567890123',
      accountName: 'VitalGeo Naturals',
      bankName: 'Bank Name',
      iban: 'PK12ABCD1234567890123456',
      isActive: true
    });
  }
  
  return settings;
};

const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

export default PaymentSettings;

