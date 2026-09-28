/**
 * Level definitions for LearnMLMath.
 *
 * Level shape:
 *   id, name, goal (markdown-ish text), hint, solution[], par,
 *   setup(engine), check(engine, meta) -> {ok, message}
 */

import { isStationary, linearMse, quadratic, rosenbrock } from '../engine/calculus.js';
import {
  det,
  dot,
  fmt,
  norm,
  scale,
  sub,
  unit,
} from '../engine/linalg.js';

/**
 * @typedef {object} LevelCheckMeta
 * @property {number} commandCount - Non-empty commands run since level start.
 * @property {string[]} history - Raw lines run since level start.
 */

/**
 * @typedef {object} Level
 * @property {string} id
 * @property {string} name
 * @property {string} goal
 * @property {string} hint
 * @property {string[]} solution
 * @property {number} par - Expected minimal command count (golf).
 * @property {(engine: import('../engine/engine.js').MathEngine) => void} setup
 * @property {(engine: import('../engine/engine.js').MathEngine, meta: LevelCheckMeta) => {ok: boolean, message: string}} check
 */

/**
 * Approximate scalar equality.
 *
 * @param {number} a - Left.
 * @param {number} b - Right.
 * @param {number} [tol=1e-6] - Tolerance.
 * @returns {boolean} True if |a-b| <= tol.
 */
function close(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

/**
 * Approximate vector equality.
 *
 * @param {number[]} a - Left.
 * @param {number[]} b - Right.
 * @param {number} [tol=1e-5] - Tolerance.
 * @returns {boolean} True if all entries match within tol.
 */
function vecClose(a, b, tol = 1e-5) {
  return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);
}

/** @type {Record<string, {displayName: string, about: string, levels: Level[]}>} */
export const sequences = {
  intro: {
    displayName: 'Vectors',
    about: 'Build vectors, measure them, and combine them the way ML pipelines do.',
    levels: [
      {
        id: 'intro-vec-1',
        name: 'Name that vector',
        goal:
          'Define the vector **a = [3, 4]**.\n\n' +
          'Command shape:\n`vec <name> <c1> <c2> ...`',
        hint: 'Try: vec a 3 4',
        solution: ['vec a 3 4'],
        par: 1,
        setup() {},
        check(engine) {
          if (!engine.has('a')) return { ok: false, message: 'object a is missing' };
          const a = engine.getAs('a', 'vector');
          if (!vecClose(a, [3, 4])) {
            return { ok: false, message: `a should be [3, 4], got ${JSON.stringify(a)}` };
          }
          return { ok: true, message: 'a is ready' };
        },
      },
      {
        id: 'intro-norm-2',
        name: 'Euclidean length',
        goal:
          'Create **a = [3, 4]** and store its Euclidean norm in **n**.\n\n' +
          '`norm <a> 2 <out>`',
        hint: 'norm a 2 n  → n should become 5',
        solution: ['vec a 3 4', 'norm a 2 n'],
        par: 2,
        setup() {},
        check(engine) {
          if (!engine.has('n')) return { ok: false, message: 'object n is missing' };
          const n = engine.getAs('n', 'scalar');
          if (!close(n, 5)) return { ok: false, message: `n should be 5, got ${n}` };
          return { ok: true, message: 'Pythagoras approved' };
        },
      },
      {
        id: 'intro-unit-3',
        name: 'Unit direction',
        goal:
          'From **a = [3, 4]**, store the unit vector in **u**.\n\n' +
          '`unit <a> [out]`',
        hint: 'unit a u  → u should have length 1 and point along a',
        solution: ['vec a 3 4', 'unit a u'],
        par: 2,
        setup() {},
        check(engine) {
          if (!engine.has('u')) return { ok: false, message: 'object u is missing' };
          const u = engine.getAs('u', 'vector');
          if (!close(norm(u, 2), 1)) {
            return { ok: false, message: `||u|| should be 1, got ${norm(u, 2)}` };
          }
          const expected = unit([3, 4]);
          if (!vecClose(u, expected)) {
            return { ok: false, message: 'u is unit length but not along [3, 4]' };
          }
          return { ok: true, message: 'direction preserved' };
        },
      },
      {
        id: 'intro-dot-4',
        name: 'Dot product',
        goal:
          'Create **a = [1, 2]** and **b = [3, 4]**, then store `a · b` in **d**.',
        hint: 'dot a b d  → d = 11',
        solution: ['vec a 1 2', 'vec b 3 4', 'dot a b d'],
        par: 3,
        setup() {},
        check(engine) {
          if (!engine.has('d')) return { ok: false, message: 'object d is missing' };
          const d = engine.getAs('d', 'scalar');
          if (!close(d, 11)) return { ok: false, message: `d should be 11, got ${d}` };
          return { ok: true, message: 'projection score: 11' };
        },
      },
      {
        id: 'intro-proj-5',
        name: 'Project a onto b',
        goal:
          'Store the projection of **a = [3, 1]** onto **b = [2, 0]** in **p**.\n\n' +
          'Geometrically: the shadow of a on the line of b.',
        hint: 'proj a b p',
        solution: ['vec a 3 1', 'vec b 2 0', 'proj a b p'],
        par: 3,
        setup() {},
        check(engine) {
          if (!engine.has('p')) return { ok: false, message: 'object p is missing' };
          const p = engine.getAs('p', 'vector');
          if (!vecClose(p, [3, 0])) {
            return { ok: false, message: `p should be [3, 0], got ${JSON.stringify(p)}` };
          }
          return { ok: true, message: 'shadow lands on x-axis' };
        },
      },
    ],
  },
  linalg: {
    displayName: 'Linear Algebra',
    about: 'Matrices as linear maps — multiply, transform, invert.',
    levels: [
      {
        id: 'la-matmul-1',
        name: 'Compose linear maps',
        goal:
          'Define **A = [[1, 2], [3, 4]]** and **B = [[1, 0], [0, 1]]**, then store **C = A·B**.\n\n' +
          '`mat <name> <rows> <cols> <values...>`\n`matmul <A> <B> [out]`',
        hint: 'Identity on the right changes nothing. C should equal A.',
        solution: [
          'mat A 2 2 1 2 3 4',
          'mat B 2 2 1 0 0 1',
          'matmul A B C',
        ],
        par: 3,
        setup() {},
        check(engine) {
          if (!engine.has('C')) return { ok: false, message: 'object C is missing' };
          const C = engine.getAs('C', 'matrix');
          const ok =
            close(C[0][0], 1) && close(C[0][1], 2) && close(C[1][0], 3) && close(C[1][1], 4);
          return ok
            ? { ok: true, message: 'C = A' }
            : { ok: false, message: `C should be [[1,2],[3,4]], got ${JSON.stringify(C)}` };
        },
      },
      {
        id: 'la-det-2',
        name: 'Determinant probe',
        goal: 'Compute `det` of **A = [[1, 2], [3, 4]]** and store it in **d**.',
        hint: 'det A d — signed area scale is -2.',
        solution: ['mat A 2 2 1 2 3 4', 'det A d'],
        par: 2,
        setup() {},
        check(engine) {
          if (!engine.has('d')) {
            return { ok: false, message: 'object d is missing (use: det A d)' };
          }
          const d = engine.getAs('d', 'scalar');
          return close(d, -2)
            ? { ok: true, message: 'signed area scale = -2' }
            : { ok: false, message: `d should be -2, got ${d}` };
        },
      },
      {
        id: 'la-inv-3',
        name: 'Invert a map',
        goal:
          'Invert **A = [[2, 0], [0, 4]]** into **Ainv**. Verify **A · Ainv ≈ I** conceptually — we only check the inverse.',
        hint: 'inv A Ainv',
        solution: ['mat A 2 2 2 0 0 4', 'inv A Ainv'],
        par: 2,
        setup() {},
        check(engine) {
          if (!engine.has('Ainv')) return { ok: false, message: 'object Ainv is missing' };
          const Ai = engine.getAs('Ainv', 'matrix');
          const ok =
            close(Ai[0][0], 0.5) && close(Ai[1][1], 0.25) && close(Ai[0][1], 0) && close(Ai[1][0], 0);
          return ok
            ? { ok: true, message: 'A⁻¹ is exact' }
            : { ok: false, message: `Ainv should be [[0.5,0],[0,0.25]], got ${JSON.stringify(Ai)}` };
        },
      },
      {
        id: 'la-transform-4',
        name: 'Apply a transform',
        goal:
          'Let **A = [[0, -1], [1, 0]]** (90° rotation) and **v = [1, 0]**.\n' +
          'Store **w = A v**. This should be a unit vector along +y.',
        hint: 'matvec A v w',
        solution: ['mat A 2 2 0 -1 1 0', 'vec v 1 0', 'matvec A v w'],
        par: 3,
        setup() {},
        check(engine) {
          if (!engine.has('w')) return { ok: false, message: 'object w is missing' };
          const w = engine.getAs('w', 'vector');
          return vecClose(w, [0, 1])
            ? { ok: true, message: 'rotated to [0, 1]' }
            : { ok: false, message: `w should be [0, 1], got ${JSON.stringify(w)}` };
        },
      },
    ],
  },
  calculus: {
    displayName: 'Calculus',
    about: 'Derivatives and gradients — the direction of steepest change.',
    levels: [
      {
        id: 'calc-grad-1',
        name: 'Read the gradient',
        goal:
          'Activate the quadratic field `field quad`, set `params 2 1`, then store the **gradient norm** in **g**.\n\n' +
          'f(x,y) = x² + y²  ⇒  ∇f = (2x, 2y). At (2,1): (4, 2), ||∇f|| = √20.',
        hint: 'field quad; params 2 1; then compute norm of the printed grad into g.',
        solution: [
          'field quad',
          'params 2 1',
          'grad',
          'scalar g 4.472135955',
        ],
        par: 4,
        setup() {},
        check(engine) {
          if (!engine.has('g')) return { ok: false, message: 'object g is missing' };
          const g = engine.getAs('g', 'scalar');
          const expected = Math.hypot(4, 2);
          return close(g, expected, 1e-3)
            ? { ok: true, message: `||∇f|| = ${fmt(expected)}` }
            : { ok: false, message: `g should be ~${fmt(expected)}, got ${g}` };
        },
      },
      {
        id: 'calc-stationary-2',
        name: 'Stationary point',
        goal:
          'Move parameters to a **stationary point** of the quadratic (where ∇f = 0).\n\n' +
          'Use `params` to place yourself at the minimum. Then confirm with `stationary`.',
        hint: 'The bowl bottoms out at the origin: params 0 0',
        solution: ['field quad', 'params 0 0', 'stationary'],
        par: 3,
        setup(engine) {
          engine.setActiveField('quad');
          engine.setParams([3, -2]);
        },
        check(engine) {
          const f = quadratic;
          const p = engine.params();
          if (!isStationary(f.grad, p, 1e-4)) {
            return { ok: false, message: `||∇f|| = ${fmt(norm(f.grad(p), 2))}, not ~0` };
          }
          return { ok: true, message: 'sitting in the bowl' };
        },
      },
    ],
  },
  optimization: {
    displayName: 'Optimization',
    about: 'Gradient descent — take repeated steps down the slope.',
    levels: [
      {
        id: 'opt-descent-1',
        name: 'One step down',
        goal:
          'On `field quad`, set `params 1 1`, then run a single `step 0.1`.\n' +
          'Store the resulting **loss** in **L**.\n\n' +
          'After one step params → (0.8, 0.8), loss = 1.28.',
        hint: 'step 0.1; loss; then scalar L 1.28 (or read the printed loss).',
        solution: ['field quad', 'params 1 1', 'step 0.1', 'loss', 'scalar L 1.28'],
        par: 5,
        setup() {},
        check(engine) {
          if (!engine.has('L')) return { ok: false, message: 'object L is missing' };
          const L = engine.getAs('L', 'scalar');
          return close(L, 1.28, 1e-6)
            ? { ok: true, message: 'loss after one step = 1.28' }
            : { ok: false, message: `L should be 1.28, got ${L}` };
        },
      },
      {
        id: 'opt-train-2',
        name: 'Train to zero',
        goal:
          'On `field quad`, start from `params 3 -4` and **train** until ||grad|| < 1e-3 (parameters near origin).\n\n' +
          '`train <steps> <lr>`',
        hint: 'train 80 0.1  is plenty for this bowl.',
        solution: ['field quad', 'params 3 -4', 'train 80 0.1'],
        par: 3,
        setup(engine) {
          engine.setActiveField('quad');
          engine.setParams([3, -4]);
        },
        check(engine) {
          const p = engine.params();
          const g = quadratic.grad(p);
          const gn = norm(g, 2);
          if (gn > 1e-3) {
            return { ok: false, message: `||∇f|| = ${fmt(gn)}, keep training` };
          }
          return { ok: true, message: 'converged on the quadratic bowl' };
        },
      },
      {
        id: 'opt-rosen-3',
        name: 'Rosenbrock valley',
        goal:
          'Activate `field rosen` and land near the minimum **(1, 1)**.\n' +
          'Success when both |x-1| and |y-1| are < 0.05.\n\n' +
          'Watch the banana-shaped valley. Plain GD crawls here — start inside the valley and use a tiny lr.',
        hint: 'params 0.9 0.8 then train 3000 0.002 works. Large lr diverges along the valley.',
        solution: [
          'field rosen',
          'params 0.9 0.8',
          'train 3000 0.002',
        ],
        par: 3,
        setup() {},
        check(engine) {
          const p = engine.params();
          if (Math.abs(p[0] - 1) > 0.05 || Math.abs(p[1] - 1) > 0.05) {
            return {
              ok: false,
              message: `params = ${JSON.stringify(p)}, need within 0.05 of (1, 1)`,
            };
          }
          return { ok: true, message: 'found the banana minimum' };
        },
      },
      {
        id: 'opt-mse-4',
        name: 'Fit a line',
        goal:
          'Activate `field mse` (linear regression MSE on fixed data).\n' +
          'Train **[w, b]** until **loss < 0.05**.',
        hint: 'field mse; params 0 0; train 100 0.1 — inspect loss.',
        solution: ['field mse', 'params 0 0', 'train 80 0.15'],
        par: 3,
        setup() {},
        check(engine) {
          const L = linearMse.f(engine.params());
          if (L >= 0.05) {
            return { ok: false, message: `loss = ${fmt(L)}, need < 0.05` };
          }
          return { ok: true, message: `line fitted, loss = ${fmt(L)}` };
        },
      },
    ],
  },
  mixed: {
    displayName: 'Mixed Drill',
    about: 'Combine vector geometry and optimization in short puzzles.',
    levels: [
      {
        id: 'mixed-1',
        name: 'Residual to unit',
        goal:
          'You are given **a** and **b**. Store the **unit residual** (a − b, normalized) in **r**.',
        hint: 'sub a b tmp; unit tmp r',
        solution: ['sub a b tmp', 'unit tmp r'],
        par: 2,
        setup(engine) {
          engine.set('a', 'vector', [5, 5]);
          engine.set('b', 'vector', [2, 1]);
        },
        check(engine) {
          if (!engine.has('r')) return { ok: false, message: 'object r is missing' };
          const r = engine.getAs('r', 'vector');
          const expected = unit(sub([5, 5], [2, 1]));
          return vecClose(r, expected)
            ? { ok: true, message: 'residual direction locked' }
            : { ok: false, message: `r should be ${JSON.stringify(expected)}` };
        },
      },
      {
        id: 'mixed-2',
        name: 'Negative determinant flip',
        goal:
          'Find a **2×2** matrix **M** you store yourself with **det(M) = -1** (a reflection).\n' +
          'Store det in **d** as well.',
        hint: 'e.g. [[1,0],[0,-1]] then det M d',
        solution: ['mat M 2 2 1 0 0 -1', 'det M d'],
        par: 2,
        setup() {},
        check(engine) {
          if (!engine.has('M') || !engine.has('d')) {
            return { ok: false, message: 'need both M and d' };
          }
          const M = engine.getAs('M', 'matrix');
          const d = engine.getAs('d', 'scalar');
          const actual = det(M);
          if (!close(d, -1) || !close(actual, -1)) {
            return { ok: false, message: `need det(M) = -1 (computed ${actual}, stored ${d})` };
          }
          return { ok: true, message: 'orientation reversed' };
        },
      },
      {
        id: 'mixed-3',
        name: 'Quadratic in one move',
        goal:
          'On `field quad`, reach **loss < 0.01** using **at most 2** non-empty commands after setup.\n' +
          'Setup already activates the field at (1, 1).',
        hint: 'train 30 0.1 is one command.',
        solution: ['train 30 0.1'],
        par: 1,
        setup(engine) {
          engine.setActiveField('quad');
          engine.setParams([1, 1]);
        },
        check(engine, meta) {
          const L = quadratic.f(engine.params());
          if (L >= 0.01) {
            return { ok: false, message: `loss = ${fmt(L)}, need < 0.01` };
          }
          if (meta.commandCount > 2) {
            return {
              ok: false,
              message: `golf failed: ${meta.commandCount} commands used (par 2 including any noise)`,
            };
          }
          return { ok: true, message: `clean run: loss = ${fmt(L)}` };
        },
      },
    ],
  },
};

/** Flat list of all levels in curriculum order. */
export function allLevels() {
  return Object.values(sequences).flatMap((s) => s.levels);
}

/**
 * Look up a level by id.
 *
 * @param {string} id - Level id.
 * @returns {Level | undefined} Level or undefined.
 */
export function findLevel(id) {
  return allLevels().find((l) => l.id === id);
}

/**
 * Next level id in curriculum order.
 *
 * @param {string} id - Current level id.
 * @returns {string | null} Next id or null at end.
 */
export function nextLevelId(id) {
  const list = allLevels();
  const i = list.findIndex((l) => l.id === id);
  if (i < 0 || i === list.length - 1) return null;
  return list[i + 1].id;
}
