import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../service/database'; // For fetching user details

// Define a type for the user payload in the JWT
interface UserPayload {
  id: number;
  email: string;
  // Add other fields from your JWT payload if necessary
}

// Define a type for the user object fetched from DB, including admin status
interface UserWithAdminStatus extends UserPayload {
  is_admin?: boolean; // Assuming 'is_admin' column in users table
}

// Extend Express Request type to include 'context'
export interface AuthenticatedRequest extends Request {
  context?: UserPayload;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_DEFAULT_JWT_SECRET') as UserPayload;
      req.context = decoded; // Attach decoded payload to request context
      next();
    } catch (error) {
      // console.error('Authentication error:', error);
      res.status(401).json({ status: false, message: 'Unauthorized: Invalid token' });
    }
  } else {
    res.status(401).json({ status: false, message: 'Unauthorized: No token provided' });
  }
};

export const authorizeAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.context || !req.context.id) {
    res.status(401).json({ status: false, message: 'Unauthorized: Authentication context not found.' });
    return;
  }

  try {
    const user = await db.findOne('users', { id: req.context.id }) as UserWithAdminStatus;
    if (user && user.is_admin) {
      next(); // User is admin, proceed
    } else {
      res.status(403).json({ status: false, message: 'Forbidden: Requires admin privileges.' });
    }
  } catch (error) {
    // console.error('Admin authorization error:', error);
    res.status(500).json({ status: false, message: 'Internal server error during admin authorization.' });
  }
};
