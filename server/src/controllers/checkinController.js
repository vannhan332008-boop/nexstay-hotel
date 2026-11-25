import { extractTextFromImage } from '../services/ai.service.js';

/**
 * Controller to handle AI OCR upload and document extraction (CCCD Việt Nam & Passport)
 */
export async function processIdOcr(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No ID document image provided. Please upload a valid JPG, PNG, or WEBP file.',
      });
    }

    const startTime = Date.now();
    const mimeType = req.file.mimetype || 'image/jpeg';
    const hint = req.body?.docHint || '';
    const extractedData = await extractTextFromImage(req.file.buffer, mimeType, hint);
    const processingTimeMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'ID document successfully scanned and parsed.',
      processingTimeMs,
      data: extractedData,
    });
  } catch (error) {
    console.error('❌ Check-in OCR Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process ID document with AI vision model.',
      error: error.message,
    });
  }
}

export default {
  processIdOcr,
};
