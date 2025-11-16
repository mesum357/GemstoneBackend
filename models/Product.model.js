import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    productType: {
      type: String,
      enum: ['Shilajit', 'Gemstone'],
      required: [true, 'Product type is required']
    },
    image: {
      type: String,
      required: [true, 'Product image is required']
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true
    },
    category: {
      type: String,
      trim: true
    },
    featured: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
productSchema.index({ productType: 1, featured: 1 });
productSchema.index({ category: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;

