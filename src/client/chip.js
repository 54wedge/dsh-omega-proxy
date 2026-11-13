// Conversation-header and New Session chip with its profile menu.
    function ProxyMenu(props) {
      const { api, sessionId, useProjection, startAlign } = props
      const readProjection = typeof useProjection === 'function' ? useProjection : () => undefined
      const selection = readProjection('modelSelection')

      // A blank Session records no selection until its first turn, so the
      // projection alone misses the model picked in the New Session window.
      // The composer's model directory is the live source: "pending" while a
      // selection is in flight, "current" once the Session records it.
      const directory = useMemo(() => {
        if (sessionId === undefined || sessionId === null) return undefined
        try {
          return api?.get?.('modelDirectories')?.directoryFor?.(String(sessionId))
        } catch {
          return undefined
        }
      }, [api, sessionId])
      const directoryState = useSyncExternalStore(
        useCallback(onChange => (directory === undefined ? () => {} : directory.store.subscribe(onChange)), [directory]),
        useCallback(() => (directory === undefined ? null : directory.store.getSnapshot()), [directory]),
        () => null,
      )
      const liveProvider = directoryState?.pending?.provider
        ?? directoryState?.current?.provider
        ?? selection?.next?.provider
        ?? selection?.lastUsed?.provider

      const t = localize(props)
      const [open, setOpen] = useState(false)
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)

      const load = useCallback(async () => {
        try {
          const query = new URLSearchParams()
          if (sessionId) query.set('sessionId', String(sessionId))
          if (typeof liveProvider === 'string' && liveProvider.length > 0) query.set('provider', liveProvider)
          const payload = await requestJson(query.toString() ? `/state?${query.toString()}` : '/state')
          if (payload?.ok) setData(payload)
          else setError(payload?.error ?? t('failed'))
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [sessionId, liveProvider, t('failed')])

      useEffect(() => {
        void load()
      }, [load])

      useEffect(() => {
        const onChange = () => { void load() }
        window.addEventListener('dswp:changed', onChange)
        return () => window.removeEventListener('dswp:changed', onChange)
      }, [load])

      const bind = useCallback(async profileId => {
        setBusy(true)
        try {
          const payload = await requestJson('/active', { profileId })
          if (payload?.ok) {
            setData(payload)
            setError(null)
          } else {
            setError(payload?.error ?? t('failed'))
          }
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        } finally {
          setBusy(false)
        }
      }, [t('failed')])

      const profiles = data?.profiles ?? []
      const active = data?.activeProfile ?? null
      const activeId = data?.active ?? null
      const resolution = data?.resolution ?? null
      const busyState = data?.busy === true
      const colorOf = id => profiles.find(profile => profile.id === id)?.color ?? '#64748b'
      const label = data === null ? (error === null ? t('loading') : t('unknown')) : active === null ? t('system') : active.name

      const row = entry => ({
        id: entry.id,
        disabled: busyState || busy || entry.disabled === true,
        icon: h('span', {
          className: 'dswp-menu-dot',
          style: {
            background: entry.fill ?? 'var(--dsw-alias-state-idle-primary)',
            ...(entry.ring === undefined ? {} : { boxShadow: `inset 0 0 0 2.5px ${entry.ring}` }),
          },
        }),
        label: h('span', { className: 'dswp-menu-name' },
          h('span', null, entry.name),
          entry.detail === undefined ? null : h('span', { className: 'dswp-menu-sub' }, entry.detail),
        ),
      })

      const items = [
        row({ id: 'system', name: t('system') }),
        ...profiles.map(profile => row({
          id: profile.id,
          name: profile.name,
          ring: profile.kind === 'switch' ? (profile.color ?? '#64748b') : undefined,
          fill: profile.kind !== 'switch'
            ? (profile.color ?? undefined)
            : activeId === profile.id
              ? (resolution?.profile?.color ?? undefined)
              : profile.defaultProfile == null
                ? undefined
                : colorOf(profile.defaultProfile),
          detail: activeId === profile.id && profile.kind === 'switch'
            ? `↳ ${resolution?.profile?.name ?? t('system')}`
            : undefined,
        })),
      ]

      return h('span', { style: { display: 'inline-flex', ...(startAlign ? { marginRight: 'auto' } : {}) } },
        h('style', null, CSS),
        h(Menu, {
          open,
          align: 'start',
          portal: true,
          minWidthFromAnchor: true,
          items,
          selectedId: activeId ?? 'system',
          onSelect: id => { void bind(id === 'system' ? null : id) },
          onClose: () => setOpen(false),
          anchor: h('button', {
            type: 'button',
            className: 'dswp-chip',
            'data-open': open ? 'true' : 'false',
            'aria-haspopup': 'menu',
            'aria-expanded': open ? 'true' : 'false',
            title: error ?? (active === null ? t('systemHint') : active.summary),
            onClick: () => { if (!open) void load(); setOpen(!open) },
          },
            h('span', {
              className: 'dswp-dot-chip',
              style: active === null
                ? undefined
                : active.kind === 'switch'
                  ? { background: resolution?.profile?.color ?? undefined, boxShadow: `inset 0 0 0 2.5px ${active.color ?? '#64748b'}` }
                  : { background: active.color ?? undefined },
            }),
            h('span', { className: 'dswp-chip-label' }, label),
            h(IconChevronDown, { size: 12, className: 'dswp-select-chevron' }),
          ),
        }),
      )
    }
