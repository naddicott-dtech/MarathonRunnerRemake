# Headless playtesting notes

Run all scenarios without waiting for real time:

```sh
npm run sim -- --scenario all --format csv
npm run sim -- --scenario balanced --dt 0.6 --output /tmp/balanced.json
npm test
```

The default simulation step is 1.2 simulated seconds; policies decide once per classroom second. The harness splits at decision boundaries, so changing the integration step does not silently change reaction speed. Every action passes through the same cooldowns and limits as the browser. These are scripted personas with chosen heuristics, not actual student research. They do not learn thresholds during the run.

## Measured default outcomes

Times are active classroom seconds. Counts include accepted actions, not failed clicks.

| Policy | Outcome | Classroom s | Distance m | Primary endpoint | Actions |
| --- | --- | ---: | ---: | --- | ---: |
| balanced | finished | 671 | 40,000 | — | 54 |
| cautious | finished | 952 | 40,000 | — | 33 |
| analytical | finished | 671 | 40,000 | — | 58 |
| impatient | finished | 663 | 40,000 | — | 74 |
| overcorrector | collapsed | 638 | 34,266 | Hypoglycemia | 144 |
| neglect-breathing | collapsed | 7 | 488 | Low blood oxygen | 7 |
| neglect-cooling | collapsed | 131 | 7,076 | Heat emergency | 40 |
| no-food | collapsed | 238 | 12,876 | Hypoglycemia | 28 |
| overdrink-water | collapsed | 639 | 26,279 | Hyponatremia | 224 |
| overdrink-electrolyte | collapsed | 914 | 37,834 | Hyponatremia | 317 |
| no-drink | collapsed | 659 | 38,160 | Heat emergency | 31 |
| no-drink-jog | finished | 965 | 40,000 | — | 17 |
| sprint-forever | collapsed | 131 | 7,076 | Heat emergency | 40 |

The two overdrinking experiments use matched jogging, sweat level 1, and food maintenance; only the drink differs. Sports drink delays dilution without preventing it. The running no-drink case loses cooling capacity and reaches heat failure; a separate gentler no-drink jog finishes with dehydration and sodium warnings. Not every imperfect strategy is forced to collapse.

Known limitation: the cautious policy maintains excessive cooling and reaches approximately 31°C while still finishing. The model intentionally has no cold-collapse endpoint, but this is an unrealistic successful trajectory for the default hot-weather lesson. A future heat-balance pass should address overcooling; completion alone does not establish physiological plausibility.

The impatient policy initially oscillated between adjacent settings hundreds of times. Giving it distinct surge/recovery thresholds reduced that artificial chatter to 74 accepted actions; its final advantage over steady running is only about eight seconds. The overcorrector repeatedly releases hormones and fluids but still exhausts its fuel supply. These observations support a pacing tradeoff, not a claim that simulated agents can measure human enjoyment.

## Small tuning sweep

Same policies and clock; only heat production scale varies.

| Heat scale | Steady run: seconds / actions | Impatient: seconds / actions |
| --- | --- | --- |
| 1.1 | 671 / 50 | 632 / 134 |
| **1.2 (default)** | **671 / 54** | **663 / 74** |
| 1.3 | 691 / 163 | 684 / 203 |

All six finish. The hotter setting raises policy correction burden sharply, so 1.2 is the first classroom candidate. A cautious jog takes about 16 minutes; this is a slower alternative rather than the 8–12 minute running target.

## Extending the experiments

`runSimulation()` accepts a custom policy, a timed action schedule (simulated timestamps), `reactionInterval` (simulated seconds), full `SimulationConfig`, a classroom-time cap, and `trace: true`. The trace includes readings and accepted actions. CLI JSON/CSV output contains summaries. For example:

```ts
import { runSimulation } from '../src/headless.ts';
import { DEFAULT_CONFIG } from '../src/simulation.ts';
const result = runSimulation({
  scenario: "analytical",
  config: { ...DEFAULT_CONFIG, heatScale: 1.1 },
  reactionInterval: 24, // two classroom seconds
  trace: true,
});
```

Regression tests check managed completion, isolated failure pathways, both overdrinking cases, a recoverable food delay, shared action limits, conserved fluid/solute accounting, and timestep agreement. Browser checks cover hidden references, help, failure unlock, restart/reload persistence, and layout at 900px. The 15-minute unlock boundary is exercised by the pure progression test rather than waiting in real time.

Next validation should involve students: can they explain why a correction helped or failed, and do warning intervals allow time to reason? Numerical pass/fail results cannot answer that.
