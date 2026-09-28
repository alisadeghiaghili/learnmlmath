/**
 * Canvas visualizations for vectors, matrices, and 2-D optimization fields.
 */

const COLORS = {
  grid: '#2a3140',
  axis: '#5a6a82',
  accent: '#5bc0eb',
  amber: '#e8a838',
  mint: '#4ecf9a',
  coral: '#e85d5d',
  ink: '#d7e0ea',
  muted: '#8b9bb0',
  board: '#12161d',
};

/**
 * @typedef {object} VecObj
 * @property {string} name
 * @property {number[]} value
 */

/**
 * Resize canvas to container with device pixel ratio.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas.
 * @returns {CanvasRenderingContext2D} 2D context with sized buffer.
 */
export function prepareCanvas(canvas) {
  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, parent.clientWidth);
  const h = Math.max(280, parent.clientHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Draw a 2-D vector workspace.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} w - CSS width.
 * @param {number} h - CSS height.
 * @param {VecObj[]} vectors - 2-D vectors to draw (higher-dim projects to first 2).
 * @param {object} [opts] - Extra options.
 * @param {number[][]} [opts.path] - Optional GD path in parameter space.
 * @returns {void}
 */
export function drawVectors(ctx, w, h, vectors, opts = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, w, h);

  const pad = 36;
  const scaleX = (w - pad * 2) / 10;
  const scaleY = (h - pad * 2) / 10;
  const s = Math.min(scaleX, scaleY);
  const cx = w / 2;
  const cy = h / 2;

  // grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i += 1) {
    const x = cx + i * s;
    const y = cy + i * s;
    ctx.beginPath();
    ctx.moveTo(x, pad * 0.4);
    ctx.lineTo(x, h - pad * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad * 0.4, y);
    ctx.lineTo(w - pad * 0.4, y);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pad * 0.4, cy);
  ctx.lineTo(w - pad * 0.4, cy);
  ctx.moveTo(cx, pad * 0.4);
  ctx.lineTo(cx, h - pad * 0.4);
  ctx.stroke();

  if (opts.path && opts.path.length > 1) {
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    opts.path.forEach((p, i) => {
      const x = cx + p[0] * s;
      const y = cy - (p[1] || 0) * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  const palette = [COLORS.accent, COLORS.mint, COLORS.amber, COLORS.coral];
  vectors.forEach((v, idx) => {
    const x = v.value[0] ?? 0;
    const y = v.value[1] ?? 0;
    const color = palette[idx % palette.length];
    drawArrow(ctx, cx, cy, cx + x * s, cy - y * s, color, 2.2);
    ctx.fillStyle = color;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(`${v.name} = [${fmtShort(x)}, ${fmtShort(y)}]`, cx + x * s + 8, cy - y * s - 8);
  });
}

/**
 * Draw a vector arrow.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} x0 - Tail x.
 * @param {number} y0 - Tail y.
 * @param {number} x1 - Tip x.
 * @param {number} y1 - Tip y.
 * @param {string} color - Stroke color.
 * @param {number} width - Line width.
 * @returns {void}
 */
function drawArrow(ctx, x0, y0, x1, y1, color, width) {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = 10;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.4), y1 - head * Math.sin(angle - 0.4));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.4), y1 - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw matrices as heat cells.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} w - CSS width.
 * @param {number} h - CSS height.
 * @param {{name: string, value: number[][]}[]} matrices - Matrices to show.
 * @returns {void}
 */
export function drawMatrices(ctx, w, h, matrices) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, w, h);
  if (!matrices.length) {
    drawEmpty(ctx, w, h, 'matrices appear here');
    return;
  }

  const gap = 28;
  const n = matrices.length;
  const blockW = Math.min(280, (w - gap * (n + 1)) / n);
  let x = gap;
  for (const m of matrices) {
    drawOneMatrix(ctx, x, 48, blockW, m.name, m.value);
    x += blockW + gap;
  }
}

/**
 * Draw a single matrix heatmap.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} x - Left.
 * @param {number} y - Top.
 * @param {number} maxW - Max width.
 * @param {string} name - Label.
 * @param {number[][]} A - Matrix values.
 * @returns {void}
 */
function drawOneMatrix(ctx, x, y, maxW, name, A) {
  const rows = A.length;
  const cols = A[0].length;
  const cell = Math.min(48, Math.floor(maxW / cols), Math.floor((280) / rows));
  const W = cols * cell;
  const H = rows * cell;
  let maxAbs = 1e-9;
  for (const row of A) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));

  ctx.fillStyle = COLORS.ink;
  ctx.font = '600 13px ui-monospace, monospace';
  ctx.fillText(name, x, y - 12);

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const v = A[i][j];
      const t = v / maxAbs;
      const bg = heatColor(t);
      ctx.fillStyle = bg;
      ctx.fillRect(x + j * cell, y + i * cell, cell - 2, cell - 2);
      ctx.fillStyle = Math.abs(t) > 0.55 ? '#0b1020' : COLORS.ink;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtShort(v), x + j * cell + (cell - 2) / 2, y + i * cell + (cell - 2) / 2);
    }
  }
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(x - 4, y - 4, W + 2, H + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Map signed scalar to heatmap color.
 *
 * @param {number} t - Value in [-1, 1].
 * @returns {string} CSS color.
 */
function heatColor(t) {
  const u = Math.max(-1, Math.min(1, t));
  if (u >= 0) {
    const r = Math.round(20 + 70 * (1 - u));
    const g = Math.round(30 + 160 * u);
    const b = Math.round(50 + 140 * (1 - u) + 40 * u);
    return `rgb(${r},${g},${b})`;
  }
  const a = -u;
  const r = Math.round(20 + 200 * a);
  const g = Math.round(30 + 50 * (1 - a));
  const b = Math.round(50 + 40 * (1 - a));
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw 2-D scalar field contours + GD path + current params.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} w - CSS width.
 * @param {number} h - CSS height.
 * @param {object} field - Field with f(x: number[]).
 * @param {number[]} params - Current parameters [x, y].
 * @param {number[][]} path - GD path.
 * @returns {void}
 */
export function drawField(ctx, w, h, field, params, path) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, w, h);

  const pad = 28;
  const spanX = field.id === 'rosen' ? [-1.5, 2.0] : [-2.5, 2.5];
  const spanY = field.id === 'rosen' ? [-0.5, 2.5] : [-2.5, 2.5];

  let minF = Infinity;
  let maxF = -Infinity;
  const step = 3;
  /** @type {Array<[number, number, number]>} */
  const samples = [];
  for (let py = pad; py < h - pad; py += step) {
    for (let px = pad; px < w - pad; px += step) {
      const x = spanX[0] + ((px - pad) / (w - pad * 2)) * (spanX[1] - spanX[0]);
      const y = spanY[1] - ((py - pad) / (h - pad * 2)) * (spanY[1] - spanY[0]);
      let val = 0;
      try {
        val = field.f([x, y]);
      } catch {
        val = 0;
      }
      if (!Number.isFinite(val)) continue;
      samples.push([px, py, val]);
      if (val < minF) minF = val;
      if (val > maxF) maxF = val;
    }
  }
  const range = Math.max(1e-9, maxF - minF);
  for (const [px, py, val] of samples) {
    const t = Math.pow((val - minF) / range, 0.35);
    const r = Math.round(18 + t * 80);
    const g = Math.round(22 + (1 - t) * 40);
    const b = Math.round(30 + (1 - t) * 90);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(px, py, step, step);
  }

  /**
   * Map field coords to canvas.
   *
   * @param {number[]} p - [x, y].
   * @returns {[number, number]} Canvas coords.
   */
  const toPx = (p) => {
    const x = pad + ((p[0] - spanX[0]) / (spanX[1] - spanX[0])) * (w - pad * 2);
    const y = pad + ((spanY[1] - p[1]) / (spanY[1] - spanY[0])) * (h - pad * 2);
    return [x, y];
  };

  if (path && path.length > 1) {
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    path.forEach((p, i) => {
      const [x, y] = toPx(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  const [px, py] = toPx(params);
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(field.label, 14, h - 12);
  ctx.fillText(`x=${fmtShort(params[0])}  y=${fmtShort(params[1])}  f=${fmtShort(field.f(params))}`, 14, 18);
}

/**
 * Empty-state caption.
 *
 * @param {CanvasRenderingContext2D} ctx - Context.
 * @param {number} w - Width.
 * @param {number} h - Height.
 * @param {string} text - Caption.
 * @returns {void}
 */
function drawEmpty(ctx, w, h, text) {
  ctx.fillStyle = COLORS.muted;
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);
  ctx.textAlign = 'left';
}

/**
 * Compact number formatting for canvas labels.
 *
 * @param {number} x - Value.
 * @returns {string} Short form.
 */
function fmtShort(x) {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return String(x);
  return String(Number(x.toPrecision(4)));
}

/**
 * Render the right view for the current engine state.
 *
 * @param {HTMLCanvasElement} canvas - Canvas element.
 * @param {import('../engine/engine.js').MathEngine} engine - Engine.
 * @param {string} preferred - View hint: vectors|matrix|field|auto.
 * @returns {{mode: string, legend: string[]}} What was drawn.
 */
export function renderWorkspace(canvas, engine, preferred = 'auto') {
  const ctx = prepareCanvas(canvas);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  /** @type {VecObj[]} */
  const vectors = [];
  /** @type {{name: string, value: number[][]}[]} */
  const matrices = [];

  for (const name of engine.names()) {
    const rec = engine.get(name);
    if (rec.type === 'vector' && rec.value.length >= 2) {
      vectors.push({ name, value: rec.value });
    }
    if (rec.type === 'matrix') {
      matrices.push({ name, value: rec.value });
    }
  }

  let mode = preferred;
  if (mode === 'auto' || mode === 'vectors' || mode === 'matrix') {
    if (preferred === 'matrix' || (preferred === 'auto' && matrices.length && !vectors.length)) {
      mode = 'matrix';
    } else if (vectors.length && preferred !== 'matrix') {
      mode = 'vectors';
    } else if (matrices.length) {
      mode = 'matrix';
    } else if (engine.activeFieldId()) {
      mode = 'field';
    } else {
      mode = 'vectors';
    }
  }

  if (mode === 'matrix') {
    drawMatrices(ctx, w, h, matrices);
    return { mode, legend: matrices.map((m) => `${m.name} matrix`) };
  }

  if (mode === 'field' && engine.activeFieldId()) {
    const field = engine.activeField();
    drawField(ctx, w, h, field, engine.params(), engine.gdPath());
    return {
      mode,
      legend: [
        `field ${field.id}`,
        `loss ${fmtShort(field.f(engine.params()))}`,
        `||grad|| ${fmtShort(Math.hypot(...field.grad(engine.params())))}`,
      ],
    };
  }

  drawVectors(ctx, w, h, vectors, { path: engine.activeFieldId() ? engine.gdPath() : null });
  return {
    mode: 'vectors',
    legend: vectors.length ? vectors.map((v) => `${v.name} vector`) : ['define a vector: vec a 3 4'],
  };
}
