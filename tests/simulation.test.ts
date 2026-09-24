import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, startGame, applyAction, step, DEFAULT_CONFIG, controlLimit, weatherAt } from '../src/simulation.ts';

test('ready and terminal states do not advance or accept controls; restart is clean', () => {
  const ready = initialGame();
  assert.equal(step(ready, 100), ready);
  assert.equal(applyAction(ready, 'water'), ready);
  for (const phase of ['finished', 'collapsed'] as const) {
    const done = { ...ready, phase };
    assert.equal(step(done, 100), done);
    assert.equal(applyAction(done, 'paceUp'), done);
  }
  assert.deepEqual(initialGame(), ready);
});

test('actions are immutable and cooldowns are enforced on the shared simulation clock', () => {
  const original = startGame(initialGame());
  const drank = applyAction(original, 'water');
  assert.equal(original.gutWater, 0);
  assert.ok(drank.gutWater > 0);
  assert.equal(applyAction(drank, 'water'), drank);
  const elapsed = step(drank, 3 * DEFAULT_CONFIG.classroomSpeed);
  assert.notEqual(applyAction(elapsed, 'water'), elapsed);
  const capped = { ...original, heartRate: 200 };
  assert.equal(applyAction(capped, 'heartUp'), capped);
});

test('fluid and solute accounting conserves absorbed inputs and measured losses', () => {
  let game = startGame(initialGame());
  game = applyAction(applyAction(game, 'water'), 'electrolyte');
  game = applyAction(game, 'sweat');
  game = step(game, 1200);
  assert.ok(Math.abs(game.bodyWater - (42 + game.waterIn - game.sweatOut - game.urineOut)) < 1e-8);
  assert.ok(Math.abs(game.solute - (140 * 42 + game.soluteIn - game.soluteOut)) < 1e-8);
  assert.ok(Math.abs(game.sodium - game.solute / game.bodyWater) < 1e-8);
  assert.ok(game.gutWater >= 0 && game.gutElectrolyte >= 0);
});

test('matching controls conserves glucose without making heart rate change saturation', () => {
  const runner = { ...startGame(initialGame()), pace: 2 as const, breathingRate: 26, heartRate: 140 };
  const matched = step(runner, 120);
  const excessHeart = step({ ...runner, heartRate: 200 }, 120);
  const excessBreathing = step({ ...runner, breathingRate: 40 }, 120);
  const lowHeart = step({ ...runner, heartRate: 60 }, 120);
  assert.equal(lowHeart.oxygen, matched.oxygen);
  assert.equal(excessHeart.oxygen, matched.oxygen);
  for (const other of [excessHeart, excessBreathing, lowHeart]) assert.ok(other.glucose < matched.glucose);
  const slowed = { ...runner, pace: 1 as const };
  assert.ok(step(slowed, 120).glucose < step({ ...slowed, breathingRate: 20, heartRate: 105 }, 120).glucose);
});

test('glucagon cannot release exhausted liver glycogen; automatic hormones do not rescue falling glucose', () => {
  const empty = { ...startGame(initialGame()), glycogen: 0, glucagon: 150, glucose: 65 };
  const later = step(empty, 120);
  assert.equal(later.glycogen, 0);
  assert.ok(later.glucose < empty.glucose);
  assert.ok(later.glucagon < empty.glucagon);
});

test('sweat cools but costs fluid; humidity limits its cooling benefit', () => {
  const runner = { ...startGame(initialGame()), pace: 2 as const, heartRate: 150, breathingRate: 28 };
  const dry = step(runner, 600);
  const sweating = step({ ...runner, sweatLevel: 3 }, 600);
  const humid = step({ ...runner, sweatLevel: 3 }, 600, { ...DEFAULT_CONFIG, humidity: 90 });
  assert.ok(sweating.temperature < dry.temperature);
  assert.ok(sweating.bodyWater < dry.bodyWater);
  assert.ok(humid.temperature > sweating.temperature);
});

test('sprinting is available even with depleted muscle fuel; effort does not force a slowdown', () => {
  const runner = { ...startGame(initialGame()), pace: 2 as const, muscleGlycogen: 0, heartRate: 180, breathingRate: 34 };
  const sprint = applyAction(runner, 'paceUp');
  assert.equal(sprint.pace, 4);
  assert.equal(step(sprint, 60).pace, 4);
});

test('capped controls expose their limits and do not consume cooldowns', () => {
  const runner = { ...startGame(initialGame()), heartRate: 200, breathingRate: 40, sweatLevel: 3, pace: 4 as const };
  for (const action of ['heartUp', 'breatheUp', 'sweat', 'paceUp'] as const) {
    assert.ok(controlLimit(runner, action));
    assert.equal(applyAction(runner, action), runner);
  }
  assert.equal(controlLimit({ ...runner, heartRate: 195 }, 'heartUp'), undefined);
  assert.equal(controlLimit({ ...runner, heartRate: 40 }, 'heartDown'), 'Minimum');
});

test('severe vitals stop the run and preserve all simultaneous causes before finish', () => {
  const runner = { ...startGame(initialGame()), glucose: 50, oxygen: 80, temperature: 41, distance: 39999, pace: 1 as const };
  const failed = step(runner, 1.2);
  assert.equal(failed.phase, 'collapsed');
  assert.equal(failed.failures.length, 3);
  assert.equal(step(failed, 100), failed);
});

test('large batches subdivide; a smaller step gives equivalent trajectories', () => {
  const runner = { ...startGame(initialGame()), pace: 2 as const, heartRate: 150, breathingRate: 28, sweatLevel: 1 };
  const a = step(runner, 600);
  const b = step(runner, 600, { ...DEFAULT_CONFIG, maxStep: .6 });
  for (const key of ['glucose', 'oxygen', 'temperature', 'sodium'] as const) {
    assert.ok(Math.abs(a[key] - b[key]) < .1, `${key} diverged`);
  }
  assert.equal(a.phase, b.phase);
  assert.ok(Math.abs(a.distance - b.distance) < 1e-6);
  assert.throws(() => step(runner, NaN));
  assert.throws(() => step(runner, -1));
});


test('weather follows simulation time with smooth changes; stationary clocks keep conditions fixed', () => {
  const ready = initialGame();
  assert.deepEqual(step(ready, 2000).weather, ready.weather);
  assert.equal(weatherAt(1800).temperature, weatherAt(1799).temperature);
  assert.ok(weatherAt(1860).humidity > weatherAt(1800).humidity);
  const running = { ...startGame(ready), time: 1799 };
  const stepped = step(running, 121);
  assert.deepEqual(stepped.weather, weatherAt(1920));
  assert.deepEqual(step(stepped, 0).weather, stepped.weather);
  assert.deepEqual(step({ ...stepped, phase: 'collapsed' }, 100).weather, stepped.weather);
  const staticConfig = { ...DEFAULT_CONFIG, weatherChanges: [] };
  assert.equal(weatherAt(9000, staticConfig).humidity, staticConfig.humidity);
});


test('bananas are finite, only successful eating consumes one, and restarting restocks', () => {
  let game = startGame(initialGame());
  const allowance = game.bananasRemaining;
  assert.equal(allowance, 3);
  for (let i = 0; i < allowance; i++) {
    const before = game;
    game = applyAction(game, 'banana');
    assert.equal(game.bananasRemaining, allowance - i - 1);
    assert.equal(game.gutCarbs, before.gutCarbs + 25);
    assert.equal(before.bananasRemaining, allowance - i);
    assert.equal(applyAction(game, 'banana'), game, 'cooldown does not consume another banana');
    if (i < allowance - 1) game = step(game, 45 * DEFAULT_CONFIG.classroomSpeed);
  }
  assert.equal(controlLimit(game, 'banana'), 'Out of bananas');
  game = step(game, 45 * DEFAULT_CONFIG.classroomSpeed);
  assert.equal(applyAction(game, 'banana'), game, 'empty inventory stays blocked after cooldown');
  assert.equal(initialGame().bananasRemaining, allowance);
});
