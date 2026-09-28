/**
 * Linear algebra primitives for LearnMLMath.
 *
 * Pure functions over plain number arrays and nested number arrays.
 * No hidden state. Numerical edge cases raise or return explicit nulls.
 */

const EPS = 1e-12;

/**
 * Assert that a value is a finite number.
 *
 * @param {unknown} value - Candidate number.
 * @param {string} label - Name used in the error message.
 * @returns {number} The finite number.
 * @throws {TypeError} If value is not a finite number.
 */
export function assertNumber(value, label = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number, got ${String(value)}`);
  }
  return value;
}

/**
 * Assert that a value is a vector (1-D array of finite numbers).
 *
 * @param {unknown} value - Candidate vector.
 * @param {string} label - Name used in the error message.
 * @returns {number[]} The vector (same reference).
 * @throws {TypeError} If value is not a valid vector.
 */
export function assertVector(value, label = 'vector') {
  if (!Array.isArray(value) || value.length === 0 || value.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
    throw new TypeError(`${label} must be a non-empty array of finite numbers`);
  }
  return value;
}

/**
 * Assert that a value is a matrix (non-empty 2-D rectangular array).
 *
 * @param {unknown} value - Candidate matrix.
 * @param {string} label - Name used in the error message.
 * @returns {number[][]} The matrix (same reference).
 * @throws {TypeError} If value is not a valid matrix.
 */
export function assertMatrix(value, label = 'matrix') {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty 2-D array`);
  }
  const cols = Array.isArray(value[0]) ? value[0].length : -1;
  if (cols < 1) {
    throw new TypeError(`${label} must be a non-empty 2-D array`);
  }
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new TypeError(`${label} must be rectangular`);
    }
    if (row.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
      throw new TypeError(`${label} entries must be finite numbers`);
    }
  }
  return value;
}

/**
 * Add two equal-length vectors.
 *
 * @param {number[]} a - Left vector.
 * @param {number[]} b - Right vector.
 * @returns {number[]} Element-wise sum a + b.
 * @throws {TypeError} On shape mismatch or invalid input.
 * @example
 * add([1, 2], [3, 4]); // => [4, 6]
 */
export function add(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  if (a.length !== b.length) {
    throw new TypeError(`add: length mismatch ${a.length} vs ${b.length}`);
  }
  return a.map((x, i) => x + b[i]);
}

/**
 * Subtract two equal-length vectors.
 *
 * @param {number[]} a - Left vector.
 * @param {number[]} b - Right vector.
 * @returns {number[]} Element-wise difference a - b.
 * @throws {TypeError} On shape mismatch or invalid input.
 * @example
 * sub([3, 4], [1, 2]); // => [2, 2]
 */
export function sub(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  if (a.length !== b.length) {
    throw new TypeError(`sub: length mismatch ${a.length} vs ${b.length}`);
  }
  return a.map((x, i) => x - b[i]);
}

/**
 * Scale a vector by a scalar.
 *
 * @param {number} k - Scalar multiplier.
 * @param {number[]} v - Vector.
 * @returns {number[]} k * v.
 * @throws {TypeError} On invalid input.
 * @example
 * scale(2, [1, -1]); // => [2, -2]
 */
export function scale(k, v) {
  assertNumber(k, 'k');
  assertVector(v, 'v');
  return v.map((x) => k * x);
}

/**
 * Dot product of two equal-length vectors.
 *
 * @param {number[]} a - Left vector.
 * @param {number[]} b - Right vector.
 * @returns {number} a · b.
 * @throws {TypeError} On shape mismatch or invalid input.
 * @example
 * dot([1, 2], [3, 4]); // => 11
 */
export function dot(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  if (a.length !== b.length) {
    throw new TypeError(`dot: length mismatch ${a.length} vs ${b.length}`);
  }
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

/**
 * Vector p-norm. Default is Euclidean (p = 2).
 *
 * @param {number[]} v - Vector.
 * @param {number} [p=2] - Norm order (p >= 1).
 * @returns {number} ||v||_p.
 * @throws {TypeError} On invalid input or p < 1.
 * @example
 * norm([3, 4]); // => 5
 */
export function norm(v, p = 2) {
  assertVector(v, 'v');
  if (typeof p !== 'number' || Number.isNaN(p) || p < 1) {
    throw new TypeError('norm: p must be >= 1 (Infinity allowed)');
  }
  if (p === Infinity) {
    return Math.max(...v.map((x) => Math.abs(x)));
  }
  if (p === 1) {
    return v.reduce((s, x) => s + Math.abs(x), 0);
  }
  if (p === 2) {
    return Math.sqrt(dot(v, v));
  }
  return v.reduce((s, x) => s + Math.abs(x) ** p, 0) ** (1 / p);
}

/**
 * Unit vector in the direction of v.
 *
 * @param {number[]} v - Non-zero vector.
 * @returns {number[]} v / ||v||_2.
 * @throws {TypeError} If v is zero or invalid.
 * @example
 * unit([3, 4]); // => [0.6, 0.8]
 */
export function unit(v) {
  const n = norm(v, 2);
  if (n < EPS) throw new TypeError('unit: zero vector has no direction');
  return scale(1 / n, v);
}

/**
 * Orthogonal projection of a onto the line spanned by b.
 *
 * @param {number[]} a - Vector to project.
 * @param {number[]} b - Direction vector (non-zero).
 * @returns {number[]} proj_b(a).
 * @throws {TypeError} If b is zero or shapes mismatch.
 * @example
 * proj([2, 1], [1, 0]); // => [2, 0]
 */
export function proj(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  if (a.length !== b.length) {
    throw new TypeError(`proj: length mismatch ${a.length} vs ${b.length}`);
  }
  const bb = dot(b, b);
  if (bb < EPS) throw new TypeError('proj: cannot project onto zero vector');
  return scale(dot(a, b) / bb, b);
}

/**
 * 3-D cross product.
 *
 * @param {number[]} a - Length-3 vector.
 * @param {number[]} b - Length-3 vector.
 * @returns {number[]} a × b.
 * @throws {TypeError} If either vector is not length 3.
 * @example
 * cross([1, 0, 0], [0, 1, 0]); // => [0, 0, 1]
 */
export function cross(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  if (a.length !== 3 || b.length !== 3) {
    throw new TypeError('cross: both vectors must have length 3');
  }
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Outer product a ⊗ b (column a, row b).
 *
 * @param {number[]} a - Left vector length m.
 * @param {number[]} b - Right vector length n.
 * @returns {number[][]} m×n matrix.
 * @throws {TypeError} On invalid input.
 */
export function outer(a, b) {
  assertVector(a, 'a');
  assertVector(b, 'b');
  return a.map((x) => b.map((y) => x * y));
}

/**
 * Matrix transpose.
 *
 * @param {number[][]} A - Matrix.
 * @returns {number[][]} Aᵀ.
 * @throws {TypeError} On invalid input.
 */
export function transpose(A) {
  assertMatrix(A, 'A');
  const rows = A.length;
  const cols = A[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      out[j][i] = A[i][j];
    }
  }
  return out;
}

/**
 * Matrix product AB.
 *
 * @param {number[][]} A - Left matrix (m×n).
 * @param {number[][]} B - Right matrix (n×p).
 * @returns {number[][]} m×p product.
 * @throws {TypeError} On shape mismatch or invalid input.
 * @example
 * matmul([[1, 2], [3, 4]], [[1], [1]]); // => [[3], [7]]
 */
export function matmul(A, B) {
  assertMatrix(A, 'A');
  assertMatrix(B, 'B');
  const m = A.length;
  const n = A[0].length;
  const n2 = B.length;
  const p = B[0].length;
  if (n !== n2) {
    throw new TypeError(`matmul: inner shape mismatch (${m}x${n}) * (${n2}x${p})`);
  }
  const out = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i += 1) {
    for (let k = 0; k < n; k += 1) {
      const aik = A[i][k];
      for (let j = 0; j < p; j += 1) {
        out[i][j] += aik * B[k][j];
      }
    }
  }
  return out;
}

/**
 * Matrix-vector product Av.
 *
 * @param {number[][]} A - Matrix (m×n).
 * @param {number[]} v - Vector length n.
 * @returns {number[]} Vector length m.
 * @throws {TypeError} On shape mismatch or invalid input.
 */
export function matVec(A, v) {
  assertMatrix(A, 'A');
  assertVector(v, 'v');
  if (A[0].length !== v.length) {
    throw new TypeError(`matVec: shape mismatch (${A.length}x${A[0].length}) * (${v.length})`);
  }
  return A.map((row) => dot(row, v));
}

/**
 * Square identity matrix.
 *
 * @param {number} n - Dimension (n >= 1).
 * @returns {number[][]} I_n.
 * @throws {TypeError} If n is not a positive integer.
 */
export function identity(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError('identity: n must be a positive integer');
  }
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

/**
 * Trace of a square matrix.
 *
 * @param {number[][]} A - Square matrix.
 * @returns {number} tr(A).
 * @throws {TypeError} If A is not square.
 */
export function trace(A) {
  assertMatrix(A, 'A');
  if (A.length !== A[0].length) {
    throw new TypeError('trace: matrix must be square');
  }
  let s = 0;
  for (let i = 0; i < A.length; i += 1) s += A[i][i];
  return s;
}

/**
 * Determinant via Gaussian elimination with partial pivoting.
 *
 * @param {number[][]} A - Square matrix.
 * @returns {number} det(A).
 * @throws {TypeError} If A is not square.
 * @example
 * det([[1, 2], [3, 4]]); // => -2
 */
export function det(A) {
  assertMatrix(A, 'A');
  const n = A.length;
  if (n !== A[0].length) {
    throw new TypeError('det: matrix must be square');
  }
  const M = A.map((row) => row.slice());
  let d = 1;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < EPS) return 0;
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
      d = -d;
    }
    d *= M[col][col];
    const invP = 1 / M[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const f = M[r][col] * invP;
      for (let c = col; c < n; c += 1) {
        M[r][c] -= f * M[col][c];
      }
    }
  }
  return d;
}

/**
 * Matrix inverse via Gauss-Jordan elimination with partial pivoting.
 *
 * @param {number[][]} A - Square invertible matrix.
 * @returns {number[][]} A⁻¹.
 * @throws {TypeError} If A is not square or is singular.
 * @example
 * inv([[2, 0], [0, 4]]); // => [[0.5, 0], [0, 0.25]]
 */
export function inv(A) {
  assertMatrix(A, 'A');
  const n = A.length;
  if (n !== A[0].length) {
    throw new TypeError('inv: matrix must be square');
  }
  const M = A.map((row) => row.slice());
  const I = identity(n);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < EPS) {
      throw new TypeError('inv: matrix is singular');
    }
    if (pivot !== col) {
      let tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
      tmp = I[pivot];
      I[pivot] = I[col];
      I[col] = tmp;
    }
    const invP = 1 / M[col][col];
    for (let c = 0; c < n; c += 1) {
      M[col][c] *= invP;
      I[col][c] *= invP;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < EPS) continue;
      for (let c = 0; c < n; c += 1) {
        M[r][c] -= f * M[col][c];
        I[r][c] -= f * I[col][c];
      }
    }
  }
  return I;
}

/**
 * Frobenius norm of a matrix.
 *
 * @param {number[][]} A - Matrix.
 * @returns {number} ||A||_F.
 * @throws {TypeError} On invalid input.
 */
export function frobenius(A) {
  assertMatrix(A, 'A');
  let s = 0;
  for (const row of A) {
    for (const x of row) s += x * x;
  }
  return Math.sqrt(s);
}

/**
 * Build a matrix from a flat row-major list of values.
 *
 * @param {number} rows - Row count.
 * @param {number} cols - Column count.
 * @param {number[]} values - Flat values length rows * cols.
 * @returns {number[][]} The matrix.
 * @throws {TypeError} On shape mismatch.
 */
export function matrixFromFlat(rows, cols, values) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new TypeError('matrixFromFlat: rows and cols must be positive integers');
  }
  if (values.length !== rows * cols) {
    throw new TypeError(`matrixFromFlat: expected ${rows * cols} values, got ${values.length}`);
  }
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => values[i * cols + j]),
  );
}

/**
 * Format a number for terminal display (trim float noise).
 *
 * @param {number} x - Value.
 * @returns {string} Compact decimal string.
 * @example
 * fmt(0.30000000000000004); // => '0.3'
 */
export function fmt(x) {
  assertNumber(x, 'x');
  if (Number.isInteger(x)) return String(x);
  const rounded = Number(x.toPrecision(10));
  return String(rounded);
}

/**
 * Format a vector for terminal display.
 *
 * @param {number[]} v - Vector.
 * @returns {string} e.g. [1, 2.5]
 */
export function fmtVector(v) {
  assertVector(v, 'v');
  return `[${v.map(fmt).join(', ')}]`;
}

/**
 * Format a matrix for terminal display.
 *
 * @param {number[][]} A - Matrix.
 * @returns {string} e.g. [[1, 2], [3, 4]]
 */
export function fmtMatrix(A) {
  assertMatrix(A, 'A');
  return `[${A.map((row) => fmtVector(row)).join(', ')}]`;
}
