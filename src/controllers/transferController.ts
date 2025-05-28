import { Request, Response } from 'express';
import { db } from '../service/database';
import { TransactionType } from '../models/transaction'; // Assuming this path is correct
import transactionController from './transactionController'; // Assuming this path
import Email from '../modules/emailModule'; // Import Email module

// Re-define User and AuthenticatedRequest if not globally available or import if they are
// For now, defining based on authController.ts structure
interface User {
  id: number;
  email: string;
  first_name?: string; // Add first_name if available and used for personalization
  // Add other fields if used from context, e.g., last_name
}

interface AuthenticatedRequest extends Request {
  context?: User; // Make context optional to align with general Request, or ensure it's always set by middleware
}

const transferController = {
  async createTransfer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const senderId = req.context?.id;
    const senderEmail = req.context?.email; // For logging or notifications, if needed

    if (!senderId) {
      res.status(401).json({ status: false, message: 'Unauthorized. Sender ID not found.' });
      return;
    }

    const { recipientTag, amount, currency = 'NGN' } = req.body;

    if (!recipientTag || !amount) {
      res.status(400).json({ status: false, message: 'Recipient tag and amount are required.' });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ status: false, message: 'Invalid transfer amount.' });
      return;
    }

    if (currency !== 'NGN') {
      res.status(400).json({ status: false, message: 'Currently, only NGN transfers are supported.' });
      return;
    }

    try {
      await db.transaction();

      // 1. Fetch sender's wallet ID (assuming one wallet per user for NGN for now)
      //    If multiple wallets per user were possible, we'd need a wallet_id from request or a default.
      const senderWallet = await db.findOne('wallets', { user_id: senderId });
      if (!senderWallet) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Sender wallet not found.' });
        return;
      }

      const recipientUser = await db.findOne('users', { user_tag: recipientTag });
      if (!recipientUser) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Recipient user not found. Please check the tag and try again.' });
        return;
      }

      if (recipientUser.id === senderId) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Cannot transfer funds to yourself.' });
        return;
      }

      const recipientWallet = await db.findOne('wallets', { user_id: recipientUser.id });
      if (!recipientWallet) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Recipient wallet not found.' });
        return;
      }

      // 3. Perform atomic debit on sender's wallet
      const debitSenderResult = await db.updateOne(
        'wallets',
        { naira_balance: senderWallet.naira_balance - parsedAmount },
        { user_id: senderId, id: senderWallet.id }
      );

      if (debitSenderResult < 1) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Insufficient balance or sender wallet not found.' });
        return;
      }

      // 4. Credit recipient's wallet
      const creditRecipientResult = await db.updateOne(
        'wallets',
        { naira_balance: recipientWallet.naira_balance + parsedAmount },
        { user_id: recipientUser.id, id: recipientWallet.id }
      );

      // Check affectedRows from the results
      if (creditRecipientResult < 1) {
          await db.rollback();
          // This indicates an issue with crediting, e.g., recipient wallet disappeared, which is highly unlikely if fetched prior.
          res.status(500).json({ status: false, message: 'Failed to credit recipient wallet. Please try again.' });
          return;
      }

      // 5. Log transactions
      await transactionController.addTransaction({
        wallet_id: senderWallet.id,
        type: TransactionType.TRANSFER_SENT, // Use enum member
        amount: -parsedAmount, // Negative for sender
        status: 'COMPLETED',
        description: `Transfer to ${recipientUser.first_name} ${recipientUser.last_name} (${recipientTag})`,
        related_user_id: recipientUser.id, // Add back related_user_id
      });

      await transactionController.addTransaction({
        wallet_id: recipientWallet.id,
        type: TransactionType.TRANSFER_RECEIVED, // Use enum member
        amount: parsedAmount, // Positive for recipient
        status: 'COMPLETED',
        description: `Transfer from ${senderEmail || 'another user'}`, // Restore fallback
        related_user_id: senderId, // Add back related_user_id
      });

      await db.commit();

      // Get sender user details for notification
      const senderUser = await db.findOne('users', { id: senderId });

      // Send email notification to recipient
      if (recipientUser && recipientUser.email) {
        const emailSubject = 'Funds Received';
        const emailHtml = `
          <p>Dear ${recipientUser.first_name || 'User'},</p>
          <p>You have received a transfer of ${parsedAmount.toFixed(2)} NGN from ${senderUser?.first_name || ''} ${senderUser?.last_name || ''} (${senderUser?.user_tag || 'User'}).</p>
          <p>Your new wallet balance reflects this transaction.</p>
          <p>Thank you for using Finwise.</p>
        `;
        try {
          await Email.sendMail(recipientUser.email, emailSubject, emailHtml);
        } catch (emailError) {
          // eslint-disable-next-line no-console
          console.error(`Failed to send transfer received email to ${recipientUser.email}:`, emailError);
          // Log this error but don't fail the entire transaction as funds have been moved.
        }
      }

      res.status(200).json({ status: true, message: 'Transfer successful.' });

    } catch (error) {
      await db.rollback();
      // eslint-disable-next-line no-console
      console.error('Transfer error:', error);
      res.status(500).json({ status: false, message: error instanceof Error ? error.message : 'An internal error occurred during the transfer.' });
    }
  },
};

export default transferController;
