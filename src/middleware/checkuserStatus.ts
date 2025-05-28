import { Request, Response, NextFunction } from 'express';
import { db } from '../service/database';
import Email from '../modules/emailModule';

// Utility function to calculate difference in days between two dates
const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
};


// Check how many days until account expiry
const daysUntilExpiry = (createdAt: Date): number => {
  const now = new Date();
  const fiveYearsInDays = 5 * 365;
  const daysSinceCreation = daysBetween(createdAt, now);
  return Math.max(0, fiveYearsInDays - daysSinceCreation);
};

// Send expiry notification to user if needed
const checkAndSendExpiryNotification = async (userId: number, days: number): Promise<void> => {
  // Thresholds for notifications
  const notifyThresholds = [30, 7, 1]; // 30 days, 7 days, 1 day

  if (!notifyThresholds.includes(days)) {
    return; // Not a notification day
  }

  // Get user details
  const user = await db.findOne('users', { id: userId });
  if (!user || !user.email) return;

  // Get wallet balance to include in expiry notice
  const wallet = await db.findOne('wallets', { user_id: userId });
  const balance = wallet ? wallet.naira_balance : 0;

  // Check if notification has already been sent for this threshold
  const notificationKey = `expiry_notification_${days}`;

  // Get notifications for this user and type
  const notifications = await db.findMany('notifications', {
    user_id: userId,
    type: notificationKey
  });

  // Filter for notifications in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentNotifications = notifications.filter(notification => {
    const notificationDate = new Date(notification.created_at);
    return notificationDate >= oneDayAgo;
  });

  const alreadySent = recentNotifications.length > 0;

  if (alreadySent) return; // Already sent notification for this threshold within the past 24 hours

  // Determine time unit for the message
  const timeUnit = days === 1 ? 'day' : 'days';

  const emailSubject = `Your Finwise Account Will Expire in ${days} ${timeUnit}`;
  const emailHtml = `
    <p>Dear ${user.first_name},</p>
    <p>Your Finwise account will expire in ${days} ${timeUnit}.</p>
    ${days <= 30 ? '<p>Please note that you cannot perform new transactions when your account is within 30 days of expiry.</p>' : ''}
    ${balance > 100 ? `<p>Your current balance is ${balance.toFixed(2)} NGN. After account expiration, to recover funds exceeding 100 NGN, please contact hi@mygenius.ng with your account details.</p>` : ''}
    <p>Thank you for using Finwise.</p>
  `;

  try {
    await Email.sendMail(user.email, emailSubject, emailHtml);

    // Record that notification was sent
    await db.insertOne('notifications', {
      user_id: userId,
      type: notificationKey,
      message: `Account expiry notification: ${days} ${timeUnit} remaining`,
      created_at: new Date()
    });
  } catch (error) {
    console.error(`Failed to send expiry notification to user ${userId}:`, error);
  }
};

/**
 * Middleware to check if user status is ACTIVE
 * Blocks access for users with PENDING, BANNED, or DELETED status
 * Also handles account expiry after 5 years
 */
const checkUserStatus = async (req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User is attached to req by the auth middleware
    const tokenUser = req.user;
    console.log('Token user:', tokenUser);

    if (!tokenUser || !tokenUser.id) {
      console.log('No valid user in token');

      res.status(401).json({
        status: false,
        message: 'Authentication required: Missing or invalid user ID'
      });
      return;
    }
    
    // Fetch complete user data from database including status
    const user = await db.findOne('users', { id: tokenUser.id });
    console.log('Database user:', user);
    
    if (!user) {
      res.status(401).json({
        status: false,
        message: 'User not found in database'
      });
      return;
    }
    
    // Attach full user data to the request for downstream handlers
    req.user = user;

    // Check account creation date and handle expiry
    if (user.created_at) {
      const createdAt = new Date(user.created_at);
      const days = daysUntilExpiry(createdAt);

      // Send notification if approaching expiry
      await checkAndSendExpiryNotification(user.id, days);

      // If account has expired, update status and notify
      if (days <= 0 && user.status !== 'EXPIRED') {
        // Update user status to EXPIRED
        await db.updateOne('users', { status: 'EXPIRED' }, { id: user.id });
        user.status = 'EXPIRED';

        // Get wallet balance
        const wallet = await db.findOne('wallets', { user_id: user.id });
        const balance = wallet ? wallet.naira_balance : 0;

        // Send final expiry notification if balance > 100
        if (balance > 100 && user.email) {
          const emailSubject = 'Your Finwise Account Has Expired';
          const emailHtml = `
            <p>Dear ${user.first_name},</p>
            <p>Your Finwise account has expired as it has reached the maximum 5-year usage period.</p>
            <p>Your current balance is ${balance.toFixed(2)} NGN. To recover your funds, please contact hi@mygenius.ng with your account details.</p>
            <p>Thank you for using Finwise.</p>
          `;

          try {
            await Email.sendMail(user.email, emailSubject, emailHtml);
          } catch (emailError) {
            console.error(`Failed to send expiry notification to user ${user.id}:`, emailError);
          }
        }
      }

      // Block transactions for accounts approaching expiry (30 days or less)
      const isTransactionRequest = req.path.includes('/transfer') ||
        req.path.includes('/deposit') ||
        req.path.includes('/withdraw');

      if (days <= 30 && isTransactionRequest) {
        res.status(403).json({
          status: false,
          message: `Your account will expire in ${days} days. Transactions are disabled for accounts within 30 days of expiry.`
        });
        return;
      }
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
        case 'EXPIRED':
          message = 'Your account has expired after 5 years of usage. If your balance exceeds 100 NGN, please contact hi@mygenius.ng to recover your funds.';
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
    console.error('Check user status error:', error);
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