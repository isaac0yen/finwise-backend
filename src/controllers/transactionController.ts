import { Request, Response } from 'express';
import { db } from '../service/database';
import { Transaction, TransactionType } from '../models/transaction';

const transactionController = {
  async addTransaction({
    wallet_id,
    type,
    amount,
    status = 'COMPLETED',
    description = '',
    token_id = null,
    related_user_id = null
  }: {
    wallet_id: number;
    type: TransactionType;
    amount: number;
    status?: 'PENDING' | 'COMPLETED' | 'FAILED';
    description?: string;
    token_id?: number | null;
    related_user_id?: number | null;
  }) {
    return db.insertOne('transactions', {
      wallet_id,
      type,
      amount,
      status,
      description,
      token_id,
      related_user_id
    });
  },

  async getWalletTransactions(req: Request, res: Response) {
    try {
      const userId = (req as any).context?.id;
      if (!userId) {
        return res.status(401).json({ status: false, message: 'Unauthorized' });
      }
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        return res.status(404).json({ status: false, message: 'Wallet not found' });
      }
      const transactions: Transaction[] = (await db.findMany('transactions', { wallet_id: wallet.id })) as Transaction[];
      return res.json({ status: true, transactions });
    } catch (err) {
      return res.status(500).json({ status: false, message: 'Failed to fetch transactions', error: (err as Error).toString() });
    }
  },
};

export default transactionController;
