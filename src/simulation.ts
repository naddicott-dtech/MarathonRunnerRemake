/** Classroom model, not a clinical predictor. All rates use simulated seconds.
 * Manual controls replace the corrective autonomic responses; basal processes remain.
 * See docs/rebalance.md for the simplifying assumptions and calibration targets.
 */
export type Pace = 0 | 1 | 2 | 4;
export type Phase = 'ready' | 'running' | 'collapsed' | 'finished';
export type VitalName = 'glucose' | 'oxygen' | 'temperature' | 'sodium';
export type Action = keyof typeof ACTION_NAMES;
export const PACE_NAMES = ['Resting', 'Jogging', 'Running', 'Collapsed', 'Sprinting'] as const;
export const ACTION_NAMES = {
  breatheUp: 'Breathe faster', breatheDown: 'Breathe slower',
  heartUp: 'Increase heart rate', heartDown: 'Decrease heart rate',
  water: 'Drink water', electrolyte: 'Drink sports drink', sweat: 'Sweat more',
  sweatDown: 'Sweat less', paceUp: 'Run faster', paceDown: 'Run slower',
  banana: 'Eat banana', glucagon: 'Release glucagon', insulin: 'Release insulin',
} as const;
/** Interface cooldowns in classroom seconds. State stores their simulated equivalents. */
export const COOLDOWNS: Record<Action, number> = {
  breatheUp: .5, breatheDown: .5, heartUp: .5, heartDown: .5,
  water: 3, electrolyte: 3, sweat: 3, sweatDown: 3, paceUp: 1, paceDown: 1,
  banana: 45, glucagon: 5, insulin: 5,
};
export type WeatherChange = {
  /** Simulated seconds; shifts ramp over 120 simulated seconds. */
  at: number; temperatureOffset: number; humidityOffset: number; label: string; hint: string;
};
export type Weather = { temperature: number; humidity: number; label: string; hint: string };
export type SimulationConfig = {
  classroomSpeed: number; finishDistance: number; outdoorTemperature: number; humidity: number;
  bodyMass: number; initialBodyWater: number; initialLiverGlycogen: number;
  initialMuscleGlycogen: number; sportsDrinkSodium: number; sweatSodium: number;
  heatScale: number; fuelScale: number; maxStep: number; bananaAllowance: number;
  weatherChanges?: readonly WeatherChange[];
};
export const DEFAULT_CONFIG: SimulationConfig = {
  classroomSpeed: 12, finishDistance: 40_000, outdoorTemperature: 36, humidity: 60,
  bodyMass: 70, initialBodyWater: 42, initialLiverGlycogen: 45,
  initialMuscleGlycogen: 160, sportsDrinkSodium: 25, sweatSodium: 40,
  heatScale: 1.2, fuelScale: 1, maxStep: 1.2, bananaAllowance: 3,
  weatherChanges: [
    { at: 1800, temperatureOffset: 4, humidityOffset: 25, label: 'Hot, humid stretch', hint: 'Sweat evaporates less readily. Watch temperature; slowing down reduces heat production.' },
    { at: 5400, temperatureOffset: -4, humidityOffset: -25, label: 'Cooler, drier air', hint: 'Sweat can cool more effectively now. Recheck sweating and fluid needs.' },
    { at: 6600, temperatureOffset: 2, humidityOffset: 15, label: 'Heat and humidity return', hint: 'Cooling is less effective again. Reassess pace, sweating, and fluid losses.' },
    { at: 7800, temperatureOffset: -2, humidityOffset: -10, label: 'Milder conditions', hint: 'Conditions have eased. Readjust controls if you change pace.' },
  ],
};
export type Game = {
  phase: Phase; time: number; classroomTime: number; distance: number; pace: Pace;
  glucose: number; oxygen: number; temperature: number; sodium: number;
  weather: Weather;
  bodyWater: number; solute: number; plasmaVolume: number; hydration: number;
  heartRate: number; breathingRate: number; insulin: number; glucagon: number;
  glycogen: number; muscleGlycogen: number;
  gutWater: number; gutElectrolyte: number; gutCarbs: number; bananasRemaining: number; sweatLevel: number;
  cooldowns: Partial<Record<Action, number>>; lastAction: string; cause: string; failures: string[];
  waterIn: number; soluteIn: number; sweatOut: number; urineOut: number; soluteOut: number;
};
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Deterministic weather shared by browser and headless runs, independent of wall time. */
export function weatherAt(time: number, config: SimulationConfig = DEFAULT_CONFIG): Weather {
  let temperatureOffset = 0, humidityOffset = 0;
  let label = 'Warm start', hint = 'Conditions change during the race. Keep checking the readings.';
  for (const change of config.weatherChanges ?? []) {
    if (time < change.at) break;
    const fraction = clamp((time - change.at) / 120, 0, 1);
    temperatureOffset += (change.temperatureOffset - temperatureOffset) * fraction;
    humidityOffset += (change.humidityOffset - humidityOffset) * fraction;
    label = change.label; hint = change.hint;
  }
  return { temperature: config.outdoorTemperature + temperatureOffset,
    humidity: clamp(config.humidity + humidityOffset, 0, 100), label, hint };
}

export function initialGame(config: SimulationConfig = DEFAULT_CONFIG): Game {
  return {
    phase: 'ready', time: 0, classroomTime: 0, distance: 0, pace: 0,
    glucose: 90, oxygen: 98, temperature: 37, sodium: 140, weather: weatherAt(0, config),
    bodyWater: config.initialBodyWater, solute: 140 * config.initialBodyWater,
    plasmaVolume: 3, hydration: 0, heartRate: 60, breathingRate: 12,
    insulin: 10, glucagon: 50, glycogen: config.initialLiverGlycogen,
    muscleGlycogen: config.initialMuscleGlycogen,
    gutWater: 0, gutElectrolyte: 0, gutCarbs: 0, bananasRemaining: config.bananaAllowance, sweatLevel: 0, cooldowns: {},
    lastAction: 'Start the race, then increase your pace.', cause: '', failures: [],
    waterIn: 0, soluteIn: 0, sweatOut: 0, urineOut: 0, soluteOut: 0,
  };
}
export function startGame(game: Game): Game {
  return game.phase === 'ready'
    ? { ...game, phase: 'running', lastAction: 'You control the feedback responses. Increase your pace to move.' }
    : game;
}
export function status(name: VitalName, value: number): 'normal' | 'warning' | 'danger' {
  if (name === 'glucose') return value < 54 ? 'danger' : value < 70 || value > 180 ? 'warning' : 'normal';
  if (name === 'oxygen') return value <= 88 ? 'danger' : value < 95 ? 'warning' : 'normal';
  if (name === 'temperature') return value >= 40 ? 'danger' : value >= 38.5 ? 'warning' : 'normal';
  return value < 125 || value > 155 ? 'danger' : value < 135 || value > 145 ? 'warning' : 'normal';
}
export function paceDemand(pace: Pace) {
  return { breathing: [12, 20, 26, 12, 34][pace], heart: [60, 105, 140, 60, 180][pace] };
}
export function effortHint(game: Game, control: 'heart' | 'breathing'): string {
  const demand = paceDemand(game.pace)[control];
  const value = control === 'heart' ? game.heartRate : game.breathingRate;
  const margin = control === 'heart' ? 10 : 2;
  if (value > demand + margin) return 'Above pace needs · extra glucose use';
  if (value < demand - margin) return control === 'heart'
    ? 'Below pace needs · inefficient fuel use' : 'Below pace needs · oxygen may fall';
  return 'Enough for current pace';
}

export const SWEAT_NAMES = ['A little', 'Moderate', 'Heavy', 'Out of every pore'] as const;
export function controlLimit(game: Game, action: Action): string | undefined {
  if (action === 'banana' && game.bananasRemaining <= 0) return 'Out of bananas';
  const bounds: Partial<Record<Action, [number, number, string]>> = {
    heartUp: [game.heartRate, 200, 'Maximum'], heartDown: [-game.heartRate, -40, 'Minimum'],
    breatheUp: [game.breathingRate, 40, 'Maximum'], breatheDown: [-game.breathingRate, -6, 'Minimum'],
    paceUp: [game.pace, 4, 'Fastest pace'], paceDown: [-game.pace, 0, 'Resting'],
    sweat: [game.sweatLevel, 3, 'Maximum'], sweatDown: [-game.sweatLevel, 0, 'Minimum'],
    insulin: [game.insulin, 25, 'Maximum'], glucagon: [game.glucagon, 150, 'Maximum'],
  };
  const bound = bounds[action];
  return bound && bound[0] >= bound[1] ? bound[2] : undefined;
}

export function applyAction(game: Game, action: Action, config = DEFAULT_CONFIG): Game {
  if (game.phase !== 'running' || !(action in ACTION_NAMES) || (game.cooldowns[action] || 0) > 1e-9) return game;
  const next = { ...game, cooldowns: { ...game.cooldowns }, failures: [...game.failures] };
  switch (action) {
    case 'breatheUp': next.breathingRate = Math.min(40, next.breathingRate + 2); break;
    case 'breatheDown': next.breathingRate = Math.max(6, next.breathingRate - 2); break;
    case 'heartUp': next.heartRate = Math.min(200, next.heartRate + 5); break;
    case 'heartDown': next.heartRate = Math.max(40, next.heartRate - 5); break;
    case 'water': next.gutWater += .25; break;
    case 'electrolyte': next.gutElectrolyte += .25; break;
    case 'banana':
      if (next.bananasRemaining <= 0) return game;
      next.bananasRemaining -= 1; next.gutCarbs += 25; break;
    case 'sweat': next.sweatLevel = Math.min(3, next.sweatLevel + 1); break;
    case 'sweatDown': next.sweatLevel = Math.max(0, next.sweatLevel - 1); break;
    case 'glucagon': next.glucagon = Math.min(150, next.glucagon + 15); break;
    case 'insulin': next.insulin = Math.min(25, next.insulin + 5); break;
    case 'paceUp':
      next.pace = next.pace === 0 ? 1 : next.pace === 1 ? 2 : 4; break;
    case 'paceDown': next.pace = next.pace === 4 ? 2 : next.pace === 2 ? 1 : 0; break;
  }
  // A capped control is a no-op, not a successful click or a fresh cooldown.
  if (Object.keys(next).every(key => key === 'cooldowns' || key === 'failures' || next[key as keyof Game] === game[key as keyof Game])) return game;
  next.cooldowns[action] = COOLDOWNS[action] * config.classroomSpeed;
  next.lastAction = ACTION_NAMES[action];
  return next;
}

function integrate(previous: Game, dt: number, config: SimulationConfig): Game {
  const g: Game = { ...previous, cooldowns: { ...previous.cooldowns }, failures: [] };
  g.time += dt;
  g.classroomTime = g.time / config.classroomSpeed;
  g.weather = weatherAt(g.time, config);
  for (const action of Object.keys(g.cooldowns) as Action[]) g.cooldowns[action] = Math.max(0, (g.cooldowns[action] || 0) - dt);

  // Absorbed fluid distributes through an effective body-water/solute pool, not directly into 3 L plasma.
  // Solute is a calibrated Na-equivalent proxy for exchangeable Na + K, not a literal plasma sodium mass.
  const gutFluid = g.gutWater + g.gutElectrolyte;
  const absorbed = Math.min(gutFluid * (1 - Math.exp(-dt * .693 / 300)), 3.5 / 3600 * dt);
  const drinkShare = gutFluid > 0 ? g.gutElectrolyte / gutFluid : 0;
  g.gutWater = Math.max(0, g.gutWater - absorbed * (1 - drinkShare));
  g.gutElectrolyte = Math.max(0, g.gutElectrolyte - absorbed * drinkShare);
  const absorbedSolute = absorbed * drinkShare * config.sportsDrinkSodium;
  g.bodyWater += absorbed; g.solute += absorbedSolute;
  g.waterIn += absorbed; g.soluteIn += absorbedSolute;

  const deficit = Math.max(0, -g.hydration);
  const sweatSupply = clamp(1 - Math.max(0, deficit - 2) * .3, .3, 1);
  const sweatLph = ([.1, .2, .25, 0, .35][g.pace] + g.sweatLevel * .7) * sweatSupply;
  const sweat = Math.min(g.bodyWater, sweatLph / 3600 * dt);
  // Exercise reduces free-water clearance. Extra water cannot be excreted without limit.
  const waterSurplus = Math.max(0, g.bodyWater - config.initialBodyWater);
  const urineLph = deficit > 1 ? .04 : .08 + Math.min(.8, waterSurplus * .3) * (g.pace === 4 ? .2 : g.pace === 2 ? .4 : g.pace === 1 ? .8 : 1);
  const urine = Math.min(Math.max(0, g.bodyWater - sweat), urineLph / 3600 * dt);
  const soluteLost = Math.min(g.solute, sweat * config.sweatSodium + urine * 20);
  g.bodyWater -= sweat + urine; g.solute -= soluteLost;
  g.sweatOut += sweat; g.urineOut += urine; g.soluteOut += soluteLost;
  g.sodium = g.bodyWater > 0 ? g.solute / g.bodyWater : 200;
  g.hydration = (g.bodyWater - config.initialBodyWater) / config.bodyMass * 100;
  g.plasmaVolume = Math.max(0, 3 * (1 + g.hydration / 100 * 2)); // estimated readout only

  const { breathing: requiredBreathing, heart: requiredHeart } = paceDemand(g.pace);
  const oxygenTarget = clamp(98 - Math.max(0, requiredBreathing - g.breathingRate) * 1.15, 78, 98);
  g.oxygen += (oxygenTarget - g.oxygen) * (1 - Math.exp(-dt / 100));
  // Teaching coefficients, not clinical glucose predictions. Low circulation
  // makes effort less fuel-efficient; excessive cardiac/respiratory work costs fuel.
  const controlCost = Math.max(0, g.heartRate - requiredHeart - 10) * .00006
    + Math.max(0, g.breathingRate - requiredBreathing - 2) * .0003
    + Math.max(0, requiredHeart - g.heartRate - 10) * .000075;

  const gutCarbsAbsorbed = Math.min(g.gutCarbs * (1 - Math.exp(-dt * .693 / 240)), .04 * dt);
  g.gutCarbs -= gutCarbsAbsorbed;
  const liverRelease = Math.min(g.glycogen, (.002 + Math.max(0, g.glucagon - 50) * .00012) * dt);
  g.glycogen -= liverRelease;
  const bloodUse = (.002 + controlCost + [0, .003, .007, 0, .017][g.pace] * config.fuelScale) * dt;
  const muscleUse = Math.min(g.muscleGlycogen, [0, .008, .015, 0, .04][g.pace] * config.fuelScale * dt);
  g.muscleGlycogen -= muscleUse;
  const storage = Math.min(Math.max(0, g.glucose - 40) / 2,
    (Math.max(0, g.glucose - 110) * .0002 + Math.max(0, g.insulin - 10) * .001) * dt,
    Math.max(0, 100 - g.glycogen));
  g.glycogen += storage;
  // Effective glucose buffering converts grams to the displayed concentration. This is calibrated, not blood volume.
  g.glucose += (liverRelease + gutCarbsAbsorbed - bloodUse - storage) * 2;
  g.insulin = 10 + (g.insulin - 10) * Math.exp(-dt / 240);
  g.glucagon = 50 + (g.glucagon - 50) * Math.exp(-dt / 360);

  const heat = [1.5, 5, 8, 0, 14][g.pace] * config.heatScale;
  const evaporationCapacity = Math.max(.2, 2.4 - g.weather.humidity * .015);
  const evaporatedLph = Math.min(sweatLph, evaporationCapacity);
  const dryLoss = (g.temperature - g.weather.temperature) * .4;
  g.temperature += (heat - evaporatedLph * 6 - dryLoss) / 3600 * dt;

  g.distance = Math.min(config.finishDistance, g.distance + [0, 3.5, 5, 0, 7][g.pace] * dt);

  if (g.oxygen <= 88) g.failures.push('Low blood oxygen: ventilation did not meet demand.');
  if (g.glucose < 54) g.failures.push('Hypoglycemia: available fuel did not meet demand.');
  if (g.temperature >= 40) g.failures.push('Heat emergency: heat production exceeded cooling.');
  if (g.sodium < 125) g.failures.push('Hyponatremia: too much retained water relative to solute.');
  if (g.sodium > 155) g.failures.push('Hypernatremia: too little water relative to solute.');
  if (g.hydration <= -6) g.failures.push('Severe dehydration: fluid losses exceeded replacement.');
  if (g.failures.length) { g.phase = 'collapsed'; g.cause = g.failures.join(' '); }
  else if (g.distance >= config.finishDistance) { g.phase = 'finished'; g.lastAction = 'Race complete.'; }
  return g;
}

/** Fixed substeps keep accelerated callers numerically consistent with the browser. */
export function step(game: Game, dt: number, config: SimulationConfig = DEFAULT_CONFIG): Game {
  if (!Number.isFinite(dt) || dt < 0) throw new Error('dt must be a finite nonnegative number');
  if (!(config.maxStep > 0) || !Number.isFinite(config.maxStep) || !(config.classroomSpeed > 0)) throw new Error('Invalid simulation clock configuration');
  let next = game;
  let remaining = dt;
  while (remaining > 1e-9 && next.phase === 'running') {
    const substep = Math.min(remaining, config.maxStep);
    next = integrate(next, substep, config);
    remaining -= substep;
  }
  return next;
}
