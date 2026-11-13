// Profile editor dialog.
    function ProfileDialog(props) {
      const { initial, profiles, providers, workspaces, t, locked, onCancel, onSave } = props
      const [draft, setDraft] = useState(() => ({ ...initial }))
      const set = patch => setDraft(current => ({ ...current, ...patch }))
      const others = profiles.filter(profile => profile.id !== draft.id && profile.id !== '')
      const trimmed = draft.name.trim()
      const nameTaken = profiles.some(profile => profile.id !== draft.id && profile.name.toLowerCase() === trimmed.toLowerCase())
      const rules = draft.rules ?? []
      const rulesIncomplete = draft.kind === 'switch' && rules.some(rule => rule.value.length === 0 || rule.profile.length === 0)
      const seenRules = new Set()
      const duplicateRules = rules.some(rule => {
        if (rule.value.length === 0) return false
        const key = `${rule.type}:${rule.value.toLowerCase()}`
        if (seenRules.has(key)) return true
        seenRules.add(key)
        return false
      })
      const canSave = trimmed.length > 0 && !nameTaken && !rulesIncomplete && !duplicateRules && !locked

      const optionsFor = type => (type === 'provider'
        ? providers.map(provider => ({ value: provider.id, label: provider.name }))
        : workspaces.map(workspace => ({ value: workspace.path, label: workspace.title })))

      const setServer = (scheme, patch) => {
        if (scheme === 'default') {
          set(patch)
          return
        }
        if (patch === null) {
          set({ [scheme]: null })
          return
        }
        set({ [scheme]: { ...(draft[scheme] ?? { kind: 'http', host: '', port: '' }), ...patch } })
      }

      const serverRow = scheme => {
        const override = scheme === 'default' ? null : draft[scheme]
        const value = scheme === 'default'
          ? { kind: draft.kind === 'socks5' ? 'socks5' : 'http', host: draft.host, port: draft.port }
          : override
        const following = scheme !== 'default' && override === null
        return h('div', { className: 'dswp-scheme-row', key: scheme },
          h('span', { className: 'dswp-scheme-label' }, scheme === 'default' ? '(default)' : scheme),
          h(Select, {
            value: following ? '' : (value?.kind ?? 'http'),
            options: [
              ...(scheme === 'default' ? [] : [{ value: '', label: t('followDefaultShort') }]),
              ...PROTOCOLS.map(option => ({ value: option.value, label: option.label })),
            ],
            align: 'start',
            wide: true,
            disabled: locked,
            onChange: kind => {
              if (scheme === 'default') set({ kind })
              else if (kind === '') setServer(scheme, null)
              else setServer(scheme, { kind, host: override?.host ?? '', port: override?.port ?? '' })
            },
          }),
          h(Input, {
            value: following ? '' : (value?.host ?? ''),
            placeholder: following ? draft.host : '127.0.0.1',
            disabled: following || locked,
            onChange: event => setServer(scheme, { host: event.target.value }),
          }),
          h(Input, {
            value: following ? '' : (value?.port ?? ''),
            placeholder: following ? draft.port : '7890',
            inputMode: 'numeric',
            disabled: following || locked,
            onChange: event => setServer(scheme, { port: event.target.value }),
          }),
        )
      }

      const ruleRow = (rule, index) => {
        const options = optionsFor(rule.type)
        const used = new Set(rules.filter((item, position) => position !== index && item.type === rule.type).map(item => item.value.toLowerCase()))
        return h('div', { className: 'dswp-rule-row', key: `rule:${index}` },
          h(Select, {
            value: rule.type,
            options: [
              { value: 'provider', label: t('condProvider') },
              { value: 'workspace', label: t('condWorkspace') },
            ],
            align: 'start',
            wide: true,
            disabled: locked,
            onChange: type => {
              const taken = new Set(rules.filter((item, position) => position !== index && item.type === type).map(item => item.value.toLowerCase()))
              const first = optionsFor(type).find(option => !taken.has(option.value.toLowerCase()))?.value ?? ''
              set({ rules: rules.map((item, position) => (position === index ? { ...item, type, value: first } : item)) })
            },
          }),
          options.length === 0
            ? h('span', { className: 'dswp-field-error' }, rule.type === 'provider' ? t('noProviders') : t('noWorkspaces'))
            : h(Select, {
                value: rule.value,
                options: [{ value: '', label: '—' }, ...options.map(option => ({
                  value: option.value,
                  label: option.label,
                  disabled: used.has(option.value.toLowerCase()),
                }))],
                align: 'start',
                wide: true,
                disabled: locked,
                onChange: next => set({ rules: rules.map((item, position) => (position === index ? { ...item, value: next } : item)) }),
              }),
          h(Select, {
            value: rule.profile,
            options: others.map(profile => ({ value: profile.id, label: profile.name || profile.id })),
            align: 'start',
            wide: true,
            disabled: locked,
            onChange: next => set({ rules: rules.map((item, position) => (position === index ? { ...item, profile: next } : item)) }),
          }),
          h(Button, {
            size: 'sm',
            icon: h(IconClose, { size: 14 }),
            disabled: locked,
            'aria-label': t('remove'),
            onClick: () => set({ rules: rules.filter((_, position) => position !== index) }),
          }),
        )
      }

      return h('div', { className: 'dswp-modal', onMouseDown: event => { if (event.target === event.currentTarget) onCancel() } },
        h('div', { className: 'dswp-dialog', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'dswp-dialog-head' },
            h('h3', null, initial.id === '' ? t('newProfile') : t('editProfile')),
            h(Button, { size: 'sm', icon: h(IconClose, { size: 14 }), 'aria-label': t('cancel'), onClick: onCancel }),
          ),
          h('div', { className: 'dswp-dialog-body' },
            h('div', { className: 'dswp-form-row' },
              h('label', { className: 'dswp-field' },
                h('span', { className: 'dswp-field-label' }, t('name')),
                h(Input, {
                  value: draft.name,
                  placeholder: t('namePlaceholder'),
                  autoFocus: true,
                  onChange: event => set({ name: event.target.value }),
                }),
                nameTaken ? h('span', { className: 'dswp-field-error' }, t('nameTaken')) : null,
              ),
              h('div', { className: 'dswp-field' },
                h('span', { className: 'dswp-field-label' }, t('kind')),
                h(Select, {
                  value: draft.kind === 'switch' ? 'switch' : 'proxy',
                  options: [
                    { value: 'proxy', label: t('typeProxy') },
                    { value: 'switch', label: t('typeSwitch') },
                  ],
                  align: 'start',
                  wide: true,
                  disabled: locked,
                  onChange: kind => {
                    if (kind === 'switch') {
                      set({
                        kind: 'switch',
                        rules: rules.length === 0 ? [{ type: 'provider', value: providers[0]?.id ?? '', profile: others[0]?.id ?? '' }] : rules,
                      })
                    } else {
                      set({ kind: 'http' })
                    }
                  },
                }),
              ),
            ),
            h('div', { className: 'dswp-field' },
              h('span', { className: 'dswp-field-label' }, t('color')),
              h(ColorSwatches, { colors: PROFILE_COLORS, value: draft.color, onPick: color => set({ color }) }),
            ),
            draft.kind === 'switch' ? null : h('div', { className: 'dswp-stack' },
              h('p', { className: 'dswp-section-label' }, t('servers')),
              serverRow('default'),
              serverRow('http'),
              serverRow('https'),
              serverRow('socks'),
              h('div', { className: 'dswp-field' },
                h('label', { className: 'dswp-inline-switch' },
                  h(Switch, {
                    checked: draft.proxyDns === true,
                    onChange: next => set({ proxyDns: next }),
                    label: t('proxyDns'),
                    disabled: locked,
                  }),
                  h('span', { className: 'dswp-field-label' }, t('proxyDns')),
                ),
                h('span', { className: 'dswp-field-note' }, t('proxyDnsHint')),
              ),
            ),
            h('div', { className: 'dswp-form-row' },
              h('label', { className: 'dswp-field' },
                h('span', { className: 'dswp-field-label' }, `${t('user')} · ${t('optional')}`),
                h(Input, {
                  value: draft.username,
                  disabled: locked,
                  onChange: event => set({ username: event.target.value }),
                }),
              ),
              h('label', { className: 'dswp-field' },
                h('span', { className: 'dswp-field-label' }, `${t('password')} · ${t('optional')}`),
                h(Input, {
                  type: 'password',
                  value: draft.password ?? '',
                  placeholder: draft.hasPassword ? t('unchanged') : '',
                  disabled: locked,
                  onChange: event => set({ password: event.target.value }),
                }),
              ),
            ),
            draft.kind === 'switch' ? h('div', { className: 'dswp-stack' },
              h('p', { className: 'dswp-section-label' }, t('rules')),
              h('p', { className: 'dswp-section-note' }, t('ruleHint')),
              ...rules.map(ruleRow),
              h(Button, {
                variant: 'outline',
                size: 'sm',
                icon: h(IconPlus, { size: 14 }),
                disabled: locked,
                className: 'dswp-add-rule',
                onClick: () => {
                  const taken = new Set(rules.filter(item => item.type === 'provider').map(item => item.value.toLowerCase()))
                  const value = providers.find(provider => !taken.has(provider.id.toLowerCase()))?.id ?? ''
                  set({ rules: [...rules, { type: 'provider', value, profile: others[0]?.id ?? '' }] })
                },
              }, t('addRule')),
              duplicateRules ? h('p', { className: 'dswp-field-error' }, t('duplicateRule')) : null,
              rulesIncomplete ? h('p', { className: 'dswp-field-error' }, t('needValue')) : null,
              h('div', { className: 'dswp-field' },
                h('span', { className: 'dswp-field-label' }, t('fallback')),
                h(Select, {
                  value: draft.defaultProfile ?? '',
                  options: [
                    { value: '', label: t('followFallback') },
                    ...others.map(profile => ({ value: profile.id, label: profile.name || profile.id })),
                  ],
                  align: 'start',
                  wide: true,
                  disabled: locked,
                  onChange: next => set({ defaultProfile: next === '' ? null : next }),
                }),
              ),
            ) : null,
          ),
          h('div', { className: 'dswp-dialog-foot' },
            h(Button, { size: 'sm', onClick: onCancel }, t('cancel')),
            h(Button, { variant: 'primary', size: 'sm', disabled: !canSave, onClick: () => { void onSave({ ...draft, name: trimmed }) } }, t('save')),
          ),
        ),
      )
    }

    /** The official confirmation shape: Modal with a plain cancel and a red confirm. */
    function ConfirmDialog(props) {
      const { name, t, onCancel, onConfirm } = props
      const fill = template => template.split('{name}').join(name)
      return h(Modal, {
        open: true,
        onClose: onCancel,
        title: fill(t('removeTitle')),
        closeLabel: t('cancel'),
        description: fill(t('removeBody')),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', onClick: onCancel }, t('cancel')),
          h(Button, { variant: 'outline', className: 'dswp-danger', onClick: onConfirm }, fill(t('removeConfirm'))),
        ),
      })
    }
