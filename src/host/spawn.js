/**
 * Merge the active profile's proxy variables into every child process.
 *
 * The subprocess seam takes an explicit `env` per spec and has no middleware
 * point, so both spawn primitives are wrapped while this plugin is loaded and
 * restored on unload. A spec whose resolved profile is "follow system" is
 * passed through untouched.
 *
 * @param options.subprocess - the Host subprocess service.
 * @param options.overlayFor - resolves one spawn spec to an env overlay, or undefined.
 * @param options.effect - registers the restore step with the plugin fiber.
 */
export function installSpawnEnv({ subprocess, overlayFor, effect }) {
  if (subprocess === undefined || subprocess === null) return
  const originalSpawn = subprocess.spawn
  const originalSpawnTerminal = subprocess.spawnTerminal
  const ownedSpawn = Object.prototype.hasOwnProperty.call(subprocess, 'spawn')
  const ownedTerminal = Object.prototype.hasOwnProperty.call(subprocess, 'spawnTerminal')

  const wrap = original => function patchedSubprocess(spec) {
    try {
      const overlay = overlayFor(spec)
      if (overlay !== undefined) {
        return original.call(this, { ...spec, env: { ...spec.env, ...overlay } })
      }
    } catch (error) {
      console.warn('[dsh-omega-proxy] proxy environment skipped:', error?.message ?? error)
    }
    return original.call(this, spec)
  }

  subprocess.spawn = wrap(originalSpawn)
  subprocess.spawnTerminal = wrap(originalSpawnTerminal)
  effect(() => () => {
    if (ownedSpawn) subprocess.spawn = originalSpawn
    else delete subprocess.spawn
    if (ownedTerminal) subprocess.spawnTerminal = originalSpawnTerminal
    else delete subprocess.spawnTerminal
  })
}
