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
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype) {
      if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') ext = '.jpg';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else if (file.mimetype === 'application/pdf') ext = '.pdf';
      else if (file.mimetype.startsWith('image/')) ext = '.' + file.mimetype.split('/')[1];
    }
    const cleanExt = ext || '.bin';
    const baseName = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
    cb(null, `${baseName}-${uniqueSuffix}${cleanExt}`);
  },
});

// File filter for Images (JPEG, PNG, WEBP, GIF), PDF, and DOCX
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
  const ext = path.extname(file.originalname).toLowerCase();

  const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
  const isAllowedExt = allowedExtensions.includes(ext);
  const isAllowedMime = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/octet-stream', // mobile clients sometimes send files as octet-stream
  ].includes(file.mimetype);

  if (isImageMime || isAllowedExt || isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new Error('Unsupported file format. Please upload an Image (PNG, JPG, WEBP), PDF, or DOCX document.'),
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
