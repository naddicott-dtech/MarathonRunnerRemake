import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, startGame } from '../src/simulation.ts';
import { emptyProgress, advanceProgress, readProgress, writeProgress, PROGRESS_KEY } from '../src/progress.ts';

test('only active moving time qualifies; a successful final tick counts', () => {
  const previous = { ...startGame(initialGame()), pace: 1 as const };
  const next = { ...previous, classroomTime: .1 };
  assert.equal(advanceProgress(emptyProgress(), previous, next).activeSeconds, .1);
  assert.equal(advanceProgress(emptyProgress(), previous, { ...next, pace: 0 }).activeSeconds, 0);
  assert.equal(advanceProgress(emptyProgress(), previous, { ...next, oxygen: 85 }).activeSeconds, 0);
  assert.equal(advanceProgress(emptyProgress(), previous, previous).activeSeconds, 0);
  assert.equal(advanceProgress(emptyProgress(), initialGame(), next).activeSeconds, 0);
  assert.equal(advanceProgress(emptyProgress(), previous, { ...next, phase: 'finished' }).activeSeconds, .1);
});

test('ranges unlock at 900 active seconds, cumulatively across races', () => {
  const progress = { ...emptyProgress(), activeSeconds: 899.5 };
  const before = { ...startGame(initialGame()), pace: 1 as const };
  assert.equal(advanceProgress(progress, before, { ...before, classroomTime: .4 }).rangesEarned, false);
  const unlocked = advanceProgress(progress, before, { ...before, classroomTime: .5 });
  assert.equal(unlocked.rangesEarned, true);
  assert.equal(unlocked.activeSeconds, 900);
  assert.equal(advanceProgress(unlocked, initialGame(), initialGame()), unlocked);
});

test('a failure unlocks ranges once; terminal ticks and restarts preserve the unlock', () => {
  const before = startGame(initialGame());
  const failed = { ...before, phase: 'collapsed' as const };
  const unlocked = advanceProgress(emptyProgress(), before, failed);
  assert.equal(unlocked.rangesEarned, true);
  assert.equal(unlocked.failedRuns, 1);
  assert.equal(advanceProgress(unlocked, failed, failed), unlocked);
  assert.equal(advanceProgress(unlocked, initialGame(), initialGame()), unlocked);
});

test('saved progress survives reload; malformed or unavailable storage does not break play', () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } });
  try {
    const saved = { ...emptyProgress(), activeSeconds: 400, failedRuns: 1, rangesEarned: true };
    writeProgress(saved);
    assert.deepEqual(readProgress(), saved);
    for (const bad of ['not json', 'null', '{"version":0}', '{"version":1,"activeSeconds":-4,"failedRuns":0}', '{"version":1,"activeSeconds":"Infinity","failedRuns":0}']) {
      values.set(PROGRESS_KEY, bad);
      assert.deepEqual(readProgress(), emptyProgress());
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('blocked'); } } });
    assert.deepEqual(readProgress(), emptyProgress());
    assert.doesNotThrow(() => writeProgress(saved));
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
