import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'

import { normalizeState, overlayOf, profileSummary, statePath } from './src/host/profile.js'
import { createTraffic, loadUndici } from './src/host/traffic.js'
import { installSpawnEnv } from './src/host/spawn.js'
import { createHttpSurface } from './src/host/http.js'
import { createWorkspaceLocator } from './src/host/workspace.js'
import { registerProxyTool } from './src/host/tool.js'
import { createSwitchResolver } from './src/host/switch.js'
import { createAgentContext } from './src/host/agent-context.js'

/**
 * ZeroOmega-style proxy routing for DeepSeek Harness.
 *
 * One active profile governs the process:
 * - a proxy profile applies to shell/terminal processes and model requests;
 * - a switch profile picks a result profile per target: provider or workspace;
 * - "system" (no active profile) leaves the Harness process environment alone.
 */

export const name = 'dsh-omega-proxy'
export const inject = ['subprocess', 'webServer', 'agents', 'workspaceRegistry', 'systemPrompt']

const ROUTE = '/proxy-switch'

const als = new AsyncLocalStorage()

const undiciModule = await loadUndici()
if (undiciModule === undefined) {
  console.warn('[dsh-omega-proxy] undici is not resolvable; model and plugin routing are unavailable')
}

export function apply(ctx) {
  let state = loadState()
  const { canonical, workspaces, workspaceForPath, workspaceForAgent } = createWorkspaceLocator(ctx)
  /** A turn is running while any live Session has an open turn. */
  function busyNow() {
    try {
      for (const agent of ctx.agents.list()) {
        const open = ctx.agents.turnBoundaryOf(agent.session)?.openTurnStartSeq
        if (open !== null && open !== undefined) return true
      }
    } catch {}
    return false
  }

  function loadState() {
    try {
      const raw = fs.readFileSync(statePath(), 'utf8')
      return normalizeState(JSON.parse(raw))
    } catch (error) {
      if (error !== null && typeof error === 'object' && error.code !== 'ENOENT') {
        console.warn('[dsh-omega-proxy] ignoring unreadable state file:', error.message ?? error)
      }
      return normalizeState({})
    }
  }

  function saveState() {
    const file = statePath()
    const tmp = `${file}.${process.pid}.tmp`
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
      fs.renameSync(tmp, file)
    } catch (error) {
      console.warn('[dsh-omega-proxy] could not persist state:', error.message ?? error)
    }
  }

  function profileById(id) {
    return state.profiles.find(profile => profile.id === id)
  }

  function findProfile(token) {
    const wanted = String(token ?? '').trim().toLowerCase()
    if (wanted.length === 0) return undefined
    return state.profiles.find(profile => profile.id === wanted)
      ?? state.profiles.find(profile => profile.name.toLowerCase() === wanted)
      ?? state.profiles.find(profile => profile.id.startsWith(wanted) || profile.name.toLowerCase().startsWith(wanted))
  }

  function activeProfile() {
    return state.activeProfile === null ? undefined : profileById(state.activeProfile)
  }

  const { resolveConcrete } = createSwitchResolver({ profileById, canonical })

  function overlayForSpawn(spec) {
    if (spec === null || typeof spec !== 'object') return undefined
    const workspace = typeof spec.cwd === 'string' ? workspaceForPath(spec.cwd) : undefined
    const profile = resolveConcrete(activeProfile(), { workspacePath: workspace?.path })
    if (profile === undefined) return undefined
    return overlayOf(profile)
  }

  function installSubprocessHook() {
    installSpawnEnv({ subprocess: ctx.get('subprocess'), overlayFor: overlayForSpawn, effect: cb => ctx.effect(cb) })
  }

  /** The profile a plugin's own traffic leaves through; saved routes are HTTP profiles only. */
  function pluginProfileFor(owner) {
    const id = state.pluginRouting?.[owner]
    return id === undefined ? undefined : profileById(id)
  }

  const traffic = createTraffic({
    als,
    undici: undiciModule,
    resolveForProvider: provider => resolveConcrete(activeProfile(), { provider }),
    hasPluginRoutes: () => Object.keys(state.pluginRouting ?? {}).length > 0,
    resolveForPlugin: pluginProfileFor,
  })

  function setActiveProfile(id) {
    state.activeProfile = id
    saveState()
    traffic.close()
  }

  const agentContext = createAgentContext({ ctx, activeProfile, workspaceForAgent, resolveConcrete })

  const surface = createHttpSurface({
    ctx,
    route: ROUTE,
    getState: () => state,
    commitState: next => {
      state = next
      saveState()
    },
    setActiveProfile,
    closeTraffic: () => traffic.close(),
    busyNow,
    profileById,
    activeProfile,
    resolveConcrete,
    workspaceForAgent,
    workspaces,
  })

  // ----------------------------------------------------------------- registration

  installSubprocessHook()
  traffic.install()

  ctx.effect(() => () => {
    traffic.dispose()
    traffic.close()
  })

  ctx.on('llm/stream', (options, next) => {
    if (activeProfile() === undefined) return next()
    return traffic.wrapStream({ provider: options.provider }, next)
  }, { global: true })

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: (req, res) => {
        Promise.resolve(surface.handleRoute(req, res)).catch(error => {
          try {
            res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: error?.message ?? String(error) }))
          } catch {}
        })
      },
    })
    return () => dispose()
  })

  const tools = ctx.get('tools')
  if (tools !== undefined && tools !== null) {
    registerProxyTool({
      tools,
      effect: cb => ctx.effect(cb),
      activeProfile,
      findProfile,
      setActiveProfile,
      workspaceForAgent,
      resolveConcrete,
    })
  }

  for (const agent of ctx.agents.list()) agentContext.register(agent)
  ctx.on('agent/created', payload => agentContext.register(payload.agent))
  ctx.on('agent/disposed', payload => agentContext.forget(payload.agent))
  ctx.effect(() => () => agentContext.disposeAll())
}
