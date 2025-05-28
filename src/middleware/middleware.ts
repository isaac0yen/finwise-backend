import { Request, Response, NextFunction } from 'express';
import { Token } from '../modules/authModule';

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  const authHeader = req.headers.authorization;
    
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      status: false,
      message: 'Authentication required 1',
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }
    
  const token = authHeader.split(' ')[1];
    
  try {
    const user = Token.verify(token);

    console.log(user);

    (req as any).context = user;
    (req as any).user = user; // Also attach to req.user for backward compatibility
    next();
  } catch (error: unknown) {
    return res.status(401).json({
      status: false,
      message: error instanceof Error ? error.message : 'Invalid token',
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }
};

export { authenticate };