import authController from "../controllers/authController";
import { authenticate } from "../middleware/middleware";

const { body } = require('express-validator');


const express = require('express');

const router = express.Router();

router.post('/sign-up', [
  body('nin').notEmpty().withMessage('NIN is required'),
  body('email').isEmail().withMessage('Valid email is required')
], authController.signUp);

router.post('/send-email-verification',
  authenticate,
  authController.resendVerificationCode);

router.post('/verify-email', [
  body('code').notEmpty().withMessage('Verification code is required')
],
  authenticate,
  authController.verifyEmail);

router.post('/set-password', [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
],
  authenticate,
  authController.setPassword);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

export default router;