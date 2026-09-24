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
| balanced | finished | 747 | 40,000 | — | 78 |
| cautious | finished | 952 | 40,000 | — | 47 |
| analytical | finished | 747 | 40,000 | — | 82 |
| impatient | collapsed | 7 | 539 | Low blood oxygen | 8 |
| overcorrector | collapsed | 844 | 35,587 | Hypoglycemia | 176 |
| neglect-breathing | collapsed | 7 | 488 | Low blood oxygen | 7 |
| neglect-cooling | collapsed | 100 | 5,394 | Heat emergency | 39 |
| no-food | collapsed | 223 | 11,982 | Hypoglycemia | 28 |
| overdrink-water | collapsed | 639 | 26,279 | Hyponatremia | 224 |
| overdrink-electrolyte | collapsed | 914 | 37,834 | Hyponatremia | 317 |
| no-drink | collapsed | 404 | 22,854 | Heat emergency | 30 |
| no-drink-jog | finished | 965 | 40,000 | — | 17 |
| sprint-forever | collapsed | 100 | 5,394 | Heat emergency | 39 |
| max-controls | collapsed | 125 | 4,932 | Hypoglycemia | 47 |
| max-controls-fed | collapsed | 586 | 27,756 | Hypoglycemia | 62 |
| set-and-forget | collapsed | 357 | 21,396 | Heat emergency | 30 |
| fixed-controls | collapsed | 404 | 22,854 | Heat emergency | 36 |

The two overdrinking experiments use matched jogging, sweat level 1, and food maintenance; only the drink differs. Sports drink delays dilution without preventing it. The running no-drink case loses cooling capacity and reaches heat failure; a separate gentler no-drink jog finishes with dehydration and sodium warnings. Not every imperfect strategy is forced to collapse.

## Revision findings

Exercise reserve, oxygen delivery, and automatic fuel-related pace restrictions are removed. Managed play still finishes in about 12.5 minutes with 78 accepted actions. Unsupported immediate sprinting can fail on oxygen within 7 classroom seconds; preparing breathing first allows the sprint probe to continue until heat failure at about 100 seconds. The impatient probe now exposes this fast failure; it is not evidence of a comfortable reaction window for students. Pause remains available.

The max-controls probe sets breathing to 40, heart rate to 200, sweat to maximum, and pace to Running, without food or drinks. It fails on glucose at 125 seconds versus 223 seconds for the matched-control no-food probe. Startup action counts differ, so this is a behavioral comparison rather than an isolated measurement. It does not maximize hormones or repeatedly eat/drink.

A controlled comparison starts two running states at 90 mg/dL with identical cooling and fuel stores. After 60 classroom seconds, matched settings (140 beats/min, 26 breaths/min) yield 79.92 mg/dL; maximum settings (200, 40) yield 70.42 mg/dL. Both maintain 98% saturation. The control-cost coefficients were reduced by half from the first trial to leave more room for recovery. Regression checks cover each excessive control separately, low heart rate without changing saturation, and readjustment after slowing down.

The cautious policy now reduces sweat when temperature falls below 37°C, rather than leaving cooling pegged and finishing near 31°C. This is a policy improvement, not a new automatic body response. The model still lacks a cold-collapse endpoint; excessive cooling remains a model limitation.

Previous heat-scale sweep results are superseded by these mechanics. The default heat scale remains 1.2. Weather changes and a 40°C game heat-stop threshold replace the static-weather challenge. A small weather-duration sweep showed that short hot stretches allowed fixed settings to coast through; a longer hot/humid stretch makes fixed running fail on heat while attentive play succeeds. The responsive policy uses a 38.3°C slowdown / below-38°C recovery interval to avoid rapidly toggling pace. No claim of optimal coefficients or student enjoyment is implied.

The fixed-controls probe holds running pace, heart rate 140, breathing 26, and sweat level 2 after setup, but still replenishes food and electrolyte drink. It finishes with constant starting weather and fails on heat with the changing-weather course. This isolates the need to respond to conditions from merely remembering to eat. The set-and-forget probe stops all actions after two minutes of attentive play and also collapses. Tests check a heat-warning window of at least ten classroom seconds and that the attentive policy slows down after the first weather shift and reduces sweat after the cooler shift.

Halving the integration step preserves completion time within one classroom second and vital extrema within 0.5 units. One extra drink can occur at a threshold crossing; exact action-count identity is not required. Timed action scheduling remains checked independently.

## Banana allowance comparison

Three bananas per race leaves one spare for the balanced probe, which finishes using two. Cautious play uses one. Eating still has delayed absorption and a 45-second classroom cooldown; cooldown clicks and rejected empty-inventory clicks do not consume inventory or restart cooldowns.

The max-controls-fed probe keeps heart rate at 200 and breathing at 40 while using the balanced policy's pace, cooling, food, and fluid corrections. It does not lower those two controls or add hormone interventions. With a large allowance, it finishes in 790 classroom seconds using five bananas. With the default three, it collapses from hypoglycemia at 586 seconds. In an allowance sweep, two bananas fail at 432 seconds; four fail at 739 seconds. Three was selected to leave recovery room for attentive play while preventing this particular food-compensation strategy from succeeding. This is not proof against every strategy involving hormones or alternate pacing.

Regression tests verify inventory exhaustion after cooldown expiry, immutable action handling, restart restocking, managed completion, and the matched fed maximum-controls comparison. Browser checks verify the remaining-count label and empty-state feedback.

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
