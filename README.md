# Homeostasis Marathon Lab

A browser-based biology game in which students manually manage the homeostasis loops that keep a marathon runner alive.

## Run locally

Requires Node.js 22.14 or newer (headless runs use built-in TypeScript support).

```bash
npm ci
npm run dev
```

Open the local address printed in the terminal.

## Publish with GitHub Pages

1. Create a public repository on GitHub.
2. Push this project to its `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab and wait for “Deploy to GitHub Pages” to finish.

The resulting Pages URL is public and requires no ChatGPT account or application installation.

## Commands

- `npm run dev` — start the local development server
- `npm run build` — create the static site in `dist/`
- `npm run preview` — preview the static build locally
- `npm run lint` — check the source code
- `npm test` — run engine, scenario, and learner-progress regression tests
- `npm run sim -- --scenario all --format csv` — run the headless scenario matrix

## Simulation and learning mode

The browser and headless runner share the same simulation. The default hot-weather lesson uses manual corrective feedback, finite fuel stores and pace-dependent control costs, hydration-limited sweating, and humidity-limited evaporation. Temperature and humidity change during the race; responsive play must readjust pace and cooling. Sprinting has no stamina lockout, and capped controls show their limits. Each race provides three bananas, with a visible remaining count and an “Out of bananas” state.

The colored normal bands remain visible as a hint; their numeric bounds are hidden until a failed run or 15 cumulative minutes of active, moving play without dangerous vitals. Progress is saved in this browser; restarting a race does not erase it. Pause/Resume freezes the race, controls, animation, cooldowns, and learning time. The timer also pauses when the page is hidden or while help is open. Losing window focus alone does not pause it. This is a classroom model, not a clinical diagnostic tool.

```bash
npm test
npm run sim -- --scenario all --format csv
npm run sim -- --scenario analytical --output /tmp/analytical.json
```

The simulations run without rendering or waiting. `--dt` is simulated seconds per integration step, not a speed multiplier. Use `runSimulation({ trace: true })` for full trajectories or pass custom policies and configurations.

See [model assumptions and sources](docs/rebalance.md) and [persona outcomes and tuning comparisons](docs/playtesting.md).

Contributor and coding-agent guidance is in [AGENTS.md](AGENTS.md).
