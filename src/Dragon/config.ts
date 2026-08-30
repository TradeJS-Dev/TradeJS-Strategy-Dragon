import { FEE_PERCENT } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface DragonSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export type DragonEntryMode = "breakout" | "close_acceptance" | "retest";

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  FEE_PERCENT,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  DRAGON_PIVOT_LENGTH: 2,
  DRAGON_MIN_REAR_FOOT_OFFSET_PCT: 10,
  DRAGON_MAX_REAR_FOOT_OFFSET_PCT: 15,
  DRAGON_MIN_HUMP_RETRACEMENT_PCT: 30,
  DRAGON_MAX_HUMP_RETRACEMENT_PCT: 50,
  DRAGON_TARGET_FIB_PCT: 100,
  DRAGON_STOP_FIB_PCT: 10,
  DRAGON_MIN_PATTERN_HEIGHT_PCT: 0.2,
  DRAGON_MIN_PATTERN_HEIGHT_ATR: 1,
  DRAGON_ATR_PERIOD: 14,
  DRAGON_MIN_LEG_BARS: 1,
  DRAGON_MAX_PATTERN_AGE_BARS: 180,
  DRAGON_MAX_BREAKOUT_AFTER_REAR_FOOT_BARS: 60,
  DRAGON_MIN_TRENDLINE_SLOPE_PCT_PER_BAR: 0,
  DRAGON_MIN_BREAKOUT_DISTANCE_ATR: 0.05,
  DRAGON_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO: 0.8,
  DRAGON_ENTRY_MODE: "close_acceptance" as DragonEntryMode,
  DRAGON_CONFIRMATION_MAX_BARS: 2,
  DRAGON_RETEST_MAX_BARS: 4,
  DRAGON_RETEST_TOLERANCE_ATR: 0.25,
  DRAGON_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type DragonConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    DRAGON_ENTRY_MODE: DragonEntryMode;
    LONG: DragonSideConfig;
    SHORT: DragonSideConfig;
  };
