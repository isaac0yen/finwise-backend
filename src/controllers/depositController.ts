import { Request, Response } from 'express';
import { initializeTransaction, verifyTransaction } from '../modules/paystack';
import { db } from '../service/database';

const depositController = {
  // User starts a deposit
  initializeDeposit: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).context?.id;
      const { amount } = req.body;
      if (!userId || !amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ status: false, message: 'Invalid user or amount' });
      }
      // Fetch user and wallet
      const user = await db.findOne('users', { id: userId });
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!user || !wallet) {
        return res.status(404).json({ status: false, message: 'User or wallet not found' });
      }
      // Initialize Paystack transaction
      const paystackRes = await initializeTransaction(user.email, amount, { userId });
      const reference = paystackRes.data.reference;
      await db.insertOne('pending_deposits', {
        user_id: userId,
        wallet_id: wallet.id,
        amount,
        paystack_reference: reference,
        status: 'PENDING',
      });
      return res.json({ status: true, authorization_url: paystackRes.data.authorization_url, reference });
    } catch (err) {
      return res.status(500).json({ status: false, message: 'Failed to initialize deposit', error: (err as Error).toString() });
    }
  },

  // Manual verification endpoint (optional, for fallback/testing)
  verifyDeposit: async (req: Request, res: Response) => {
    try {
      const { reference } = req.params;
      if (!reference) {
        return res.status(400).json({ status: false, message: 'Reference is required' });
      }
      // Find pending deposit
      const deposit = await db.findOne('pending_deposits', { paystack_reference: reference, status: 'PENDING' });
      if (!deposit) {
        return res.status(404).json({ status: false, message: 'Pending deposit not found' });
      }
      // Verify with Paystack
      const paystackRes = await verifyTransaction(reference);
      if (paystackRes.data.status === 'success') {
        // Update wallet balance
        const wallet = await db.findOne('wallets', { id: deposit.wallet_id });
        if (!wallet) {
          return res.status(404).json({ status: false, message: 'Wallet not found' });
        }
        await db.updateOne('wallets', { naira_balance: parseFloat(wallet.naira_balance) + parseFloat(deposit.amount) }, { id: deposit.wallet_id });
        // Mark deposit as SUCCESS
        await db.updateOne('pending_deposits', { status: 'SUCCESS' }, { id: deposit.id });
        // Add transaction record
        const transactionController = require('./transactionController').default;
        await transactionController.addTransaction({
          wallet_id: deposit.wallet_id,
          type: 'DEPOSIT',
          amount: deposit.amount,
          status: 'COMPLETED',
          description: `Naira deposit via Paystack (ref: ${deposit.paystack_reference})`,
          token_id: null,
          related_user_id: deposit.user_id
        });
        return res.json({ status: true, message: 'Deposit successful' });
      } else {
        await db.updateOne('pending_deposits', { status: 'FAILED' }, { id: deposit.id });
        return res.status(400).json({ status: false, message: 'Deposit not successful' });
      }
    } catch (err) {
      return res.status(500).json({ status: false, message: 'Failed to verify deposit', error: (err as Error).toString() });
    }
  }
};

export default depositController;
