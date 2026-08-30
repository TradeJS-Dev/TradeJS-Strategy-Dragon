import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as dragonDefaultConfig } from "./Dragon/config";
import { DragonStrategyDefinition } from "./Dragon/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  DragonStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  Dragon: dragonDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { DragonStrategyDefinition } from "./Dragon/strategy";
export { dragonDefaultConfig };
export { dragonManifest } from "./Dragon/manifest";
export { dragonAiAdapter } from "./Dragon/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
