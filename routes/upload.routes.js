import express from 'express';
import { upload, uploadsUrl } from '../middleware/upload.middleware.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Single image upload route (admin only)
router.post(
  '/image',
  isAuthenticated,
  isAdmin,
  upload.single('image'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Construct absolute URL for the uploaded file
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      const fileUrl = `${uploadsUrl}/${req.file.filename}`;
      const absoluteUrl = `${baseUrl}${fileUrl}`;

      return res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: fileUrl, // Keep relative URL for backward compatibility
        absoluteUrl: absoluteUrl, // New absolute URL field
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error uploading image',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

export default router;

