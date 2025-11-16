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

      // Return the file path/URL
      const fileUrl = `${uploadsUrl}/${req.file.filename}`;

      return res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: fileUrl,
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

