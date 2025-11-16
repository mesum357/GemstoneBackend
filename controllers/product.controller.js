import Product from '../models/Product.model.js';

// Helper function to normalize image URLs - replace localhost with production backend URL
const normalizeImageUrl = (imageUrl, req) => {
  if (!imageUrl) return imageUrl;
  
  // If image URL contains localhost, replace with current backend URL
  if (imageUrl.includes('localhost:3000') || imageUrl.includes('127.0.0.1:3000')) {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    return imageUrl.replace(/https?:\/\/[^/]+/, baseUrl);
  }
  
  return imageUrl;
};

// Helper function to transform product image URLs in response
const transformProductImages = (product, req) => {
  if (product.image) {
    product.image = normalizeImageUrl(product.image, req);
  }
  return product;
};

const productController = {
  // Get all products
  getAllProducts: async (req, res) => {
    try {
      const { productType, category, featured } = req.query;
      const filter = { isActive: true };

      if (productType) {
        filter.productType = productType;
      }
      if (category) {
        filter.category = category;
      }
      if (featured !== undefined) {
        // Handle both 'true' and 'false' as strings from query params
        if (featured === 'true') {
          filter.featured = true;
        } else if (featured === 'false') {
          filter.featured = false;
        }
      }

      const products = await Product.find(filter).sort({ createdAt: -1 });

      // Transform image URLs to use current backend URL
      const transformedProducts = products.map(product => {
        const productObj = product.toObject();
        return transformProductImages(productObj, req);
      });

      return res.json({
        success: true,
        count: transformedProducts.length,
        products: transformedProducts
      });
    } catch (error) {
      console.error('Get products error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get single product by ID
  getProductById: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Transform image URL to use current backend URL
      const productObj = product.toObject();
      const transformedProduct = transformProductImages(productObj, req);

      return res.json({
        success: true,
        product: transformedProduct
      });
    } catch (error) {
      console.error('Get product error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Create new product
  createProduct: async (req, res) => {
    try {
      const { name, productType, image, description, category, featured, price } = req.body;

      // Validation
      if (!name || !productType || !image || !description) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be provided'
        });
      }

      const product = new Product({
        name,
        productType,
        image,
        description,
        category: category || undefined,
        featured: featured || false,
        price: price !== undefined ? parseFloat(price) : 0
      });

      await product.save();

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Update product
  updateProduct: async (req, res) => {
    try {
      const { name, productType, image, description, category, featured, price } = req.body;

      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Update fields
      if (name) product.name = name;
      if (productType) product.productType = productType;
      if (image) product.image = image;
      if (description) product.description = description;
      if (category !== undefined) product.category = category || undefined;
      if (featured !== undefined) product.featured = featured;
      if (price !== undefined) product.price = parseFloat(price);

      await product.save();

      return res.json({
        success: true,
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      console.error('Update product error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Delete product (soft delete)
  deleteProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      product.isActive = false;
      await product.save();

      return res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Delete product error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get products for admin (includes inactive)
  getAdminProducts: async (req, res) => {
    try {
      const products = await Product.find().sort({ createdAt: -1 });

      // Transform image URLs to use current backend URL
      const transformedProducts = products.map(product => {
        const productObj = product.toObject();
        return transformProductImages(productObj, req);
      });

      return res.json({
        success: true,
        count: transformedProducts.length,
        products: transformedProducts
      });
    } catch (error) {
      console.error('Get admin products error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default productController;

