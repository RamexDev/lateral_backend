// Import Express router.
import { Router } from 'express';
// Import multer for file uploads.
import multer from 'multer';
// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';
// Import photo controller.
import * as photoController from './photo.controller.js';

// Configure multer with memory storage (validated in service).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Create photo router.
const router = Router();

// All photo routes require user authentication.
router.use(authenticateUser);

// POST /api/v1/me/photo — upload custom photo.
router.post('/me/photo', upload.single('photo'), photoController.uploadPhoto);

// DELETE /api/v1/me/photo — remove custom photo.
router.delete('/me/photo', photoController.deletePhoto);

// Export photo router.
export default router;
