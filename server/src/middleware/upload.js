const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!ext && mime) {
      if (mime === 'image/png') ext = '.png';
      else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
      else if (mime === 'image/webp') ext = '.webp';
      else if (mime === 'image/gif') ext = '.gif';
      else if (mime === 'application/pdf' || mime === 'application/x-pdf') ext = '.pdf';
      else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime.includes('wordprocessingml')
      ) ext = '.docx';
      else if (mime === 'application/msword' || mime === 'application/vnd.ms-word') ext = '.doc';
      else if (mime === 'text/plain') ext = '.txt';
      else if (mime.startsWith('image/')) ext = '.' + mime.split('/')[1];
    }
    const cleanExt = ext || '.bin';
    const rawBase = path.basename(file.originalname || 'document', ext);
    const cleanBaseName = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
    cb(null, `${cleanBaseName}-${uniqueSuffix}${cleanExt}`);
  },
});

// File filter for Images (JPEG, JPG, PNG, WEBP, GIF), PDF, and Word documents (DOCX, DOC)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.heic',
    '.docx',
    '.doc',
    '.txt',
  ];
  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isImageMime = mime.startsWith('image/');
  const isAllowedExt = allowedExtensions.includes(ext);
  const isAllowedMime = [
    'application/pdf',
    'application/x-pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-word',
    'application/x-zip-compressed',
    'application/zip',
    'text/plain',
    'application/octet-stream', // mobile clients sometimes send files as octet-stream
  ].includes(mime);

  if (isImageMime || isAllowedExt || isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new Error('Unsupported file format. Please upload a PDF, JPEG/JPG, PNG, or DOCX document.'),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter,
});

module.exports = upload;
