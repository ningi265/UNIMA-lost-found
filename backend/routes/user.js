const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');  // User model
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');  // Middleware to check JWT token

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));  // Ensure file extension is preserved
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // Limit to 5MB
  fileFilter: function (req, file, cb) {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG image formats are allowed!'));
    }
  }
}).single('profileImage');

// Profile image upload route
router.post('/upload', authenticateToken, (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error', error: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      // Update user profile with the uploaded image URL
      const userId = req.user.id;  // Get user ID from JWT token
      const profileImageUrl = `/uploads/${req.file.filename}`;  // Store relative path to image

      // Update user in the database
      const user = await User.findByIdAndUpdate(
        userId,
        { profileImage: profileImageUrl },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'Profile image uploaded successfully!',
        profileImage: profileImageUrl,
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
});

module.exports = router;
