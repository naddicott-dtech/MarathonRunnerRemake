import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, createPolicy } from '../src/headless.ts';
import type { ScenarioName } from '../src/headless.ts';
import { DEFAULT_CONFIG } from '../src/simulation.ts';

test('managed play finishes within the classroom target without excessive input', () => {
  const result = runSimulation({ scenario: 'balanced' });
  assert.equal(result.outcome, 'finished');
  assert.ok(result.classroomTime >= 480 && result.classroomTime <= 720);
  assert.ok(Object.values(result.acceptedActions).reduce((sum, n) => sum + n, 0) < 100);
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
  assert.deepEqual(normal.acceptedActions, fine.acceptedActions);
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
