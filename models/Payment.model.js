import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Optional for guest payments
    },
    accountName: {
      type: String,
      trim: true
    },
    transactionId: {
      type: String,
      trim: true,
      sparse: true, // Allows multiple null/undefined values but enforces uniqueness for non-null values
      unique: true
    },
    screenshot: {
      type: String,
      required: [true, 'Payment screenshot is required']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required']
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedAt: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: {
      type: String,
      trim: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ productId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ transactionId: 1 }, { sparse: true }); // Sparse index for optional transactionId

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;

