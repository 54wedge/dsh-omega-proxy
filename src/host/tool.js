import { profileSummary } from './profile.js'

const FOLLOW_SYSTEM = 'Active profile: system (follow the Harness process environment).'

/**
 * Register the model-facing `proxy` tool.
 *
 * It reports the active profile — and, for a switch profile, what this
 * workspace resolves to — or switches the active profile. Switching uses the
 * same helper as the HTTP endpoint, so both paths share one state transition.
 *
 * @param options.tools - the Host tool registry.
 * @param options.effect - registers the tool with the plugin fiber.
 * @param options.activeProfile - reads the active profile.
 * @param options.findProfile - resolves a profile id, name, or prefix.
 * @param options.setActiveProfile - switches the active profile.
 * @param options.workspaceForAgent - the workspace owning an agent's cwd.
 * @param options.resolveConcrete - follows switch rules to a concrete profile.
 */
export function registerProxyTool(options) {
  const { tools, effect, activeProfile, findProfile, setActiveProfile, workspaceForAgent, resolveConcrete } = options
  effect(() => tools.register({
    name: 'proxy',
    description: 'Report or switch the active proxy profile. A switch profile routes by provider or workspace; shell commands inherit the resolved proxy automatically.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['status', 'use'], description: 'status reports the active profile; use switches it.' },
        profile: { type: 'string', description: 'Profile id or name, or "system" for the process environment.' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    },
    async execute(args, exec) {
      if (args?.action === 'use') {
        const token = args?.profile
        if (token === undefined || String(token).toLowerCase() === 'system') {
          setActiveProfile(null)
          return { text: FOLLOW_SYSTEM }
        }
        const profile = findProfile(token)
        if (profile === undefined) return { text: `Unknown profile "${String(token)}".` }
        setActiveProfile(profile.id)
        return { text: `Active profile: ${profile.name} (${profileSummary(profile, 'en')}).` }
      }
      const profile = activeProfile()
      if (profile === undefined) return { text: FOLLOW_SYSTEM }
      const workspace = workspaceForAgent(exec.agent)
      const resolved = resolveConcrete(profile, { workspacePath: workspace?.path })
      const lines = [`Active profile: ${profile.name} (${profileSummary(profile, 'en')}).`]
      if (profile.kind === 'switch') {
        lines.push(`This workspace resolves to ${resolved === undefined ? 'system' : profileSummary(resolved, 'en')}.`)
      }
      return { text: lines.join(' ') }
    },
  }))
}
