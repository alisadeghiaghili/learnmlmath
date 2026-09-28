/**
 * Level schema and solver tests — every level must be solvable via its solution.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine/engine.js';
import { execute } from '../src/engine/commands.js';
import { allLevels, findLevel, nextLevelId, sequences } from '../src/levels/index.js';

/**
 * Run a solution script against a fresh engine prepared by level.setup.
 *
 * @param {import('../src/levels/index.js').Level} level - Level under test.
 * @returns {{engine: ReturnType<typeof createEngine>, commandCount: number, ok: boolean, message: string}}
 */
function solve(level) {
  const engine = createEngine();
  level.setup(engine);
  let commandCount = 0;
  for (const line of level.solution) {
    const r = execute(engine, line);
    if (r.ok && line.trim() && !line.trim().startsWith('#')) commandCount += 1;
    if (!r.ok) {
      return { engine, commandCount, ok: false, message: `solution failed: ${line}: ${r.lines[0]}` };
    }
  }
  const check = level.check(engine, { commandCount, history: level.solution });
  return { engine, commandCount, ok: check.ok, message: check.message };
}

test('sequences expose levels with required fields', () => {
  assert.ok(Object.keys(sequences).length >= 4);
  for (const [key, seq] of Object.entries(sequences)) {
    assert.ok(seq.displayName.length > 0, key);
    assert.ok(seq.levels.length > 0, key);
    for (const level of seq.levels) {
      assert.equal(typeof level.id, 'string');
      assert.equal(typeof level.name, 'string');
      assert.ok(level.goal.length > 10);
      assert.ok(Array.isArray(level.solution));
      assert.ok(level.solution.length >= 1);
      assert.equal(typeof level.setup, 'function');
      assert.equal(typeof level.check, 'function');
    }
  }
});

test('every level solution actually solves it', () => {
  for (const level of allLevels()) {
    const result = solve(level);
    assert.equal(result.ok, true, `${level.id}: ${result.message}`);
  }
});

test('failed checks stay failed', () => {
  const level = findLevel('intro-vec-1');
  const engine = createEngine();
  level.setup(engine);
  execute(engine, 'vec a 0 0');
  const check = level.check(engine, { commandCount: 1, history: [] });
  assert.equal(check.ok, false);
});

test('nextLevelId walks the curriculum', () => {
  const list = allLevels();
  assert.equal(nextLevelId(list[0].id), list[1].id);
  assert.equal(nextLevelId(list[list.length - 1].id), null);
});

test('golf level enforces command budget', () => {
  const level = findLevel('mixed-3');
  const engine = createEngine();
  level.setup(engine);
  execute(engine, 'train 30 0.1');
  let check = level.check(engine, { commandCount: 1, history: ['train 30 0.1'] });
  assert.equal(check.ok, true, check.message);

  const engine2 = createEngine();
  level.setup(engine2);
  execute(engine2, 'train 5 0.1');
  execute(engine2, 'train 5 0.1');
  execute(engine2, 'train 5 0.1');
  check = level.check(engine2, { commandCount: 3, history: [] });
  assert.equal(check.ok, false);
  assert.match(check.message, /golf/);
});
