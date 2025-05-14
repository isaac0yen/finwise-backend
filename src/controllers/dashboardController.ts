import { Request, Response } from 'express';
import { db } from '../service/database';

const dashboardController = {
  getDashboard: async (req: Request, res: Response): Promise<void> => {
    try {
      // Get userId from context (assume middleware sets req.context)
      const userId = (req as any).context?.id;
      if (!userId) {
        res.status(401).json({ status: false, message: 'Unauthorized' });
        return;
      }

      // Fetch user info
      const user = await db.findOne('users', { id: userId });
      if (!user) {
        res.status(404).json({ status: false, message: 'User not found' });
        return;
      }

      // Fetch wallet info
      const wallet = await db.findOne('wallets', { user_id: userId });
      // Fetch token balances
      const tokenBalances = await db.find('token_balances', { user_id: userId });
      // Fetch all available tokens
      const tokens = await db.find('tokens', {});
      // Fetch token market info
      const tokenMarkets = await db.find('token_markets', {});

      // Aggregate token balances with token and market info
      const portfolio = tokenBalances?.map((balance: any) => {
        const token = tokens?.find((t: any) => t.id === balance.token_id);
        const market = tokenMarkets?.find((m: any) => m.token_id === balance.token_id);
        return {
          token: token?.symbol,
          institution: token?.institution,
          balance: balance.balance,
          price: market?.price,
          value: market && balance ? Number(balance.balance) * Number(market.price) : 0
        };
      });

      // Aggregate market trends
      const marketTrends = tokens?.map((token: any) => {
        const market = tokenMarkets?.find((m: any) => m.token_id === token.id);
        return {
          token: token.symbol,
          price: market?.price,
          volume: market?.volume,
          liquidity_pool: market?.liquidity_pool,
          volatility: market?.volatility,
          sentiment: market?.sentiment
        };
      });

      res.json({
        status: true,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          naira_balance: wallet?.naira_balance || 0,
        },
        portfolio,
        marketTrends
      });
    } catch (err) {
      res.status(500).json({ status: false, message: 'Server error', error: (err as Error).toString() });
    }
  }
};

export default dashboardController;
