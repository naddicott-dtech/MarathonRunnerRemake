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
export type SimulationConfig = {
  classroomSpeed: number; finishDistance: number; outdoorTemperature: number; humidity: number;
  bodyMass: number; initialBodyWater: number; initialLiverGlycogen: number;
  initialMuscleGlycogen: number; sportsDrinkSodium: number; sweatSodium: number;
  heatScale: number; fuelScale: number; maxStep: number;
};
export const DEFAULT_CONFIG: SimulationConfig = {
  classroomSpeed: 12, finishDistance: 40_000, outdoorTemperature: 36, humidity: 60,
  bodyMass: 70, initialBodyWater: 42, initialLiverGlycogen: 45,
  initialMuscleGlycogen: 160, sportsDrinkSodium: 25, sweatSodium: 40,
  heatScale: 1.2, fuelScale: 1, maxStep: 1.2,
};
export type Game = {
  phase: Phase; time: number; classroomTime: number; distance: number; pace: Pace;
  glucose: number; oxygen: number; temperature: number; sodium: number;
  bodyWater: number; solute: number; plasmaVolume: number; hydration: number;
  heartRate: number; breathingRate: number; insulin: number; glucagon: number;
  glycogen: number; muscleGlycogen: number; reserve: number; oxygenDelivery: number;
  gutWater: number; gutElectrolyte: number; gutCarbs: number; sweatLevel: number;
  cooldowns: Partial<Record<Action, number>>; lastAction: string; cause: string; failures: string[];
  waterIn: number; soluteIn: number; sweatOut: number; urineOut: number; soluteOut: number;
};
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function initialGame(config: SimulationConfig = DEFAULT_CONFIG): Game {
  return {
    phase: 'ready', time: 0, classroomTime: 0, distance: 0, pace: 0,
    glucose: 90, oxygen: 98, temperature: 37, sodium: 140,
    bodyWater: config.initialBodyWater, solute: 140 * config.initialBodyWater,
    plasmaVolume: 3, hydration: 0, heartRate: 60, breathingRate: 12,
    insulin: 10, glucagon: 50, glycogen: config.initialLiverGlycogen,
    muscleGlycogen: config.initialMuscleGlycogen, reserve: 100, oxygenDelivery: 100,
    gutWater: 0, gutElectrolyte: 0, gutCarbs: 0, sweatLevel: 0, cooldowns: {},
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
  if (name === 'temperature') return value >= 40.5 ? 'danger' : value >= 38.5 ? 'warning' : 'normal';
  return value < 125 || value > 155 ? 'danger' : value < 135 || value > 145 ? 'warning' : 'normal';
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
    case 'banana': next.gutCarbs += 25; break;
    case 'sweat': next.sweatLevel = Math.min(3, next.sweatLevel + 1); break;
    case 'sweatDown': next.sweatLevel = Math.max(0, next.sweatLevel - 1); break;
    case 'glucagon': next.glucagon = Math.min(150, next.glucagon + 15); break;
    case 'insulin': next.insulin = Math.min(25, next.insulin + 5); break;
    case 'paceUp':
      if (next.pace === 2 && (next.reserve < 25 || next.muscleGlycogen < 5)) return game;
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

  const requiredBreathing = [12, 20, 26, 12, 34][g.pace];
  const oxygenTarget = clamp(98 - Math.max(0, requiredBreathing - g.breathingRate) * 1.15, 78, 98);
  g.oxygen += (oxygenTarget - g.oxygen) * (1 - Math.exp(-dt / 100));
  const requiredHeart = [60, 105, 140, 60, 180][g.pace];
  const perfusion = clamp(1 - Math.max(0, -g.hydration - 1) * .07, .5, 1);
  g.oxygenDelivery = Math.min(110, 100 * g.oxygen / 98 * Math.min(g.heartRate, 180) / requiredHeart * perfusion);

  const gutCarbsAbsorbed = Math.min(g.gutCarbs * (1 - Math.exp(-dt * .693 / 240)), .04 * dt);
  g.gutCarbs -= gutCarbsAbsorbed;
  const liverRelease = Math.min(g.glycogen, (.002 + Math.max(0, g.glucagon - 50) * .00012) * dt);
  g.glycogen -= liverRelease;
  const bloodUse = (.002 + [0, .003, .007, 0, .017][g.pace] * config.fuelScale) * dt;
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
  const evaporationCapacity = Math.max(.2, 2.4 - config.humidity * .015);
  const evaporatedLph = Math.min(sweatLph, evaporationCapacity);
  const dryLoss = (g.temperature - config.outdoorTemperature) * .4;
  g.temperature += (heat - evaporatedLph * 6 - dryLoss) / 3600 * dt;

  const deliveryShortfall = Math.max(0, 85 - g.oxygenDelivery) / 100;
  const reserveRate = g.pace === 4 ? -.16 : g.pace === 2 ? .045 : .09;
  g.reserve = clamp(g.reserve + (reserveRate - deliveryShortfall * .8 - (g.muscleGlycogen < 5 ? .15 : 0)) * dt, 0, 100);
  if (g.pace === 4 && g.reserve < 10) {
    g.pace = 2;
    g.lastAction = 'Sprint reserve exhausted: the runner slowed down. Recover before the next surge.';
  }
  if (g.pace === 2 && g.muscleGlycogen < 1) {
    g.pace = 1;
    g.lastAction = 'Muscle fuel is depleted: the runner slowed to a jog.';
  }
  g.distance = Math.min(config.finishDistance, g.distance + [0, 3.5, 5, 0, 7][g.pace] * dt);

  if (g.oxygen <= 88) g.failures.push('Low blood oxygen: ventilation did not meet demand.');
  if (g.glucose < 54) g.failures.push('Hypoglycemia: available fuel did not meet demand.');
  if (g.temperature >= 40.5) g.failures.push('Heat emergency: heat production exceeded cooling.');
  if (g.sodium < 125) g.failures.push('Hyponatremia: too much retained water relative to solute.');
  if (g.sodium > 155) g.failures.push('Hypernatremia: too little water relative to solute.');
  if (g.hydration <= -6) g.failures.push('Severe dehydration: fluid losses exceeded replacement.');
  if (g.reserve <= 0 && g.oxygenDelivery < 65) g.failures.push('Inadequate oxygen delivery: circulation could not support the effort.');
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
