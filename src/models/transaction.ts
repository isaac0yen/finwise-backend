/* eslint-disable no-unused-vars */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER_SENT = 'TRANSFER_SENT',
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED'
}

export interface Transaction {
  id?: number;
  wallet_id: number;
  user_id: number;
  type: TransactionType;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  reference?: string;
  description?: string;
  related_wallet_id?: number; // for transfers
  created_at?: Date;
}
