# Architecture

How `dsh-omega-proxy` is put together, and why it is split the way it is.

## Scope

The plugin owns one thing: deciding which proxy a piece of traffic leaves through, and applying that
decision. It stores profiles, resolves switch rules, and rewrites three kinds of outbound traffic. It
does not proxy anything itself, does not intercept TLS, and makes no network requests of its own.

## Two halves

| Half | Entry | Role |
|---|---|---|
| Host | `index.js` | holds state, registers a web route, wraps `fetch` and subprocess spawning, registers a tool and a prompt section |
| Client | `client.js` | mounts a chip in the conversation header and New Session row, and a settings section |

The Host half runs in the Harness process. The Client half is a single browser bundle served by the
module loader; it talks to the Host only through `/proxy-switch` JSON endpoints.

## Modules

```
index.js                  wiring: state reads/writes, switch lock, event subscriptions
src/host/profile.js       profile model, state normalization, server URL and env derivation
src/host/switch.js        rule matching, switch resolution with a depth bound
src/host/http.js          HTTP surface and the two payload projections
src/host/traffic.js       undici resolution, dispatcher pool, fetch shim, stream scope
src/host/spawn.js         child-process environment injection
src/host/workspace.js     directory → owning workspace
src/host/tool.js          model-facing `proxy` tool
src/host/agent-context.js per-agent system-prompt section
src/client/runtime.js     React, official primitives, identifiers
src/client/strings.js     locale dictionaries
src/client/api.js         HTTP client, slot error boundary
src/client/chip.js        header chip and its menu
src/client/settings.js    settings page (profiles tab, plugins tab)
src/client/dialog.js      profile editor
src/client/cards.js       list rows
src/client/controls.js    Select, colour swatches
src/client/model.js       draft conversions, summaries
src/client/styles.js      stylesheet
src/client/localize.js    t from slot props
src/client/entry.js       slot registrations, apply()
```

Every Host module receives what it needs as a parameter; none of them reaches into `index.js`. That is
why `createHttpSurface`, `createTraffic`, `createSwitchResolver`, `createWorkspaceLocator`,
`createAgentContext` and `registerProxyTool` take option objects: the wiring in `index.js` is the only
place that knows about all of them.

Client modules share one factory scope, so they are ordered by the build script rather than imported.
That is a platform constraint, not a design choice.

## State

`$DSH_HOME/dsh-omega-proxy.json`, version 5:

```
{
  version: 5,
  activeProfile: string | null,          // null = follow system
  pluginRouting: { [package]: profileId },     // HTTP profiles only; absent = follow system
  profiles: Profile[]
}

Profile =
  | { id, name, kind: 'http' | 'socks5', host, port, username?, password?, proxyDns?, color?,
      http?, https?, socks? }            // per-scheme overrides
  | { id, name, kind: 'switch', color?, rules: Rule[], defaultProfile? }

Rule = { type: 'provider' | 'workspace', value: string, profile: profileId }
```

`normalizeState` is the only writer of this shape. It drops unknown kinds, duplicate ids, rules that
point at missing profiles and duplicate conditions, and assigns a colour when one is missing. A file
without a `profiles` field gets the single default profile; an explicit empty list stays empty.

## Traffic

Three paths, one resolver.

```
shell spawn ──► overlayForSpawn(spec)
                   workspaceForPath(spec.cwd) ─┐
                   resolveConcrete(active) ────┴─► { http_proxy, https_proxy, all_proxy }

llm/stream ────► als.run({ provider })
                   fetch inside scope ──► resolveConcrete(active, { provider }) ──► ProxyAgent

other fetch ───► call stack → node_modules/<pkg>
                   pluginRouting[pkg] ──► profileById(...) ──► ProxyAgent
```

`resolveConcrete` reads the current state on every call, so a saved change applies to the next
request. Requests already in flight keep the dispatcher they started with; child processes keep the
environment they were spawned with.

Undici is resolved from the Host entry point, never declared as a dependency. A SOCKS5 profile cannot
produce a dispatcher, so it only participates in the shell path.

## HTTP surface

| Route | Purpose |
|---|---|
| `GET /state` | chip: `busy`, `active`, active profile, resolution for a session/provider, profile list |
| `GET /settings` | page: full profiles, providers, workspaces, plugins, routing, `busy` |
| `POST /active` | switch the active profile |
| `POST /settings` | replace profiles and plugin routing |
| `GET|POST /log` | client diagnostics appended to `$DSH_HOME/dsh-omega-proxy.log` |

The two payloads are deliberately different projections of the same state: the chip needs six fields
per profile, the page needs the editable shape. Neither carries password material.

The HTTP layer never derives the session's provider from the client's word alone for authorization —
it is only a routing hint; the requested session id and the Host state decide what exists.

## Lock semantics

A turn is open when any live session reports an open turn (`turnBoundaryOf().openTurnStartSeq`).
While that holds:

- `POST /active` returns 409,
- `POST /settings` returns 409,
- the chip menu items are disabled,
- every settings control is disabled and the page shows a warning with the same reason.

The client mirrors the lock from `busy` in both payloads, but the Host check is authoritative: a save
racing a turn start fails instead of applying halfway.

## Registration and teardown

`apply()` registers everything through `ctx.effect` or events, so unloading withdraws it:

- `ctx.effect` → web route, tool, prompt sections, fetch shim and subprocess wrappers restore,
- `ctx.on('llm/stream')` → provider scope,
- `ctx.on('agent/created' | 'agent/disposed')` → prompt sections per agent.

The only two global mutations are the `fetch` property and the two subprocess methods; both are
restored with the exact original descriptor.

## Client rendering

- Chip: `conversation.session.header.utilities` (order −20) and `conversation.hero.options`.
- Settings: `settings.section`, rendering its own heading and two tabs.
- Text: dictionaries registered with `ctx.locale.register`, read through the slot-provided `t`.
- Controls: the official primitives (`Menu`, `Button`, `Input`, `Switch`, `Pill`, icons) so the page
  matches built-in settings without a parallel design system.

Errors thrown while rendering are caught by a slot boundary and written to the diagnostics log; a
broken slot disappears instead of taking the page down.

## Build

`client.js` is generated: `scripts/build-client.mjs` concatenates `src/client/*.js` in the order
declared in that script, wraps them in the lazy-CJS factory the loader expects, and `npm run check`
fails when the committed bundle is stale. The bundle is committed because git installs do not run a
build step.

## Adding a surface

1. Put the logic in a Host module that takes its dependencies as arguments.
2. Wire it in `index.js` with `ctx.effect` so unloading withdraws it.
3. Add the field the client needs to the payload that belongs to it (`/state` for the chip,
   `/settings` for the page) — do not widen the other one.
4. Register the slot with `locale` and read text through `t`.
