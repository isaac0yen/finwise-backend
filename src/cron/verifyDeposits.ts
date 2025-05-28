import { verifyTransaction } from '../modules/paystack';
import { db } from '../service/database';
import transactionController from '../controllers/transactionController';
import Email from '../modules/emailModule'; // Import Email module
import { TransactionType } from '../models/transaction'; // Import TransactionType

export async function verifyPendingDeposits() {
  const pendingDeposits = await db.findMany('pending_deposits', { status: 'PENDING' });
  for (const deposit of pendingDeposits) {
    try {
      const paystackRes = await verifyTransaction(deposit.paystack_reference);
      if (paystackRes.data.status === 'success') {
        // Fetch user details for email notification
        const user = await db.findOne('users', { id: deposit.user_id });
        if (!user || !user.email) {
          // eslint-disable-next-line no-console
          console.error(`User or user email not found for user_id: ${deposit.user_id} during deposit success.`);
          // Optionally, proceed without email if user not found, or handle error differently
        }

        await db.updateOne(
          'wallets',
          { naira_balance: deposit.amount },
          { id: deposit.wallet_id }
        );
        await db.updateOne('pending_deposits', { status: 'SUCCESS' }, { id: deposit.id });
        await transactionController.addTransaction({
          wallet_id: deposit.wallet_id,
          type: TransactionType.DEPOSIT,
          amount: deposit.amount,
          status: 'COMPLETED',
          description: `Naira deposit via Paystack (ref: ${deposit.paystack_reference})`,
          token_id: null,
          related_user_id: deposit.user_id
        });

        // Send email notification to user
        if (user && user.email) {
          const emailSubject = 'Deposit Successful';
          const emailHtml = `
            <p>Dear ${user.first_name || 'User'},</p>
            <p>Your deposit of ${deposit.amount} NGN has been successfully processed and credited to your wallet.</p>
            <p>Transaction Reference: ${deposit.paystack_reference}</p>
            <p>Thank you for using Finwise.</p>
          `;
          try {
            await Email.sendMail(user.email, emailSubject, emailHtml);
          } catch (emailError) {
            // eslint-disable-next-line no-console
            console.error(`Failed to send deposit success email to ${user.email}:`, emailError);
          }
        }

      } else if (paystackRes.data.status === 'failed') {
        await db.updateOne('pending_deposits', { status: 'FAILED' }, { id: deposit.id });
      }
    } catch (err) {
      // Log error, but don't throw to avoid stopping the cron
      // eslint-disable-next-line no-console
      console.error(`Error processing deposit ID ${deposit.id}:`, err);
    }
  }
}
