import cron from 'node-cron';
import { verifyPendingDeposits } from './verifyDeposits';
import { checkAllWalletBalances } from './balanceIntegrityChecker';

export function startCrons() {
  // Every minute: verify pending naira deposits
  cron.schedule('* * * * *', async () => {
    console.log('Cron job: Verifying pending naira deposits...');
    await verifyPendingDeposits();
    console.log('Cron job: Finished verifying pending naira deposits.');
  });

  // Daily at 2 AM: check wallet balance integrity
  cron.schedule('0 2 * * *', async () => {
    console.log('Cron job: Starting wallet balance integrity check...');
    await checkAllWalletBalances();
    console.log('Cron job: Finished wallet balance integrity check.');
  });

  // Add other cron jobs here, e.g.
  // cron.schedule('0 0 * * *', async () => { ... });
}
