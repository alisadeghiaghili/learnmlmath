/**
 * Unit tests for linear algebra primitives.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  add,
  cross,
  det,
  dot,
  fmt,
  identity,
  inv,
  matmul,
  matVec,
  matrixFromFlat,
  norm,
  outer,
  proj,
  scale,
  sub,
  trace,
  transpose,
  unit,
} from '../src/engine/linalg.js';

test('vector arithmetic', () => {
  assert.deepEqual(add([1, 2], [3, 4]), [4, 6]);
  assert.deepEqual(sub([3, 4], [1, 2]), [2, 2]);
  assert.deepEqual(scale(2, [1, -1]), [2, -2]);
  assert.equal(dot([1, 2], [3, 4]), 11);
});

test('norms and unit', () => {
  assert.equal(norm([3, 4], 2), 5);
  assert.equal(norm([3, -4], 1), 7);
  assert.equal(norm([3, -4], Infinity), 4);
  const u = unit([3, 4]);
  assert.ok(Math.abs(norm(u, 2) - 1) < 1e-12);
  assert.ok(Math.abs(u[0] - 0.6) < 1e-12);
  assert.ok(Math.abs(u[1] - 0.8) < 1e-12);
  assert.throws(() => unit([0, 0]));
});

test('projection and cross', () => {
  assert.deepEqual(proj([2, 1], [1, 0]), [2, 0]);
  const c = cross([1, 0, 0], [0, 1, 0]);
  assert.deepEqual(c, [0, 0, 1]);
});

test('matrix ops', () => {
  const A = matrixFromFlat(2, 2, [1, 2, 3, 4]);
  assert.deepEqual(transpose(A), [[1, 3], [2, 4]]);
  assert.equal(det(A), -2);
  assert.equal(trace(A), 5);
  const B = matrixFromFlat(2, 1, [1, 1]);
  assert.deepEqual(matmul(A, B), [[3], [7]]);
  assert.deepEqual(matVec(A, [1, 1]), [3, 7]);
  assert.deepEqual(identity(2), [[1, 0], [0, 1]]);
  assert.deepEqual(outer([1, 2], [3, 4]), [[3, 4], [6, 8]]);
});

test('inverse round-trip', () => {
  const A = matrixFromFlat(2, 2, [2, 0, 0, 4]);
  const Ai = inv(A);
  assert.deepEqual(Ai, [[0.5, 0], [0, 0.25]]);
  const I = matmul(A, Ai);
  assert.ok(Math.abs(I[0][0] - 1) < 1e-12);
  assert.ok(Math.abs(I[1][1] - 1) < 1e-12);
  assert.ok(Math.abs(I[0][1]) < 1e-12);
  assert.throws(() => inv([[1, 2], [2, 4]]));
});

test('fmt trims float noise', () => {
  assert.equal(fmt(0.30000000000000004), '0.3');
  assert.equal(fmt(3), '3');
});
