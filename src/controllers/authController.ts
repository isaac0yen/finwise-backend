import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Token } from '../modules/authModule';
import { generateVerificationCode } from '../modules/codes';
import Email from '../modules/emailModule';
import { db } from '../service/database';
import studentBase from '../service/studentBase';
import bcrypt from 'bcryptjs';


interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  gender: 'MALE' | 'FEMALE';
  dob: Date;
  nin: string;
  photo: string;
  address: string;
  state_of_origin: string;
  email_verified: boolean;
  created_at: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED' | 'PENDING';
}

interface AuthenticatedRequest extends Request {
  context: User;
}

const authController = {

  signUp: async (req: Request, res: Response): Promise<void> => {
    try {
      const { nin, email } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: false,
          message: 'Validation error',
          errors: errors.array()
        });
        return;
      }

      if (!nin || !email) {
        res.status(400).json({
          status: false,
          message: 'NIN and email are required'
        });
        return;
      }

      const existingUser = await db.findOne('users', { email });
      if (existingUser) {
        res.status(400).json({
          status: false,
          message: 'Email already exists'
        });
        return;
      }

      const existingNin = await db.findOne('users', { nin });
      if (existingNin) {
        res.status(400).json({
          status: false,
          message: 'NIN already exists'
        });
        return;
      }

      const userDetail = await studentBase.verifyNin(nin);

      const user_data = {
        first_name: userDetail.nin_data.firstname,
        email: email,
        last_name: userDetail.nin_data.surname,
        gender: userDetail.nin_data.gender === "m" ? "MALE" : "FEMALE",
        dob: userDetail.nin_data.birthdate,
        nin: userDetail.nin_data.nin,
        photo: userDetail.nin_data.photo,
        address: userDetail.nin_data.residence_address,
        state_of_origin: userDetail.nin_data.self_origin_state,
        status: 'PENDING'
      }

      const inserted = await db.insertOne("users", user_data);

      if (inserted < 1) {
        throw new Error('Failed to create user');
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.deleteMany("verification_codes", { user_id: inserted });

      Email.sendVerificationEmail(email, code);

      await db.insertOne("verification_codes", {
        user_id: inserted,
        code,
        type: 'EMAIL_VERIFICATION',
        expires_at: expiresAt
      });

      const token = Token.sign({ id: inserted, email });

      res.status(201).json({
        status: true,
        message: 'User created successfully',
        token
      });

    } catch (error) {
      res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },

  resendVerificationCode: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.context.id;
      const email = req.context.email;

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.deleteMany("verification_codes", { user_id: userId });

      Email.sendVerificationEmail(email, code);

      await db.insertOne("verification_codes", {
        user_id: userId,
        code,
        type: 'EMAIL_VERIFICATION',
        expires_at: expiresAt
      });

      res.status(200).json({
        status: true,
        message: 'Verification code sent successfully'
      });

    } catch (error) {
      res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },  
  /**
   * Verify email with verification code
   */
  async verifyEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: false,
          errors: errors.array()
        });
        return;
      }

      const { code } = req.body;
      const userId = req.context.id;

      const emails = await db.findOne("verification_codes", { user_id: userId, code, type: 'EMAIL_VERIFICATION' });

      if (!emails) {
        throw new Error('Invalid verification code');
      }

      if (emails.expires_at < new Date()) {
        throw new Error('Verification code expired');
      }

      if (emails.code !== code) {
        throw new Error('Invalid verification code');
      }

      const updated = await db.updateOne("users", { email_verified: 1, status: "ACTIVE" }, { id: userId });

      if (updated < 1) {
        throw new Error('Failed to verify email');
      }

      res.status(200).json({
        status: true,
        message: 'Email verified successfully',
      });

    } catch (error) {
      res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },

  /**
   * Set or update user password
   */
  async setPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new Error('Validation failed');
      }

      const { password } = req.body;
      const userId = req.context.id;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const updated = await db.updateOne("users", { password: hashedPassword }, { id: userId });

      if (updated < 1) {
        throw new Error('Failed to set password');
      }

      res.status(200).json({
        status: true,
        message: 'Password set successfully'
      });
    } catch (error) {
      res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },

  /**
   * Login with email and password
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: false,
          errors: errors.array()
        });
        return;
      }

      const { email, password } = req.body;

      const user = await db.findOne("users", { email });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      if (user.status === 'INACTIVE') {
        throw new Error('User is inactive');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      const token = Token.sign({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      });

      res.status(200).json({
        status: true,
        access_token: token,
      });

    } catch (error) {
      res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },
};

export default authController;