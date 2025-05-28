import { Request, Response } from 'express';
import { db } from '../service/database';
import { TransactionType } from '../models/transaction';
import { PRICE_MOVEMENT_RULES, UNIVERSITY_TOKENS, TokenEventType } from '../models/universityToken';
import Email from '../modules/emailModule';
import { marketService } from '../service/marketService';

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface AuthenticatedRequest extends Request {
  context?: User;
}

const tokenController = {
  // Get all available tokens
  async getAllTokens(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await db.findMany('tokens', {}, { 
        columns: "id, name, symbol, institution, total_supply, circulating_supply, initial_price"
      });
      
      // Get current prices from token_markets - get all and filter in JavaScript
      const tokenIds = tokens.map(token => token.id);
      const allMarketData = await db.findMany('token_markets', {});
      const marketData = allMarketData.filter(market => tokenIds.includes(market.token_id));
      
      // Map market data to tokens
      const tokensWithPrices = tokens.map(token => {
        const market = marketData.find(m => m.token_id === token.id);
        return {
          id: token.id,
          name: token.name,
          symbol: token.symbol,
          institution: token.institution,
          totalSupply: token.total_supply,
          circulatingSupply: token.circulating_supply,
          initialPrice: token.initial_price,
          currentPrice: market ? Number(market.price.toFixed(8)) : Number(token.initial_price.toFixed(8)),
          priceChange24h: market ? Number(market.price_change_24h.toFixed(5)) : 0,
          volume24h: market ? Number(market.volume.toFixed(18)) : Number('0.000000000000000000'),
          liquidityPool: market ? Number(market.liquidity_pool.toFixed(18)) : Number((token.total_supply * token.initial_price * 0.1).toFixed(18)),
          volatility: market ? Number(market.volatility.toFixed(5)) : Number('0.05000'),
          sentiment: market ? market.sentiment : 'NEUTRAL'
        };
      });
      
      res.status(200).json({
        status: true,
        tokens: tokensWithPrices
      });
    } catch (error) {
      console.error('Get all tokens error:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to retrieve tokens'
      });
    }
  },
  
  // Get token market data
  async getMarketData(req: Request, res: Response): Promise<void> {
    try {
      // Get all tokens with their market data
      const tokens = await db.findMany('tokens', {});
      const tokenIds = tokens.map(token => token.id);
      // Get all market data and filter in JavaScript
      const allMarketData = await db.findMany('token_markets', {});
      const marketData = allMarketData.filter(market => tokenIds.includes(market.token_id));
      
      // Format market data response
      const prices: Record<string, any> = {};
      tokens.forEach(token => {
        const market = marketData.find(m => m.token_id === token.id);
        if (market) {
          prices[token.symbol] = {
            current: Number(market.price.toFixed(8)),
            change24h: Number(market.price_change_24h.toFixed(5)),
            volume24h: Number(market.volume.toFixed(18)),
            liquidityPool: Number(market.liquidity_pool.toFixed(18)),
            volatility: Number(market.volatility.toFixed(5)),
            sentiment: market.sentiment
          };
        }
      });
      
      // Get top gainers, losers, and most traded
      const sortedByChange = [...marketData].sort((a, b) => b.price_change_24h - a.price_change_24h);
      const sortedByVolume = [...marketData].sort((a, b) => b.volume - a.volume);
      
      const topGainers = sortedByChange.slice(0, 3).map(market => {
        const token = tokens.find(t => t.id === market.token_id);
        return {
          symbol: token?.symbol,
          name: token?.name,
          change: Number(market.price_change_24h.toFixed(5)),
          price: Number(market.price.toFixed(8)),
          volume: Number(market.volume.toFixed(18)),
          liquidityPool: Number(market.liquidity_pool.toFixed(18)),
          volatility: Number(market.volatility.toFixed(5)),
          sentiment: market.sentiment
        };
      });
      
      const topLosers = sortedByChange.slice(-3).reverse().map(market => {
        const token = tokens.find(t => t.id === market.token_id);
        return {
          symbol: token?.symbol,
          name: token?.name,
          change: Number(market.price_change_24h.toFixed(5)),
          price: Number(market.price.toFixed(8)),
          volume: Number(market.volume.toFixed(18)),
          liquidityPool: Number(market.liquidity_pool.toFixed(18)),
          volatility: Number(market.volatility.toFixed(5)),
          sentiment: market.sentiment
        };
      });
      
      const mostTraded = sortedByVolume.slice(0, 3).map(market => {
        const token = tokens.find(t => t.id === market.token_id);
        return {
          symbol: token?.symbol,
          name: token?.name,
          volume: Number(market.volume.toFixed(18)),
          price: Number(market.price.toFixed(8)),
          change: Number(market.price_change_24h.toFixed(5)),
          liquidityPool: Number(market.liquidity_pool.toFixed(18)),
          volatility: Number(market.volatility.toFixed(5)),
          sentiment: market.sentiment
        };
      });
      
      res.status(200).json({
        status: true,
        prices,
        marketTrends: {
          topGainers,
          topLosers,
          mostTraded
        }
      });
    } catch (error) {
      console.error('Get market data error:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to retrieve market data'
      });
    }
  },
  
  // Buy tokens
  async buyTokens(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.context?.id;
    
    if (!userId) {
      res.status(401).json({ status: false, message: 'Unauthorized. User ID not found.' });
      return;
    }
    
    const { tokenId, quantity, price } = req.body;
    
    if (!tokenId || !quantity || !price) {
      res.status(400).json({ status: false, message: 'Token ID, quantity, and price are required.' });
      return;
    }
    
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);
    
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      res.status(400).json({ status: false, message: 'Invalid token quantity.' });
      return;
    }
    
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ status: false, message: 'Invalid token price.' });
      return;
    }
    
    // Calculate total cost
    const totalCost = parsedQuantity * parsedPrice;
    
    try {
      await db.transaction();
      
      // Get user's wallet
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Wallet not found.' });
        return;
      }
      
      // Check if user has enough balance
      if (wallet.naira_balance < totalCost) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Insufficient balance.' });
        return;
      }
      
      // Get token data
      const token = await db.findOne('tokens', { id: tokenId });
      if (!token) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Token not found.' });
        return;
      }
      
      // Get token market data to verify price
      const tokenMarket = await db.findOne('token_markets', { token_id: tokenId });
      if (!tokenMarket) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Token market data not found.' });
        return;
      }
      
      // Verify price is within acceptable range (±2% of current price)
      const currentPrice = tokenMarket.price;
      const priceDiffPercentage = Math.abs((parsedPrice - currentPrice) / currentPrice);
      if (priceDiffPercentage > 0.02) {
        await db.rollback();
        res.status(400).json({ 
          status: false, 
          message: 'Price has changed. Current price: ' + currentPrice 
        });
        return;
      }
      
      // Deduct amount from user's wallet using updateOne
      const newBalance = wallet.naira_balance - totalCost;
      const newInvested = (wallet.total_invested || 0) + totalCost;
      if (newBalance < 0) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Insufficient balance.' });
        return;
      }
      const debitResult = await db.updateOne(
        'wallets',
        { naira_balance: newBalance, total_invested: newInvested },
        { id: wallet.id }
      );
      if (debitResult < 1) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Failed to update wallet balance.' });
        return;
      }
      
      // Update or create token balance for user
      const existingBalance = await db.findOne('token_balances', { 
        user_id: userId,
        token_id: tokenId
      });
      
      if (existingBalance) {
        // Calculate new average buy price and total invested
        const newTotalTokens = existingBalance.balance + parsedQuantity;
        const newTotalInvested = existingBalance.total_invested + totalCost;
        const newAverageBuyPrice = newTotalInvested / newTotalTokens;
        
        // Update existing balance
        const updateResult = await db.updateOne('token_balances', {
          balance: newTotalTokens,
          average_buy_price: newAverageBuyPrice,
          total_invested: newTotalInvested
        }, {
          id: existingBalance.id
        });
        
        if (updateResult < 1) {
          await db.rollback();
          res.status(400).json({ status: false, message: 'Failed to update token balance.' });
          return;
        }
      } else {
        // Create new token balance
        const insertResult = await db.insertOne('token_balances', {
          user_id: userId,
          token_id: tokenId,
          balance: parsedQuantity,
          average_buy_price: parsedPrice,
          total_invested: totalCost
        });
        
        if (insertResult < 1) {
          await db.rollback();
          res.status(400).json({ status: false, message: 'Failed to create token balance.' });
          return;
        }
      }
      
      // Record transaction
      const transactionResult = await db.insertOne('transactions', {
        wallet_id: wallet.id,
        type: TransactionType.BUY,
        amount: -totalCost, // Negative because money is leaving wallet
        token_id: tokenId,
        token_quantity: parsedQuantity,
        token_price: parsedPrice,
        status: 'COMPLETED',
        description: `Bought ${parsedQuantity} ${token.symbol} tokens at ₦${parsedPrice} each.`
      });
      
      if (transactionResult < 1) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Failed to record transaction.' });
        return;
      }
      
      // Update token price based on this purchase
      const newPrice = await marketService.updatePriceOnTrade(
        tokenId,
        true, // this is a buy order
        parsedQuantity,
        totalCost
      );
      
      await db.commit();
      
      res.status(200).json({
        status: true,
        message: 'Tokens purchased successfully.',
        transaction: {
          tokenSymbol: token.symbol,
          quantity: parsedQuantity,
          price: parsedPrice,
          totalCost,
          newBalance: existingBalance ? existingBalance.balance + parsedQuantity : parsedQuantity
        }
      });
      
    } catch (error) {
      await db.rollback();
      console.error('Buy tokens error:', error);
      res.status(500).json({
        status: false,
        message: 'An error occurred while processing your purchase.'
      });
    }
  },
  
  // Sell tokens
  async sellTokens(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.context?.id;
    
    if (!userId) {
      res.status(401).json({ status: false, message: 'Unauthorized. User ID not found.' });
      return;
    }
    
    const { tokenId, quantity, price } = req.body;
    
    if (!tokenId || !quantity || !price) {
      res.status(400).json({ status: false, message: 'Token ID, quantity, and price are required.' });
      return;
    }
    
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);
    
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      res.status(400).json({ status: false, message: 'Invalid token quantity.' });
      return;
    }
    
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ status: false, message: 'Invalid token price.' });
      return;
    }
    
    try {
      await db.transaction();
      
      // Get user's wallet
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Wallet not found.' });
        return;
      }
      
      // Get token data
      const token = await db.findOne('tokens', { id: tokenId });
      if (!token) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Token not found.' });
        return;
      }
      
      // Get token balance
      const tokenBalance = await db.findOne('token_balances', { 
        user_id: userId,
        token_id: tokenId
      });
      
      if (!tokenBalance || tokenBalance.balance < parsedQuantity) {
        await db.rollback();
        res.status(400).json({ status: false, message: 'Insufficient token balance.' });
        return;
      }
      
      // Get token market data to verify price
      const tokenMarket = await db.findOne('token_markets', { token_id: tokenId });
      if (!tokenMarket) {
        await db.rollback();
        res.status(404).json({ status: false, message: 'Token market data not found.' });
        return;
      }
      
      // Verify price is within acceptable range (±2% of current price)
      const currentPrice = tokenMarket.price;
      const priceDiffPercentage = Math.abs((parsedPrice - currentPrice) / currentPrice);
      if (priceDiffPercentage > 0.02) {
        await db.rollback();
        res.status(400).json({ 
          status: false, 
          message: 'Price has changed. Current price: ' + currentPrice 
        });
        return;
      }
      
      // Calculate total sale value and profit/loss
      const totalSaleValue = parsedQuantity * parsedPrice;
      const costBasis = parsedQuantity * tokenBalance.average_buy_price;
      const profitLoss = totalSaleValue - costBasis;
      
      // Calculate fee (10% of profit, if profit is positive)
      let fee = 0;
      if (profitLoss > 0) {
        fee = profitLoss * 0.1; // 10% of profit
      }
      
      // Calculate net amount after fees
      const netAmount = totalSaleValue - fee;
      
      // Update token balance
      const newBalance = tokenBalance.balance - parsedQuantity;
      
      if (newBalance > 0) {
        // If user still has tokens, update the balance
        await db.updateOne('token_balances', {
          balance: newBalance
        }, {
          id: tokenBalance.id
        });
      } else {
        // If user has sold all tokens, remove the record
        await db.deleteOne('token_balances', { id: tokenBalance.id });
      }
      
      // Update wallet: add the sale amount and update realized profits and fees
      await db.updateOne('wallets', {
        naira_balance: wallet.naira_balance + netAmount,
        realized_profits: wallet.realized_profits + (profitLoss > 0 ? profitLoss : 0),
        total_fees_paid: wallet.total_fees_paid + fee
      }, {
        id: wallet.id
      });
      
      // Record transaction
      await db.insertOne('transactions', {
        wallet_id: wallet.id,
        type: TransactionType.SELL,
        amount: netAmount, // Positive because money is entering wallet
        token_id: tokenId,
        token_quantity: parsedQuantity,
        token_price: parsedPrice,
        fee: fee,
        profit_loss: profitLoss,
        status: 'COMPLETED',
        description: `Sold ${parsedQuantity} ${token.symbol} tokens at ₦${parsedPrice} each. ${fee > 0 ? `Fee: ₦${fee.toFixed(2)}` : ''}`
      });
      
      // Update token price based on this sale
      const newPrice = await marketService.updatePriceOnTrade(
        tokenId,
        false, // this is a sell order
        parsedQuantity,
        totalSaleValue
      );
      
      await db.commit();
      
      // Send notification if significant profit
      if (profitLoss > 1000) { // If profit is over ₦1000
        try {
          const user = await db.findOne('users', { id: userId });
          if (user && user.email) {
            const emailSubject = 'Profitable Token Sale';
            const emailHtml = `
              <p>Dear ${user.first_name || 'User'},</p>
              <p>Congratulations! You've made a profit of ₦${profitLoss.toFixed(2)} from your recent sale of ${parsedQuantity} ${token.symbol} tokens.</p>
              <p>Sale Details:</p>
              <ul>
                <li>Tokens Sold: ${parsedQuantity} ${token.symbol}</li>
                <li>Sale Price: ₦${parsedPrice} per token</li>
                <li>Total Sale Value: ₦${totalSaleValue.toFixed(2)}</li>
                <li>Profit: ₦${profitLoss.toFixed(2)}</li>
                <li>Fee (10% of profit): ₦${fee.toFixed(2)}</li>
                <li>Net Amount: ₦${netAmount.toFixed(2)}</li>
              </ul>
              <p>This amount has been added to your wallet balance.</p>
              <p>Thank you for using Finwise!</p>
            `;
            
            await Email.sendMail(user.email, emailSubject, emailHtml);
          }
        } catch (emailError) {
          console.error('Failed to send profit notification email:', emailError);
          // Don't fail the transaction because of email error
        }
      }
      
      res.status(200).json({
        status: true,
        message: 'Tokens sold successfully.',
        transaction: {
          tokenSymbol: token.symbol,
          quantity: parsedQuantity,
          price: parsedPrice,
          totalSaleValue,
          profit: profitLoss,
          fee,
          netAmount,
          newBalance
        }
      });
      
    } catch (error) {
      await db.rollback();
      console.error('Sell tokens error:', error);
      res.status(500).json({
        status: false,
        message: 'An error occurred while processing your sale.'
      });
    }
  },
  
  // Get user portfolio
  async getUserPortfolio(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.context?.id;
    
    if (!userId) {
      res.status(401).json({ status: false, message: 'Unauthorized. User ID not found.' });
      return;
    }
    
    try {
      // Get user's wallet
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        res.status(404).json({ status: false, message: 'Wallet not found.' });
        return;
      }
      
      // Get user's token balances
      const tokenBalances = await db.findMany('token_balances', { user_id: userId });
      
      if (tokenBalances.length === 0) {
        res.status(200).json({
          status: true,
          portfolio: {
            nairaBalance: wallet.naira_balance,
            tokens: {},
            totalInvested: wallet.total_invested,
            totalCurrentValue: wallet.naira_balance,
            realizedProfits: wallet.realized_profits,
            unrealizedProfits: 0,
            totalFeesPaid: wallet.total_fees_paid
          },
          currentPrices: {},
          profitAnalysis: {
            bestPerforming: null,
            worstPerforming: null,
            totalROI: 0
          }
        });
        return;
      }
      
      // Get token data
      const tokenIds = tokenBalances.map(balance => balance.token_id);
      
      // Fetch all tokens at once and filter in JavaScript
      const allTokens = await db.findMany('tokens', {});
      const tokens = allTokens.filter(token => tokenIds.includes(token.id));
      
      // Fetch all market data at once and filter in JavaScript
      const allMarketData = await db.findMany('token_markets', {});
      const marketData = allMarketData.filter(market => tokenIds.includes(market.token_id));
      
      // Format portfolio data
      const portfolioTokens: Record<string, any> = {};
      let totalCurrentValue = wallet.naira_balance;
      let totalUnrealizedProfit = 0;
      const tokenProfits: Array<{ symbol: string, profitPercentage: number }> = [];
      const currentPrices: Record<string, number> = {};
      
      tokenBalances.forEach(balance => {
        const token = tokens.find(t => t.id === balance.token_id);
        const market = marketData.find(m => m.token_id === balance.token_id);
        
        if (token && market) {
          const currentPrice = market.price;
          const currentValue = balance.balance * currentPrice;
          const investedAmount = balance.total_invested;
          const unrealizedProfit = currentValue - investedAmount;
          const profitPercentage = investedAmount > 0 ? (unrealizedProfit / investedAmount) * 100 : 0;
          
          portfolioTokens[token.symbol] = {
            quantity: balance.balance,
            averageBuyPrice: balance.average_buy_price,
            currentPrice,
            currentValue,
            totalInvested: investedAmount,
            unrealizedProfit,
            profitPercentage
          };
          
          currentPrices[token.symbol] = currentPrice;
          totalCurrentValue += currentValue;
          totalUnrealizedProfit += unrealizedProfit;
          
          tokenProfits.push({
            symbol: token.symbol,
            profitPercentage
          });
        }
      });
      
      // Sort tokens by profit percentage to find best and worst performers
      tokenProfits.sort((a, b) => b.profitPercentage - a.profitPercentage);
      const bestPerforming = tokenProfits.length > 0 ? tokenProfits[0].symbol : null;
      const worstPerforming = tokenProfits.length > 0 ? tokenProfits[tokenProfits.length - 1].symbol : null;
      
      // Calculate total ROI
      const totalInvested = wallet.total_invested;
      const totalROI = totalInvested > 0 ? 
        ((totalCurrentValue + wallet.realized_profits - totalInvested) / totalInvested) * 100 : 0;
      
      res.status(200).json({
        status: true,
        portfolio: {
          nairaBalance: wallet.naira_balance,
          tokens: portfolioTokens,
          totalInvested,
          totalCurrentValue,
          realizedProfits: wallet.realized_profits,
          unrealizedProfits: totalUnrealizedProfit,
          totalFeesPaid: wallet.total_fees_paid
        },
        currentPrices,
        profitAnalysis: {
          bestPerforming,
          worstPerforming,
          totalROI
        }
      });
      
    } catch (error) {
      console.error('Get user portfolio error:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to retrieve portfolio data'
      });
    }
  },
  
  // Get transaction history
  async getTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.context?.id;
    
    if (!userId) {
      res.status(401).json({ status: false, message: 'Unauthorized. User ID not found.' });
      return;
    }
    
    try {
      // Get user's wallet
      const wallet = await db.findOne('wallets', { user_id: userId });
      if (!wallet) {
        res.status(404).json({ status: false, message: 'Wallet not found.' });
        return;
      }
      
      // Get transaction history
      const transactions = await db.findDirect(
        `SELECT t.*, tk.symbol as token_symbol, tk.name as token_name 
         FROM transactions t 
         LEFT JOIN tokens tk ON t.token_id = tk.id 
         WHERE t.wallet_id = ? 
         AND (t.type = 'BUY' OR t.type = 'SELL') 
         ORDER BY t.created_at DESC 
         LIMIT 50`,
        [wallet.id] as any
      );
      
      // Format response
      const formattedTransactions = transactions.map((transaction: any) => ({
        id: transaction.id,
        type: transaction.type,
        tokenSymbol: transaction.token_symbol,
        tokenName: transaction.token_name,
        quantity: transaction.token_quantity,
        price: transaction.token_price,
        amount: Math.abs(transaction.amount),
        fee: transaction.fee,
        profitLoss: transaction.profit_loss,
        status: transaction.status,
        description: transaction.description,
        date: transaction.created_at
      }));
      
      // Calculate summary
      const totalVolume = transactions.reduce((sum, t: any) => sum + Math.abs(t.amount), 0);
      const totalFees = transactions.reduce((sum, t: any) => sum + (t.fee || 0), 0);
      const totalTrades = transactions.length;
      const profitableTrades = transactions.filter((t: any) => t.profit_loss > 0).length;
      
      res.status(200).json({
        status: true,
        transactions: formattedTransactions,
        summary: {
          totalVolume,
          totalFees,
          totalTrades,
          profitableTrades
        }
      });
      
    } catch (error) {
      console.error('Get transaction history error:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to retrieve transaction history'
      });
    }
  },
  
  // Initialize university tokens
  async initializeTokens(req: Request, res: Response): Promise<void> {
    try {
      await db.transaction();
      
      // Check if tokens already exist
      const existingTokens = await db.findMany('tokens', {});
      
      if (existingTokens.length > 0) {
        await db.rollback();
        res.status(400).json({
          status: false,
          message: 'Tokens have already been initialized'
        });
        return;
      }
      
      // Insert university tokens
      for (const [symbol, data] of Object.entries(UNIVERSITY_TOKENS)) {
        const tokenId = await db.insertOne('tokens', {
          name: data.name,
          symbol,
          institution: data.name,
          total_supply: data.totalSupply,
          circulating_supply: data.totalSupply * 0.1, // 10% initial circulating supply
          initial_price: data.initialPrice,
          decimals: 18
        });
        
        // Create initial market data
        await db.insertOne('token_markets', {
          token_id: tokenId,
          price: data.initialPrice,
          volume: 0,
          liquidity_pool: data.totalSupply * data.initialPrice * 0.01, // 1% of market cap
          volatility: 0.05, // 5% initial volatility
          sentiment: 'NEUTRAL',
          price_change_24h: 0
        });
      }
      
      await db.commit();
      
      res.status(200).json({
        status: true,
        message: 'University tokens initialized successfully'
      });
      
    } catch (error) {
      await db.rollback();
      console.error('Initialize tokens error:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to initialize tokens'
      });
    }
  }
};

export default tokenController;
