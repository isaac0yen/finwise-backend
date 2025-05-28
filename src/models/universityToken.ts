export enum TokenEventType {
  BOOST = 'BOOST',
  DROP = 'DROP',
  NEUTRAL = 'NEUTRAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface UniversityToken {
  id?: number;
  name: string;
  symbol: string;
  institution: string;
  totalSupply: number;
  circulatingSupply: number;
  initialPrice: number;
  decimals?: number;
  createdAt?: Date;
}

export interface TokenMarket {
  id?: number;
  tokenId: number;
  price: number;
  volume: number;
  liquidityPool?: number;
  volatility?: number;
  sentiment?: string;
  priceChange24h?: number;
  updatedAt?: Date;
}

export interface TokenBalance {
  id?: number;
  userId: number;
  tokenId: number;
  balance: number;
  averageBuyPrice: number;
  totalInvested: number;
  updatedAt?: Date;
}

export interface MarketEvent {
  id?: number;
  name: string;
  description?: string;
  effectType: TokenEventType;
  magnitude: number;
  tokensAffected: string; // JSON string of token symbols
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdAt?: Date;
}

export interface PortfolioSnapshot {
  id?: number;
  userId: number;
  totalInvested: number;
  totalCurrentValue: number;
  unrealizedProfits: number;
  realizedProfits: number;
  snapshotDate: Date;
  createdAt?: Date;
}

// Price movement constants
export const PRICE_MOVEMENT_RULES = {
  maxDailyChange: 0.25,        // ±25% max daily change
  minPrice: 10,                // Minimum ₦10 per token
  maxPrice: 1000,              // Maximum ₦1000 per token
  volatilityWindow: 300000,    // 5-minute price update intervals
  trendDuration: 3600000,      // 1-hour trend periods
  marketHours: {
    start: 9,                  // 9 AM
    end: 17                    // 5 PM (more volatility during these hours)
  }
};

// Initial university token data
export const UNIVERSITY_TOKENS: Record<string, { name: string, initialPrice: number, totalSupply: number }> = {
  'UNILAG': { name: 'University of Lagos', initialPrice: 100, totalSupply: 1000000 },
  'UNILORIN': { name: 'University of Ilorin', initialPrice: 95, totalSupply: 950000 },
  'OAU': { name: 'Obafemi Awolowo University', initialPrice: 110, totalSupply: 800000 },
  'UI': { name: 'University of Ibadan', initialPrice: 105, totalSupply: 900000 },
  'UNIBEN': { name: 'University of Benin', initialPrice: 85, totalSupply: 750000 },
  'UNN': { name: 'University of Nigeria Nsukka', initialPrice: 90, totalSupply: 850000 },
  'ABU': { name: 'Ahmadu Bello University', initialPrice: 88, totalSupply: 1100000 },
  'UNIPORT': { name: 'University of Port Harcourt', initialPrice: 92, totalSupply: 700000 },
  'UNICAL': { name: 'University of Calabar', initialPrice: 80, totalSupply: 600000 },
  'FUTO': { name: 'Federal University of Technology Owerri', initialPrice: 75, totalSupply: 500000 }
};

// Market event templates
export const RANDOM_EVENTS = [
  { 
    name: 'University rankings released',
    description: 'Annual university rankings have been published, affecting token values.',
    effectType: TokenEventType.BOOST,
    magnitude: 0.15, 
    duration: 3600000, // 1 hour
    probability: 0.05
  },
  {
    name: 'ASUU strike news',
    description: 'News about potential ASUU strike affecting university operations.',
    effectType: TokenEventType.DROP,
    magnitude: 0.10, 
    duration: 7200000, // 2 hours
    probability: 0.03
  },
  {
    name: 'Graduation ceremony',
    description: 'Major graduation ceremony boosting university reputation.',
    effectType: TokenEventType.BOOST,
    magnitude: 0.08, 
    duration: 1800000, // 30 minutes
    probability: 0.08
  }
];
