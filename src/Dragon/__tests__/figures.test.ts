import { buildDragonFigures } from "../figures";
import { DragonPattern } from "../engine";

describe("Dragon figures", () => {
  it("renders the zigzag, projected trendline, target, stop, pivots and entry", () => {
    const pattern: DragonPattern = {
      setupId: "bullish-dragon-1",
      kind: "bullish_dragon",
      direction: "LONG",
      entryMode: "close_acceptance",
      entryStage: "close_accepted",
      pivots: [
        { timestamp: 1, index: 0, value: 120, kind: "high", traded: false },
        { timestamp: 2, index: 1, value: 100, kind: "low", traded: false },
        { timestamp: 3, index: 2, value: 108, kind: "high", traded: false },
        { timestamp: 4, index: 3, value: 102.4, kind: "low", traded: true },
      ],
      trendlinePrice: 103,
      targetPrice: 124,
      stopLossPrice: 100.4,
      height: 20,
      patternHeightAtr: 4,
      patternAgeBars: 5,
      breakoutAfterRearFootBars: 2,
      headToFrontFootBars: 1,
      frontFootToHumpBars: 1,
      humpToRearFootBars: 1,
      humpRetracementPct: 40,
      rearFootOffsetPct: 12,
      trendlineSlopePctPerBar: -5,
      breakoutDistancePct: 1,
      breakoutDistanceAtr: 0.5,
      breakoutDistanceHeightRatio: 0.05,
      breakoutTimestamp: 5,
      confirmationBars: 1,
      timestamp: 6,
      close: 104,
    };

    const figures = buildDragonFigures({
      pattern,
      entryTimestamp: 6,
      entryPrice: 104,
    });

    expect(figures.lines).toHaveLength(4);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "dragon_bullish_dragon_pattern",
      "dragon_head_hump_trendline",
      "dragon_target",
      "dragon_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(4);
  });
});
