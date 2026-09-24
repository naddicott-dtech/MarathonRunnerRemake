/**
 * Fast, deterministic scenario runner for the homeostasis simulation.
 *
 * This module deliberately contains no physiology.  The browser and this
 * runner both call the functions in simulation.ts, so a headless result is a
 * useful check that the UI is exercising the same rules.
 */
import {
  DEFAULT_CONFIG,
  applyAction,
  initialGame,
  status,
  startGame,
  step,
  paceDemand,
} from "./simulation.ts";
import type { Action, Game, SimulationConfig } from "./simulation.ts";

export type ScenarioName =
  | "balanced"
  | "cautious"
  | "analytical"
  | "impatient"
  | "overcorrector"
  | "neglect-breathing"
  | "neglect-cooling"
  | "no-food"
  | "overdrink-water"
  | "overdrink-electrolyte"
  | "no-drink"
  | "no-drink-jog"
  | "sprint-forever"
  | "max-controls"
  | "max-controls-fed"
  | "set-and-forget"
  | "fixed-controls";

export type PolicyName = Exclude<ScenarioName, "balanced"> | "balanced";

/** A scheduled time is in simulated seconds, just like Game.time. */
export type TimedAction = {
  at: number;
  action: Action;
};

export type VitalStatus = "normal" | "warning" | "danger";

export type VisibleStatuses = {
  glucose: VitalStatus;
  oxygen: VitalStatus;
  temperature: VitalStatus;
  sodium: VitalStatus;
  hydration: VitalStatus;
};

export type PolicyContext = {
  /** Simulated time at which this decision is being made. */
  time: number;
  statuses: VisibleStatuses;
  acceptedActions: Readonly<Record<string, number>>;
  lastActionTime: number;
  scenario: ScenarioName;
};

export type Policy = (game: Game, context: PolicyContext) => Action | undefined;

export type HeadlessOptions = {
  config?: SimulationConfig;
  /** Fixed simulated seconds per engine step. Defaults to the UI's 1.2. */
  dt?: number;
  /** Classroom seconds, rather than simulated seconds. Defaults to 30 minutes. */
  maxClassroomSeconds?: number;
  /** Minimum simulated seconds between policy decisions. */
  reactionInterval?: number;
  scenario?: ScenarioName;
  policy?: PolicyName | Policy;
  /** Actions are offered at the next reaction slot. Cooldowns retry; capped no-ops are consumed.
   * Supplying a schedule without a policy disables the default autonomous policy. */
  schedule?: readonly TimedAction[];
  /** Include every fixed-step sample in the result. */
  trace?: boolean;
};

export type TraceSample = {
  time: number;
  classroomTime: number;
  distance: number;
  phase: Game["phase"];
  pace: Game["pace"];
  glucose: number;
  oxygen: number;
  temperature: number;
  sodium: number;
  hydration: number;
  glycogen: number;
  muscleGlycogen: number;
  heartRate: number;
  breathingRate: number;
  sweatLevel: number;
  outdoorTemperature: number;
  humidity: number;
  weather: string;
  gutWater: number;
  gutElectrolyte: number;
  gutCarbs: number;
  bananasRemaining: number;
  action?: Action;
};

export type RunSummary = {
  scenario: ScenarioName;
  outcome: Game["phase"];
  time: number;
  classroomTime: number;
  distance: number;
  cause: string;
  failures: string[];
  acceptedActions: Record<string, number>;
  warnings: Partial<Record<keyof VisibleStatuses, number>>;
  extrema: {
    glucose: { min: number; max: number };
    oxygen: { min: number; max: number };
    temperature: { min: number; max: number };
    sodium: { min: number; max: number };
    hydration: { min: number; max: number };
    distance: { min: number; max: number };
  };
};

export type RunResult = RunSummary & { trace?: TraceSample[] };

export const DEFAULT_HEADLESS_OPTIONS: Required<Pick<HeadlessOptions, "dt" | "maxClassroomSeconds" | "reactionInterval">> = {
  dt: 1.2,
  maxClassroomSeconds: 30 * 60,
  // One decision per classroom second models a student's attention while
  // still letting the engine advance at its UI-sized 1.2 s fixed tick.
  reactionInterval: 12,
};

const SCENARIOS: readonly ScenarioName[] = [
  "balanced",
  "cautious",
  "analytical",
  "impatient",
  "overcorrector",
  "neglect-breathing",
  "neglect-cooling",
  "no-food",
  "overdrink-water",
  "overdrink-electrolyte",
  "no-drink",
  "no-drink-jog",
  "sprint-forever",
  "max-controls",
  "max-controls-fed",
  "set-and-forget",
  "fixed-controls",
];

export const SCENARIO_NAMES = SCENARIOS;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * These are gameplay statuses used by a policy, not a second set of engine
 * collapse rules.  Keep the policy decisions based on readings a student can
 * see, and let simulation.ts remain the authority on failure thresholds.
 */
export function visibleStatuses(game: Game): VisibleStatuses {
  return {
    glucose: status("glucose", game.glucose),
    oxygen: status("oxygen", game.oxygen),
    temperature: status("temperature", game.temperature),
    sodium: status("sodium", game.sodium),
    hydration: game.hydration < -2 || game.hydration > 1 ? (game.hydration < -5 || game.hydration > 3 ? "danger" : "warning") : "normal",
  };
}

function choosePace(game: Game, target: Game["pace"]): Action | undefined {
  if (game.pace < target) return "paceUp";
  if (game.pace > target) return "paceDown";
  return undefined;
}

function chooseHeart(game: Game, target: number): Action | undefined {
  if (game.heartRate < target - 3) return "heartUp";
  if (game.heartRate > target + 3) return "heartDown";
  return undefined;
}

function chooseBreathing(game: Game, target: number): Action | undefined {
  if (game.breathingRate < target - 1) return "breatheUp";
  if (game.breathingRate > target + 1) return "breatheDown";
  return undefined;
}

function urgentCorrection(game: Game, statuses: VisibleStatuses): Action | undefined {
  if (statuses.oxygen !== "normal") {
    // Respond to the visible oxygen reading before changing pace.
    const { breathing: requiredBreathing, heart: requiredHeart } = paceDemand(game.pace);
    if (game.breathingRate < requiredBreathing - 1) return "breatheUp";
    if (game.heartRate < requiredHeart - 3) return "heartUp";
    return "paceDown";
  }
  if (statuses.temperature === "danger") return game.pace > 0 ? "paceDown" : (game.sweatLevel < 3 ? "sweat" : undefined);
  if (statuses.sodium === "danger" || statuses.hydration === "danger") {
    if (game.pace > 0) return "paceDown";
    if (game.sodium < 125) return "electrolyte";
    if (game.sodium > 155) return "water";
    return game.hydration < -5 ? "electrolyte" : undefined;
  }
  if (statuses.glucose === "danger") return game.glucose < 54 ? "banana" : "insulin";
  return undefined;
}

function maintenanceAction(game: Game, statuses: VisibleStatuses, style: "balanced" | "cautious" | "analytical" | "impatient" | "overcorrector"): Action | undefined {
  const urgent = urgentCorrection(game, statuses);
  if (urgent) return urgent;

  if (game.temperature >= 37.8) {
    if (game.sweatLevel < 3) return "sweat";
    if (game.temperature >= 38.3) return game.pace > 1 ? "paceDown" : undefined;
  }
  if (statuses.temperature !== "normal" && game.pace > 1) return "paceDown";
  if (statuses.glucose !== "normal" && game.glucose < 78) return style === "overcorrector" ? "glucagon" : "banana";
  if (statuses.glucose !== "normal" && game.glucose > 160) return "insulin";
  if (statuses.sodium === "warning" && game.sodium < 135) return game.hydration > 1 ? "paceDown" : "electrolyte";
  if (statuses.sodium === "warning" && game.sodium > 145) return "water";
  if (statuses.hydration === "warning" && game.hydration < -1.5) return "electrolyte";
  if (statuses.hydration === "warning" && game.hydration > 1) return "paceDown";

  if (style === "overcorrector") {
    if (game.temperature > 37.5 && game.sweatLevel < 3) return "sweat";
    if (game.sodium > 142 || game.hydration < -0.5) return "water";
    if (game.glucose < 100) return game.glucagon < 145 ? "glucagon" : "banana";
  }
  if (game.temperature < 37 && game.sweatLevel > 0) return "sweatDown";
  if (style === "cautious" && game.temperature > 37.3 && game.sweatLevel < 3) return "sweat";
  if (style === "analytical" && game.hydration < -0.8 && game.sodium >= 135) return "electrolyte";
  return undefined;
}

function standardPolicy(style: "balanced" | "cautious" | "analytical" | "impatient" | "overcorrector"): Policy {
  let recovering = false;
  return (game, context) => {
    if (game.temperature >= 38.3) recovering = true;
    if (game.temperature < 38) recovering = false;
    const correction = maintenanceAction(game, context.statuses, style);
    if (correction) return correction;

    const targetPace: Game["pace"] = recovering || style === "cautious" ? 1 : style === "impatient" ? 4 : 2;
    const paceAction = choosePace(game, targetPace);
    if (paceAction) return paceAction;
    const heartTarget = targetPace === 4 ? 180 : targetPace === 2 ? 145 : 105;
    const breathingTarget = targetPace === 4 ? 34 : targetPace === 2 ? 26 : 20;
    return chooseBreathing(game, breathingTarget) ?? chooseHeart(game, heartTarget);
  };
}

function diagnosticPolicy(name: ScenarioName): Policy {
  // Keep pace, breathing, heart rate and sweat fixed after setup, but still
  // replace food/fluid. This isolates failure to adapt to the weather.
  if (name === "fixed-controls") return (game) => chooseBreathing(game, 26)
    ?? chooseHeart(game, 140) ?? choosePace(game, 2)
    ?? (game.sweatLevel < 2 ? "sweat" : undefined)
    ?? (game.glucose < 80 && game.gutCarbs < 10 ? "banana" : undefined)
    ?? (game.hydration < -1 && game.gutWater + game.gutElectrolyte < .3 ? "electrolyte" : undefined);
  if (name === "set-and-forget") {
    const managed = standardPolicy('balanced');
    return (game, context) => game.classroomTime < 120 ? managed(game, context) : undefined;
  }
  if (name === "max-controls-fed") {
    const managed = standardPolicy('balanced');
    return (game, context) => {
      const maximum = chooseBreathing(game, 40) ?? chooseHeart(game, 200);
      if (maximum) return maximum;
      const action = managed(game, context);
      return action === 'heartDown' || action === 'breatheDown' ? undefined : action;
    };
  }
  if (name === "max-controls") return (game) => chooseBreathing(game, 40) ?? chooseHeart(game, 200) ?? choosePace(game, 2) ?? (game.sweatLevel < 3 ? "sweat" : undefined);
  if (name === "neglect-breathing") return (game) => choosePace(game, 4) ?? chooseHeart(game, 180);
  if (name === "neglect-cooling") return (game) => chooseBreathing(game, 34) ?? chooseHeart(game, 180) ?? choosePace(game, 4) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : undefined);
  if (name === "no-food") return (game) => chooseBreathing(game, 26) ?? chooseHeart(game, 140) ?? choosePace(game, 2) ?? (game.sweatLevel < 3 ? "sweat" : undefined);
  if (name === "no-drink") return (game) => chooseBreathing(game, 26) ?? chooseHeart(game, 140) ?? choosePace(game, 2) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : game.sweatLevel < 3 ? "sweat" : undefined);
  if (name === "no-drink-jog") return (game) => chooseBreathing(game, 20) ?? chooseHeart(game, 105) ?? choosePace(game, 1) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : game.sweatLevel < 1 ? "sweat" : undefined);
  if (name === "sprint-forever") return (game) => chooseBreathing(game, 34) ?? chooseHeart(game, 180) ?? choosePace(game, 4) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : undefined);
  // Keep the plain-water and sports-drink experiments matched: jogging,
  // sweat level 1, and otherwise the same glucose maintenance.  The drink
  // concentration is the independent variable.
  if (name === "overdrink-water") return (game) => chooseBreathing(game, 20) ?? chooseHeart(game, 105) ?? choosePace(game, 1) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : game.sweatLevel < 1 ? "sweat" : "water");
  if (name === "overdrink-electrolyte") return (game) => chooseBreathing(game, 20) ?? chooseHeart(game, 105) ?? choosePace(game, 1) ?? (game.glucose < 85 && game.gutCarbs < 10 ? "banana" : game.sweatLevel < 1 ? "sweat" : "electrolyte");
  return standardPolicy(name as "balanced" | "cautious" | "analytical" | "impatient" | "overcorrector");
}

export function createPolicy(name: PolicyName | ScenarioName): Policy {
  return diagnosticPolicy(name);
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Non-finite simulation output");
  return value;
}

function readSample(game: Game, action?: Action): TraceSample {
  return {
    time: finite(game.time),
    classroomTime: finite(game.classroomTime),
    distance: finite(game.distance),
    phase: game.phase,
    pace: game.pace,
    glucose: finite(game.glucose),
    oxygen: finite(game.oxygen),
    temperature: finite(game.temperature),
    sodium: finite(game.sodium),
    hydration: finite(game.hydration),
    glycogen: finite(game.glycogen),
    muscleGlycogen: finite(game.muscleGlycogen),
    heartRate: finite(game.heartRate),
    breathingRate: finite(game.breathingRate),
    sweatLevel: finite(game.sweatLevel),
    outdoorTemperature: finite(game.weather.temperature),
    humidity: finite(game.weather.humidity),
    weather: game.weather.label,
    gutWater: finite(game.gutWater),
    gutElectrolyte: finite(game.gutElectrolyte),
    gutCarbs: finite(game.gutCarbs),
    bananasRemaining: finite(game.bananasRemaining),
    ...(action ? { action } : {}),
  };
}

function updateExtrema(extrema: RunResult["extrema"], game: Game): void {
  const values = {
    glucose: game.glucose,
    oxygen: game.oxygen,
    temperature: game.temperature,
    sodium: game.sodium,
    hydration: game.hydration,
    distance: game.distance,
  } as const;
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    const value = finite(values[key]);
    extrema[key].min = Math.min(extrema[key].min, value);
    extrema[key].max = Math.max(extrema[key].max, value);
  }
}

function blankExtrema(game: Game): RunResult["extrema"] {
  return {
    glucose: { min: game.glucose, max: game.glucose },
    oxygen: { min: game.oxygen, max: game.oxygen },
    temperature: { min: game.temperature, max: game.temperature },
    sodium: { min: game.sodium, max: game.sodium },
    hydration: { min: game.hydration, max: game.hydration },
    distance: { min: game.distance, max: game.distance },
  };
}

function actionAccepted(before: Game, after: Game): boolean {
  // The engine returns the original object for cooldown-blocked and capped
  // no-op actions.  Comparing identity also handles actions whose visible
  // label happens to repeat (for example two consecutive water drinks).
  return after !== before;
}

function actionSchedule(schedule: readonly TimedAction[] | undefined): TimedAction[] {
  return [...(schedule ?? [])].sort((a, b) => a.at - b.at);
}

export function runSimulation(options: HeadlessOptions = {}): RunResult {
  for (const [name, value] of Object.entries({ dt: options.dt, maxClassroomSeconds: options.maxClassroomSeconds, reactionInterval: options.reactionInterval })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || (name === 'dt' && value === 0))) throw new Error(`${name} must be finite and nonnegative (dt must be positive)`);
  }
  const scenario = options.scenario ?? (typeof options.policy === "string" ? options.policy : "balanced");
  const policy = typeof options.policy === "function" ? options.policy
    : options.schedule && !options.policy ? () => undefined : createPolicy(options.policy ?? scenario);
  const dt = clamp(options.dt ?? DEFAULT_HEADLESS_OPTIONS.dt, 0.001, 3600);
  const maxClassroomSeconds = clamp(options.maxClassroomSeconds ?? DEFAULT_HEADLESS_OPTIONS.maxClassroomSeconds, 0, 24 * 60 * 60);
  const reactionInterval = clamp(options.reactionInterval ?? DEFAULT_HEADLESS_OPTIONS.reactionInterval, 0, 24 * 60 * 60);
  const config = options.config ?? DEFAULT_CONFIG;
  let game = startGame(initialGame(config));
  const schedule = actionSchedule(options.schedule);
  let scheduleIndex = 0;
  let nextReaction = 0;
  let lastActionTime = -Infinity;
  let lastSampleTime = -Infinity;
  const acceptedActions: Record<string, number> = {};
  const warnings: RunSummary["warnings"] = {};
  const trace = options.trace ? [readSample(game)] : undefined;
  const extrema = blankExtrema(game);

  const recordWarnings = (current: Game, time: number): void => {
    const statuses = visibleStatuses(current);
    for (const key of Object.keys(statuses) as (keyof VisibleStatuses)[]) {
      if (statuses[key] !== "normal" && warnings[key] === undefined) warnings[key] = time;
    }
  };

  while (game.phase === "running" && game.classroomTime < maxClassroomSeconds) {
    let actionTaken: Action | undefined;
    const atReaction = game.time + 1e-9 >= nextReaction;
    if (atReaction) {
      const due = schedule[scheduleIndex];
      const scheduled = due && due.at <= game.time + 1e-9 ? due.action : undefined;
      const action = scheduled ?? policy(game, {
        time: game.time,
        statuses: visibleStatuses(game),
        acceptedActions,
        lastActionTime,
        scenario,
      });
      if (action) {
        const coolingDown = (game.cooldowns[action] ?? 0) > 1e-9;
        const next = applyAction(game, action, config);
        if (actionAccepted(game, next)) {
          game = next;
          acceptedActions[action] = (acceptedActions[action] ?? 0) + 1;
          lastActionTime = game.time;
          actionTaken = action;
        }
        if (scheduled && !coolingDown) scheduleIndex += 1;
      }
      nextReaction += reactionInterval;
      if (reactionInterval === 0) nextReaction = game.time + dt;
    }

    const beforeStep = game;
    // Split at policy reaction boundaries so changing --dt does not change
    // when a scheduled or personality action is offered.
    const untilReaction = nextReaction - game.time;
    const stepDt = untilReaction > 1e-9 ? Math.min(dt, untilReaction) : dt;
    const untilCap = (maxClassroomSeconds - game.classroomTime) * config.classroomSpeed;
    game = step(game, Math.min(stepDt, Math.max(0, untilCap)), config);
    if (game === beforeStep && game.phase === "running") break;
    updateExtrema(extrema, game);
    recordWarnings(game, game.time);
    if (trace && game.time !== lastSampleTime) {
      trace.push(readSample(game, actionTaken));
      lastSampleTime = game.time;
    }
  }

  const result: RunResult = {
    scenario,
    outcome: game.phase,
    time: finite(game.time),
    classroomTime: finite(game.classroomTime),
    distance: finite(game.distance),
    cause: game.cause,
    failures: [...game.failures],
    acceptedActions,
    warnings,
    extrema,
  };
  if (trace) result.trace = trace;
  return result;
}

export function runScenarios(names: readonly ScenarioName[] = SCENARIOS, options: Omit<HeadlessOptions, "scenario" | "policy"> = {}): RunResult[] {
  return names.map((scenario) => runSimulation({ ...options, scenario, policy: scenario }));
}

export function isScenarioName(value: string): value is ScenarioName {
  return (SCENARIOS as readonly string[]).includes(value);
}
