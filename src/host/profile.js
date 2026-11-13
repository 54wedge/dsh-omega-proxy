import os from 'node:os'
import path from 'node:path'

/** Profile model, routing rules, and the environment a profile produces. */

/** Bumped when the state file shape changes. */
export const STATE_VERSION = 5

/** The only profile a fresh install starts with; a state file with an empty list stays empty. */
export function seedProfiles() {
  return [
    { id: 'proxy', name: 'proxy', kind: 'http', host: '127.0.0.1', port: 7890, color: '#22c55e' },
  ]
}

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function statePath() {
  return path.join(dshHome(), 'dsh-omega-proxy.json')
}

function slug(value) {
  const base = String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base.length > 0 ? base : 'proxy'
}

function normalizePort(value) {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : undefined
}

export function normalizeProfile(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const kind = raw.kind === 'switch' ? 'switch' : raw.kind === 'socks5' ? 'socks5' : raw.kind === 'http' ? 'http' : undefined
  if (kind === undefined) return undefined
  const id = slug(typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : raw.name)
  const name = String(raw.name ?? id).trim() || id
  const color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color.toLowerCase() : undefined
  if (kind === 'switch') {
    const rules = []
    const seenRules = new Set()
    for (const item of Array.isArray(raw.rules) ? raw.rules : []) {
      if (item === null || typeof item !== 'object') continue
      const type = item.type === 'provider' ? 'provider' : item.type === 'workspace' ? 'workspace' : undefined
      const value = String(item.value ?? '').trim()
      const profile = typeof item.profile === 'string' ? item.profile : ''
      if (type === undefined || value.length === 0 || profile.length === 0) continue
      const key = `${type}:${value.toLowerCase()}`
      if (seenRules.has(key)) continue
      seenRules.add(key)
      rules.push({ type, value, profile })
    }
    const profile = { id, name, kind, rules, ...(color === undefined ? {} : { color }) }
    if (typeof raw.defaultProfile === 'string' && raw.defaultProfile.length > 0) profile.defaultProfile = raw.defaultProfile
    return profile
  }
  const host = String(raw.host ?? '').trim()
  const port = normalizePort(raw.port)
  if (host.length === 0 || port === undefined) return undefined
  const profile = { id, name, kind, host, port, ...(color === undefined ? {} : { color }) }
  if (typeof raw.username === 'string' && raw.username.length > 0) profile.username = raw.username
  if (typeof raw.password === 'string' && raw.password.length > 0) profile.password = raw.password
  if (raw.proxyDns === true) profile.proxyDns = true
  for (const scheme of ['http', 'https', 'socks']) {
    const entry = raw[scheme]
    if (entry === null || typeof entry !== 'object') continue
    const overrideKind = entry.kind === 'socks5' ? 'socks5' : entry.kind === 'http' || entry.kind === 'https' ? 'http' : undefined
    if (overrideKind === undefined) continue
    const overrideHost = String(entry.host ?? '').trim()
    const overridePort = normalizePort(entry.port)
    if (overrideHost.length === 0 || overridePort === undefined) continue
    profile[scheme] = { kind: overrideKind, host: overrideHost, port: overridePort }
  }
  return profile
}

export function normalizeState(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const profiles = []
  const seen = new Set()
  for (const item of Array.isArray(source.profiles) ? source.profiles : []) {
    const profile = normalizeProfile(item)
    if (profile === undefined || seen.has(profile.id)) continue
    seen.add(profile.id)
    profiles.push(profile)
  }
  if (!Array.isArray(source.profiles)) profiles.push(...seedProfiles())
  const known = new Set(profiles.map(profile => profile.id))
  for (const profile of profiles) {
    if (profile.kind !== 'switch') continue
    profile.rules = profile.rules.filter(rule => known.has(rule.profile) && rule.profile !== profile.id)
    if (profile.defaultProfile !== undefined && (!known.has(profile.defaultProfile) || profile.defaultProfile === profile.id)) {
      delete profile.defaultProfile
    }
  }
  const palette = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b']
  profiles.forEach((profile, index) => {
    if (profile.color === undefined) profile.color = palette[index % palette.length]
  })
  const active = typeof source.activeProfile === 'string' && known.has(source.activeProfile) ? source.activeProfile : null
  return { version: STATE_VERSION, profiles, pluginRouting: sanitizeRouting(source.pluginRouting, profiles), activeProfile: active }
}

/**
 * Keep only routes to a live proxy profile: a plugin route must be a single HTTP
 * proxy, because switch resolution needs a provider or workspace and SOCKS5 has
 * no request dispatcher. "Follow system" is the default and is not stored.
 */
export function sanitizeRouting(raw, profiles) {
  const routable = new Set(profiles.filter(profile => profile.kind === 'http').map(profile => profile.id))
  const routing = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return routing
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || !routable.has(value)) continue
    routing[name] = value
  }
  return routing
}

function serverOf(profile, scheme) {
  if (profile === undefined) return undefined
  const override = profile[scheme]
  if (override !== undefined) return override
  return { kind: profile.kind, host: profile.host, port: profile.port }
}

function serverUrl(profile, scheme) {
  const server = serverOf(profile, scheme)
  if (server === undefined) return undefined
  const auth = profile.username !== undefined
    ? `${encodeURIComponent(profile.username)}:${encodeURIComponent(profile.password ?? '')}@`
    : ''
  const protocol = server.kind === 'socks5' ? (profile.proxyDns === true ? 'socks5h' : 'socks5') : 'http'
  return `${protocol}://${auth}${server.host}:${server.port}`
}

export function profileUrl(profile) {
  return serverUrl(profile, 'https') ?? serverUrl(profile, 'http') ?? serverUrl(profile, 'socks')
}

export function profileSummary(profile, lang = 'zh') {
  if (profile.kind === 'switch') {
    const count = profile.rules?.length ?? 0
    return lang === 'zh' ? `分流 · ${count} 条规则` : `switch · ${count} rules`
  }
  const label = profile.kind === 'socks5' ? 'SOCKS5' : 'HTTP'
  return `${label} ${profileUrl(profile)}`
}

export function overlayOf(profile) {
  if (profile === undefined) return undefined
  const http = serverUrl(profile, 'http') ?? serverUrl(profile, 'https') ?? serverUrl(profile, 'socks') ?? ''
  const https = serverUrl(profile, 'https') ?? serverUrl(profile, 'http') ?? serverUrl(profile, 'socks') ?? ''
  const all = serverUrl(profile, 'socks') ?? https ?? http
  return {
    http_proxy: http, https_proxy: https, all_proxy: all,
  }
}

/** Resolve the undici copy the Harness itself runs on. */
