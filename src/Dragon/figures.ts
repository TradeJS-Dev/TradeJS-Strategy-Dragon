import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { DragonPattern } from "./engine";

export const buildDragonFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: DragonPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const color = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const [head, frontFoot, hump, rearFoot] = pattern.pivots;
  const patternPoints = [head, frontFoot, hump, rearFoot].map(
    ({ timestamp, value }) => ({ timestamp, value }),
  );

  const lines: StrategyFigureLine[] = [
    {
      id: `dragon-pattern-${entryTimestamp}`,
      kind: `dragon_${pattern.kind}_pattern`,
      points: [
        ...patternPoints,
        { timestamp: entryTimestamp, value: entryPrice },
      ],
      color,
      width: 2,
      style: "solid",
    },
    {
      id: `dragon-trendline-${entryTimestamp}`,
      kind: "dragon_head_hump_trendline",
      points: [
        { timestamp: head.timestamp, value: head.value },
        { timestamp: entryTimestamp, value: pattern.trendlinePrice },
      ],
      color: "#2563eb",
      width: 2,
      style: "dashed",
    },
    {
      id: `dragon-target-${entryTimestamp}`,
      kind: "dragon_target",
      points: [
        { timestamp: rearFoot.timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `dragon-stop-${entryTimestamp}`,
      kind: "dragon_stop",
      points: [
        { timestamp: rearFoot.timestamp, value: pattern.stopLossPrice },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `dragon-pivots-${entryTimestamp}`,
      kind: `dragon_${pattern.kind}_pivots`,
      points: patternPoints,
      color,
      radius: 4,
    },
    {
      id: `dragon-entry-${entryTimestamp}`,
      kind: "dragon_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color,
      radius: 5,
    },
  ];

  return { lines, points };
};
