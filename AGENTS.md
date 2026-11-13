# AGENTS.md — working in this repository

A DeepSeek Harness bundle: one Host half (`index.js` + `src/host/`) and one built Client half
(`client.js`, generated from `src/client/`). `README.md` describes behaviour; `ARCHITECTURE.md`
describes the design. Read both before changing structure.

## Rules

- **No compatibility layers.** There is one released line. Do not keep old state shapes, old option
  names, or migration branches for versions nobody runs.
- **No speculative fallbacks.** A `try/catch` or `??` must correspond to a failure that can happen
  (missing optional service, unreadable file, a user-entered value). Delete it if it cannot.
- **No dead code.** An export nobody imports is a bug. Run the scan described below after a refactor.
- **One job per module.** If a file needs the word "and" twice to describe it, split it.
- **Do not over-engineer.** No plugin registries for two cases, no abstraction with one implementation,
  no settings for values that never change.
- **Host modules take their dependencies as parameters.** `index.js` is the only place that knows all
  the pieces; a module that reaches for global state breaks that boundary.
- **Client modules share one factory scope.** Order matters; declare new files in
  `scripts/build-client.mjs`'s `ORDER`.

## Build discipline

`client.js` is generated. Never edit it by hand.

```sh
npm run build   # rewrite client.js from src/client/*.js
npm run check   # node --check on both halves + verify client.js is current
```

`npm run check` must pass before a commit. A stale bundle is a failing check, not a warning.

## Changing behaviour

- Host logic goes in the module that owns the concern, wired through `ctx.effect` in `index.js` so
  unloading withdraws it.
- Add a field to exactly one payload: `/state` for the header chip, `/settings` for the settings page.
- Client text goes through the locale dictionaries and the slot-provided `t`; never hard-code a
  user-visible string in a component.
- Use the official primitives (`Menu`, `Button`, `Input`, `Switch`, `Pill`) rather than native controls
  or a parallel style system.

## Verification

There is no test suite. Verify against a running Harness:

1. `npm run check`.
2. Toggle the plugin off and on (plugin manager) so the Host half re-applies; a failed apply is
   reported as `application: failed` with a diagnostic — read it.
3. `GET /proxy-switch/state` and `GET /proxy-switch/settings` on the running port return `ok: true`.
4. `GET /proxy-switch/log` shows no `render-crash` entries.
5. For UI changes, open the settings page and the header chip; the slot boundary hides a crashing
   slot, so a missing chip is a failure, not an empty state.

## Boundaries

- The single default profile is intentional. Do not add more seeded profiles.
- Child processes receive exactly `http_proxy`, `https_proxy`, `all_proxy`. Do not add uppercase
  variants or `NO_PROXY`.
- `README.md` lists every Harness interface this plugin touches. When one changes, update that table in
  the same commit.
- Writes are locked while a turn is open (`POST /settings` and `POST /active` both return 409). Keep
  that invariant when adding a mutation.
- A plugin route is one HTTP proxy profile or "follow system". Switch profiles cannot be stored there
  (no provider or workspace to resolve) and SOCKS5 has no request dispatcher; `sanitizeRouting`
  enforces both.
