# LearnMLMath design notes

## Mapping from learnGitBranching

| LGB | LearnMLMath |
| --- | --- |
| Git engine | MathEngine (vectors / matrices / fields) |
| Commit tree visualization | Vector plane, matrix heatmap, loss landscape |
| Git command parser | Math command interpreter (`src/engine/commands.js`) |
| Levels + tree compare | Levels + numeric `check(engine)` predicates |
| Command golf | Command golf (`par`) |
| Sandbox | Sandbox |
| undo / reset | undo / reset |
| Level builder | (roadmap) JSON level import |
| `?command=` permalinks | `?level=<id>` deep links |

## Visual direction

- **Anchor:** learnGitBranching OS-window chrome × chalkboard math (3Blue1Brown readability)
- **Palette**
  - workspace `#8FA3B8`
  - chrome `#E8EEF4` / ink `#243041`
  - terminal `#0E1116` / board `#12161D`
  - accent `#5BC0EB` (objects / primary)
  - amber `#E8A838` (gradients / paths)
  - mint `#4ECF9A` (success)
  - coral `#E85D5D` (errors)
- **Type:** JetBrains Mono / Cascadia Code for math and terminal; IBM Plex Sans / system-ui for chrome labels
- **Layout:** three columns — terminal | visualization | goal — plus a bottom helper bar of real commands
- **Signature moments**
  1. Vectors snap onto the plane with labeled arrows after `vec`
  2. Matrix cells heat by signed magnitude after `mat` / `matmul`
  3. GD path draws live over the loss landscape during `step` / `train`

## Interaction rules

1. Every command prints a result or a precise error (never silent).
2. Goal checks run after every successful command.
3. Level solutions are executable scripts and are tested.
4. Reduced motion: no decorative animation is required to understand state.

## Roadmap (not in v0.1)

- Level builder / JSON import (LGB `build level`)
- Permalink for arbitrary command sequences
- 3-D vector view
- Probability sequence (distributions, Bayes, entropy)
- Localization (en / fa / de) like LGB strings.js
