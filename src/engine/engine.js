/**
 * MathEngine: named object store with undo/reset history.
 *
 * Objects are typed values living in a workspace:
 *   vector  -> number[]
 *   matrix  -> number[][]
 *   scalar  -> number
 *   field   -> calculus field handle (id + functions)
 *
 * History records snapshots so undo/reset are exact.
 */

import {
  assertNumber,
  assertMatrix,
  assertVector,
  fmtMatrix,
  fmtVector,
  fmt,
} from './linalg.js';
import { fields as builtinFields } from './calculus.js';

/**
 * Deep-clone plain JSON-like values used as objects.
 *
 * @param {unknown} value - Value to clone.
 * @returns {unknown} Deep copy.
 */
function cloneValue(value) {
  return structuredClone(value);
}

/**
 * Create an empty engine bound to optional built-in fields.
 *
 * @returns {MathEngine} Fresh engine instance.
 */
export function createEngine() {
  /** @type {Map<string, {type: string, value: any}>} */
  const objects = new Map();
  /** @type {Array<Map<string, {type: string, value: any}>>} */
  const history = [];
  /** @type {string | null} */
  let activeFieldId = null;
  /** @type {number[]} */
  let params = [0, 0];
  /** @type {number[][]} */
  let gdPath = [];

  /**
   * Snapshot current objects map into history.
   *
   * @returns {void}
   */
  function pushHistory() {
    const snap = new Map();
    for (const [k, v] of objects) {
      snap.set(k, { type: v.type, value: cloneValue(v.value) });
    }
    history.push(snap);
    if (history.length > 200) history.shift();
  }

  /**
   * Restore a snapshot.
   *
   * @param {Map<string, {type: string, value: any}>} snap - Snapshot to restore.
   * @returns {void}
   */
  function restore(snap) {
    objects.clear();
    for (const [k, v] of snap) {
      objects.set(k, { type: v.type, value: cloneValue(v.value) });
    }
  }

  const engine = {
    /**
     * Number of undo snapshots available.
     *
     * @returns {number} History depth.
     */
    historyDepth() {
      return history.length;
    },

    /**
     * Whether a named object exists.
     *
     * @param {string} name - Object name.
     * @returns {boolean} True if present.
     */
    has(name) {
      return objects.has(name);
    },

    /**
     * List object names sorted for display.
     *
     * @returns {string[]} Sorted names.
     */
    names() {
      return [...objects.keys()].sort();
    },

    /**
     * Get object metadata.
     *
     * @param {string} name - Object name.
     * @returns {{type: string, value: any}} Object record.
     * @throws {Error} If name is missing.
     */
    get(name) {
      const rec = objects.get(name);
      if (!rec) throw new Error(`unknown object '${name}'`);
      return { type: rec.type, value: cloneValue(rec.value) };
    },

    /**
     * Get typed value or throw a precise error.
     *
     * @param {string} name - Object name.
     * @param {string} expectedType - Required type.
     * @returns {any} Cloned value.
     * @throws {Error} If missing or wrong type.
     */
    getAs(name, expectedType) {
      const rec = objects.get(name);
      if (!rec) throw new Error(`unknown object '${name}'`);
      if (rec.type !== expectedType) {
        throw new Error(`'${name}' is ${rec.type}, expected ${expectedType}`);
      }
      return cloneValue(rec.value);
    },

    /**
     * Store a named object (creates history entry).
     *
     * @param {string} name - Object name (identifier-like).
     * @param {string} type - One of vector|matrix|scalar|field.
     * @param {any} value - Value matching type.
     * @returns {void}
     * @throws {TypeError|Error} On invalid name/type/value.
     */
    set(name, type, value) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`invalid name '${name}'`);
      }
      if (!['vector', 'matrix', 'scalar', 'field'].includes(type)) {
        throw new TypeError(`invalid type '${type}'`);
      }
      if (type === 'vector') assertVector(value, name);
      if (type === 'matrix') assertMatrix(value, name);
      if (type === 'scalar') assertNumber(value, name);
      if (type === 'field') {
        if (!value || typeof value.id !== 'string') {
          throw new TypeError('field value must be a field handle');
        }
      }
      pushHistory();
      objects.set(name, { type, value: cloneValue(value) });
    },

    /**
     * Delete a named object.
     *
     * @param {string} name - Object name.
     * @returns {void}
     * @throws {Error} If missing.
     */
    delete(name) {
      if (!objects.has(name)) throw new Error(`unknown object '${name}'`);
      pushHistory();
      objects.delete(name);
    },

    /**
     * Undo last mutation.
     *
     * @returns {boolean} True if an undo occurred.
     */
    undo() {
      if (history.length === 0) return false;
      restore(history.pop());
      return true;
    },

    /**
     * Clear objects and restore initial optional seed.
     *
     * @returns {void}
     */
    clear() {
      pushHistory();
      objects.clear();
      activeFieldId = null;
      params = [0, 0];
      gdPath = [];
    },

    /**
     * Active scalar field id or null.
     *
     * @returns {string | null} Field id.
     */
    activeFieldId() {
      return activeFieldId;
    },

    /**
     * Set active field by id (quad | rosen | mse) or a stored field object.
     *
     * @param {string} fieldId - Built-in field id.
     * @returns {{id: string, label: string, dim: number}} Field summary.
     * @throws {Error} If field id is unknown.
     */
    setActiveField(fieldId) {
      const f = builtinFields[fieldId];
      if (!f) throw new Error(`unknown field '${fieldId}'`);
      pushHistory();
      activeFieldId = fieldId;
      params = Array(f.dim).fill(0);
      gdPath = [params.slice()];
      return { id: f.id, label: f.label, dim: f.dim };
    },

    /**
     * Get the active field handle.
     *
     * @returns {object} Field with f/grad.
     * @throws {Error} If no field is active.
     */
    activeField() {
      if (!activeFieldId) {
        throw new Error('no active field — run `field quad` or `field rosen` or `field mse`');
      }
      return builtinFields[activeFieldId];
    },

    /**
     * Current parameter vector for the active field.
     *
     * @returns {number[]} Copy of params.
     */
    params() {
      return params.slice();
    },

    /**
     * Overwrite current parameters (records history).
     *
     * @param {number[]} next - New parameters.
     * @returns {void}
     */
    setParams(next) {
      assertVector(next, 'params');
      const f = engine.activeField();
      if (next.length !== f.dim) {
        throw new TypeError(`params must have length ${f.dim}`);
      }
      pushHistory();
      params = next.slice();
    },

    /**
     * Gradient-descent path recorded in this session (including current params).
     *
     * @returns {number[][]} Path points.
     */
    gdPath() {
      return gdPath.map((p) => p.slice());
    },

    /**
     * Replace the GD path (e.g. after train).
     *
     * @param {number[][]} path - Path points.
     * @returns {void}
     */
    setGdPath(path) {
      gdPath = path.map((p) => p.slice());
    },

    /**
     * Evaluate active field at current params.
     *
     * @returns {number} f(params).
     */
    loss() {
      const f = engine.activeField();
      return f.f(params);
    },

    /**
     * Gradient of active field at current params.
     *
     * @returns {number[]} Gradient vector.
     */
    grad() {
      const f = engine.activeField();
      return f.grad(params);
    },

    /**
     * Apply one GD step to current params.
     *
     * @param {number} lr - Learning rate.
     * @returns {{params: number[], loss: number, gradNorm: number}} After step.
     */
    gdStep(lr) {
      const f = engine.activeField();
      assertNumber(lr, 'lr');
      pushHistory();
      const g = f.grad(params);
      params = params.map((p, i) => p - lr * g[i]);
      gdPath.push(params.slice());
      const gn = Math.sqrt(g.reduce((s, x) => s + x * x, 0));
      return { params: params.slice(), loss: f.f(params), gradNorm: gn };
    },

    /**
     * Run multiple GD steps.
     *
     * @param {number} steps - Step count.
     * @param {number} lr - Learning rate.
     * @returns {{params: number[], loss: number, steps: number}} After training.
     */
    train(steps, lr) {
      if (!Number.isInteger(steps) || steps < 1) {
        throw new TypeError('steps must be an integer >= 1');
      }
      const f = engine.activeField();
      pushHistory();
      for (let i = 0; i < steps; i += 1) {
        const g = f.grad(params);
        params = params.map((p, j) => p - lr * g[j]);
        gdPath.push(params.slice());
      }
      return { params: params.slice(), loss: f.f(params), steps };
    },

    /**
     * Render a value the way the terminal prints it.
     *
     * @param {any} value - Vector, matrix, number, or field summary.
     * @param {string} type - Object type.
     * @returns {string} Display string.
     */
    formatValue(value, type) {
      if (type === 'vector') return fmtVector(value);
      if (type === 'matrix') return fmtMatrix(value);
      if (type === 'scalar') return fmt(value);
      if (type === 'field') return `field ${value.id} (${value.label})`;
      return String(value);
    },
  };

  return engine;
}

/**
 * Type helper for JSDoc consumers.
 * @typedef {ReturnType<typeof createEngine>} MathEngine
 */
export const MathEngine = createEngine;
