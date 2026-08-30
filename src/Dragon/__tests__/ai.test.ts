import { dragonAiAdapter } from "../adapters/ai";

describe("dragonAiAdapter", () => {
  it("carries Dragon geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_dragon",
      signalDirection: "LONG",
      humpRetracementPct: 40,
      rearFootOffsetPct: 12,
      pivots: [{ role: "head", value: 120 }],
    };
    const payload = dragonAiAdapter.buildPayload!({
      signal: { additionalIndicators: { dragonContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).dragonContext).toEqual(
      context,
    );
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = dragonAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_dragon");
    expect(prompt).toContain("humpRetracementPct=40");
    expect(prompt).toContain("rearFootOffsetPct=12");
  });

  const applyLocalGate = ({
    direction = "LONG",
    altVolToBtcVol24h,
    nearestBuyPressureDistanceAtr,
    nearestBuyPressureTouches,
  }: {
    direction?: "LONG" | "SHORT";
    altVolToBtcVol24h?: unknown;
    nearestBuyPressureDistanceAtr?: unknown;
    nearestBuyPressureTouches?: unknown;
  }) =>
    dragonAiAdapter.postProcessLocalAnalysis!({
      signal: {
        direction,
        prices: {
          currentPrice: 100,
          takeProfitPrice: direction === "LONG" ? 110 : 90,
          stopLossPrice: direction === "LONG" ? 95 : 105,
        },
      },
      payload: {
        additionalIndicators: {
          baseContext: {
            relative: {
              btcAltRegime: { altVolToBtcVol24h },
            },
            structure: {
              liquidityTails: {
                nearestBuyPressure: {
                  distanceAtr: nearestBuyPressureDistanceAtr,
                  touches: nearestBuyPressureTouches,
                },
              },
            },
          },
        },
      },
      analysis: { quality: 3 },
    } as any) as any;

  it("approves LONG at the alt-turnover ratio boundary", () => {
    const analysis = applyLocalGate({ altVolToBtcVol24h: 1.4 });

    expect(analysis).toMatchObject({
      approved: true,
      direction: "LONG",
      quality: 4,
      gateDecision: "approved",
      needRetest: false,
      takeProfitPrice: 110,
      stopLossPrice: 95,
    });
    expect(analysis.qualityReason).toContain(
      "rule=dragon_directional_regime_and_buy_pressure_2026_08_30",
    );
  });

  it("rejects LONG above the alt-turnover ratio boundary", () => {
    const analysis = applyLocalGate({ altVolToBtcVol24h: 1.400001 });

    expect(analysis).toMatchObject({
      approved: false,
      direction: null,
      quality: 3,
      gateDecision: "rejected",
      needRetest: true,
      takeProfitPrice: null,
      stopLossPrice: null,
    });
  });

  it.each([undefined, null, "not-a-number"])(
    "rejects unavailable alt-turnover context: %p",
    (altVolToBtcVol24h) => {
      expect(applyLocalGate({ altVolToBtcVol24h })).toMatchObject({
        approved: false,
        quality: 3,
        gateDecision: "rejected",
      });
    },
  );

  it("approves SHORT at both buy-pressure boundaries", () => {
    expect(
      applyLocalGate({
        direction: "SHORT",
        nearestBuyPressureDistanceAtr: 7.5,
        nearestBuyPressureTouches: 2,
      }),
    ).toMatchObject({
      approved: true,
      direction: "SHORT",
      quality: 4,
      gateDecision: "approved",
      needRetest: false,
      takeProfitPrice: 90,
      stopLossPrice: 105,
    });
  });

  it.each([
    { nearestBuyPressureDistanceAtr: 7.500001, nearestBuyPressureTouches: 2 },
    { nearestBuyPressureDistanceAtr: 7.5, nearestBuyPressureTouches: 1 },
    { nearestBuyPressureDistanceAtr: undefined, nearestBuyPressureTouches: 2 },
    { nearestBuyPressureDistanceAtr: 7.5, nearestBuyPressureTouches: null },
  ])("rejects SHORT outside the buy-pressure pocket: %p", (context) => {
    expect(applyLocalGate({ direction: "SHORT", ...context })).toMatchObject({
      approved: false,
      direction: null,
      quality: 3,
      gateDecision: "rejected",
    });
  });

  it("does not let SHORT context bypass the LONG regime condition", () => {
    expect(
      applyLocalGate({
        direction: "LONG",
        altVolToBtcVol24h: 1.400001,
        nearestBuyPressureDistanceAtr: 2,
        nearestBuyPressureTouches: 4,
      }),
    ).toMatchObject({ approved: false, gateDecision: "rejected" });
  });
});
