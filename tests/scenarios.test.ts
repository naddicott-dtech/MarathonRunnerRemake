import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, createPolicy } from '../src/headless.ts';
import type { ScenarioName } from '../src/headless.ts';
import { DEFAULT_CONFIG } from '../src/simulation.ts';

test('managed play finishes within the classroom target without excessive input', () => {
  const result = runSimulation({ scenario: 'balanced' });
  assert.equal(result.outcome, 'finished');
  assert.ok(result.classroomTime >= 480 && result.classroomTime <= 840);
  assert.ok(Object.values(result.acceptedActions).reduce((sum, n) => sum + n, 0) < 120);
});

test('neglect scenarios reach the intended failure, not an unrelated earlier failure', () => {
  const cases: [ScenarioName, RegExp][] = [
    ['neglect-breathing', /Low blood oxygen/],
    ['neglect-cooling', /Heat emergency/],
    ['no-food', /Hypoglycemia/],
    ['no-drink', /Heat emergency|dehydration/],
  ];
  for (const [scenario, cause] of cases) {
    const result = runSimulation({ scenario });
    assert.equal(result.outcome, 'collapsed', scenario);
    assert.match(result.cause, cause, scenario);
    assert.ok(result.distance < DEFAULT_CONFIG.finishDistance, scenario);
  }
});

test('overdrinking either drink can cause dilution, with later failure for sports drink', () => {
  const water = runSimulation({ scenario: 'overdrink-water' });
  const sports = runSimulation({ scenario: 'overdrink-electrolyte' });
  for (const result of [water, sports]) {
    assert.equal(result.outcome, 'collapsed');
    assert.match(result.cause, /Hyponatremia/);
    assert.ok(result.extrema.hydration.max > 0);
    assert.ok(result.warnings.sodium! < result.time - 60);
  }
  assert.ok(sports.time > water.time);
});

test('a delayed food correction remains recoverable', () => {
  const managed = createPolicy('balanced');
  const result = runSimulation({ policy: (game, context) => {
    const action = managed(game, context);
    return game.classroomTime < 140 && (action === 'banana' || action === 'glucagon') ? undefined : action;
  } });
  assert.equal(result.outcome, 'finished');
  assert.ok(result.extrema.glucose.min < 80);
});

test('headless dt does not change decision timing or outcomes; time cap is respected', () => {
  const normal = runSimulation({ scenario: 'balanced', dt: 1.2 });
  const fine = runSimulation({ scenario: 'balanced', dt: .6 });
  assert.equal(normal.outcome, fine.outcome);
  assert.ok(Math.abs(normal.classroomTime - fine.classroomTime) < 1);
  // Threshold crossings may shift one corrective drink without changing the trajectory.
  const actions = (result: typeof normal) => Object.values(result.acceptedActions).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(actions(normal) - actions(fine)) <= 2);
  for (const vital of ['glucose', 'oxygen', 'temperature', 'sodium'] as const) {
    assert.ok(Math.abs(normal.extrema[vital].min - fine.extrema[vital].min) < .5);
    assert.ok(Math.abs(normal.extrema[vital].max - fine.extrema[vital].max) < .5);
  }
  const capped = runSimulation({ dt: 7, maxClassroomSeconds: 2.5 });
  assert.ok(capped.classroomTime <= 2.5 + 1e-9);
  const slowerClock = runSimulation({ config: { ...DEFAULT_CONFIG, classroomSpeed: 6 }, maxClassroomSeconds: 2.5 });
  assert.ok(Math.abs(slowerClock.time - 15) < 1e-7);
});

test('scripted schedules do not invoke an unrequested bot or stall behind capped actions', () => {
  const result = runSimulation({ maxClassroomSeconds: 10, schedule: [
    { at: 0, action: 'paceDown' }, // already resting: consume the no-op
    { at: 12, action: 'water' },
    { at: 24, action: 'water' }, // retry after cooldown
    { at: 84, action: 'paceUp' },
  ] });
  assert.deepEqual(result.acceptedActions, { water: 2, paceUp: 1 });
  assert.throws(() => runSimulation({ dt: NaN }));
});


test('maximum controls spend fuel faster than matching effort without causing high-saturation failure', () => {
  const max = runSimulation({ scenario: 'max-controls' });
  const matched = runSimulation({ scenario: 'no-food' });
  assert.equal(max.outcome, 'collapsed');
  assert.match(max.cause, /Hypoglycemia/);
  assert.ok(max.classroomTime < matched.classroomTime);
  assert.ok(max.extrema.oxygen.min >= 95);
});


test('weather demands adaptation even when fixed controls still replace food and fluid', () => {
  const fixed = runSimulation({ scenario: 'fixed-controls' });
  const constantWeather = runSimulation({ scenario: 'fixed-controls', config: { ...DEFAULT_CONFIG, weatherChanges: [] } });
  const attentive = runSimulation({ scenario: 'balanced', trace: true });
  assert.equal(constantWeather.outcome, 'finished');
  assert.equal(fixed.outcome, 'collapsed');
  assert.match(fixed.cause, /Heat emergency/);
  assert.ok(fixed.time - fixed.warnings.temperature! > 120, 'at least ten classroom seconds to react');
  assert.equal(attentive.outcome, 'finished');
  assert.ok(attentive.trace!.some(sample => sample.time > 1800 && sample.action === 'paceDown'));
  assert.ok(attentive.trace!.some(sample => sample.time > 5400 && sample.action === 'sweatDown'));
  const abandoned = runSimulation({ scenario: 'set-and-forget' });
  assert.equal(abandoned.outcome, 'collapsed');
});


test('finite bananas prevent the fed maximum-controls strategy from coasting to a win', () => {
  const limited = runSimulation({ scenario: 'max-controls-fed' });
  const stocked = runSimulation({ scenario: 'max-controls-fed', config: { ...DEFAULT_CONFIG, bananaAllowance: 100 } });
  assert.equal(stocked.outcome, 'finished');
  assert.ok(stocked.acceptedActions.banana > DEFAULT_CONFIG.bananaAllowance);
  assert.equal(limited.acceptedActions.banana, DEFAULT_CONFIG.bananaAllowance);
  assert.equal(limited.outcome, 'collapsed');
  assert.match(limited.cause, /Hypoglycemia/);
  const balanced = runSimulation({ scenario: 'balanced' });
  assert.equal(balanced.outcome, 'finished');
  assert.ok(balanced.acceptedActions.banana < DEFAULT_CONFIG.bananaAllowance);
});
