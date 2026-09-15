import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, startGame, applyAction, step, DEFAULT_CONFIG } from '../src/simulation.ts';

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

test('poor circulation reduces delivery without pretending to reduce arterial saturation', () => {
  const initial = { ...startGame(initialGame()), pace: 2 as const, breathingRate: 30 };
  const weak = step(initial, 60);
  const supported = step({ ...initial, heartRate: 160 }, 60);
  assert.equal(weak.oxygen, supported.oxygen);
  assert.ok(weak.oxygenDelivery < supported.oxygenDelivery);
  assert.ok(weak.reserve < supported.reserve);
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

test('an exhausted sprint forces a slowdown and cannot be immediately resumed', () => {
  const runner = { ...startGame(initialGame()), pace: 4 as const, reserve: 10.01, heartRate: 180, breathingRate: 36 };
  const tired = step(runner, 1.2);
  assert.equal(tired.pace, 2);
  assert.equal(applyAction(tired, 'paceUp'), tired);
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
  for (const key of ['glucose', 'oxygen', 'temperature', 'sodium', 'reserve'] as const) {
    assert.ok(Math.abs(a[key] - b[key]) < .1, `${key} diverged`);
  }
  assert.equal(a.phase, b.phase);
  assert.ok(Math.abs(a.distance - b.distance) < 1e-6);
  assert.throws(() => step(runner, NaN));
  assert.throws(() => step(runner, -1));
});
