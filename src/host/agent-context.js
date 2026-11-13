import { profileSummary } from './profile.js'

/**
 * Tell each running agent which route its shell commands already use.
 *
 * The section exists only while the agent lives and emits nothing when the
 * active profile is "follow system", so an inert switch adds no prompt text.
 *
 * @param options.ctx - Host context.
 * @param options.activeProfile - reads the active profile.
 * @param options.workspaceForAgent - the workspace owning an agent's cwd.
 * @param options.resolveConcrete - follows switch rules to a concrete profile.
 * @returns register, forget, disposeAll.
 */
export function createAgentContext(options) {
  const { ctx, activeProfile, workspaceForAgent, resolveConcrete } = options
  const disposers = new Map()

  function promptFor(agent) {
    const profile = activeProfile()
    if (profile === undefined) return ''
    const workspace = workspaceForAgent(agent)
    const resolved = resolveConcrete(profile, { workspacePath: workspace?.path })
    const routing = profile.kind === 'switch'
      ? `switching (${resolved === undefined ? 'system' : profileSummary(resolved, 'en')})`
      : resolved === undefined ? 'system' : profileSummary(resolved, 'en')
    return `Proxy: the active profile is ${profile.name} — ${routing}. Shell and terminal processes already carry http_proxy, https_proxy and all_proxy when a proxy applies, so do not add proxy flags to commands. The \`proxy\` tool reports or switches the active profile.`
  }

  function register(agent) {
    if (agent === undefined || disposers.has(agent.id)) return
    try {
      const disposer = agent.ctx.effect(() => {
        const remove = agent.ctx.systemPrompt.context({
          name: 'dsh-omega-proxy',
          order: 900,
          text: () => promptFor(agent),
        })
        return () => remove()
      })
      disposers.set(agent.id, disposer)
    } catch (error) {
      console.warn('[dsh-omega-proxy] could not register prompt context:', error?.message ?? error)
    }
  }

  function forget(agent) {
    const disposer = disposers.get(agent?.id)
    if (disposer === undefined) return
    disposers.delete(agent.id)
    try {
      disposer()
    } catch {}
  }

  function disposeAll() {
    for (const disposer of disposers.values()) {
      try {
        disposer()
      } catch {}
    }
    disposers.clear()
  }

  return { register, forget, disposeAll }
}
