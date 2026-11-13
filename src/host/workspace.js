import fs from 'node:fs'
import path from 'node:path'

/**
 * Map a directory to the workspace that owns it.
 *
 * Workspace strings are compared through their real path so a symlinked cwd and
 * its target count as the same workspace. The locator owns that cache; callers
 * only see directories and workspace records.
 *
 * @param ctx - Host context with the workspace registry.
 * @returns canonical, workspaces, workspaceForPath, workspaceForAgent.
 */
export function createWorkspaceLocator(ctx) {
  const cache = new Map()

  function canonical(target) {
    if (typeof target !== 'string' || target.length === 0) return ''
    const resolved = path.resolve(target)
    const cached = cache.get(resolved)
    if (cached !== undefined) return cached
    let out = resolved
    try {
      out = fs.realpathSync(resolved)
    } catch {}
    if (cache.size > 256) cache.clear()
    cache.set(resolved, out)
    return out
  }

  function workspaces() {
    try {
      return ctx.workspaceRegistry.list()
    } catch {
      return []
    }
  }

  /** The deepest registered workspace that contains the directory. */
  function workspaceForPath(target) {
    const wanted = canonical(target)
    if (wanted.length === 0) return undefined
    let best
    for (const workspace of workspaces()) {
      const root = canonical(workspace.path)
      if (root.length === 0) continue
      if (wanted !== root && !wanted.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) continue
      if (best === undefined || root.length > best.root.length) best = { workspace, root }
    }
    return best?.workspace
  }

  function cwdOf(agent) {
    if (agent === undefined) return undefined
    try {
      const workingDirectory = ctx.get('workingDirectory')
      const current = workingDirectory?.get(agent.session)
      if (typeof current === 'string' && current.length > 0) return current
    } catch {}
    const header = agent.session?.header
    return typeof header?.cwd === 'string' ? header.cwd : undefined
  }

  function workspaceForAgent(agent) {
    const cwd = cwdOf(agent)
    return cwd === undefined ? undefined : workspaceForPath(cwd)
  }

  return { canonical, workspaces, workspaceForPath, workspaceForAgent }
}
