import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { DragonConfig } from "./config";
import { buildDragonSignalContext, createDragonEngine } from "./engine";
import { buildDragonFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const buildDragonStateKey = (config: DragonConfig) =>
  JSON.stringify({
    pivotLength: config.DRAGON_PIVOT_LENGTH,
    minRearFootOffsetPct: config.DRAGON_MIN_REAR_FOOT_OFFSET_PCT,
    maxRearFootOffsetPct: config.DRAGON_MAX_REAR_FOOT_OFFSET_PCT,
    minHumpRetracementPct: config.DRAGON_MIN_HUMP_RETRACEMENT_PCT,
    maxHumpRetracementPct: config.DRAGON_MAX_HUMP_RETRACEMENT_PCT,
    targetFibPct: config.DRAGON_TARGET_FIB_PCT,
    stopFibPct: config.DRAGON_STOP_FIB_PCT,
    minPatternHeightPct: config.DRAGON_MIN_PATTERN_HEIGHT_PCT,
    minPatternHeightAtr: config.DRAGON_MIN_PATTERN_HEIGHT_ATR,
    atrPeriod: config.DRAGON_ATR_PERIOD,
    minLegBars: config.DRAGON_MIN_LEG_BARS,
    maxPatternAgeBars: config.DRAGON_MAX_PATTERN_AGE_BARS,
    maxBreakoutAfterRearFootBars:
      config.DRAGON_MAX_BREAKOUT_AFTER_REAR_FOOT_BARS,
    minTrendlineSlopePctPerBar: config.DRAGON_MIN_TRENDLINE_SLOPE_PCT_PER_BAR,
    minBreakoutDistanceAtr: config.DRAGON_MIN_BREAKOUT_DISTANCE_ATR,
    maxBreakoutDistanceHeightRatio:
      config.DRAGON_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO,
    entryMode: config.DRAGON_ENTRY_MODE,
    confirmationMaxBars: config.DRAGON_CONFIRMATION_MAX_BARS,
    retestMaxBars: config.DRAGON_RETEST_MAX_BARS,
    retestToleranceAtr: config.DRAGON_RETEST_TOLERANCE_ATR,
  });

export const createDragonCore: CreateStrategyCore<
  DragonConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createDragonEngine> },
    ReturnType<ReturnType<typeof createDragonEngine>["next"]>,
    ReturnType<ReturnType<typeof createDragonEngine>["getState"]>
  >(
    "Dragon",
    () => ({
      engine: createDragonEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildDragonStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createDragonEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (Boolean(config.DRAGON_EXIT_ON_OPPOSITE_PATTERN) && oppositePattern) {
        return strategyApi.exit({
          code: "DRAGON_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const signalContext = {
      ...buildDragonSignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
    };
    const indicators = indicatorsState.snapshot();
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? `DRAGON_BULLISH_${pattern.entryStage.toUpperCase()}`
          : `DRAGON_BEARISH_${pattern.entryStage.toUpperCase()}`,
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { dragonContext: signalContext },
      figures: buildDragonFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
