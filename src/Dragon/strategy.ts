import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, DragonConfig } from "./config";
import { createDragonCore } from "./core";
import { dragonManifest } from "./manifest";

export const DragonStrategyDefinition: ValidatedStrategyRegistryEntry<DragonConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "Dragon",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createDragonCore,
    manifest: dragonManifest,
  };
