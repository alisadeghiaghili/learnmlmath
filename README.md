# LearnMLMath

Interactive ML math visualization sandbox and tutorial game — the learnGitBranching pattern applied to the mathematics of machine learning.

## Why

learnGitBranching teaches git with a live commit tree, a command terminal, and game-like levels. LearnMLMath applies the same loop to ML math:

- a **terminal** where you define vectors, matrices, fields, and optimization steps
- a **live visualization** (vector plane, matrix heatmaps, loss landscape + GD path)
- **levels** with goals, hints, reference solutions, and command golf (par)
- **sandbox** mode for free exploration
- **undo / reset**

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine + level solver tests
npm run build    # static site in dist/
```

Deep link a level: `/?level=opt-train-2`

## Curriculum

| Sequence | Theme |
| --- | --- |
| Vectors | create vectors, norms, unit, dot, projection |
| Linear Algebra | matmul, det, inverse, linear maps |
| Calculus | gradients, stationary points |
| Optimization | gradient descent, Rosenbrock, linear MSE |
| Mixed Drill | short puzzles + command golf |

## Command language

```text
vec a 3 4
mat A 2 2 1 2 3 4
eye I 2
scalar s 2.5

dot a b d
norm a 2 n
add a b c
unit a u
proj a b p

matmul A B C
det A d
inv A Ainv
matvec A v w

field quad | rosen | mse
params 1 1
loss
grad
step 0.1
train 80 0.1
path

levels | goal | hint | solution | goto <id>
undo | reset | help
```

## Architecture

```text
src/engine/     pure math + command interpreter (tested headlessly)
src/levels/     declarative curriculum with checkers
src/viz/        canvas renderers
src/ui/         terminal, goal panel, level browser
```

Levels are data + `check(engine)` predicates. Every shipped level is solved by its own `solution` in `tests/levels.test.js` — if a level cannot be solved, CI fails.

## Design notes

See `docs/DESIGN.md` for palette, interaction model, and the LGB mapping.

## License

MIT
