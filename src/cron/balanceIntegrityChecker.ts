/* eslint-disable no-console */
import { db } from '../service/database';

interface Wallet {
  id: number;
  user_id: number;
  naira_balance: number | string; // Assuming naira_balance could be string from DB
  // Add other wallet fields if needed, e.g., satoshi_balance
}

interface Transaction {
  id: number;
  wallet_id: number;
  amount: number | string; // Assuming amount could be string from DB
  type: string;
  // Add other transaction fields if needed
}

export const checkAllWalletBalances = async (): Promise<void> => {
  console.log('Starting wallet balance integrity check...');
  let discrepanciesFound = 0;

  try {
    const wallets: Wallet[] = await db.findMany('wallets', {}) as Wallet[];

    if (!wallets || wallets.length === 0) {
      console.log('No wallets found to check.');
      return;
    }

    for (const wallet of wallets) {
      const transactions: Transaction[] = await db.findMany('transactions', { wallet_id: wallet.id }) as Transaction[];

      let calculatedNairaBalance = 0;
      for (const tx of transactions) {
        calculatedNairaBalance += parseFloat(tx.amount as string); // Ensure amount is treated as number
      }

      const storedNairaBalance = parseFloat(wallet.naira_balance as string);

      // Compare balances, typically with a small tolerance for floating point arithmetic if applicable,
      // but for sums of exact DB values, direct comparison after parsing should be fine.
      // Using toFixed(2) for currency comparison is a good practice.
      if (storedNairaBalance.toFixed(2) !== calculatedNairaBalance.toFixed(2)) {
        discrepanciesFound++;
        console.warn(`DISCREPANCY FOUND for Wallet ID: ${wallet.id} (User ID: ${wallet.user_id})`);
        console.warn(`  Stored Naira Balance: ${storedNairaBalance.toFixed(2)}`);
        console.warn(`  Calculated Naira Balance from transactions: ${calculatedNairaBalance.toFixed(2)}`);
        console.warn(`  Difference: ${(storedNairaBalance - calculatedNairaBalance).toFixed(2)}`);
        // TODO: Consider more robust logging or alerting (e.g., email admin, log to DB table)
      }
    }

    if (discrepanciesFound === 0) {
      console.log('Wallet balance integrity check completed. No discrepancies found.');
    } else {
      console.warn(`Wallet balance integrity check completed. Found ${discrepanciesFound} discrepancy/discrepancies.`);
    }

  } catch (error) {
    console.error('Error during wallet balance integrity check:', error);
  }
};

// If you want to run this script directly for testing:
// (async () => {
//   await require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Adjust path to .env if necessary
//   await require('../service/database').DBConnect(); // Ensure DB is connected
//   await checkAllWalletBalances();
//   await require('../service/database').DBClose(); // Close DB connection
// })();
