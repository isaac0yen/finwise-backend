import { Request, Response } from 'express';
import { db } from '../service/database';
import { resolveAccount, getBanks } from '../modules/paystack';
import Email from '../modules/emailModule'; // Assuming Email module is structured like this

interface AuthenticatedRequest extends Request {
  context?: { id: number; email: string }; // Define based on your auth middleware
}

const withdrawalController = {
  /**
   * Get list of banks supported by Paystack
   */
  async getBanks(req: Request, res: Response): Promise<void> {
    try {
      const response = await getBanks();
      
      if (!response.status) {
        res.status(400).json({
          status: false,
          message: response.message || 'Failed to fetch banks'
        });
        return;
      }
      
      // Return successful response with banks list
      res.json({
        status: true,
        message: 'Banks retrieved successfully',
        data: response.data
      });
    } catch (error) {
      console.error('Error fetching banks:', error);
      res.status(500).json({
        status: false,
        message: 'An error occurred while fetching banks'
      });
    }
  },
  
  /**
   * Resolves and verifies bank account details with Paystack
   */
  async resolveAccount(req: Request, res: Response): Promise<void> {
    try {
      const { account_number, bank_code } = req.body;
      
      if (!account_number || !bank_code) {
        res.status(400).json({
          status: false, 
          message: 'Account number and bank code are required'
        });
        return;
      }
      
      // Call Paystack to verify the account
      const response = await resolveAccount(account_number, bank_code);
      
      if (!response.status) {
        res.status(400).json({
          status: false,
          message: response.message || 'Failed to verify account'
        });
        return;
      }
      
      // Return successful response with account name
      res.json({
        status: true,
        message: 'Account verified successfully',
        data: {
          account_name: response.data.account_name,
          account_number: response.data.account_number,
          bank_code: bank_code
        }
      });
    } catch (error) {
      console.error('Error resolving account:', error);
      res.status(500).json({
        status: false,
        message: 'An error occurred while verifying the account'
      });
    }
  },
  
  async requestWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.context?.id;
      const userEmail = req.context?.email;
      const { amount, bank_name, account_number, account_name } = req.body;
      const currency = req.body.currency || 'NGN'; // Default to NGN

      if (!userId || !userEmail) {
        res.status(401).json({ status: false, message: 'Unauthorized' });
        return;
      }

      // Basic amount parsing. Detailed validation is in express-validator in routes.
      const parsedAmount = parseFloat(amount);
      // Redundant check if validator is robust, but safe as a fallback.
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({ status: false, message: 'Invalid withdrawal amount.' });
        return;
      }

      // Fetch wallet
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        res.status(404).json({ status: false, message: 'Wallet not found' });
        return;
      }

      // Check balance (assuming NGN for now, extend for other currencies if needed)
      if (currency === 'NGN' && wallet.naira_balance < parsedAmount) {
        res.status(400).json({ status: false, message: 'Insufficient Naira balance' });
        return;
      }

      // Log pending withdrawal
      const withdrawalRecordId = await db.insertOne('pending_withdrawals', {
        user_id: userId,
        wallet_id: wallet.id,
        amount: parsedAmount,
        currency,
        status: 'PENDING_REVIEW',
        bank_name,
        account_number,
        account_name,
      });

      if (withdrawalRecordId < 1) {
        throw new Error('Failed to record withdrawal request');
      }

      // Send email notification to admin
      const adminEmail = process.env.ADMIN_EMAIL_ADDRESS || 'bstprogrammer999@gmail.com'; // Use env var
      const emailSubject = 'New Withdrawal Request';
      const emailHtml = `
        <p>A new withdrawal request has been submitted:</p>
        <ul>
          <li>User ID: ${userId}</li>
          <li>User Email: ${userEmail}</li>
          <li>Amount: ${parsedAmount} ${currency}</li>
          <li>Bank: ${bank_name}</li>
          <li>Account Number: ${account_number}</li>
          <li>Account Name: ${account_name}</li>
          <li>Request ID: ${withdrawalRecordId}</li>
        </ul>
        <p>Please review and process this request.</p>
      `;
      // Make email sending async (fire-and-forget)
      Email.sendMail(adminEmail, emailSubject, emailHtml)
        .catch(err => console.error('Failed to send admin withdrawal notification email (async):', err));

      // Send email notification to user
      const userSubject = 'Withdrawal Request Received';
      const userEmailHtml = `
        <p>Dear User,</p>
        <p>Your withdrawal request for ${parsedAmount} ${currency} to bank account ${account_number} (${bank_name}) has been received.</p>
        <p>It is currently under review and will be processed shortly.</p>
        <p>You will receive another notification once it's processed.</p>
        <p>Thank you for using Finwise.</p>
      `;
      Email.sendMail(userEmail, userSubject, userEmailHtml)
        .catch(err => console.error('Failed to send user withdrawal confirmation email (async):', err));

      res.status(200).json({
        status: true,
        message: 'Withdrawal request received. It will be processed within approximately one hour.',
      });

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Withdrawal request error:', error);
      res.status(500).json({
        status: false,
        message: error instanceof Error ? error.message : 'An internal error occurred',
      });
    }
  },
};

export default withdrawalController;
