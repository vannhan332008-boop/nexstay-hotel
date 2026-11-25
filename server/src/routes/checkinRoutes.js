import express from 'express';
import multer from 'multer';
import { processIdOcr } from '../controllers/checkinController.js';

const router = express.Router();

// Configure Multer for in-memory buffer storage (max 10MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are supported for OCR scanning.'), false);
    }
  },
});

// Endpoint: POST /api/checkin/ocr
router.post('/ocr', upload.single('idDocument'), processIdOcr);

export default router;
