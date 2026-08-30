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
});
