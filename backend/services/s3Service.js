const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// Generate unique filename to prevent conflicts
const generateUniqueFileName = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalname);
  const nameWithoutExt = path.basename(originalname, extension);
  
  return `${nameWithoutExt}_${timestamp}_${randomString}${extension}`;
};

// Configure multer middleware for S3 upload
const uploadToS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      const fileName = generateUniqueFileName(file.originalname);
      const folder = req.body.folder || 'uploads';
      cb(null, `${folder}/${fileName}`);
    },
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user ? req.user._id.toString() : 'anonymous',
        uploadedAt: new Date().toISOString()
      });
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per request
  },
      fileFilter: (req, file, cb) => {
      // Define allowed file types for security
      const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, PDFs, and documents are allowed.'), false);
    }
  }
});

// Middleware for single file upload
const uploadSingle = uploadToS3.single('file');

// Middleware for multiple files upload
const uploadMultiple = uploadToS3.array('files', 5);

// Upload AI generated image to S3 with metadata
const uploadAIImage = async (imageBuffer, fileName, userId) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `ai-images/${userId}/${fileName}`,
      Body: imageBuffer,
      ContentType: 'image/png',
      ACL: 'public-read',
      Metadata: {
        generatedBy: 'AI',
        userId: userId.toString(),
        generatedAt: new Date().toISOString()
      }
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload image to cloud storage');
  }
};

// Delete file from S3 bucket
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
};

// Generate signed URL for private file access
const getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expiresIn
    };

    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error('Failed to generate signed URL');
  }
};

// List files in S3 bucket folder
const listFiles = async (folder, prefix = '') => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: `${folder}/${prefix}`,
      MaxKeys: 100
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  } catch (error) {
    console.error('S3 list files error:', error);
    throw new Error('Failed to list files');
  }
};

// Get file metadata and information
const getFileInfo = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    const result = await s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      metadata: result.Metadata
    };
  } catch (error) {
    console.error('S3 get file info error:', error);
    throw new Error('Failed to get file info');
  }
};

// Check if S3 configuration is complete
const isS3Configured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadAIImage,
  deleteFromS3,
  getSignedUrl,
  listFiles,
  getFileInfo,
  isS3Configured,
  s3
}; 