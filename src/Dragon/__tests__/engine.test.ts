/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createDragonEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  dt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    DRAGON_PIVOT_LENGTH: 1,
    DRAGON_MIN_PATTERN_HEIGHT_PCT: 0,
    DRAGON_MIN_PATTERN_HEIGHT_ATR: 0,
    DRAGON_MIN_BREAKOUT_DISTANCE_ATR: 0,
    DRAGON_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO: 1,
    DRAGON_ENTRY_MODE: "breakout",
    ...overrides,
  }) as any;

export const makeBullishDragonCandles = () => [
  makeCandle(0, 112, 113, 111, 112),
  makeCandle(1, 118, 120, 118, 119),
  makeCandle(2, 116, 116, 114, 115),
  makeCandle(3, 110, 111, 109, 110),
  makeCandle(4, 104, 105, 103, 104),
  makeCandle(5, 101, 102, 100, 101),
  makeCandle(6, 104, 105, 103, 104),
  makeCandle(7, 107, 108, 106, 107),
  makeCandle(8, 105, 106, 104, 105),
  makeCandle(9, 103, 104, 102.4, 103),
  makeCandle(10, 103, 105, 103, 104.5),
];

const mirrorCandles = (candles: ReturnType<typeof makeBullishDragonCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

describe("Dragon engine", () => {
  it("detects a bullish Dragon after the descending trendline break", () => {
    const engine = createDragonEngine({ config: makeConfig() });
    const states = makeBullishDragonCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_dragon");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      120, 100, 108, 102.4,
    ]);
    expect(pattern?.humpRetracementPct).toBeCloseTo(40);
    expect(pattern?.rearFootOffsetPct).toBeCloseTo(12);
    expect(pattern?.trendlinePrice).toBeCloseTo(102);
    expect(pattern?.targetPrice).toBeCloseTo(124.5);
    expect(pattern?.stopLossPrice).toBeCloseTo(100.4);
  });

  it("detects the mirrored bearish Dragon", () => {
    const engine = createDragonEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishDragonCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_dragon");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      100, 120, 112, 117.6,
    ]);
    expect(pattern?.humpRetracementPct).toBeCloseTo(40);
    expect(pattern?.rearFootOffsetPct).toBeCloseTo(12);
    expect(pattern?.targetPrice).toBeLessThan(pattern?.close ?? 0);
    expect(pattern?.stopLossPrice).toBeGreaterThan(pattern?.close ?? Infinity);
  });

  it("rejects a rear foot outside the configured 10-15% height band", () => {
    const candles = makeBullishDragonCandles();
    candles[9] = makeCandle(9, 102, 104, 101, 102);
    const engine = createDragonEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects a hump outside the configured 30-50% retracement band", () => {
    const candles = makeBullishDragonCandles();
    candles[7] = makeCandle(7, 110, 111, 109, 110);
    const engine = createDragonEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("waits for close acceptance and emits the setup only once", () => {
    const engine = createDragonEngine({
      config: makeConfig({
        DRAGON_ENTRY_MODE: "close_acceptance",
        DRAGON_CONFIRMATION_MAX_BARS: 2,
      }),
    });
    const history = makeBullishDragonCandles();
    const breakoutState = history.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(breakoutState.pattern).toBeNull();
    expect(breakoutState.pending?.stage).toBe("trendline_crossed");

    const confirmation = makeCandle(11, 104, 106, 103, 105);
    const accepted = engine.next(confirmation as any);
    expect(accepted.pattern?.entryStage).toBe("close_accepted");
    expect(accepted.pattern?.confirmationBars).toBe(1);

    expect(engine.next(confirmation as any)).toEqual(accepted);
    expect(
      engine.next(makeCandle(12, 105, 107, 104, 106) as any).pattern,
    ).toBeNull();
  });

  it("rebuilds a pending setup identically from initial candles", () => {
    const config = makeConfig({ DRAGON_ENTRY_MODE: "close_acceptance" });
    const history = makeBullishDragonCandles();
    const confirmation = makeCandle(11, 104, 106, 103, 105);
    const continuous = createDragonEngine({ config });
    for (const candle of history) continuous.next(candle as any);
    const continuousState = continuous.next(confirmation as any);

    const restored = createDragonEngine({
      config,
      initialCandles: history as any,
    });
    expect(restored.next(confirmation as any)).toEqual(continuousState);
  });
});
