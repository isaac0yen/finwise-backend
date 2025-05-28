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
        const currentPrice = market.price;
        let newPrice = currentPrice;

        // 1. Apply time-based trend (random walk)
        const timeBasedTrend = this.getRandomVolatility(market.volatility);
        newPrice *= (1 + timeBasedTrend);

        // 2. Apply market hours volatility
        const hour = now.getHours();
        if (hour >= PRICE_MOVEMENT_RULES.marketHours.start && hour < PRICE_MOVEMENT_RULES.marketHours.end) {
          // During market hours, increase volatility
          newPrice *= (1 + this.getRandomVolatility(market.volatility * 1.5));
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

        // Update the market data
        await db.updateOne('token_markets', {
          price: newPrice,
          price_change_24h: priceChange,
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
   * Gets a random subset of tokens
   */
  private getRandomTokens(allTokens: string[], count: number): string[] {
    const shuffled = [...allTokens].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, allTokens.length));
  }
}

// Export singleton instance
export const marketService = new MarketService();
