import { Request, Response } from 'express';
import { db } from '../service/database';
import path from 'path';
import fs from 'fs';

const verificationController = {
  async getVerificationPage(req: Request, res: Response): Promise<void> {
    try {
      // Read the HTML template
      const templatePath = path.join(__dirname, '../templates/verification.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      
      // Send the HTML page
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } catch (error) {
      console.error('Error serving verification page:', error);
      res.status(500).json({ status: false, message: 'Error serving verification page' });
    }
  },

  async getTransactionsData(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = '1', 
        limit = '50', 
        search = '', 
        type = '', 
        startDate = '', 
        endDate = '' 
      } = req.query as Record<string, string>;
      
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      // Build where conditions for simpler queries
      let whereConditions: any = {};
      
      if (type) {
        whereConditions.type = type;
      }
      
      // Use direct string comparison for dates
      if (startDate && endDate) {
        // Will handle with manual filtering since we can't use BETWEEN
      } else if (startDate) {
        // Will handle with manual filtering
      } else if (endDate) {
        // Will handle with manual filtering
      }
      
      // Get all transactions - simplified approach
      // Since we can't use complex options, we'll get all matching transactions
      const allTransactions = await db.findMany('transactions', whereConditions);
      
      // Apply date filtering manually if needed
      let dateFilteredTransactions = allTransactions;
      if (startDate || endDate) {
        dateFilteredTransactions = allTransactions.filter(t => {
          const txDate = new Date(t.created_at).getTime();
          const startOk = !startDate || txDate >= new Date(startDate).getTime();
          const endOk = !endDate || txDate <= new Date(`${endDate} 23:59:59`).getTime();
          return startOk && endOk;
        });
      }
      
      // Sort by created_at descending
      const sortedTransactions = dateFilteredTransactions.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Descending order
      });
      
      // Apply pagination manually
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const transactions = sortedTransactions.slice(startIndex, endIndex);
      
      // Enhance with user info by querying all wallets and users at once
      
      // Get all wallet IDs from transactions
      const walletIds = transactions.map(transaction => transaction.wallet_id);
      
      // Get all wallets in one query
      const allWallets = await db.findMany('wallets', {});
      const relevantWallets = allWallets.filter(wallet => walletIds.includes(wallet.id));
      
      // Get all user IDs from wallets
      const userIds = relevantWallets.map(wallet => wallet.user_id);
      
      // Get all users in one query
      const allUsers = await db.findMany('users', {});
      const relevantUsers = allUsers.filter(user => userIds.includes(user.id));
      
      // Create a map for faster lookups
      const walletMap = {};
      relevantWallets.forEach(wallet => {
        walletMap[wallet.id] = wallet;
      });
      
      const userMap = {};
      relevantUsers.forEach(user => {
        userMap[user.id] = user;
      });
      
      // Enhance transactions with user info
      const transactionsWithUserInfo = transactions.map(transaction => {
        const wallet = walletMap[transaction.wallet_id];
        if (!wallet) {
          return {
            ...transaction,
            email: 'Unknown',
            first_name: 'Unknown',
            last_name: 'Unknown'
          };
        }
        
        const user = userMap[wallet.user_id];
        if (!user) {
          return {
            ...transaction,
            email: 'Unknown',
            first_name: 'Unknown',
            last_name: 'Unknown'
          };
        }
        
        return {
          ...transaction,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        };
      });

      // Filter by search term if provided (since we can't do this in the DB query easily)
      let searchFilteredTransactions = transactionsWithUserInfo;
      if (search) {
        const searchLower = search.toLowerCase();
        searchFilteredTransactions = transactionsWithUserInfo.filter(t => {
          // Create a type-safe check for each property
          const descMatch = 'description' in t && t.description ? 
                           t.description.toString().toLowerCase().includes(searchLower) : false;
          const emailMatch = t.email ? t.email.toString().toLowerCase().includes(searchLower) : false;
          const firstNameMatch = t.first_name ? t.first_name.toString().toLowerCase().includes(searchLower) : false;
          const lastNameMatch = t.last_name ? t.last_name.toString().toLowerCase().includes(searchLower) : false;
          
          return descMatch || emailMatch || firstNameMatch || lastNameMatch;
        });
      }
      
      // Count total transactions for pagination - use findMany and count the results
      const allTransactionsForCount = await db.findMany('transactions', whereConditions);
      const totalCount = allTransactionsForCount.length;
      
      // Get financial integrity metrics
      // Use direct function call instead of this.method to avoid binding issues
      const financialSummary = await verificationController.getFinancialSummary();
      
      res.json({
        status: true,
        transactions: searchFilteredTransactions,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        financialSummary
      });
    } catch (error) {
      console.error('Error fetching transactions data:', error);
      res.status(500).json({ status: false, message: 'Error fetching transactions data' });
    }
  },
  
  async getFinancialSummary(): Promise<any> {
    // Use aggregation helper methods instead of raw SQL
    
    // Get deposits sum
    const deposits = await db.findMany('transactions', { 
      type: 'DEPOSIT', 
      status: 'COMPLETED' 
    });
    const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    
    // Get withdrawals sum
    const withdrawals = await db.findMany('transactions', { 
      type: 'WITHDRAWAL', 
      status: 'COMPLETED' 
    });
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    
    // Get token buys sum
    const buys = await db.findMany('transactions', { 
      type: 'BUY', 
      status: 'COMPLETED' 
    });
    const totalBuys = buys.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    
    // Get token sells sum
    const sells = await db.findMany('transactions', { 
      type: 'SELL', 
      status: 'COMPLETED' 
    });
    const totalSells = sells.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    
    // Get fees sum
    const feesTransactions = await db.findMany('transactions', { 
      status: 'COMPLETED',
    });
    const totalFees = feesTransactions.reduce((sum, t) => {
      const fee = t.fee ? parseFloat(t.fee.toString()) : 0;
      return sum + (fee > 0 ? fee : 0);
    }, 0);
    
    // Get wallet balances
    const wallets = await db.findMany('wallets', {});
    const totalWalletBalance = wallets.reduce((sum, w) => {
      return sum + parseFloat(w.naira_balance.toString());
    }, 0);
    
    // Calculate expected balance
    const expectedBalance = totalDeposits + totalSells - totalWithdrawals - totalBuys;
    
    // Check if the system is balanced
    const isBalanced = Math.abs(expectedBalance - totalWalletBalance) < 0.01; // Allow for small rounding errors
    
    return {
      totalDeposits,
      totalWithdrawals,
      totalBuys,
      totalSells,
      totalFees,
      totalWalletBalance,
      expectedBalance,
      isBalanced,
      discrepancy: expectedBalance - totalWalletBalance,
      lastChecked: new Date()
    };
  }
};

export default verificationController;
