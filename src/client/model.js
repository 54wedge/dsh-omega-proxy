// Editor draft conversions shared by the settings page and the dialog.
    const PROFILE_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b']
    const PROTOCOLS = [
      { value: 'http', label: 'HTTP' },
      { value: 'https', label: 'HTTPS' },
      { value: 'socks5', label: 'SOCKS5' },
    ]

    function emptyProfile(kind, name) {
      return {
        id: '',
        name,
        kind,
        host: '127.0.0.1',
        port: '7890',
        username: '',
        proxyDns: false,
        color: '',
        http: null,
        https: null,
        socks: null,
        rules: [],
        defaultProfile: null,
      }
    }

    function serverDraft(server) {
      if (server === null || server === undefined) return null
      return {
        kind: server.kind === 'socks5' ? 'socks5' : 'http',
        host: server.host ?? '',
        port: server.port === undefined ? '' : String(server.port),
      }
    }

    function toDraft(payload) {
      return {
        active: payload.active ?? null,
        busy: payload.busy === true,
        pluginRouting: { ...(payload.pluginRouting ?? {}) },
        plugins: (payload.plugins ?? []).map(plugin => ({ name: String(plugin.name), label: String(plugin.label ?? plugin.name) })),
        profiles: (payload.profiles ?? []).map(profile => ({
          id: profile.id,
          name: profile.name,
          kind: profile.kind,
          host: profile.host ?? '',
          port: profile.port === undefined ? '' : String(profile.port),
          username: profile.username ?? '',
          hasPassword: profile.hasPassword === true,
          proxyDns: profile.proxyDns === true,
          color: profile.color ?? '',
          http: serverDraft(profile.servers?.http),
          https: serverDraft(profile.servers?.https),
          socks: serverDraft(profile.servers?.socks),
          rules: (profile.rules ?? []).map(rule => ({ type: rule.type, value: rule.value, profile: rule.profile })),
          defaultProfile: profile.defaultProfile ?? null,
        })),
      }
    }

    function summaryOf(profile, t) {
      if (profile.kind === 'switch') return `${t('typeSwitch')} · ${(profile.rules ?? []).length}`
      const scheme = profile.https ?? profile.http
      const protocol = (scheme?.kind ?? profile.kind).toUpperCase()
      const host = scheme?.host || profile.host || '—'
      const port = scheme?.port || profile.port || ''
      return `${protocol} ${host}${port === '' ? '' : `:${port}`}`
    }
