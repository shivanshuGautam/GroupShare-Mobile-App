const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authMiddleware);

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/group/:groupId', documentController.getGroupDocuments);
router.get('/download/:id', documentController.downloadDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
