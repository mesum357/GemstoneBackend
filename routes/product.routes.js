import express from 'express';
import productController from '../controllers/product.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', productController.getAllProducts);

// Admin routes (require authentication and admin role)
// IMPORTANT: Define specific routes before parameterized routes
router.get('/admin/all', isAuthenticated, isAdmin, productController.getAdminProducts);
router.post('/', isAuthenticated, isAdmin, productController.createProduct);
router.put('/:id', isAuthenticated, isAdmin, productController.updateProduct);
router.delete('/:id', isAuthenticated, isAdmin, productController.deleteProduct);

// Public routes - must come after specific routes
router.get('/:id', productController.getProductById);

export default router;

