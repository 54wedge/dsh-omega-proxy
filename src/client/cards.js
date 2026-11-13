// Row components for the settings lists.
/** Warning triangle for the switch-lock notice; the primitives ship no warning glyph. */
function WarningTriangle() {
  return h('svg', {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true,
    focusable: false,
  },
    h('path', {
      d: 'M8 1.9 15 14H1L8 1.9Z',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinejoin: 'round',
    }),
    h('path', { d: 'M8 6.2v3.4', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    h('circle', { cx: 8, cy: 11.7, r: 0.8, fill: 'currentColor' }),
  )
}
    function ProfileCard(props) {
      const { profile, active, locked, t, onEdit, onRemove } = props
      return h('div', { className: 'dswp-card' },
        h('span', {
          className: 'dswp-dot',
          style: profile.kind === 'switch'
            ? { background: 'transparent', boxShadow: `inset 0 0 0 2.5px ${profile.color || 'var(--dsw-alias-state-idle-primary)'}` }
            : { background: profile.color || undefined },
        }),
        h('div', { className: 'dswp-card-main' },
          h('div', { className: 'dswp-card-title' },
            h('span', { className: 'dswp-card-name' }, profile.name || t('namePlaceholder')),
            active ? h(Pill, { active: true }, t('current')) : null,
          ),
          h('div', { className: 'dswp-card-desc' }, summaryOf(profile, t)),
        ),
        h('div', { className: 'dswp-card-actions' },
          h(Button, { variant: 'outline', size: 'sm', disabled: locked, onClick: onEdit }, t('edit')),
          h(Button, { size: 'sm', className: 'dswp-danger', disabled: locked, onClick: onRemove }, t('remove')),
        ),
      )
    }

    function PluginCard(props) {
      const { plugin, routing, options, locked, onChange } = props
      return h('div', { className: 'dswp-card' },
        h('div', { className: 'dswp-card-main' },
          h('div', { className: 'dswp-card-title' }, h('span', { className: 'dswp-card-name' }, plugin.label)),
          h('div', { className: 'dswp-card-meta' }, h('span', { className: 'dswp-code' }, plugin.name)),
        ),
        h('div', { className: 'dswp-card-actions' },
          h(Select, { value: routing, options, disabled: locked, title: plugin.name, onChange }),
        ),
      )
    }
