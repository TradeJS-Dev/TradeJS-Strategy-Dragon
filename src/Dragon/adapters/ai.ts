import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import {
  getAiPayloadNumber,
  withStrategyLocalAiGate,
} from "@tradejs/strategy-kit/ai-gate";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { DragonConfig } from "../config";

const dragonBaseAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        dragonContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.dragonContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.dragonContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional Dragon context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- entryStage=${String(context.entryStage ?? "n/a")}
- trendlinePrice=${String(context.trendlinePrice ?? "n/a")}
- humpRetracementPct=${String(context.humpRetracementPct ?? "n/a")}
- rearFootOffsetPct=${String(context.rearFootOffsetPct ?? "n/a")}
- trendlineSlopePctPerBar=${String(context.trendlineSlopePctPerBar ?? "n/a")}
- breakoutDistanceHeightRatio=${String(context.breakoutDistanceHeightRatio ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for Dragon:
- A bullish Dragon is head high, front-foot low, lower hump, higher rear-foot low, then a close above the projected head-to-hump line.
- A bearish Dragon is the exact mirror image and confirms below the projected line.
- The hump and rear-foot proportions are geometry checks, not independent entry signals.
- Prefer a fresh breakout close near the projected trendline and reject analysis that contradicts the signal direction.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<DragonConfig, "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY">,
    ),
};

export const dragonAiAdapter = withStrategyLocalAiGate(dragonBaseAiAdapter, {
  id: "dragon_long_alt_turnover_ratio_2026_08_30",
  approves: ({ signal, payload }) => {
    const altVolToBtcVol24h = getAiPayloadNumber(
      payload,
      "additionalIndicators.baseContext.relative.btcAltRegime.altVolToBtcVol24h",
    );

    return (
      signal.direction === "LONG" &&
      altVolToBtcVol24h != null &&
      altVolToBtcVol24h <= 1.4
    );
  },
});
