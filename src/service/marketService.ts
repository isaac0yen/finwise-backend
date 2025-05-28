import { db } from './database';
import { PRICE_MOVEMENT_RULES, RANDOM_EVENTS, TokenEventType } from '../models/universityToken';

/**
 * Market service for handling token price updates and market events
 */
class MarketService {
  private isUpdating = false;
  private marketIntervalId: NodeJS.Timeout | null = null;
  private eventIntervalId: NodeJS.Timeout | null = null;

  /**
   * Starts the market service
   */
  public start(): void {
    if (!this.marketIntervalId) {
      // Update prices every 5 minutes
      this.marketIntervalId = setInterval(() => this.updateMarketPrices(), PRICE_MOVEMENT_RULES.volatilityWindow);
      console.log('Market price update service started');
    }

    if (!this.eventIntervalId) {
      // Check for random events every hour
      this.eventIntervalId = setInterval(() => this.checkForRandomEvents(), 3600000);
      console.log('Market events service started');
    }
  }

  /**
   * Stops the market service
   */
  public stop(): void {
    if (this.marketIntervalId) {
      clearInterval(this.marketIntervalId);
      this.marketIntervalId = null;
      console.log('Market price update service stopped');
    }

    if (this.eventIntervalId) {
      clearInterval(this.eventIntervalId);
      this.eventIntervalId = null;
      console.log('Market events service stopped');
    }
  }

  /**
   * Updates market prices based on various factors
   */
  private async updateMarketPrices(): Promise<void> {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      // Get all tokens
      const tokens = await db.findMany('tokens', {});
      const tokenIds = tokens.map(token => token.id);
      
      // Get market data for all tokens - get all and filter in JavaScript
      const allMarketData = await db.findMany('token_markets', {});
      const marketData = allMarketData.filter(market => tokenIds.includes(market.token_id));
      
      // Get active market events - get all and filter in JavaScript
      const now = new Date();
      const allEvents = await db.findMany('market_events', { is_active: true });
      const activeEvents = allEvents.filter(event => {
        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);
        return startTime <= now && endTime >= now;
      });

      // Process each token
      for (const token of tokens) {
        const market = marketData.find(m => m.token_id === token.id);
        if (!market) continue;

        // Calculate new price based on multiple factors
        const currentPrice = Number(market.price);
        let newPrice = currentPrice;

        // 1. Apply time-based trend (random walk)
        const timeBasedTrend = this.getRandomVolatility(Number(market.volatility));
        newPrice *= (1 + timeBasedTrend);

        // 2. Apply market hours volatility
        const hour = now.getHours();
        if (hour >= PRICE_MOVEMENT_RULES.marketHours.start && hour < PRICE_MOVEMENT_RULES.marketHours.end) {
          // During market hours, increase volatility
          newPrice *= (1 + this.getRandomVolatility(Number(market.volatility) * 1.5));
        }

        // 3. Apply active market events
        for (const event of activeEvents) {
          // Check if this token is affected by the event
          const affectedTokens = JSON.parse(event.tokens_affected || '[]');
          if (affectedTokens.includes(token.symbol)) {
            // Apply event effect
            const effectMultiplier = event.effect_type === TokenEventType.BOOST ? 1 + event.magnitude : 
                                    event.effect_type === TokenEventType.DROP ? 1 - event.magnitude : 1;
            newPrice *= effectMultiplier;
          }
        }

        // 4. Apply supply-demand factor (simplified version)
        const supplyFactor = token.circulating_supply / token.total_supply;
        newPrice *= (1 + (0.1 - supplyFactor)); // Lower supply increases price

        // Ensure price is within bounds
        newPrice = Math.max(PRICE_MOVEMENT_RULES.minPrice, Math.min(PRICE_MOVEMENT_RULES.maxPrice, newPrice));
        
        // Enforce max daily change limit
        const maxDailyChange = currentPrice * PRICE_MOVEMENT_RULES.maxDailyChange;
        if (Math.abs(newPrice - currentPrice) > maxDailyChange) {
          newPrice = currentPrice + (newPrice > currentPrice ? maxDailyChange : -maxDailyChange);
        }

        // Calculate price change percentage
        const priceChange = ((newPrice - currentPrice) / currentPrice) * 100;

        // Calculate liquidity pool and volatility
        const liquidityPool = token.circulating_supply * newPrice;
        const volatility = this.calculateVolatility(currentPrice, newPrice);
        
        // Update the market data with all metrics
        await db.updateOne('token_markets', {
          price: Number(newPrice.toFixed(8)),
          price_change_24h: Number(priceChange.toFixed(5)),
          volume: market.volume, // Keep existing volume, it's updated on trades
          liquidity_pool: Number(liquidityPool.toFixed(18)),
          volatility: volatility,
          sentiment: this.getMarketSentiment(priceChange),
          updated_at: new Date()
        }, {
          id: market.id
        });
      }

      console.log(`Updated market prices at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error updating market prices:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Checks for and creates random market events
   */
  private async checkForRandomEvents(): Promise<void> {
    try {
      // Get all tokens
      const tokens = await db.findMany('tokens', {});
      const tokenSymbols = tokens.map(token => token.symbol);
      
      // Process each potential event
      for (const eventTemplate of RANDOM_EVENTS) {
        // Determine if event occurs based on probability
        if (Math.random() < eventTemplate.probability) {
          // Select random tokens to be affected (at least 1, up to 3)
          const tokensToAffect = this.getRandomTokens(tokenSymbols, Math.floor(Math.random() * 3) + 1);
          
          // Create event
          const now = new Date();
          const endTime = new Date(now.getTime() + eventTemplate.duration);
          
          await db.insertOne('market_events', {
            name: eventTemplate.name,
            description: eventTemplate.description,
            effect_type: eventTemplate.effectType,
            magnitude: eventTemplate.magnitude,
            tokens_affected: JSON.stringify(tokensToAffect),
            start_time: now,
            end_time: endTime,
            is_active: true
          });
          
          console.log(`Created market event: ${eventTemplate.name} affecting ${tokensToAffect.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Error creating market events:', error);
    }
  }

  /**
   * Gets a random volatility factor based on the token's volatility parameter
   */
  private getRandomVolatility(baseVolatility: number = 0.05): number {
    // Returns a value between -baseVolatility and +baseVolatility
    return (Math.random() * 2 - 1) * baseVolatility;
  }
  
  /**
   * Calculates volatility based on price changes
   * @param oldPrice Previous price
   * @param newPrice New price
   * @returns Volatility as a percentage (0-10)
   */
  private calculateVolatility(oldPrice: number, newPrice: number): number {
    const priceChange = Math.abs((newPrice - oldPrice) / oldPrice);
    return Math.min(Number((priceChange * 100).toFixed(5)), 10); // Cap at 10% volatility
  }
  
  /**
   * Determines market sentiment based on price change
   * @param priceChange24h 24-hour price change percentage
   * @returns Market sentiment string (BULLISH, BEARISH, NEUTRAL)
   */
  private getMarketSentiment(priceChange24h: number): string {
    if (priceChange24h > 0.5) return 'BULLISH';
    if (priceChange24h < -0.5) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Gets a random subset of tokens
   */
  private getRandomTokens(allTokens: string[], count: number): string[] {
    const shuffled = [...allTokens].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, allTokens.length));
  }

  /**
   * Updates token price immediately after a trade
   * 
   * @param tokenId ID of the token being traded
   * @param isBuy True if this is a buy order, false for sell order
   * @param quantity Amount of tokens being traded
   * @param tradeValue Total value of the trade in naira
   */
  public async updatePriceOnTrade(
    tokenId: number, 
    isBuy: boolean, 
    quantity: number, 
    tradeValue: number
  ): Promise<number> {
    try {
      // Get token data
      const token = await db.findOne('tokens', { id: tokenId });
      if (!token) {
        throw new Error(`Token with ID ${tokenId} not found`);
      }

      // Get current market data
      const market = await db.findOne('token_markets', { token_id: tokenId });
      if (!market) {
        throw new Error(`Market data for token ID ${tokenId} not found`);
      }

      const currentPrice = Number(market.price);
      const totalSupply = Number(token.total_supply);
      const circulatingSupply = Number(token.circulating_supply);

      // Calculate price impact based on trade size relative to token liquidity
      // Smaller tokens or larger trades have bigger impact
      const liquidityFactor = circulatingSupply / totalSupply;
      const tradeSizeFactor = quantity / circulatingSupply;
      
      // Base impact percentage - larger for less liquid tokens
      let baseImpactPercentage = (1 - liquidityFactor) * PRICE_MOVEMENT_RULES.tradeImpactMultiplier;
      
      // Scale based on size of trade
      const scaledImpact = baseImpactPercentage * tradeSizeFactor * 100;
      
      // Cap the maximum impact to prevent extreme price movements
      const cappedScaledImpact = Math.min(
        scaledImpact, 
        PRICE_MOVEMENT_RULES.maxTradeImpactPercentage
      );

      // Apply direction - buys increase price, sells decrease price
      const impactMultiplier = isBuy ? 1 + (cappedScaledImpact / 100) : 1 - (cappedScaledImpact / 100);
      let newPrice = currentPrice * impactMultiplier;

      // Ensure price is within bounds
      newPrice = Math.max(
        PRICE_MOVEMENT_RULES.minPrice, 
        Math.min(PRICE_MOVEMENT_RULES.maxPrice, newPrice)
      );

      // Calculate price change percentage
      const priceChange = ((newPrice - currentPrice) / currentPrice) * 100;
      
      // Update the token's circulating supply
      if (isBuy) {
        // When buying, tokens come from total supply into circulation
        await db.updateOne('tokens', {
          circulating_supply: circulatingSupply + quantity
        }, {
          id: tokenId
        });
      } else {
        // When selling, tokens remain in circulation, just changing hands
        // No need to update circulating_supply here as it stays the same
      }

      // Calculate liquidity pool and volatility
      const liquidityPool = token.circulating_supply * newPrice;
      const volatility = this.calculateVolatility(currentPrice, newPrice);
      const updatedPriceChange = Number((Number(market.price_change_24h) + priceChange).toFixed(5));
      
      // Update the market data with all metrics
      await db.updateOne('token_markets', {
        price: Number(newPrice.toFixed(8)),
        price_change_24h: updatedPriceChange,
        volume: Number((Number(market.volume) + tradeValue).toFixed(18)),
        liquidity_pool: Number(liquidityPool.toFixed(18)),
        volatility: volatility,
        sentiment: this.getMarketSentiment(updatedPriceChange),
        updated_at: new Date()
      }, {
        id: market.id
      });

      console.log(`Token ${token.symbol} price updated after trade: ${currentPrice} → ${newPrice} (${priceChange.toFixed(2)}%)`);
      return newPrice;
    } catch (error) {
      console.error('Error updating price on trade:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const marketService = new MarketService();
