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
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED' | 'PENDING' | 'EXPIRED';
  user_tag: string;
}

interface AuthenticatedRequest extends Request {
  context: User;
}

/**
 * Generates a random 4-character alphanumeric tag
 * @returns A random 4-character alphanumeric string
 */
const generateUserTag = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Checks if the email is from an educational institution
 * @param email The email to check
 * @returns boolean indicating if the email is educational
 */
const isEducationalEmail = (email: string): boolean => {
  // Common educational domains
  const eduDomains = [
    '.edu',
    '.ac.',
    '.edu.',
    '.sch.',
    'university',
    'college',
    'school',
    'academy',
    'institute'
  ];
  
  const lowerEmail = email.toLowerCase();
  return eduDomains.some(domain => lowerEmail.includes(domain));
};

const authController = {

  signUp: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { nin, email } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: false,
          message: 'Validation error',
          errors: errors.array()
        });
      }

      if (!nin || !email) {
        return res.status(400).json({
          status: false,
          message: 'NIN and email are required'
        });
      }
      
      // Validate if the email is from an educational institution
      if (!isEducationalEmail(email)) {
        return res.status(400).json({
          status: false,
          message: 'Only educational email addresses are allowed'
        });
      }

      const existingUser = await db.findOne('users', { email });
      if (existingUser) {
        return res.status(400).json({
          status: false,
          message: 'Email already exists'
        });
      }

      const existingNin = await db.findOne('users', { nin });
      if (existingNin && existingNin.status !== 'PENDING') {
        return res.status(400).json({
          status: false,
          message: 'NIN already exists'
        });
      }

      if (existingNin && existingNin.status === 'PENDING') {
        // Check if user already has a tag, if not, generate one
        if (!existingNin.user_tag) {
          // Generate a unique user tag for transfers
          let userTag = generateUserTag();
          // Check if the tag already exists
          let existingTag = await db.findOne('users', { user_tag: userTag });
          while (existingTag) {
            userTag = generateUserTag();
            existingTag = await db.findOne('users', { user_tag: userTag });
          }
          
          // Update the user with the new tag
          await db.updateOne('users', { user_tag: userTag }, { id: existingNin.id });
        }
        
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.deleteMany("verification_codes", { user_id: existingNin.id });

        Email.sendVerificationEmail(email, code);

        await db.insertOne("verification_codes", {
          user_id: existingNin.id,
          code,
          type: 'EMAIL_VERIFICATION',
          expires_at: expiresAt
        });

        const token = Token.sign({ id: existingNin.id, email });

        return res.status(200).json({
          status: true,
          message: 'Verification code resent successfully',
          token
        });
      }

      const userDetail = await studentBase.verifyNin(nin);

      // Helper function to reformat date from DD-MM-YYYY to YYYY-MM-DD
      const reformatDate = (dateString: string): string => {
        if (!dateString || typeof dateString !== 'string' || !dateString.includes('-')) return dateString; // Basic check
        const parts = dateString.split('-');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString; // Return original if format is unexpected
      };

      // Generate a unique user tag for transfers
      let userTag = generateUserTag();
      // Check if the tag already exists
      let existingTag = await db.findOne('users', { user_tag: userTag });
      while (existingTag) {
        userTag = generateUserTag();
        existingTag = await db.findOne('users', { user_tag: userTag });
      }

      const user_data = {
        first_name: userDetail.nin_data.firstname,
        email: email,
        last_name: userDetail.nin_data.surname,
        gender: userDetail.nin_data.gender === "m" ? "MALE" : "FEMALE",
        dob: reformatDate(userDetail.nin_data.birthdate), // Reformatted date
        nin: userDetail.nin_data.nin,
        photo: userDetail.nin_data.photo,
        address: userDetail.nin_data.residence_address,
        state_of_origin: userDetail.nin_data.self_origin_state,
        status: 'PENDING',
        user_tag: userTag,
        created_at: new Date() // Explicitly set creation date for expiry tracking
      }

      const inserted = await db.insertOne("users", user_data);

      if (inserted < 1) {
        throw new Error('Failed to create user');
      }

      // Create a wallet for the new user
      await db.insertOne('wallets', {
        user_id: inserted,
        naira_balance: 0,
      });

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

      return res.status(201).json({
        status: true,
        message: 'User created successfully',
        token
      });

    } catch (error: any) {
      console.error("Sign Up Controller Error:", error);
      console.error("Detailed Sign Up Controller Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      let responseMessage = "An unexpected error occurred during sign up. Please check server logs for details.";
      let statusCode = 500; // Default to server error

      if (error) {
        if (error.message && typeof error.message === 'string' && error.message.trim() !== '') {
          responseMessage = error.message;
          // If it's a known error type that implies client fault, use 400
          if (error.name === 'ValidationError' || (error.message && (error.message.includes('Duplicate entry') || error.message.includes('already exists')))) {
            statusCode = 400;
          }
        } else if (typeof error === 'string' && error.trim() !== '') {
          responseMessage = error;
          statusCode = 400; // Assume string errors are often validation/client related
        } else if (error.sqlMessage) { // For MySQL errors from a raw query from 'mysql2' package
          responseMessage = `Database error: ${error.sqlMessage}`;
          statusCode = 500; // Database errors are typically server-side issues in this context
        } else if (error.code && error.code.startsWith('ER_')) { // Generic MySQL error codes
          responseMessage = `Database error (code: ${error.code}).`;
          statusCode = 500;
        }
      }

      return res.status(statusCode).json({ status: false, message: responseMessage });
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
  async setPassword(req: AuthenticatedRequest, res: Response): Promise<Response> {
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

      return res.status(200).json({
        status: true,
        message: 'Password set successfully'
      });
    } catch (error) {
      return res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },

  /**
   * Login with email and password
   */
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: false,
          errors: errors.array()
        });
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

      return res.status(200).json({
        status: true,
        access_token: token,
      });

    } catch (error) {
      return res.status(400).json({
        status: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  },
};

export default authController;