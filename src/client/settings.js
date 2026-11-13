// Settings page: tabs, profile list, and per-plugin routes.
    function SettingsPage(props) {
      const { api } = props
      const t = localize(props)
      const [doc, setDoc] = useState(null)
      const [meta, setMeta] = useState({ providers: [], workspaces: [] })
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [savedAt, setSavedAt] = useState(0)
      const [dialog, setDialog] = useState(null)
      const [tab, setTab] = useState('profiles')
      const [showBuiltin, setShowBuiltin] = useState(false)
      const [removing, setRemoving] = useState(null)

      const absorb = useCallback(payload => {
        const draft = toDraft(payload)
        setDoc(draft)
        setMeta({ providers: payload.providers ?? [], workspaces: payload.workspaces ?? [] })
        return draft
      }, [])

      const load = useCallback(async () => {
        try {
          const payload = await requestJson('/settings')
          if (!payload?.ok) {
            setError(payload?.error ?? t('failed'))
            return
          }
          absorb(payload)
          setError(null)
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [absorb, t('failed')])

      useEffect(() => {
        void load()
      }, [load])

      useEffect(() => {
        if (savedAt === 0) return undefined
        const timer = setTimeout(() => setSavedAt(0), 2000)
        return () => clearTimeout(timer)
      }, [savedAt])

      /** Every mutation saves immediately; there is no draft to apply. */
      const persist = useCallback(async patch => {
        setBusy(true)
        try {
          const payload = await requestJson('/settings', {
            profiles: patch.profiles ?? doc?.profiles ?? [],
            active: patch.active !== undefined ? patch.active : (doc?.active ?? null),
            pluginRouting: patch.pluginRouting ?? doc?.pluginRouting ?? {},
          })
          if (!payload?.ok) {
            setError(payload?.error ?? t('failed'))
            return undefined
          }
          absorb(payload)
          setError(null)
          setSavedAt(Date.now())
          return payload
        } catch (cause) {
          setError(String(cause?.message ?? cause))
          return undefined
        } finally {
          setBusy(false)
        }
      }, [absorb, doc, t('failed')])

      const saveProfile = useCallback(async draft => {
        if (doc === null) return
        const prepared = draft.id === '' && !draft.color
          ? { ...draft, color: PROFILE_COLORS[doc.profiles.length % PROFILE_COLORS.length] }
          : draft
        const next = prepared.id === ''
          ? [...doc.profiles, prepared]
          : doc.profiles.map(profile => (profile.id === prepared.id ? prepared : profile))
        const payload = await persist({ profiles: next })
        if (payload !== undefined) {
          setDialog(null)
          window.dispatchEvent(new Event('dswp:changed'))
        }
      }, [doc, persist])

      const removeProfile = useCallback(async id => {
        if (doc === null) return
        const next = doc.profiles
          .filter(profile => profile.id !== id)
          .map(profile => ({
            ...profile,
            rules: (profile.rules ?? []).filter(rule => rule.profile !== id),
            defaultProfile: profile.defaultProfile === id ? null : profile.defaultProfile,
          }))
        const payload = await persist({ profiles: next, active: doc.active === id ? null : doc.active })
        if (payload !== undefined) window.dispatchEvent(new Event('dswp:changed'))
      }, [doc, persist])

      const setPluginRoute = useCallback(async (name, value) => {
        if (doc === null) return
        const next = { ...doc.pluginRouting }
        if (value === 'system') delete next[name]
        else next[name] = value
        await persist({ profiles: doc.profiles, pluginRouting: next })
      }, [doc, persist])

      if (doc === null) {
        return h('div', { className: 'dswp-section' },
          h('style', null, CSS),
          h('p', { className: 'dswp-hint' }, error ?? t('loading')),
        )
      }

      /** Saving and switching share one lock: an open turn freezes the whole page. */
      const locked = busy || doc.busy === true

      const profilesTab = h('div', { className: 'dswp-panel', role: 'tabpanel' },
        h('div', { className: 'dswp-panel-head' },
          h('h3', { className: 'dswp-panel-title' }, t('profiles')),
          h(Button, {
            variant: 'outline',
            size: 'sm',
            icon: h(IconPlus, { size: 14 }),
            disabled: locked,
            onClick: () => setDialog({ draft: emptyProfile('http', '') }),
          }, t('addProfile')),
        ),
        error === null ? null : h('p', { className: 'dswp-error' }, error),
        doc.profiles.length === 0
          ? h('p', { className: 'dswp-empty' }, t('noProfiles'))
          : h('div', { className: 'dswp-stack' }, ...doc.profiles.map(profile => h(ProfileCard, {
              key: profile.id || profile.name,
              profile,
              active: doc.active === profile.id,
              locked,
              t,
              onEdit: () => setDialog({ draft: { ...profile } }),
              onRemove: () => setRemoving(profile),
            }))),
        h('p', { className: 'dswp-savehint' }, savedAt !== 0 ? t('saved') : t('autoSave')),
      )

      const isBuiltin = plugin => plugin.name.startsWith('@deepseek-ai/')
      const builtinCount = doc.plugins.filter(isBuiltin).length
      const visiblePlugins = doc.plugins.filter(plugin => showBuiltin || !isBuiltin(plugin))
      // A route must be one HTTP proxy: switch and SOCKS5 profiles cannot rewrite a request.
      const routeOptions = [
        { value: 'system', label: t('routingSystem') },
        ...doc.profiles.filter(profile => profile.kind === 'http').map(profile => ({ value: profile.id, label: profile.name })),
      ]

      const pluginsTab = h('div', { className: 'dswp-panel', role: 'tabpanel' },
        h('p', { className: 'dswp-hint' }, t('pluginsHint')),
        doc.plugins.length === 0
          ? h('p', { className: 'dswp-empty' }, t('pluginsEmpty'))
          : h('div', { className: 'dswp-scroll' }, ...visiblePlugins.map(plugin => h(PluginCard, {
              key: plugin.name,
              plugin,
              routing: doc.pluginRouting[plugin.name] ?? 'system',
              options: routeOptions,
              locked,
              onChange: value => { void setPluginRoute(plugin.name, value) },
            }))),
        builtinCount === 0 ? null : h('button', {
          className: 'dswp-link',
          type: 'button',
          onClick: () => setShowBuiltin(value => !value),
        }, showBuiltin ? t('hideBuiltin') : `${t('showBuiltin')} (${builtinCount})`),
      )

      return h('section', { className: 'dswp-section' },
        h('style', null, CSS),
        h('h2', { className: 'dswp-heading' }, t('title')),
        h('p', { className: 'dswp-intro' }, t('intro')),
        h('div', { className: 'dswp-tabs', role: 'tablist' },
          h('button', {
            type: 'button',
            role: 'tab',
            className: 'dswp-tab',
            'data-active': tab === 'profiles' ? 'true' : 'false',
            'aria-selected': tab === 'profiles',
            onClick: () => setTab('profiles'),
          }, t('tabProfiles')),
          h('button', {
            type: 'button',
            role: 'tab',
            className: 'dswp-tab',
            'data-active': tab === 'plugins' ? 'true' : 'false',
            'aria-selected': tab === 'plugins',
            onClick: () => setTab('plugins'),
          }, t('tabPlugins')),
        ),
        doc.busy ? h('p', { className: 'dswp-notice' }, h(WarningTriangle), h('span', null, t('busyNotice'))) : null,
        tab === 'profiles' ? profilesTab : pluginsTab,
        removing === null ? null : h(ConfirmDialog, {
          name: removing.name,
          t,
          onCancel: () => setRemoving(null),
          onConfirm: () => {
            const id = removing.id
            setRemoving(null)
            void removeProfile(id)
          },
        }),
        dialog === null ? null : h(ProfileDialog, {
          initial: dialog.draft,
          profiles: doc.profiles,
          providers: meta.providers,
          workspaces: meta.workspaces,
          t,
          locked,
          onCancel: () => setDialog(null),
          onSave: saveProfile,
        }),
      )
    }
