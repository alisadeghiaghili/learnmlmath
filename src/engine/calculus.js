/**
 * Scalar / multivariate calculus helpers used by ML optimization demos.
 *
 * Function representation is a plain object:
 *   { id, label, dim, f(x: number[]): number, grad(x: number[]): number[] }
 */

import { assertNumber, assertVector, norm, sub } from './linalg.js';

/**
 * Create a scalar field with an analytic gradient.
 *
 * @param {object} spec - Field specification.
 * @param {string} spec.id - Stable machine id.
 * @param {string} spec.label - Human label for UI.
 * @param {number} spec.dim - Input dimension.
 * @param {(x: number[]) => number} spec.f - Objective value.
 * @param {(x: number[]) => number[]} spec.grad - Analytic gradient.
 * @returns {{id: string, label: string, dim: number, f: (x: number[]) => number, grad: (x: number[]) => number[]}}
 */
export function makeField({ id, label, dim, f, grad }) {
  return {
    id,
    label,
    dim,
    f(x) {
      assertVector(x, 'x');
      if (x.length !== dim) {
        throw new TypeError(`${id}: expected input dim ${dim}, got ${x.length}`);
      }
      return assertNumber(f(x), `${id}.f`);
    },
    grad(x) {
      assertVector(x, 'x');
      if (x.length !== dim) {
        throw new TypeError(`${id}: expected input dim ${dim}, got ${x.length}`);
      }
      const g = grad(x);
      assertVector(g, `${id}.grad`);
      if (g.length !== dim) {
        throw new TypeError(`${id}.grad: expected dim ${dim}, got ${g.length}`);
      }
      return g;
    },
  };
}

/** f(x, y) = x² + y². Minimum at (0, 0). */
export const quadratic = makeField({
  id: 'quad',
  label: 'f(x,y) = x² + y²',
  dim: 2,
  f: ([x, y]) => x * x + y * y,
  grad: ([x, y]) => [2 * x, 2 * y],
});

/** f(x, y) = (1-x)² + 100(y-x²)². Minimum at (1, 1). */
export const rosenbrock = makeField({
  id: 'rosen',
  label: 'Rosenbrock',
  dim: 2,
  f: ([x, y]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
  grad: ([x, y]) => {
    const t = y - x * x;
    return [-2 * (1 - x) - 400 * x * t, 200 * t];
  },
});

/**
 * Linear regression MSE with one feature and bias folded into params [w, b].
 * Training set is fixed for the lesson.
 */
const LIN_X = [-2, -1, 0, 1, 2];
const LIN_Y = [-2.2, -0.9, 0.1, 1.1, 2.3];

export const linearMse = makeField({
  id: 'mse',
  label: 'MSE(w, b) for linear fit',
  dim: 2,
  f: ([w, b]) => {
    let s = 0;
    for (let i = 0; i < LIN_X.length; i += 1) {
      const e = w * LIN_X[i] + b - LIN_Y[i];
      s += e * e;
    }
    return s / LIN_X.length;
  },
  grad: ([w, b]) => {
    let gw = 0;
    let gb = 0;
    const n = LIN_X.length;
    for (let i = 0; i < n; i += 1) {
      const e = w * LIN_X[i] + b - LIN_Y[i];
      gw += e * LIN_X[i];
      gb += e;
    }
    return [(2 / n) * gw, (2 / n) * gb];
  },
});

/** Fixed dataset used by linearMse (exported for visualization). */
export const linearData = {
  x: LIN_X.slice(),
  y: LIN_Y.slice(),
};

/** Registry of built-in fields. */
export const fields = {
  [quadratic.id]: quadratic,
  [rosenbrock.id]: rosenbrock,
  [linearMse.id]: linearMse,
};

/**
 * One gradient-descent step. Returns the new parameter vector.
 *
 * @param {(x: number[]) => number[]} gradFn - Gradient of the objective.
 * @param {number[]} x - Current parameters.
 * @param {number} lr - Learning rate (lr > 0).
 * @returns {number[]} x - lr * grad(x).
 * @throws {TypeError} On invalid input.
 * @example
 * gdStep(quad.grad, [1, 1], 0.1); // => [0.8, 0.8]
 */
export function gdStep(gradFn, x, lr) {
  assertVector(x, 'x');
  assertNumber(lr, 'lr');
  if (lr <= 0) throw new TypeError('gdStep: lr must be > 0');
  const g = gradFn(x);
  assertVector(g, 'grad');
  return sub(x, g.map((gi) => lr * gi));
}

/**
 * Run k gradient-descent steps and record the path.
 *
 * @param {(x: number[]) => number[]} gradFn - Gradient of the objective.
 * @param {number[]} x0 - Initial parameters.
 * @param {number} lr - Learning rate.
 * @param {number} steps - Number of steps (integer >= 1).
 * @returns {{path: number[][], final: number[], steps: number}} Path including x0.
 * @throws {TypeError} On invalid input.
 */
export function gdRun(gradFn, x0, lr, steps) {
  assertVector(x0, 'x0');
  assertNumber(lr, 'lr');
  if (!Number.isInteger(steps) || steps < 1) {
    throw new TypeError('gdRun: steps must be an integer >= 1');
  }
  const path = [x0.slice()];
  let x = x0.slice();
  for (let i = 0; i < steps; i += 1) {
    x = gdStep(gradFn, x, lr);
    path.push(x.slice());
  }
  return { path, final: x, steps };
}

/**
 * Central finite-difference gradient (for sandbox experiments).
 *
 * @param {(x: number[]) => number} f - Scalar field.
 * @param {number[]} x - Evaluation point.
 * @param {number} [h=1e-5] - Step size.
 * @returns {number[]} Numerical gradient.
 * @throws {TypeError} On invalid input.
 */
export function numericalGrad(f, x, h = 1e-5) {
  assertVector(x, 'x');
  assertNumber(h, 'h');
  const g = Array(x.length).fill(0);
  for (let i = 0; i < x.length; i += 1) {
    const xp = x.slice();
    const xm = x.slice();
    xp[i] += h;
    xm[i] -= h;
    g[i] = (f(xp) - f(xm)) / (2 * h);
  }
  return g;
}

/**
 * Check that a point is (approximately) a stationary point of f.
 *
 * @param {(x: number[]) => number[]} gradFn - Gradient.
 * @param {number[]} x - Point.
 * @param {number} [tol=1e-4] - Gradient norm tolerance.
 * @returns {boolean} True if ||grad(x)|| <= tol.
 */
export function isStationary(gradFn, x, tol = 1e-4) {
  return norm(gradFn(x), 2) <= tol;
}
