import { StrategyManifest } from "@tradejs/types";
import { dragonAiAdapter } from "./adapters/ai";

export const dragonManifest: StrategyManifest = {
  name: "Dragon",
  aiAdapter: dragonAiAdapter,
};
