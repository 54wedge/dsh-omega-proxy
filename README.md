# dsh-omega-proxy

ZeroOmega-style proxy routing for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
One active profile drives shell commands, terminals and model requests; switch profiles route by
provider or workspace; every enabled Host plugin can be given its own route.

[中文说明](README.zh.md) · [Architecture](ARCHITECTURE.md)

## What it does

- **One active profile.** Pick it in the header chip. It applies to every shell command, terminal
  session and model request that starts afterwards.
- **Switch profiles.** Rules are evaluated top to bottom and the first match wins. A rule matches a
  `provider` or a `workspace`, and the value is picked from a list rather than typed. A condition can
  appear only once. The fallback is either "follow system" or another profile.
- **Per-plugin routes.** Settings lists every enabled Host plugin; each one can be set to
  `follow system` or an HTTP proxy profile. Switch and SOCKS5 profiles are not offered: a plugin
  request has no provider or workspace to resolve, and SOCKS5 has no request dispatcher.
- **No switching mid-turn.** While a turn is open the menu entries grey out and the Host rejects a
  switch request, so a running conversation never changes route underneath itself.
- **Three environment variables, lowercase only.** Child processes receive `http_proxy`,
  `https_proxy` and `all_proxy`. No uppercase variants and no `NO_PROXY` are written. With no active
  profile, no variable is injected at all.

## Install

A bundle is installed into a profile. With the CLI:

```sh
# from a local checkout (linked into the profile)
dsh plugin --profile desktop add /path/to/dsh-omega-proxy

# from a packed tarball (no network, no build step)
dsh plugin --profile desktop add ./dsh-omega-proxy-0.1.0.tgz

# from GitHub
dsh plugin --profile desktop add github:54wedge/dsh-omega-proxy
```

The GitHub form pulls the repository as-is. This package commits its built `client.js`, so no
install-time build runs and no build authorization is required. Prefer pinning a commit so a later
push cannot change what you run: `github:YOUR-NAME/dsh-omega-proxy#<sha>`.

Restart the profile after installing. A fresh install starts with a single profile pointing at
`127.0.0.1:7890`; everything else is yours to configure.

## Use

- **Header chip** — in the right-hand utilities, left of the "open in app" control. It shows the
  active profile; the menu lists "follow system" plus your profiles. A switch profile also shows what
  it resolves to for the current session.
- **New Session row** — the same chip sits at the right end of the workspace/preset row.
- **Settings → Proxy** — two tabs:
  - *Profiles*: add, edit, delete. The editor holds name, type (proxy server / switch), colour, four
    server rows (`(default)` / `http` / `https` / `socks`), a "resolve DNS through SOCKS" toggle and
    optional user/password. Switch profiles add a rule list and a fallback. Every change saves
    immediately. While a turn is open the whole page is locked — the same lock that blocks switching —
    and a warning explains why; there is no Apply button.
  - *Plugins*: one row per enabled Host plugin, with its route on the right.

Dot meaning: filled = proxy profile; ring = switch profile, where the ring is the profile's own
colour and the centre is the colour of the profile it resolves to (grey means "follow system").

## How routing works

| Traffic | Route |
|---|---|
| shell / terminal | `subprocess.spawn` and `spawnTerminal` are wrapped; the child's `cwd` selects the workspace, and the resolved profile's three variables are merged into `env` |
| model requests | the `llm/stream` hook records the request's provider in an `AsyncLocalStorage` scope; `fetch` calls inside that scope use a `ProxyAgent` for the profile the provider resolves to |
| plugin requests | outside a provider scope the call stack identifies the calling npm package; a package with a route uses that profile's agent, everything else passes through untouched |

Switching or saving closes cached `ProxyAgent` instances so old connections are not reused.

## State and API

`$DSH_HOME/dsh-omega-proxy.json` (`version: 5`):

```json
{
  "version": 5,
  "activeProfile": "auto",
  "pluginRouting": { "some-package": "proxy" },
  "profiles": [
    { "id": "proxy", "name": "proxy", "kind": "http", "host": "127.0.0.1", "port": 7890, "color": "#22c55e" },
    { "id": "auto", "name": "auto", "kind": "switch", "color": "#3b82f6",
      "rules": [{ "type": "provider", "value": "relay", "profile": "proxy" }] }
  ]
}
```

HTTP routes under `/proxy-switch`: `GET /state` for the chip, `GET /settings` for the settings page,
`POST /active` to switch, `POST /settings` to save, `GET|POST /log` for client diagnostics.

The model-facing `proxy` tool reports the active profile and, for a switch profile, what the current
workspace resolves to; `use` switches it. A system-prompt section states the same route and notes that
proxy variables are already present, so the model does not add proxy flags to commands.

## Compatibility

Tested with **DeepSeek Harness 0.2.1-rc.4** on macOS. The plugin declares no `engines.dsh` range; it
works against the interfaces below, which are the surfaces a Harness upgrade could move.

| Surface | Used for |
|---|---|
| `subprocess.spawn` / `spawnTerminal` | inject the proxy variables (`src/host/spawn.js`) |
| `globalThis.fetch` | reroute model and plugin traffic (`src/host/traffic.js`) |
| `llm/stream` | learn the request's provider |
| `agents.list` / `turnBoundaryOf` | detect an open turn |
| `sessionController.projections` → `modelSelection` | resolve when the caller sends no provider |
| `webServer.register` | serve `/proxy-switch` |
| `pluginInventory.list` | list enabled Host plugins |
| slots `conversation.session.header.utilities`, `conversation.hero.options`, `settings.section` | mount points |
| client service `modelDirectories` | read the model picked but not yet sent |
| client module `@deepseek-ai/dsh-client-ui-primitives` | Menu, Button, Input, Switch, Pill, icons |

`fetch` and the two `subprocess` methods are monkey-patched while the plugin is loaded and restored
when it unloads; everything else is ordinary registration.

## Network, privacy and security

What this plugin does on its own network:

- It makes **no requests of its own**. No telemetry, no analytics, no update check, no remote
  configuration. It only changes where requests that the Harness already makes are sent.
- It does not read, buffer or log request or response bodies. The rewrite adds a dispatcher to the
  request; it never inspects payloads.
- The diagnostics log (`$DSH_HOME/dsh-omega-proxy.log`, also `GET /proxy-switch/log`) records
  client-side lifecycle events such as "bundle applied" or a render error, with a short detail string.
  It contains no URLs, headers or credentials.

What your proxy can see:

- For plain `http://` requests the proxy sees the full request, including headers and body.
- For `https://` requests the proxy sees the destination host and port from `CONNECT`; the payload
  stays encrypted unless something else terminates TLS. This plugin performs no TLS interception.
- Credentials embedded in a proxy URL are sent to that proxy. Prefer a loopback proxy or one you
  control, and do not point a route at an untrusted endpoint.

Credentials and local access:

- A profile password is stored **in plaintext** in `$DSH_HOME/dsh-omega-proxy.json`, next to your other
  Harness state. Do not commit that file; keep the directory readable only by your user.
- The HTTP API never returns passwords: the settings payload carries `hasPassword`, not the secret.
  Leaving the password field empty keeps the stored value; typing one replaces it.
- The API is served by the Harness web server (loopback by default) and rejects cross-site requests
  via `sec-fetch-site`. Anyone who can reach that loopback port and act as the same origin can switch
  profiles.

Behavior worth knowing before you trust a route:

- Rerouting is process-wide while active. A profile pointing at a proxy you do not trust can see the
  destinations of all traffic it carries.
- Plugin attribution reads the **call stack** to find an owning package. It is a heuristic: requests
  made through helper modules, workers or a package that replaced `fetch` itself may be attributed
  differently or not at all.
- The plugin changes global behavior (`fetch`, subprocess spawning) while loaded. If it fails to
  unload cleanly, restart the Harness rather than assuming the original functions are back.
- A profile whose proxy is down makes the affected network operations fail until you switch back to
  "follow system".

## Known limits

- SOCKS5 profiles apply to shell and terminal only: request routing needs an HTTP `CONNECT` proxy, so
  SOCKS5 is not offered in the plugin route list.
- A plugin route must be a single HTTP proxy. Switch profiles are not offered there either — routing
  them would need a provider or workspace that a plugin request does not carry.
- Packages that install their own HTTP client or swap `fetch` are out of reach.
- Code paths that resolve a proxy from the environment themselves are out of reach.
- WebSocket traffic is not rerouted.

## Development

```
index.js                  Host entry: wiring, state, switch lock
src/host/profile.js       profile model, resolved environment, state shape
src/host/switch.js        rule matching and switch resolution
src/host/http.js          /state /settings /active /log
src/host/traffic.js       undici resolution, fetch shim, agent pool, stream scope
src/host/spawn.js         child-process environment
src/host/workspace.js     directory → owning workspace
src/host/tool.js          the model-facing proxy tool
src/host/agent-context.js per-agent system-prompt section
src/client/*.js           client sources (one shared factory scope)
client.js                 generated single-file bundle
scripts/build-client.mjs  concatenates src/client/*.js into client.js
```

The module loader accepts one `client.js` per package and exposes only shared modules (`react`, the UI
primitives, …), so the client sources are plain declarations concatenated in the order listed in the
build script.

```sh
npm run build   # regenerate client.js
npm run check   # syntax check + verify client.js is current
```

## License

MIT
