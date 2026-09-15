# Working on Homeostasis Marathon Lab

This is a biology classroom game with deliberately manual homeostasis controls. Preserve the distinction between teaching abstractions and real physiology.

## Project map

- `src/simulation.ts`: shared, pure physiology engine and action rules.
- `src/headless.ts` and `scripts/sim.ts`: accelerated scenarios and CLI.
- `src/progress.ts`: browser learner progress and earned numeric ranges.
- `app/page.tsx` and `app/globals.css`: React interface and styling.
- `docs/rebalance.md`: model boundaries, pedagogy, and physiology sources.
- `docs/playtesting.md`: scenario results and tuning comparisons.

## Preserve these decisions

- Browser and headless play use the same engine, cooldowns, and simulation clock. Keep physiology out of UI-only logic.
- Show colored normal bands immediately; unlock numeric bounds after a failed run or 900 cumulative eligible classroom seconds. Persist learner progress across race resets.
- Pause, hidden pages, and help stop browser simulation time without catch-up. Losing focus alone does not pause a visible page.
- Dehydration limits sweat production; humidity limits evaporation. Produced sweat still consumes water.
- High oxygen saturation is not a failure route. Do not equate breathlessness with low saturation or fuel depletion with loss of consciousness.
- Do not add a finish-line mental-relaxation airway trigger. See the physiology discussion in `docs/rebalance.md`.
- Treat scripted personas as behavioral probes, not evidence of student enjoyment or learning.

## Validation

Use Node.js 22.14 or newer. Run `npm test`, `npm run lint`, and `npm run build` for implementation changes. After physiology or policy changes, also run `npm run sim -- --scenario all --format csv` and update documented outcomes when necessary. Favor a small set of meaningful invariants and behavioral checks over assertions that freeze every coefficient. Check relevant browser interactions and responsive layout for UI changes.

Keep source-backed mechanisms separate from gameplay coefficients in documentation. Verify new medical claims against authoritative sources. Do not commit generated builds, local test output, or credentials.
