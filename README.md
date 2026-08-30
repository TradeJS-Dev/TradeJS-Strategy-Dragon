# @tradejs/strategy-dragon

TradeJS strategy plugin providing `Dragon`.

## Strategy overview

`Dragon` detects a rare four-pivot reversal pattern in both directions:

1. `head` starts the directional move;
2. `front foot` ends its first impulse;
3. `hump` retraces 30–50% of the head-to-front-foot height;
4. `rear foot` is 10–15% of that height closer to the head than the front foot;
5. an entry becomes eligible when price closes through the projected
   head-to-hump trendline.

The bullish form uses `high → low → lower high → higher low` and enters long
above a descending trendline. The bearish form is its exact mirror.

![Dragon strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Dragon/main/docs/strategy-logic.svg)

## Signal geometry

![Bullish Dragon signal](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Dragon/main/docs/signal-example.svg)

The illustrations are schematic. Defaults use wick pivots, a two-bar confirmed
fractal, a 100% measured-move target from the confirmed break, and a stop 10%
of pattern height beyond the rear foot. Every tolerance is explicit in the
strategy config so research can change geometry without changing detector
code.

## Install

```bash
yarn add @tradejs/strategy-dragon
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-dragon"],
});
```

The package exports `strategyEntries`, the `Dragon` strategy definition,
manifest, default config, and AI adapter.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow.

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads a hidden nested engine, types package, or Strategy Kit.
