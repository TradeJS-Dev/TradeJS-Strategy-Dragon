import { Candle, Direction } from "@tradejs/types";
import { DragonConfig, DragonEntryMode } from "./config";

export type DragonPatternKind = "bullish_dragon" | "bearish_dragon";
export type DragonEntryStage = "breakout" | "close_accepted" | "retest_held";
export type DragonPivotRole = "head" | "front_foot" | "hump" | "rear_foot";

export interface DragonPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface DragonPattern {
  setupId: string;
  kind: DragonPatternKind;
  direction: Direction;
  entryMode: DragonEntryMode;
  entryStage: DragonEntryStage;
  pivots: [DragonPivot, DragonPivot, DragonPivot, DragonPivot];
  trendlinePrice: number;
  targetPrice: number;
  stopLossPrice: number;
  height: number;
  patternHeightAtr: number;
  patternAgeBars: number;
  breakoutAfterRearFootBars: number;
  headToFrontFootBars: number;
  frontFootToHumpBars: number;
  humpToRearFootBars: number;
  humpRetracementPct: number;
  rearFootOffsetPct: number;
  trendlineSlopePctPerBar: number;
  breakoutDistancePct: number;
  breakoutDistanceAtr: number;
  breakoutDistanceHeightRatio: number;
  breakoutTimestamp: number;
  confirmationBars: number;
  timestamp: number;
  close: number;
}

export interface DragonPendingSetup {
  setupId: string;
  mode: Exclude<DragonEntryMode, "breakout">;
  stage: "trendline_crossed" | "retest_pending";
  breakoutIndex: number;
  pattern: DragonPattern;
}

export interface DragonRuntimeState {
  pattern: DragonPattern | null;
  pending: DragonPendingSetup | null;
  pivots: DragonPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: DragonPivot[];
  pattern: DragonPattern | null;
  pending: DragonPendingSetup | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const clampPositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const getConfigNumbers = (config: DragonConfig) => {
  const minRearFootOffsetPct = Math.max(
    0,
    Number(config.DRAGON_MIN_REAR_FOOT_OFFSET_PCT ?? 10),
  );
  const minHumpRetracementPct = Math.max(
    0,
    Number(config.DRAGON_MIN_HUMP_RETRACEMENT_PCT ?? 30),
  );

  return {
    pivotLength: Math.max(1, Math.floor(config.DRAGON_PIVOT_LENGTH ?? 2)),
    minRearFootOffsetPct,
    maxRearFootOffsetPct: Math.max(
      minRearFootOffsetPct,
      Number(config.DRAGON_MAX_REAR_FOOT_OFFSET_PCT ?? 15),
    ),
    minHumpRetracementPct,
    maxHumpRetracementPct: Math.max(
      minHumpRetracementPct,
      Number(config.DRAGON_MAX_HUMP_RETRACEMENT_PCT ?? 50),
    ),
    targetFibPct: Math.max(0, Number(config.DRAGON_TARGET_FIB_PCT ?? 100)),
    stopFibPct: Math.max(0, Number(config.DRAGON_STOP_FIB_PCT ?? 10)),
    minPatternHeightPct: Math.max(
      0,
      Number(config.DRAGON_MIN_PATTERN_HEIGHT_PCT ?? 0),
    ),
    minPatternHeightAtr: Math.max(
      0,
      Number(config.DRAGON_MIN_PATTERN_HEIGHT_ATR ?? 0),
    ),
    atrPeriod: Math.max(2, Math.floor(config.DRAGON_ATR_PERIOD ?? 14)),
    minLegBars: Math.max(1, Math.floor(config.DRAGON_MIN_LEG_BARS ?? 1)),
    maxPatternAgeBars: Math.max(
      4,
      Math.floor(config.DRAGON_MAX_PATTERN_AGE_BARS ?? 180),
    ),
    maxBreakoutAfterRearFootBars: Math.max(
      1,
      Math.floor(config.DRAGON_MAX_BREAKOUT_AFTER_REAR_FOOT_BARS ?? 60),
    ),
    minTrendlineSlopePctPerBar: Math.max(
      0,
      Number(config.DRAGON_MIN_TRENDLINE_SLOPE_PCT_PER_BAR ?? 0),
    ),
    minBreakoutDistanceAtr: Math.max(
      0,
      Number(config.DRAGON_MIN_BREAKOUT_DISTANCE_ATR ?? 0),
    ),
    maxBreakoutDistanceHeightRatio: Math.max(
      0,
      Number(config.DRAGON_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO ?? 0),
    ),
    entryMode: config.DRAGON_ENTRY_MODE ?? "close_acceptance",
    confirmationMaxBars: Math.max(
      1,
      Math.floor(config.DRAGON_CONFIRMATION_MAX_BARS ?? 2),
    ),
    retestMaxBars: Math.max(1, Math.floor(config.DRAGON_RETEST_MAX_BARS ?? 4)),
    retestToleranceAtr: Math.max(
      0,
      Number(config.DRAGON_RETEST_TOLERANCE_ATR ?? 0.25),
    ),
  };
};

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
  return state.currentIndex;
};

const appendPivot = (state: EngineState, pivot: DragonPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 16) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value == null) ||
    lows.some((value) => value == null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const projectTrendline = (
  head: DragonPivot,
  hump: DragonPivot,
  index: number,
) => {
  const bars = hump.index - head.index;
  if (bars <= 0) return head.value;
  return head.value + ((hump.value - head.value) * (index - head.index)) / bars;
};

const patternRolesForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["high", "low", "high", "low"] as const)
    : (["low", "high", "low", "high"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): [DragonPivot, DragonPivot, DragonPivot, DragonPivot] | null => {
  const roles = patternRolesForDirection(direction);
  const firstCandidate = Math.max(0, state.pivots.length - 5);

  for (
    let index = state.pivots.length - 4;
    index >= firstCandidate;
    index -= 1
  ) {
    const candidate = state.pivots.slice(index, index + 4);
    if (
      candidate.length === 4 &&
      candidate.every((pivot, roleIndex) => pivot.kind === roles[roleIndex]) &&
      candidate[3]!.index < state.currentIndex &&
      !candidate[3]!.traded
    ) {
      return candidate as [DragonPivot, DragonPivot, DragonPivot, DragonPivot];
    }
  }

  return null;
};

const findLatestTrendlineCross = ({
  records,
  head,
  hump,
  rearFoot,
  direction,
}: {
  records: CandleRecord[];
  head: DragonPivot;
  hump: DragonPivot;
  rearFoot: DragonPivot;
  direction: Direction;
}): CandleRecord | null => {
  const sign = direction === "LONG" ? 1 : -1;
  let crossing: CandleRecord | null = null;

  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (!previous || !current || current.index <= rearFoot.index) continue;

    const previousClose = asNumber(previous.candle.close);
    const currentClose = asNumber(current.candle.close);
    if (previousClose == null || currentClose == null) continue;

    const previousLine = projectTrendline(head, hump, previous.index);
    const currentLine = projectTrendline(head, hump, current.index);
    const crossed =
      previousClose * sign <= previousLine * sign &&
      currentClose * sign > currentLine * sign;
    if (crossed) crossing = current;
  }

  return crossing;
};

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markTerminal = (state: EngineState, setup: DragonPendingSetup) => {
  if (!hasConsumed(state, setup.setupId)) {
    state.consumedSetupIds.push(setup.setupId);
    if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  }
  const rearFoot = state.pivots.find(
    (pivot) => pivot.timestamp === setup.pattern.pivots[3].timestamp,
  );
  if (rearFoot) rearFoot.traded = true;
};

const buildBreakoutPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): DragonPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const [head, frontFoot, hump, rearFoot] = pivots;
  const sign = direction === "LONG" ? 1 : -1;
  const headValue = head.value * sign;
  const frontFootValue = frontFoot.value * sign;
  const humpValue = hump.value * sign;
  const rearFootValue = rearFoot.value * sign;
  const height = headValue - frontFootValue;
  if (height <= 0) return null;

  const headToFrontFootBars = frontFoot.index - head.index;
  const frontFootToHumpBars = hump.index - frontFoot.index;
  const humpToRearFootBars = rearFoot.index - hump.index;
  if (
    Math.min(headToFrontFootBars, frontFootToHumpBars, humpToRearFootBars) <
    options.minLegBars
  ) {
    return null;
  }

  const humpRetracementPct = ((humpValue - frontFootValue) / height) * 100;
  const rearFootOffsetPct = ((rearFootValue - frontFootValue) / height) * 100;
  if (
    humpRetracementPct < options.minHumpRetracementPct ||
    humpRetracementPct > options.maxHumpRetracementPct ||
    rearFootOffsetPct < options.minRearFootOffsetPct ||
    rearFootOffsetPct > options.maxRearFootOffsetPct ||
    humpValue >= headValue ||
    rearFootValue >= humpValue
  ) {
    return null;
  }

  const frontFootLine = projectTrendline(head, hump, frontFoot.index) * sign;
  const rearFootLine = projectTrendline(head, hump, rearFoot.index) * sign;
  if (frontFootValue >= frontFootLine || rearFootValue >= rearFootLine) {
    return null;
  }

  const patternAgeBars = state.currentIndex - head.index;
  const breakoutAfterRearFootBars = state.currentIndex - rearFoot.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    breakoutAfterRearFootBars > options.maxBreakoutAfterRearFootBars
  ) {
    return null;
  }

  const heightPct =
    head.value !== 0 ? (height / Math.abs(head.value)) * 100 : 0;
  const patternHeightAtr = atr != null && atr > 0 ? height / atr : 0;
  if (
    heightPct < options.minPatternHeightPct ||
    patternHeightAtr < options.minPatternHeightAtr
  ) {
    return null;
  }

  const trendlineSlopePctPerBar =
    head.value !== 0
      ? ((hump.value - head.value) /
          Math.abs(head.value) /
          (hump.index - head.index)) *
        100
      : 0;
  if (Math.abs(trendlineSlopePctPerBar) < options.minTrendlineSlopePctPerBar) {
    return null;
  }

  const crossing = findLatestTrendlineCross({
    records: state.records,
    head,
    hump,
    rearFoot,
    direction,
  });
  const close = asNumber(candle.close);
  if (!crossing || close == null) return null;

  const trendlinePrice = projectTrendline(head, hump, state.currentIndex);
  const normalizedBreakoutDistance = close * sign - trendlinePrice * sign;
  if (normalizedBreakoutDistance <= 0) return null;

  const breakoutDistancePct =
    trendlinePrice !== 0
      ? (normalizedBreakoutDistance / Math.abs(trendlinePrice)) * 100
      : 0;
  const breakoutDistanceAtr =
    atr != null && atr > 0 ? normalizedBreakoutDistance / atr : 0;
  const breakoutDistanceHeightRatio = normalizedBreakoutDistance / height;
  if (
    breakoutDistanceAtr < options.minBreakoutDistanceAtr ||
    (options.maxBreakoutDistanceHeightRatio > 0 &&
      breakoutDistanceHeightRatio > options.maxBreakoutDistanceHeightRatio)
  ) {
    return null;
  }

  const kind: DragonPatternKind =
    direction === "LONG" ? "bullish_dragon" : "bearish_dragon";
  const setupId = `${kind}:${head.timestamp}:${frontFoot.timestamp}:${hump.timestamp}:${rearFoot.timestamp}`;
  if (hasConsumed(state, setupId)) return null;

  return {
    setupId,
    kind,
    direction,
    entryMode: options.entryMode,
    entryStage: "breakout",
    pivots,
    trendlinePrice,
    targetPrice: close + sign * height * (options.targetFibPct / 100),
    stopLossPrice: rearFoot.value - sign * height * (options.stopFibPct / 100),
    height,
    patternHeightAtr,
    patternAgeBars,
    breakoutAfterRearFootBars,
    headToFrontFootBars,
    frontFootToHumpBars,
    humpToRearFootBars,
    humpRetracementPct,
    rearFootOffsetPct,
    trendlineSlopePctPerBar,
    breakoutDistancePct,
    breakoutDistanceAtr,
    breakoutDistanceHeightRatio,
    breakoutTimestamp: crossing.candle.timestamp,
    confirmationBars: 0,
    timestamp: candle.timestamp,
    close,
  };
};

const resolvePending = ({
  state,
  candle,
  atr,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  options: EngineOptions;
}): DragonPattern | null => {
  const pending = state.pending;
  if (!pending) return null;
  const confirmationBars = state.currentIndex - pending.breakoutIndex;
  if (confirmationBars < 1) return null;

  const close = asNumber(candle.close);
  const high = asNumber(candle.high);
  const low = asNumber(candle.low);
  if (close == null || high == null || low == null) return null;

  const pattern = pending.pattern;
  const invalidated =
    pattern.direction === "LONG"
      ? low <= pattern.stopLossPrice
      : high >= pattern.stopLossPrice;
  const maxBars =
    pending.mode === "retest"
      ? options.retestMaxBars
      : options.confirmationMaxBars;
  if (invalidated || confirmationBars > maxBars) {
    markTerminal(state, pending);
    state.pending = null;
    return null;
  }

  const [head, , hump] = pattern.pivots;
  const sign = pattern.direction === "LONG" ? 1 : -1;
  const trendlinePrice = projectTrendline(head, hump, state.currentIndex);
  const effectiveAtr = atr != null && atr > 0 ? atr : pattern.height;
  const minimumDistance = effectiveAtr * options.minBreakoutDistanceAtr;
  const normalizedDistance = close * sign - trendlinePrice * sign;
  const closeAccepted = normalizedDistance >= minimumDistance;
  let entryStage: DragonEntryStage | null = null;

  if (pending.mode === "close_acceptance") {
    if (closeAccepted) entryStage = "close_accepted";
  } else {
    const tolerance = effectiveAtr * options.retestToleranceAtr;
    const touchPrice = pattern.direction === "LONG" ? low : high;
    const touched = Math.abs(touchPrice - trendlinePrice) <= tolerance;
    if (touched && closeAccepted) entryStage = "retest_held";
  }

  if (!entryStage) return null;
  markTerminal(state, pending);
  state.pending = null;
  return {
    ...pattern,
    entryStage,
    trendlinePrice,
    breakoutDistancePct:
      trendlinePrice !== 0
        ? (normalizedDistance / Math.abs(trendlinePrice)) * 100
        : 0,
    breakoutDistanceAtr:
      effectiveAtr > 0 ? normalizedDistance / effectiveAtr : 0,
    breakoutDistanceHeightRatio: normalizedDistance / pattern.height,
    confirmationBars,
    timestamp: candle.timestamp,
    close,
  };
};

const clonePending = (
  pending: DragonPendingSetup | null,
): DragonPendingSetup | null =>
  pending
    ? {
        ...pending,
        pattern: { ...pending.pattern, pivots: [...pending.pattern.pivots] },
      }
    : null;

export const buildDragonSignalContext = (pattern: DragonPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  entryMode: pattern.entryMode,
  entryStage: pattern.entryStage,
  trendlinePrice: pattern.trendlinePrice,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  height: pattern.height,
  patternHeightAtr: pattern.patternHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  breakoutAfterRearFootBars: pattern.breakoutAfterRearFootBars,
  headToFrontFootBars: pattern.headToFrontFootBars,
  frontFootToHumpBars: pattern.frontFootToHumpBars,
  humpToRearFootBars: pattern.humpToRearFootBars,
  humpRetracementPct: pattern.humpRetracementPct,
  rearFootOffsetPct: pattern.rearFootOffsetPct,
  trendlineSlopePctPerBar: pattern.trendlineSlopePctPerBar,
  breakoutDistancePct: pattern.breakoutDistancePct,
  breakoutDistanceAtr: pattern.breakoutDistanceAtr,
  breakoutDistanceHeightRatio: pattern.breakoutDistanceHeightRatio,
  breakoutTimestamp: pattern.breakoutTimestamp,
  confirmationBars: pattern.confirmationBars,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: (["head", "front_foot", "hump", "rear_foot"] as DragonPivotRole[])[
      index
    ],
    timestamp,
    value,
    kind,
  })),
});

export type DragonSignalContext = ReturnType<typeof buildDragonSignalContext>;

export const createDragonEngine = ({
  config,
  initialCandles = [],
}: {
  config: DragonConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => DragonRuntimeState;
  getState: () => DragonRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    pending: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars + options.pivotLength * 2 + 4,
    options.atrPeriod + 2,
  );

  const snapshot = (): DragonRuntimeState => ({
    pattern: state.pattern
      ? { ...state.pattern, pivots: [...state.pattern.pivots] }
      : null,
    pending: clonePending(state.pending),
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): DragonRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    const pendingPattern = resolvePending({ state, candle, atr, options });
    if (pendingPattern) {
      state.pattern = pendingPattern;
      return snapshot();
    }
    if (state.pending) return snapshot();

    const breakout =
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    if (!breakout) return snapshot();

    if (options.entryMode === "breakout") {
      const terminal: DragonPendingSetup = {
        setupId: breakout.setupId,
        mode: "close_acceptance",
        stage: "trendline_crossed",
        breakoutIndex: state.currentIndex,
        pattern: breakout,
      };
      markTerminal(state, terminal);
      state.pattern = breakout;
      return snapshot();
    }

    state.pending = {
      setupId: breakout.setupId,
      mode: options.entryMode,
      stage:
        options.entryMode === "retest" ? "retest_pending" : "trendline_crossed",
      breakoutIndex: state.currentIndex,
      pattern: breakout,
    };
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
