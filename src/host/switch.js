/**
 * Follow switch rules to a concrete proxy profile.
 *
 * Rules are evaluated top to bottom; the first match wins, and the chosen
 * profile may itself be a switch profile. Depth is bounded so a cycle in the
 * editor falls back to "follow system" instead of recursing forever.
 *
 * @param options.profileById - looks up one profile by id.
 * @param options.canonical - resolves a path to its real path for comparison.
 * @returns resolveConcrete(profile, context).
 */
export function createSwitchResolver({ profileById, canonical }) {
  function matches(rule, context) {
    if (rule.type === 'provider') {
      return typeof context?.provider === 'string' && context.provider.toLowerCase() === rule.value.toLowerCase()
    }
    if (typeof context?.workspacePath !== 'string' || context.workspacePath.length === 0) return false
    return canonical(context.workspacePath) === canonical(rule.value)
  }

  function resolveConcrete(profile, context = {}, depth = 0) {
    if (profile === undefined || depth > 6) return undefined
    if (profile.kind !== 'switch') return profile
    for (const rule of profile.rules ?? []) {
      if (!matches(rule, context)) continue
      const target = resolveConcrete(profileById(rule.profile), context, depth + 1)
      if (target !== undefined) return target
    }
    if (profile.defaultProfile === undefined) return undefined
    return resolveConcrete(profileById(profile.defaultProfile), context, depth + 1)
  }

  return { resolveConcrete }
}
