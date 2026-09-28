/**
 * Command parser and executor for the LearnMLMath terminal.
 *
 * Grammar is intentionally small and shell-like:
 *   verb [args...]
 * Commands never mutate history on parse failure.
 */

import {
  add,
  cross,
  det,
  dot,
  fmt,
  fmtMatrix,
  fmtVector,
  frobenius,
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
} from './linalg.js';
import { fields, gdRun, isStationary, numericalGrad } from './calculus.js';

/**
 * Tokenize a command line (whitespace split, simple quotes).
 *
 * @param {string} line - Raw input line.
 * @returns {string[]} Tokens.
 * @example
 * tokenize('vec a 1 2'); // => ['vec', 'a', '1', '2']
 */
export function tokenize(line) {
  const out = [];
  let cur = '';
  let q = null;
  for (const ch of line) {
    if (q) {
      if (ch === q) {
        q = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (q) throw new Error('unclosed quote');
  if (cur) out.push(cur);
  return out;
}

/**
 * Parse a number token.
 *
 * @param {string} token - Numeric token.
 * @param {string} label - Error label.
 * @returns {number} Parsed number.
 * @throws {Error} If not finite.
 */
function num(token, label) {
  const x = Number(token);
  if (!Number.isFinite(x)) {
    throw new Error(`${label} must be a number, got '${token}'`);
  }
  return x;
}

/**
 * Execute one command against an engine.
 *
 * @param {import('./engine.js').MathEngine} engine - Workspace engine.
 * @param {string} line - Command line.
 * @returns {{ok: boolean, lines: string[], type: 'out'|'err', action?: object}} Result for the UI.
 */
export function execute(engine, line) {
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) {
    return { ok: true, lines: [], type: 'out' };
  }

  let tokens;
  try {
    tokens = tokenize(raw);
  } catch (err) {
    return { ok: false, lines: [err.message], type: 'err' };
  }

  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);
  const out = [];
  const action = {};

  try {
    switch (verb) {
      case 'help': {
        out.push(...HELP_LINES);
        break;
      }
      case 'ls':
      case 'objects': {
        const names = engine.names();
        if (!names.length) {
          out.push('(empty workspace)');
        } else {
          for (const n of names) {
            const rec = engine.get(n);
            out.push(`${n}: ${engine.formatValue(rec.value, rec.type)}`);
          }
        }
        if (engine.activeFieldId()) {
          out.push(`active field: ${engine.activeFieldId()}  params: ${fmtVector(engine.params())}`);
        }
        break;
      }
      case 'vec': {
        if (args.length < 2) throw new Error('usage: vec <name> <c1> <c2> ...');
        const name = args[0];
        const values = args.slice(1).map((t, i) => num(t, `v[${i}]`));
        engine.set(name, 'vector', values);
        out.push(`${name} = ${fmtVector(values)}`);
        action.view = 'vectors';
        break;
      }
      case 'mat': {
        // mat <name> <rows> <cols> <v...>
        if (args.length < 4) throw new Error('usage: mat <name> <rows> <cols> <values...>');
        const name = args[0];
        const rows = num(args[1], 'rows');
        const cols = num(args[2], 'cols');
        const values = args.slice(3).map((t, i) => num(t, `v[${i}]`));
        const M = matrixFromFlat(rows, cols, values);
        engine.set(name, 'matrix', M);
        out.push(`${name} = ${fmtMatrix(M)}`);
        action.view = 'matrix';
        break;
      }
      case 'eye': {
        if (args.length !== 2) throw new Error('usage: eye <name> <n>');
        const name = args[0];
        const n = num(args[1], 'n');
        const I = identity(n);
        engine.set(name, 'matrix', I);
        out.push(`${name} = ${fmtMatrix(I)}`);
        action.view = 'matrix';
        break;
      }
      case 'scalar': {
        if (args.length !== 2) throw new Error('usage: scalar <name> <value>');
        engine.set(args[0], 'scalar', num(args[1], 'value'));
        out.push(`${args[0]} = ${fmt(engine.get(args[0]).value)}`);
        break;
      }
      case 'show': {
        if (args.length !== 1) throw new Error('usage: show <name>');
        const rec = engine.get(args[0]);
        out.push(engine.formatValue(rec.value, rec.type));
        if (rec.type === 'vector') action.view = 'vectors';
        if (rec.type === 'matrix') action.view = 'matrix';
        break;
      }
      case 'rm': {
        if (args.length !== 1) throw new Error('usage: rm <name>');
        engine.delete(args[0]);
        out.push(`removed ${args[0]}`);
        break;
      }
      case 'dot': {
        if (args.length < 2) throw new Error('usage: dot <a> <b> [out]');
        const a = engine.getAs(args[0], 'vector');
        const b = engine.getAs(args[1], 'vector');
        const d = dot(a, b);
        out.push(`dot = ${fmt(d)}`);
        if (args[2]) {
          engine.set(args[2], 'scalar', d);
          out.push(`${args[2]} = ${fmt(d)}`);
        }
        action.view = 'vectors';
        break;
      }
      case 'norm': {
        // norm <a> [p] [out]
        if (args.length < 1) throw new Error('usage: norm <a> [p] [out]');
        const a = engine.getAs(args[0], 'vector');
        let p = 2;
        let outName = null;
        if (args[1]) {
          const maybe = Number(args[1]);
          if (Number.isFinite(maybe) && !args[2]) {
            // could be p or we only have one extra
            if (args.length === 2) {
              // ambiguous: treat as p if numeric
              p = maybe;
            }
          } else if (Number.isFinite(maybe)) {
            p = maybe;
            outName = args[2];
          } else {
            outName = args[1];
          }
        }
        if (args.length === 3) {
          p = num(args[1], 'p');
          outName = args[2];
        }
        const n = norm(a, p);
        out.push(`norm = ${fmt(n)}`);
        if (outName) {
          engine.set(outName, 'scalar', n);
          out.push(`${outName} = ${fmt(n)}`);
        }
        break;
      }
      case 'add':
      case 'sub':
      case 'scale':
      case 'proj':
      case 'unit':
      case 'cross':
      case 'outer': {
        const result = runVectorOp(verb, engine, args);
        out.push(result.text);
        if (result.storeName) {
          engine.set(result.storeName, result.storeType, result.storeValue);
          out.push(`${result.storeName} = ${engine.formatValue(result.storeValue, result.storeType)}`);
        }
        if (result.storeType === 'vector' || result.storeType === 'matrix') {
          action.view = result.storeType === 'vector' ? 'vectors' : 'matrix';
        }
        break;
      }
      case 'transpose':
      case 't': {
        if (args.length < 1) throw new Error('usage: transpose <A> [out]');
        const A = engine.getAs(args[0], 'matrix');
        const T = transpose(A);
        out.push(fmtMatrix(T));
        if (args[1]) {
          engine.set(args[1], 'matrix', T);
          out.push(`${args[1]} = ${fmtMatrix(T)}`);
        }
        action.view = 'matrix';
        break;
      }
      case 'matmul': {
        if (args.length < 2) throw new Error('usage: matmul <A> <B> [out]');
        const A = engine.getAs(args[0], 'matrix');
        const B = engine.getAs(args[1], 'matrix');
        const C = matmul(A, B);
        out.push(fmtMatrix(C));
        if (args[2]) {
          engine.set(args[2], 'matrix', C);
          out.push(`${args[2]} = ${fmtMatrix(C)}`);
        }
        action.view = 'matrix';
        break;
      }
      case 'matvec': {
        if (args.length < 2) throw new Error('usage: matvec <A> <v> [out]');
        const A = engine.getAs(args[0], 'matrix');
        const v = engine.getAs(args[1], 'vector');
        const y = matVec(A, v);
        out.push(fmtVector(y));
        if (args[2]) {
          engine.set(args[2], 'vector', y);
          out.push(`${args[2]} = ${fmtVector(y)}`);
        }
        action.view = 'vectors';
        break;
      }
      case 'det': {
        if (args.length < 1) throw new Error('usage: det <A> [out]');
        const d = det(engine.getAs(args[0], 'matrix'));
        out.push(`det = ${fmt(d)}`);
        if (args[1]) {
          engine.set(args[1], 'scalar', d);
          out.push(`${args[1]} = ${fmt(d)}`);
        }
        break;
      }
      case 'inv': {
        if (args.length < 1) throw new Error('usage: inv <A> [out]');
        const I = inv(engine.getAs(args[0], 'matrix'));
        out.push(fmtMatrix(I));
        if (args[1]) {
          engine.set(args[1], 'matrix', I);
          out.push(`${args[1]} = ${fmtMatrix(I)}`);
        }
        action.view = 'matrix';
        break;
      }
      case 'trace': {
        if (args.length < 1) throw new Error('usage: trace <A> [out]');
        const t = trace(engine.getAs(args[0], 'matrix'));
        out.push(`trace = ${fmt(t)}`);
        if (args[1]) {
          engine.set(args[1], 'scalar', t);
          out.push(`${args[1]} = ${fmt(t)}`);
        }
        break;
      }
      case 'fro': {
        if (args.length !== 1) throw new Error('usage: fro <A>');
        out.push(`||A||_F = ${fmt(frobenius(engine.getAs(args[0], 'matrix')))}`);
        break;
      }
      case 'field': {
        if (args.length !== 1) throw new Error('usage: field <quad|rosen|mse>');
        const info = engine.setActiveField(args[0]);
        out.push(`active field: ${info.label}`);
        out.push(`params = ${fmtVector(engine.params())}`);
        action.view = 'field';
        break;
      }
      case 'params': {
        if (args.length === 0) {
          out.push(fmtVector(engine.params()));
          break;
        }
        const p = args.map((t, i) => num(t, `p[${i}]`));
        engine.setParams(p);
        out.push(`params = ${fmtVector(engine.params())}`);
        out.push(`loss = ${fmt(engine.loss())}`);
        action.view = 'field';
        break;
      }
      case 'loss': {
        out.push(`loss = ${fmt(engine.loss())}`);
        break;
      }
      case 'grad': {
        const g = engine.grad();
        out.push(`grad = ${fmtVector(g)}`);
        out.push(`||grad|| = ${fmt(norm(g, 2))}`);
        action.view = 'field';
        break;
      }
      case 'ngrad': {
        const f = engine.activeField();
        const g = numericalGrad((x) => f.f(x), engine.params());
        out.push(`ngrad = ${fmtVector(g)}`);
        break;
      }
      case 'step': {
        const lr = args[0] ? num(args[0], 'lr') : 0.1;
        const r = engine.gdStep(lr);
        out.push(`params = ${fmtVector(r.params)}`);
        out.push(`loss = ${fmt(r.loss)}`);
        out.push(`||grad|| = ${fmt(r.gradNorm)}`);
        action.view = 'field';
        break;
      }
      case 'train': {
        if (args.length < 2) throw new Error('usage: train <steps> <lr>');
        const steps = num(args[0], 'steps');
        const lr = num(args[1], 'lr');
        const r = engine.train(steps, lr);
        out.push(`trained ${r.steps} steps`);
        out.push(`params = ${fmtVector(r.params)}`);
        out.push(`loss = ${fmt(r.loss)}`);
        const g = engine.grad();
        out.push(`||grad|| = ${fmt(norm(g, 2))}`);
        action.view = 'field';
        break;
      }
      case 'path': {
        const path = engine.gdPath();
        out.push(`path length = ${path.length}`);
        path.forEach((p, i) => out.push(`  ${i}: ${fmtVector(p)}`));
        action.view = 'field';
        break;
      }
      case 'stationary': {
        const f = engine.activeField();
        const ok = isStationary(f.grad, engine.params());
        out.push(ok ? 'stationary (||grad|| ~ 0)' : 'not stationary');
        break;
      }
      case 'hint': {
        out.push('(hint requested — see goal panel)');
        action.hint = true;
        break;
      }
      case 'goal': {
        action.goal = true;
        break;
      }
      case 'levels': {
        action.levels = true;
        break;
      }
      case 'sandbox': {
        action.sandbox = true;
        break;
      }
      case 'reset': {
        engine.clear();
        action.reset = true;
        out.push('workspace cleared');
        break;
      }
      case 'undo': {
        const ok = engine.undo();
        out.push(ok ? 'undid last change' : 'nothing to undo');
        action.view = 'auto';
        break;
      }
      case 'solution': {
        action.solution = true;
        break;
      }
      case 'goto': {
        if (args.length !== 1) throw new Error('usage: goto <levelId>');
        action.goto = args[0];
        break;
      }
      case 'clear': {
        action.clearTerminal = true;
        break;
      }
      default:
        throw new Error(`unknown command '${verb}' — type 'help'`);
    }

    return { ok: true, lines: out, type: 'out', action };
  } catch (err) {
    return { ok: false, lines: [err.message], type: 'err', action: {} };
  }
}

/**
 * Shared vector-op helper for binary/ternary vector commands.
 *
 * @param {string} verb - Command verb.
 * @param {import('./engine.js').MathEngine} engine - Engine.
 * @param {string[]} args - Arguments after verb.
 * @returns {{text: string, storeName?: string, storeType?: string, storeValue?: any}} Result payload.
 */
function runVectorOp(verb, engine, args) {
  if (verb === 'unit') {
    if (args.length < 1) throw new Error('usage: unit <a> [out]');
    const a = engine.getAs(args[0], 'vector');
    const u = unit(a);
    return {
      text: fmtVector(u),
      storeName: args[1],
      storeType: 'vector',
      storeValue: u,
    };
  }
  if (verb === 'cross') {
    if (args.length < 2) throw new Error('usage: cross <a> <b> [out]');
    const c = cross(engine.getAs(args[0], 'vector'), engine.getAs(args[1], 'vector'));
    return {
      text: fmtVector(c),
      storeName: args[2],
      storeType: 'vector',
      storeValue: c,
    };
  }
  if (verb === 'outer') {
    if (args.length < 2) throw new Error('usage: outer <a> <b> [out]');
    const M = outer(engine.getAs(args[0], 'vector'), engine.getAs(args[1], 'vector'));
    return {
      text: fmtMatrix(M),
      storeName: args[2],
      storeType: 'matrix',
      storeValue: M,
    };
  }
  if (verb === 'scale') {
    if (args.length < 2) throw new Error('usage: scale <k> <a> [out]');
    const k = num(args[0], 'k');
    const v = scale(k, engine.getAs(args[1], 'vector'));
    return {
      text: fmtVector(v),
      storeName: args[2],
      storeType: 'vector',
      storeValue: v,
    };
  }
  if (args.length < 2) throw new Error(`usage: ${verb} <a> <b> [out]`);
  const a = engine.getAs(args[0], 'vector');
  const b = engine.getAs(args[1], 'vector');
  if (verb === 'add') {
    const v = add(a, b);
    return { text: fmtVector(v), storeName: args[2], storeType: 'vector', storeValue: v };
  }
  if (verb === 'sub') {
    const v = sub(a, b);
    return { text: fmtVector(v), storeName: args[2], storeType: 'vector', storeValue: v };
  }
  if (verb === 'proj') {
    const v = proj(a, b);
    return { text: fmtVector(v), storeName: args[2], storeType: 'vector', storeValue: v };
  }
  throw new Error(`unsupported op ${verb}`);
}

/** Help text shown by `help`. */
export const HELP_LINES = [
  'LearnMLMath commands',
  '',
  '  define',
  '    vec <name> <c1> <c2> ...     vector',
  '    mat <name> <rows> <cols> ... matrix (row-major values)',
  '    eye <name> <n>               identity matrix',
  '    scalar <name> <value>        scalar',
  '    field <quad|rosen|mse>       activate objective + params',
  '    params <p1> <p2> ...         set current parameters',
  '',
  '  vector / matrix',
  '    show|ls|rm|dot|norm|add|sub|scale|unit|proj|cross|outer',
  '    transpose|matmul|matvec|det|inv|trace|fro',
  '',
  '  optimization',
  '    loss | grad | ngrad | step [lr] | train <steps> <lr> | path',
  '    stationary',
  '',
  '  session',
  '    levels | goal | hint | solution | goto <id> | sandbox',
  '    undo | reset | clear | help',
];
