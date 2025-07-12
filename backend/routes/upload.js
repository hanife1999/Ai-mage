const express = require('express');
const auth = require('../middleware/auth');
const s3Service = require('../services/s3Service');
const File = require('../models/File');

const router = express.Router();

// Upload single file to S3
router.post('/single', auth, (req, res) => {
  s3Service.uploadSingle(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        message: err.message || 'File upload failed' 
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Create file record in database with S3 metadata
      const file = new File({
        user: req.user._id,
        originalName: req.file.originalname,
        fileName: req.file.key,
        fileUrl: req.file.location,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        metadata: {
          bucket: req.file.bucket,
          etag: req.file.etag,
          s3Key: req.file.key
        }
      });

      await file.save();

      res.json({
        message: 'File uploaded successfully',
        file: {
          id: file._id,
          originalName: file.originalName,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          uploadedAt: file.createdAt
        }
      });

    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Failed to save file record' });
    }
  });
});

// Upload multiple files to S3
router.post('/multiple', auth, (req, res) => {
  s3Service.uploadMultiple(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        message: err.message || 'File upload failed' 
      });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const fileRecord = new File({
          user: req.user._id,
          originalName: file.originalname,
          fileName: file.key,
          fileUrl: file.location,
          fileSize: file.size,
          mimeType: file.mimetype,
          metadata: {
            bucket: file.bucket,
            etag: file.etag,
            s3Key: file.key
          }
        });

        await fileRecord.save();
        uploadedFiles.push({
          id: fileRecord._id,
          originalName: fileRecord.originalName,
          fileName: fileRecord.fileName,
          fileUrl: fileRecord.fileUrl,
          fileSize: fileRecord.fileSize,
          mimeType: fileRecord.mimeType,
          uploadedAt: fileRecord.createdAt
        });
      }

      res.json({
        message: `${uploadedFiles.length} files uploaded successfully`,
        files: uploadedFiles
      });

    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Failed to save file records' });
    }
  });
});

// Get user's uploaded files with pagination
router.get('/my-files', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const files = await File.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await File.countDocuments({ user: req.user._id });

    res.json({
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Failed to get files' });
  }
});

// Get single file details by ID
router.get('/:fileId', auth, async (req, res) => {
  try {
    const file = await File.findOne({ 
      _id: req.params.fileId, 
      user: req.user._id 
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Failed to get file' });
  }
});

// Delete file from S3 and database
router.delete('/:fileId', auth, async (req, res) => {
  try {
    const file = await File.findOne({ 
      _id: req.params.fileId, 
      user: req.user._id 
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete file from S3 bucket
    if (s3Service.isS3Configured()) {
      await s3Service.deleteFromS3(file.fileUrl);
    }

    // Delete file record from database
    await File.findByIdAndDelete(req.params.fileId);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

// Generate signed download URL for private files
router.get('/:fileId/download', auth, async (req, res) => {
  try {
    const file = await File.findOne({ 
      _id: req.params.fileId, 
      user: req.user._id 
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (s3Service.isS3Configured()) {
      const signedUrl = await s3Service.getSignedUrl(file.fileName, 3600); // 1 hour
      res.json({ 
        downloadUrl: signedUrl,
        expiresIn: 3600
      });
    } else {
      res.json({ 
        downloadUrl: file.fileUrl,
        expiresIn: null
      });
    }
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({ message: 'Failed to generate download URL' });
  }
});

// Get user storage usage statistics
router.get('/stats/usage', auth, async (req, res) => {
  try {
    const files = await File.find({ user: req.user._id });
    
    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    const fileCount = files.length;
    
    const fileTypes = {};
    files.forEach(file => {
      const type = file.mimeType.split('/')[0]; // image, video, application, etc.
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });

    res.json({
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileCount,
      fileTypes
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get storage stats' });
  }
});

module.exports = router; 