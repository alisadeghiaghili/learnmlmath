/**
 * Unit tests for calculus helpers and command execution.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gdStep,
  isStationary,
  linearMse,
  numericalGrad,
  quadratic,
  rosenbrock,
} from '../src/engine/calculus.js';
import { createEngine } from '../src/engine/engine.js';
import { execute, tokenize } from '../src/engine/commands.js';

test('analytic gradients match finite differences', () => {
  for (const field of [quadratic, rosenbrock, linearMse]) {
    const x = field.dim === 2 ? [0.3, -0.7] : [0.1];
    const g = field.grad(x);
    const n = numericalGrad((p) => field.f(p), x);
    assert.equal(g.length, n.length);
    for (let i = 0; i < g.length; i += 1) {
      assert.ok(
        Math.abs(g[i] - n[i]) < 1e-4,
        `${field.id} grad[${i}]: analytic ${g[i]} vs numeric ${n[i]}`,
      );
    }
  }
});

test('gdStep decreases quadratic loss', () => {
  const x0 = [1.5, -2];
  const x1 = gdStep(quadratic.grad, x0, 0.1);
  assert.ok(quadratic.f(x1) < quadratic.f(x0));
  assert.ok(isStationary(quadratic.grad, [0, 0]));
});

test('tokenize handles quotes and comments', () => {
  assert.deepEqual(tokenize('vec a 1 2'), ['vec', 'a', '1', '2']);
  assert.deepEqual(tokenize('  scalar  s  2.5  '), ['scalar', 's', '2.5']);
  assert.throws(() => tokenize('echo "unclosed'));
});

test('execute define and ops', () => {
  const engine = createEngine();
  let r = execute(engine, 'vec a 3 4');
  assert.equal(r.ok, true);
  r = execute(engine, 'vec b 1 0');
  assert.equal(r.ok, true);
  r = execute(engine, 'dot a b c');
  assert.equal(r.ok, true);
  assert.equal(engine.getAs('c', 'scalar'), 3);
  r = execute(engine, 'unit a u');
  assert.equal(r.ok, true);
  const u = engine.getAs('u', 'vector');
  assert.ok(Math.abs(Math.hypot(...u) - 1) < 1e-12);
  r = execute(engine, 'norm a 2 n');
  assert.equal(r.ok, true);
  assert.equal(engine.getAs('n', 'scalar'), 5);
});

test('execute matrix ops', () => {
  const engine = createEngine();
  execute(engine, 'mat A 2 2 1 2 3 4');
  execute(engine, 'eye I 2');
  let r = execute(engine, 'det A');
  assert.equal(r.ok, true);
  assert.match(r.lines[0], /-2/);
  r = execute(engine, 'matmul A I C');
  assert.equal(r.ok, true);
  assert.deepEqual(engine.getAs('C', 'matrix'), [[1, 2], [3, 4]]);
});

test('execute optimization flow', () => {
  const engine = createEngine();
  assert.equal(execute(engine, 'field quad').ok, true);
  assert.equal(execute(engine, 'params 1 1').ok, true);
  // x <- x(1 - 2*lr) per step on f=x²+y²; 40 steps at lr=0.1 → 0.8^40 ≈ 1e-4
  assert.equal(execute(engine, 'train 40 0.1').ok, true);
  const p = engine.params();
  assert.ok(Math.abs(p[0]) < 1e-3, `p0=${p[0]}`);
  assert.ok(Math.abs(p[1]) < 1e-3, `p1=${p[1]}`);
  assert.equal(execute(engine, 'loss').ok, true);
  assert.equal(execute(engine, 'grad').ok, true);
});

test('undo restores previous objects', () => {
  const engine = createEngine();
  execute(engine, 'vec a 1 2');
  execute(engine, 'vec a 9 9');
  assert.deepEqual(engine.getAs('a', 'vector'), [9, 9]);
  execute(engine, 'undo');
  assert.deepEqual(engine.getAs('a', 'vector'), [1, 2]);
});

test('unknown command errors cleanly', () => {
  const engine = createEngine();
  const r = execute(engine, 'frobnicate');
  assert.equal(r.ok, false);
  assert.match(r.lines[0], /unknown command/);
});
