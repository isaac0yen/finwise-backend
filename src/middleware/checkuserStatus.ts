import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if user status is ACTIVE
 * Blocks access for users with PENDING, BANNED, or DELETED status
 */
const checkUserStatus = (req: Request & { user?: any }, res: Response, next: NextFunction): void => {
  try {
    // User is attached to req by the auth middleware
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        status: false,
        message: 'Authentication required'
      });
      return;
    }
    
    if (user.status !== 'ACTIVE') {
      let message = 'Access denied';
      
      switch (user.status) {
        case 'PENDING':
          message = 'Email verification required. Please verify your email to continue.';
          break;
        case 'BANNED':
          message = 'Your account has been banned. Please contact support for assistance.';
          break;
        case 'DELETED':
          message = 'Your account has been deleted.';
          break;
      }
      
      res.status(403).json({
        status: false,
        message
      });
      return;
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Server error'
    });
    return;
  }
};

export {
  checkUserStatus
};