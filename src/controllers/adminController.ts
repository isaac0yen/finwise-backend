import { Request, Response } from 'express';
import { db } from '../service/database';
import { TransactionType } from '../models/transaction';
import Email from '../modules/emailModule';
import transactionController from './transactionController'; // For logging transactions

interface AuthenticatedAdminRequest extends Request {
  context?: { id: number; email: string; isAdmin?: boolean }; // Assuming context from auth middleware
}

const adminController = {
  // Get all pending withdrawal requests
  async getPendingWithdrawals(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const pendingWithdrawals = await db.findMany('pending_withdrawals', { status: 'PENDING_REVIEW' });
      res.status(200).json({ status: true, data: pendingWithdrawals });
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
      res.status(500).json({ status: false, message: 'Internal server error' });
    }
  },

  // Process a specific withdrawal request (approve/reject)
  async processWithdrawalRequest(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id: withdrawalIdStr } = req.params;
    const { action, reason } = req.body; // action: 'APPROVE' | 'REJECT'
    const withdrawalId = parseInt(withdrawalIdStr, 10);

    if (isNaN(withdrawalId)) {
      res.status(400).json({ status: false, message: 'Invalid withdrawal ID format.' });
      return;
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ status: false, message: "Invalid action. Must be 'APPROVE' or 'REJECT'." });
      return;
    }

    await db.transaction(); // Start transaction

    try {
      const pendingWithdrawal = await db.findOne('pending_withdrawals', { id: withdrawalId, status: 'PENDING_REVIEW' });

      if (!pendingWithdrawal) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Pending withdrawal request not found or already processed.' });
        return;
      }

      // Fetch user details for email notification
      const user = await db.findOne('users', { id: pendingWithdrawal.user_id });
      if (!user || !user.email) {
        await db.rollback();
        // Log this, as it's an data integrity issue if user for a withdrawal doesn't exist
        console.error(`User or user email not found for user_id: ${pendingWithdrawal.user_id} during withdrawal processing.`);
        res.status(500).json({ status: false, message: 'User details not found for notification.' });
        return;
      }

      if (action === 'APPROVE') {
        // 1. Perform atomic debit on user's wallet
        // Assuming currency is NGN as per current withdrawal request structure
        const debitResult = await db.updateDirect(
          'UPDATE wallets SET naira_balance = naira_balance - ? WHERE id = ? AND user_id = ? AND naira_balance >= ?',
          [pendingWithdrawal.amount, pendingWithdrawal.wallet_id, pendingWithdrawal.user_id, pendingWithdrawal.amount] as any
        );

        if (debitResult < 1) {
          await db.rollback();
          res.status(400).json({ status: false, message: 'Insufficient balance or wallet update failed.' });
          return;
        }

        // 2. Log transaction
        await transactionController.addTransaction({
          wallet_id: pendingWithdrawal.wallet_id,
          type: TransactionType.WITHDRAWAL, // Using the enum member
          amount: -pendingWithdrawal.amount, // Negative for withdrawal
          status: 'COMPLETED',
          description: `Withdrawal processed. Request ID: ${withdrawalId}`
        });

        // 3. Update pending_withdrawals status
        await db.updateOne('pending_withdrawals', { status: 'APPROVED' }, { id: withdrawalId });

        await db.commit(); // Commit transaction for approval

        // 4. Send success email
        const emailSubject = 'Withdrawal Approved';
        const emailHtml = `
          <p>Dear ${user.first_name || 'User'},</p>
          <p>Your withdrawal request for ${pendingWithdrawal.amount} NGN has been approved and processed.</p>
          <p>The funds should reflect in your designated account shortly.</p>
          <p>Thank you for using Finwise.</p>
        `;
        // Send email asynchronously (fire-and-forget)
        Email.sendMail(user.email, emailSubject, emailHtml)
          .catch(emailError => {
            console.error(`Failed to send withdrawal approval email to ${user.email} (async):`, emailError);
          });

        res.status(200).json({ status: true, message: 'Withdrawal request approved and processed.' });

      } else if (action === 'REJECT') {
        if (!reason) {
          await db.rollback(); // Rollback if transaction was started implicitly for REJECT path without prior guard
          res.status(400).json({ status: false, message: 'Reason for rejection is required.' });
          return;
        }
        await db.updateOne('pending_withdrawals', { status: 'REJECTED', rejection_reason: reason }, { id: withdrawalId });
        
        await db.commit(); // Commit transaction for rejection

        // Send rejection email
        const emailSubject = 'Withdrawal Request Rejected';
        const emailHtml = `
          <p>Dear ${user.first_name || 'User'},</p>
          <p>Your withdrawal request for ${pendingWithdrawal.amount} NGN has been rejected.</p>
          <p>Reason: ${reason}</p>
          <p>If you have any questions, please contact support.</p>
          <p>Thank you for using Finwise.</p>
        `;
        // Send email asynchronously (fire-and-forget)
        Email.sendMail(user.email, emailSubject, emailHtml)
          .catch(emailError => {
            console.error(`Failed to send withdrawal rejection email to ${user.email} (async):`, emailError);
          });

        res.status(200).json({ status: true, message: 'Withdrawal request rejected.' });
      }

    } catch (error) {
      await db.rollback(); // Rollback on any error
      console.error(`Error processing withdrawal request ${withdrawalId}:`, error);
      res.status(500).json({ status: false, message: 'Internal server error' });
    }
  }
};

export default adminController;
