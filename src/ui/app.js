/**
 * LearnMLMath application shell: terminal, levels, goal, visualization.
 */

import { createEngine } from '../engine/engine.js';
import { execute, HELP_LINES } from '../engine/commands.js';
import { allLevels, findLevel, nextLevelId, sequences } from '../levels/index.js';
import { renderWorkspace } from '../viz/render.js';

const STORAGE_KEY = 'learnmlmath.progress.v1';

/**
 * Load solved level ids and golf scores from localStorage.
 *
 * @returns {Record<string, {commands: number, at: number}>} Progress map.
 */
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Persist progress map.
 *
 * @param {Record<string, {commands: number, at: number}>} progress - Progress.
 * @returns {void}
 */
function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/**
 * Escape text for safe HTML insertion.
 *
 * @param {string} s - Raw string.
 * @returns {string} Escaped string.
 */
function esc(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Minimal markdown-ish renderer for goal text.
 *
 * @param {string} text - Goal markdown subset.
 * @returns {string} HTML.
 */
function renderMarkdown(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

/**
 * Boot the application.
 *
 * @returns {void}
 */
export function boot() {
  const engine = createEngine();
  const progress = loadProgress();

  const terminal = document.getElementById('terminal');
  const input = /** @type {HTMLInputElement} */ (document.getElementById('commandInput'));
  const form = /** @type {HTMLFormElement} */ (document.getElementById('commandForm'));
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('visCanvas'));
  const visLegend = document.getElementById('visLegend');
  const visTitle = document.getElementById('visTitle');
  const goalTitle = document.getElementById('goalTitle');
  const goalText = document.getElementById('goalText');
  const goalStatus = document.getElementById('goalStatus');
  const golfScore = document.getElementById('golfScore');
  const levelToolbar = document.getElementById('levelToolbar');
  const modalRoot = document.getElementById('modalRoot');

  /** @type {string[]} */
  let history = [];
  /** @type {number} */
  let historyIndex = -1;
  /** @type {string[]} */
  let sessionLines = [];
  /** @type {import('./levels/index.js').Level | null} */
  let currentLevel = null;
  /** @type {number} */
  let commandCount = 0;
  /** @type {string} */
  let preferredView = 'auto';
  /** @type {boolean} */
  let solved = false;

  /**
   * Append a terminal line.
   *
   * @param {string} text - Line text.
   * @param {string} [kind=out] - Line kind class.
   * @returns {void}
   */
  function print(text, kind = 'out') {
    const el = document.createElement('div');
    el.className = `line ${kind}`;
    el.textContent = text;
    terminal.appendChild(el);
    terminal.scrollTop = terminal.scrollHeight;
    sessionLines.push(text);
  }

  /**
   * Redraw visualization from engine state.
   *
   * @returns {void}
   */
  function redraw() {
    const result = renderWorkspace(canvas, engine, preferredView);
    visTitle.textContent =
      result.mode === 'field'
        ? `field · ${engine.activeFieldId() || '—'}`
        : result.mode;
    visLegend.innerHTML = result.legend
      .map((t, i) => `<span class="c-${['accent', 'amber', 'mint', 'coral'][i % 4]}">${esc(t)}</span>`)
      .join('');
  }

  /**
   * Update goal panel for current level / sandbox.
   *
   * @returns {void}
   */
  function renderGoal() {
    if (!currentLevel) {
      goalTitle.textContent = 'Sandbox';
      goalText.innerHTML =
        '<p>Free workspace. Type <code>levels</code> for the tutorial, or explore with vectors, matrices, and gradient descent.</p>' +
        '<p><code>help</code> lists every command.</p>';
      goalStatus.textContent = '';
      goalStatus.className = 'goal-status';
      golfScore.textContent = '';
      levelToolbar.hidden = true;
      return;
    }

    levelToolbar.hidden = false;
    levelToolbar.textContent = `level: ${currentLevel.id} · commands: ${commandCount} · par: ${currentLevel.par}`;
    goalTitle.textContent = currentLevel.name;
    goalText.innerHTML = `<p>${renderMarkdown(currentLevel.goal)}</p>`;
    if (solved) {
      goalStatus.textContent = 'Level solved';
      goalStatus.className = 'goal-status ok';
      const best = progress[currentLevel.id]?.commands ?? commandCount;
      golfScore.innerHTML =
        commandCount <= currentLevel.par
          ? `<span class="par-hit">par ${currentLevel.par} matched</span> · used ${commandCount}`
          : `par ${currentLevel.par} · used ${commandCount} · best ${best}`;
    } else {
      goalStatus.textContent = 'Not solved yet';
      goalStatus.className = 'goal-status bad';
      golfScore.textContent = `par ${currentLevel.par} · used ${commandCount}`;
    }
  }

  /**
   * Run level check and celebrate on success.
   *
   * @returns {void}
   */
  function checkLevel() {
    if (!currentLevel || solved) return;
    const result = currentLevel.check(engine, {
      commandCount,
      history: sessionLines.slice(),
    });
    if (!result.ok) {
      goalStatus.textContent = result.message;
      goalStatus.className = 'goal-status bad';
      return;
    }
    solved = true;
    const prev = progress[currentLevel.id]?.commands;
    if (prev === undefined || commandCount < prev) {
      progress[currentLevel.id] = { commands: commandCount, at: Date.now() };
      saveProgress(progress);
    }
    goalStatus.textContent = result.message;
    goalStatus.className = 'goal-status ok';
    print(`✓ ${currentLevel.name}: ${result.message}`, 'ok');
    if (commandCount <= currentLevel.par) {
      print(`  golf: matched par ${currentLevel.par}`, 'ok');
    }
    const next = nextLevelId(currentLevel.id);
    print(next ? `  next: goto ${next}` : '  you finished the curriculum', 'sys');
    renderGoal();
  }

  /**
   * Start a level by id.
   *
   * @param {string} id - Level id.
   * @returns {void}
   */
  function startLevel(id) {
    const level = findLevel(id);
    if (!level) {
      print(`unknown level '${id}'`, 'err');
      return;
    }
    engine.clear();
    currentLevel = level;
    commandCount = 0;
    sessionLines = [];
    solved = false;
    preferredView = 'auto';
    level.setup(engine);
    print(`— level ${level.id}: ${level.name} —`, 'sys');
    print(level.goal.replace(/\*\*/g, '').replace(/`/g, ''), 'sys');
    print('type `hint` if stuck, `solution` for the reference path', 'sys');
    renderGoal();
    redraw();
    input.focus();
  }

  /**
   * Enter sandbox mode.
   *
   * @returns {void}
   */
  function startSandbox() {
    engine.clear();
    currentLevel = null;
    commandCount = 0;
    sessionLines = [];
    solved = false;
    preferredView = 'auto';
    print('sandbox ready — type `help`', 'sys');
    renderGoal();
    redraw();
    input.focus();
  }

  /**
   * Open the level browser modal.
   *
   * @returns {void}
   */
  function openLevels() {
    const seqKeys = Object.keys(sequences);
    let active = seqKeys[0];

    /**
     * Render modal body for a sequence tab.
     *
     * @returns {void}
     */
    const render = () => {
      const seq = sequences[active];
      const rows = seq.levels
        .map((level, i) => {
          const done = Boolean(progress[level.id]);
          const best = progress[level.id]?.commands;
          return `<button type="button" class="level-row ${done ? 'done' : ''}" data-id="${esc(level.id)}">
            <span class="idx">${done ? '✓' : i + 1}</span>
            <span class="name">${esc(level.name)}</span>
            <span class="meta">${done ? `best ${best}` : `par ${level.par}`}</span>
          </button>`;
        })
        .join('');

      modalRoot.innerHTML = `<div class="modal-card" role="dialog" aria-label="Levels">
        <header>
          <h2>Levels</h2>
          <button type="button" class="btn" id="closeModal">Close</button>
        </header>
        <div class="body">
          <div class="tabs">${seqKeys
            .map(
              (k) =>
                `<button type="button" data-seq="${esc(k)}" class="${k === active ? 'active' : ''}">${esc(sequences[k].displayName)}</button>`,
            )
            .join('')}</div>
          <p class="sequence-about">${esc(seq.about)}</p>
          <div class="level-list">${rows}</div>
        </div>
      </div>`;
      modalRoot.hidden = false;

      modalRoot.querySelector('#closeModal')?.addEventListener('click', () => {
        modalRoot.hidden = true;
        input.focus();
      });
      modalRoot.querySelectorAll('[data-seq]').forEach((btn) => {
        btn.addEventListener('click', () => {
          active = /** @type {HTMLElement} */ (btn).dataset.seq;
          render();
        });
      });
      modalRoot.querySelectorAll('.level-row').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = /** @type {HTMLElement} */ (btn).dataset.id;
          modalRoot.hidden = true;
          startLevel(id);
        });
      });
    };

    render();
  }

  /**
   * Show solution commands for the active level.
   *
   * @returns {void}
   */
  function showSolution() {
    if (!currentLevel) {
      print('no active level', 'err');
      return;
    }
    print('reference solution:', 'sys');
    currentLevel.solution.forEach((line) => print(`  ${line}`, 'sys'));
  }

  /**
   * Handle one submitted command line.
   *
   * @param {string} line - Raw line.
   * @returns {void}
   */
  function runLine(line) {
    const trimmed = line.trim();
    print(`$ ${trimmed}`, 'cmd');
    if (!trimmed) return;
    history.push(trimmed);
    historyIndex = history.length;

    const isMeta = /^(#|$)/.test(trimmed);
    const result = execute(engine, trimmed);
    for (const out of result.lines) {
      print(out, result.ok ? 'out' : 'err');
    }

    if (!isMeta && result.ok) commandCount += 1;

    const action = result.action || {};
    if (action.view) preferredView = action.view;
    if (action.clearTerminal) terminal.innerHTML = '';
    if (action.levels) openLevels();
    if (action.sandbox) startSandbox();
    if (action.goto) startLevel(action.goto);
    if (action.hint && currentLevel) print(`hint: ${currentLevel.hint}`, 'sys');
    if (action.goal) renderGoal();
    if (action.solution) showSolution();
    if (action.reset) {
      if (currentLevel) {
        startLevel(currentLevel.id);
      } else {
        startSandbox();
      }
      return;
    }

    redraw();
    checkLevel();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const line = input.value;
    input.value = '';
    runLine(line);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (historyIndex > 0) {
        historyIndex -= 1;
        input.value = history[historyIndex] ?? '';
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex < history.length) {
        historyIndex += 1;
        input.value = history[historyIndex] ?? '';
      }
    }
  });

  document.getElementById('helperBar')?.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!(target instanceof HTMLButtonElement)) return;
    const cmd = target.dataset.cmd;
    if (cmd) {
      input.value = cmd;
      runLine(cmd);
      input.value = '';
    }
  });

  document.getElementById('btnLevels')?.addEventListener('click', openLevels);
  document.getElementById('btnHint')?.addEventListener('click', () => {
    if (currentLevel) print(`hint: ${currentLevel.hint}`, 'sys');
    else print('sandbox has no hint — open levels', 'sys');
  });
  document.getElementById('btnSolution')?.addEventListener('click', showSolution);
  document.getElementById('btnReset')?.addEventListener('click', () => {
    runLine('reset');
  });
  document.getElementById('goalClose')?.addEventListener('click', () => {
    const panel = document.getElementById('goalPanel');
    if (panel) panel.hidden = true;
  });

  window.addEventListener('resize', redraw);

  // boot copy
  print('LearnMLMath — interactive math for machine learning', 'sys');
  print('sandbox mode. type `levels` to start the tutorial.', 'sys');
  print(HELP_LINES.join('\n'), 'sys');
  renderGoal();
  redraw();
  input.focus();

  // URL: ?level=<id> deep link
  const params = new URLSearchParams(window.location.search);
  const levelParam = params.get('level');
  if (levelParam && findLevel(levelParam)) {
    startLevel(levelParam);
  }
}

/**
 * Get all levels for debugging.
 *
 * @returns {import('./levels/index.js').Level[]} Levels.
 */
export function listLevels() {
  return allLevels();
}
