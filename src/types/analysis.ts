export interface MarketSnapshot {
  ticker: string;
  currentPrice: string;
  ytdPerformance: string;
  weekHigh52: string;
  weekLow52: string;
  analystConsensus: string;
  recentEarnings: string;
  raw: string;
}

export interface PriceTargets {
  bullishCase: {
    targetRange: string;
    catalysts: string[];
    resistanceLevels: string[];
  };
  bearishCase: {
    targetRange: string;
    risks: string[];
    supportLevels: string[];
  };
  chartParams?: ChartParams;
  raw: string;
}

export interface ChartParams {
  bullLow: number;
  bullHigh: number;
  bearLow: number;
  bearHigh: number;
  supports: number[];
  resistances: number[];
  current: number;
}

export interface EntryExitLevels {
  shortPositions: {
    entryZone: string;
    stopLoss: string;
    profitTargets: string[];
  };
  longPositions: {
    accumulationZone: string;
    scaleInLevels: string[];
    profitTargets: string[];
  };
  raw: string;
}

export interface OptionsStrategy {
  name: string;
  expiration: string;
  structure: string;
  netCost: string;
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
  rrRatio: string;
  probOfProfit: string;
  whyThisWorks: string;
  entryTrigger: string;
  exitRules: string;
}

export interface OptionsStrategies {
  ivEnvironment: string;
  strategies: OptionsStrategy[];
  raw: string;
}

export interface Catalyst {
  date: string;
  event: string;
  impact: string;
}

export interface CatalystTimeline {
  catalysts: Catalyst[];
  raw: string;
}

export interface BottomLine {
  summary: string;
  raw: string;
}

export interface InstitutionalMetrics {
  sectorMetrics: string[];
  universalMetrics: string[];
  raw: string;
}

export interface MacroEvent {
  name: string;
  date: string;
  direction: string;
  whyItMatters: string;
  whatToWatch: string;
}

export interface MacroScorecard {
  events: MacroEvent[];
  scorecard: Array<{
    factor: string;
    currentReading: string;
    impact: string;
    trend: string;
  }>;
  raw: string;
}

export interface AnalysisPhase {
  phase: number;
  title: string;
  content: MarketSnapshot | PriceTargets | EntryExitLevels | OptionsStrategies | CatalystTimeline | BottomLine | InstitutionalMetrics | MacroScorecard;
  raw: string;
}

export interface AnalyzeRequest {
  ticker: string;
  bias?: 'bullish' | 'bearish' | 'neutral';
  riskAppetite?: 'conservative' | 'moderate' | 'aggressive';
  timeframe?: 'short' | 'medium' | 'long';
}

export interface ChartRequest {
  ticker: string;
  bullLow: number;
  bullHigh: number;
  bearLow: number;
  bearHigh: number;
  supports: number[];
  resistances: number[];
  current: number;
}
