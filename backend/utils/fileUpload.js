const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ErrorResponse = require('./errorResponse');

// Set up storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for image uploads
const imageFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new ErrorResponse('Only image files are allowed!', 400), false);
  }
};

// File filter for document uploads
const documentFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|gif|pdf|docx?|xlsx?|pptx?|txt/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new ErrorResponse('Invalid file type. Only images, documents, and PDFs are allowed!', 400), false);
  }
};

// Initialize upload
const upload = (type = 'image', fieldName = 'file', fileSize = 5) => {
  const fileFilter = type === 'document' ? documentFilter : imageFilter;
  
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: fileSize * 1024 * 1024 // MB to bytes
    }
  }).single(fieldName);
};

// Middleware to handle file upload
const handleFileUpload = (type = 'image', fieldName = 'file', fileSize = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload(type, fieldName, fileSize);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ErrorResponse(`File too large. Maximum size is ${fileSize}MB`, 400));
        } else if (err instanceof multer.MulterError) {
          return next(new ErrorResponse(err.message, 400));
        } else if (err) {
          return next(err);
        }
      }
      
      // If file was uploaded, add the file path to the request body
      if (req.file) {
        // Create a relative path for the frontend
        const relativePath = path.join('uploads', path.basename(req.file.path));
        req.body[fieldName] = relativePath;
      }
      
      next();
    });
  };
};

// Function to delete file
const deleteFile = (filePath) => {
  if (!filePath) return;
  
  const fullPath = path.join(__dirname, '../../public', filePath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) console.error(`Error deleting file: ${err}`);
    });
  }
};

module.exports = {
  upload,
  handleFileUpload,
  deleteFile
};
