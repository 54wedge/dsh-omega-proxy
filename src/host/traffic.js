import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { profileUrl } from './profile.js'

/** This package's directory, used to skip our own frames when reading a call stack. */
const SELF_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve the undici copy the Harness itself runs on.
 *
 * The plugin ships no dependency: it first tries a copy installed beside it,
 * then the copy the Host entry point already loaded.
 */
export async function loadUndici() {
  try {
    const local = await import('undici')
    if (local !== null && local !== undefined) return local
  } catch {}
  try {
    const entry = typeof process.argv[1] === 'string' ? process.argv[1] : process.cwd()
    const fromEntry = createRequire(path.join(entry, 'index.js'))
    return await import(pathToFileURL(fromEntry.resolve('undici')).href)
  } catch {
    return undefined
  }
}

/**
 * Route outbound `fetch` calls through the active profile.
 *
 * @param options.als - async-local storage carrying the provider of an LLM stream.
 * @param options.undici - the resolved undici module, or undefined.
 * @param options.resolveForProvider - concrete profile for one provider, or undefined.
 * @param options.hasPluginRoutes - whether any package route is configured.
 * @param options.resolveForPlugin - concrete profile for one package name, or undefined.
 * @returns install/dispose/close/wrapStream.
 */
export function createTraffic({ als, undici, resolveForProvider, resolveForPlugin, hasPluginRoutes }) {
  const agents = new Map()
  const owners = new Map()
  let shim = null

  function dispatcherFor(profile) {
    const url = profileUrl(profile)
    const key = `${profile.id}|${url ?? ''}`
    let agent = agents.get(key)
    if (agent === undefined) {
      agent = new undici.ProxyAgent({ uri: url })
      agents.set(key, agent)
    }
    return agent
  }

  function close() {
    for (const agent of agents.values()) {
      try {
        agent.close?.().catch?.(() => {})
      } catch {}
    }
    agents.clear()
  }

  /** The installed package that made this call, read from the synchronous stack. */
  function ownerOfCall() {
    const stack = new Error().stack
    if (typeof stack !== 'string') return undefined
    for (const line of stack.split('\n')) {
      const cached = owners.get(line)
      if (cached !== undefined) return cached
      if (line.includes(SELF_DIR) || line.includes('node:internal')) continue
      const match = /node_modules[\\/]((?:@[^\/\s]+\/)?[^\/\s]+)[\\/]/.exec(line)
      if (match === null) continue
      if (owners.size < 512) owners.set(line, match[1])
      return match[1]
    }
    return undefined
  }

  function dispatcherForCall() {
    if (undici === undefined) return undefined
    const store = als.getStore()
    const provider = typeof store?.provider === 'string' ? store.provider : undefined
    let profile
    if (provider !== undefined) {
      profile = resolveForProvider(provider)
    } else {
      if (!hasPluginRoutes()) return undefined
      const owner = ownerOfCall()
      if (owner === undefined) return undefined
      profile = resolveForPlugin(owner)
    }
    if (profile === undefined || profile.kind === 'socks5') return undefined
    return dispatcherFor(profile)
  }

  function install() {
    if (undici === undefined || shim !== null) return
    const original = globalThis.fetch
    if (typeof original !== 'function') return
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
    const routed = function routedFetch(input, init) {
      if (typeof input !== 'string' && !(input instanceof URL)) {
        return original.call(globalThis, input, init)
      }
      const dispatcher = dispatcherForCall()
      if (dispatcher === undefined) return original.call(globalThis, input, init)
      return undici.fetch(input, { ...(init ?? {}), dispatcher })
    }
    try {
      Object.defineProperty(globalThis, 'fetch', {
        ...(descriptor ?? { configurable: true, enumerable: true, writable: true }),
        value: routed,
      })
      shim = { original, routed, descriptor }
    } catch (error) {
      console.warn('[dsh-omega-proxy] could not install the fetch shim:', error?.message ?? error)
    }
  }

  function dispose() {
    if (shim === null) return
    if (globalThis.fetch === shim.routed) {
      try {
        if (shim.descriptor === undefined) delete globalThis.fetch
        else Object.defineProperty(globalThis, 'fetch', shim.descriptor)
      } catch {}
    }
    shim = null
  }

  /** Keep one provider in scope across a streamed response's async iteration. */
  function wrapStream(store, factory) {
    return {
      [Symbol.asyncIterator]() {
        let iterator
        const ensure = () => {
          if (iterator !== undefined) return iterator
          const iterable = factory()
          if (iterable === null || typeof iterable?.[Symbol.asyncIterator] !== 'function') {
            throw new TypeError('dsh-omega-proxy: llm/stream next() did not return an AsyncIterable')
          }
          iterator = iterable[Symbol.asyncIterator]()
          return iterator
        }
        const invoke = (method, value) => als.run(store, () => {
          if (method === 'return' && iterator === undefined) return Promise.resolve({ done: true, value })
          if (method === 'throw' && iterator === undefined) return Promise.reject(value)
          const target = ensure()
          const operation = target[method]
          if (typeof operation !== 'function') {
            if (method === 'return') return Promise.resolve({ done: true, value })
            return Promise.reject(value)
          }
          return operation.call(target, value)
        })
        return {
          next: value => invoke('next', value),
          return: value => invoke('return', value),
          throw: error => invoke('throw', error),
          [Symbol.asyncIterator]() {
            return this
          },
        }
      },
    }
  }

  return { close, dispose, install, wrapStream }
}
