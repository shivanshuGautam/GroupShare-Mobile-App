const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

const multer = require('multer');

router.use(authMiddleware);

// Middleware to catch Multer errors and return clean 400 Bad Request
const handleUpload = (req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return next();
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size limit exceeded. Maximum file size is 25 MB.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload validation failed.',
      });
    }
    next();
  });
};

router.post('/upload', handleUpload, documentController.uploadDocument);
router.get('/group/:groupId', documentController.getGroupDocuments);
router.get('/download/:id', documentController.downloadDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
