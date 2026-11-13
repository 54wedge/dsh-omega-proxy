import fs from 'node:fs'
import path from 'node:path'

import { STATE_VERSION, dshHome, normalizeProfile, profileSummary, sanitizeRouting } from './profile.js'

/**
 * The plugin's HTTP surface: two read endpoints and two mutations.
 *
 * Payloads are split by consumer — `/state` feeds the header chip, `/settings`
 * feeds the configuration page — so neither carries fields the other needs.
 *
 * @param options.ctx - Host context, for agents, providers and the plugin inventory.
 * @param options.route - URL prefix.
 * @param options.getState - reads the current plugin state.
 * @param options.commitState - replaces the state and persists it.
 * @param options.setActiveProfile - switches the active profile and drops pooled agents.
 * @param options.closeTraffic - closes pooled proxy agents.
 * @param options.busyNow - whether a turn holds the switch lock.
 * @param options.profileById - looks up one profile by id.
 * @param options.activeProfile - reads the active profile.
 * @param options.resolveConcrete - follows switch rules to a concrete profile.
 * @param options.workspaces - lists workspaces for the editor.
 * @returns the request handler.
 */
export function createHttpSurface(options) {
  const {
    ctx,
    route: ROUTE,
    getState,
    commitState,
    setActiveProfile,
    closeTraffic,
    busyNow,
    profileById,
    activeProfile,
    resolveConcrete,
    workspaceForAgent,
    workspaces,
  } = options
  const MAX_BODY_BYTES = 64 * 1024

  function sendJson(res, status, body) {
    const text = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(text),
    })
    res.end(text)
  }

  async function readJson(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) throw new Error('request body too large')
      chunks.push(chunk)
    }
    if (size === 0) return {}
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  }

  function providerDirectory() {
    const modelLlm = ctx.get('llm')
    const entries = new Map()
    try {
      for (const item of modelLlm?.listProviders?.() ?? []) {
        entries.set(item.id, { id: item.id, name: item.name ?? item.id })
      }
    } catch {}
    return [...entries.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  function publicProfile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
      color: profile.color ?? null,
      host: profile.host,
      port: profile.port,
      proxyDns: profile.proxyDns === true,
      servers: {
        default: profile.kind === 'switch' ? null : { kind: profile.kind, host: profile.host, port: profile.port },
        http: profile.http ?? null,
        https: profile.https ?? null,
        socks: profile.socks ?? null,
      },
      rules: profile.kind === 'switch' ? (profile.rules ?? []) : [],
      defaultProfile: profile.defaultProfile ?? null,
    }
  }

  /** The provider this session will use, from its model-selection projection. */
  async function providerForSession(sessionId) {
    try {
      const controller = ctx.get('sessionController')
      if (controller === undefined || typeof controller.projections !== 'function') return undefined
      const result = await controller.projections({ sessionId }, AbortSignal.timeout(2000))
      const selection = result?.values?.modelSelection
      const provider = selection?.next?.provider ?? selection?.lastUsed?.provider
      return typeof provider === 'string' ? provider : undefined
    } catch {
      return undefined
    }
  }

  async function resolutionFor(sessionId, providerOverride) {
    const profile = activeProfile()
    if (profile === undefined || profile.kind !== 'switch') return null
    let agent
    try {
      agent = typeof sessionId === 'string' && sessionId.length > 0 ? ctx.agents.get(sessionId) : undefined
    } catch {}
    const workspace = agent === undefined ? undefined : workspaceForAgent(agent)
    const provider = typeof providerOverride === 'string' && providerOverride.length > 0
      ? providerOverride
      : await providerForSession(sessionId)
    const resolved = resolveConcrete(profile, { provider, workspacePath: workspace?.path })
    return {
      workspace: workspace === undefined ? null : workspace.title,
      provider: typeof provider === 'string' ? provider : null,
      profile: resolved === undefined ? null : { id: resolved.id, name: resolved.name, color: resolved.color ?? null },
    }
  }

  /** What the header chip needs for one profile. */
  function profileChip(profile) {
    return {
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
      color: profile.color ?? null,
      summary: profileSummary(profile, 'zh'),
      defaultProfile: profile.defaultProfile ?? null,
    }
  }

  async function statePayload(sessionId, providerOverride) {
    const profile = activeProfile()
    return {
      ok: true,
      busy: busyNow(),
      active: getState().activeProfile,
      activeProfile: profile === undefined ? null : profileChip(profile),
      resolution: await resolutionFor(sessionId, providerOverride),
      profiles: getState().profiles.map(profileChip),
    }
  }

  /** Enabled Loader entries that own a Host half; client-only packages cannot fetch. */
  async function installedPlugins() {
    let entries = []
    try {
      entries = (await ctx.get('pluginInventory')?.list())?.entries ?? []
    } catch {}
    const seen = new Set()
    const plugins = []
    for (const entry of entries) {
      if (entry?.enabled !== true || entry.fiberPhase !== 'active') continue
      const moduleName = entry.moduleName
      if (typeof moduleName !== 'string' || moduleName.length === 0) continue
      if (moduleName === 'dsh-omega-proxy' || moduleName.includes(':') || moduleName.startsWith('@deepseek-ai/dsh-client-')) continue
      if (seen.has(moduleName)) continue
      seen.add(moduleName)
      plugins.push({ name: moduleName, label: typeof entry.meta?.title === 'string' ? entry.meta.title : moduleName })
    }
    const shipped = value => value.startsWith('@deepseek-ai/')
    plugins.sort((left, right) => Number(shipped(left.name)) - Number(shipped(right.name)) || left.name.localeCompare(right.name))
    return plugins
  }

  async function settingsPayload() {
    return {
      ok: true,
      busy: busyNow(),
      active: getState().activeProfile,
      plugins: await installedPlugins(),
      pluginRouting: { ...(getState().pluginRouting ?? {}) },
      profiles: getState().profiles.map(profile => ({
        ...publicProfile(profile),
        username: profile.username ?? '',
        hasPassword: typeof profile.password === 'string' && profile.password.length > 0,
      })),
      providers: providerDirectory(),
      workspaces: workspaces().map(workspace => ({ id: workspace.id, title: workspace.title, path: workspace.path })),
    }
  }

  async function handleRoute(req, res) {
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      sendJson(res, 403, { ok: false, error: 'cross-site request refused' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const route = url.pathname.slice(ROUTE.length) || '/'

    if (req.method === 'GET' && route === '/state') {
      sendJson(res, 200, await statePayload(
        url.searchParams.get('sessionId') ?? undefined,
        url.searchParams.get('provider') ?? undefined,
      ))
      return
    }

    if (req.method === 'GET' && route === '/settings') {
      sendJson(res, 200, await settingsPayload())
      return
    }

    if (route === '/log') {
      const logFile = path.join(dshHome(), 'dsh-omega-proxy.log')
      if (req.method === 'GET') {
        let lines = []
        try {
          lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-80)
        } catch {}
        sendJson(res, 200, { ok: true, lines })
        return
      }
      try {
        const body = await readJson(req)
        fs.appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...body })}\n`)
      } catch {}
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return
    }

    const body = await readJson(req)

    if (route === '/active') {
      if (busyNow()) {
        sendJson(res, 409, { ok: false, error: 'conversation in progress; switch after it finishes' })
        return
      }
      const id = body.profileId === null || body.profileId === undefined ? null : String(body.profileId)
      if (id !== null && profileById(id) === undefined) {
        sendJson(res, 404, { ok: false, error: `unknown profile: ${id}` })
        return
      }
      setActiveProfile(id)
      sendJson(res, 200, await statePayload())
      return
    }

    if (route === '/settings') {
      if (busyNow()) {
        sendJson(res, 409, { ok: false, error: 'conversation in progress; change settings after it finishes' })
        return
      }
      const incoming = Array.isArray(body.profiles) ? body.profiles : []
      const nextProfiles = []
      const names = new Set()
      const ids = new Set()
      for (const item of incoming) {
        const profile = normalizeProfile(item)
        if (profile === undefined) {
          sendJson(res, 400, { ok: false, error: 'invalid profile entry', profileId: item?.id ?? null })
          return
        }
        const lowered = profile.name.toLowerCase()
        if (names.has(lowered)) {
          sendJson(res, 400, { ok: false, error: `duplicate profile name: ${profile.name}` })
          return
        }
        if (ids.has(profile.id)) continue
        names.add(lowered)
        ids.add(profile.id)
        const previous = profileById(profile.id)
        if (previous !== undefined && item.password === undefined && typeof previous.password === 'string') {
          profile.password = previous.password
        }
        if (item.password !== undefined && String(item.password).length === 0) delete profile.password
        nextProfiles.push(profile)
      }
      const knownIds = new Set(nextProfiles.map(profile => profile.id))
      for (const profile of nextProfiles) {
        if (profile.kind !== 'switch') continue
        profile.rules = (profile.rules ?? []).filter(rule => knownIds.has(rule.profile) && rule.profile !== profile.id)
        if (profile.defaultProfile !== undefined && (!knownIds.has(profile.defaultProfile) || profile.defaultProfile === profile.id)) {
          delete profile.defaultProfile
        }
      }
      const active = typeof body.active === 'string' && knownIds.has(body.active) ? body.active : null
      const pluginRouting = body.pluginRouting === undefined
        ? (getState().pluginRouting ?? {})
        : sanitizeRouting(body.pluginRouting, nextProfiles)
      commitState({ version: STATE_VERSION, profiles: nextProfiles, pluginRouting, activeProfile: active })
      closeTraffic()
      sendJson(res, 200, await settingsPayload())
      return
    }

    sendJson(res, 404, { ok: false, error: 'unknown endpoint' })
  }


  return { handleRoute }
}
