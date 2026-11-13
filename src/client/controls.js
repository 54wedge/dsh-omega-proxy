// Reusable controls built on the official primitives.
    function Select(props) {
      const { value, options, onChange, disabled = false, title, align = 'end', wide = false } = props
      const [open, setOpen] = useState(false)
      const current = options.find(option => option.value === value)
      return h(Menu, {
        open,
        align,
        portal: true,
        minWidthFromAnchor: true,
        items: options.map(option => ({ id: option.value, label: option.label, disabled: option.disabled === true })),
        selectedId: value,
        onSelect: id => {
          setOpen(false)
          if (id !== value) onChange(id)
        },
        onClose: () => setOpen(false),
        className: wide ? 'dswp-select dswp-select-wide' : 'dswp-select',
        anchor: h(Button, {
          variant: 'outline',
          size: 'sm',
          disabled,
          title,
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen(current => !current),
        },
          h('span', { className: 'dswp-select-value' }, current?.label ?? ''),
          h(IconChevronDown, { size: 14 }),
        ),
      })
    }

    function ColorSwatches(props) {
      const { colors, value, onPick } = props
      return h('div', { className: 'dswp-swatches' },
        ...colors.map(color => h('button', {
          key: color,
          type: 'button',
          className: 'dswp-swatch',
          style: { background: color },
          'data-on': (value || '') === color ? 'true' : 'false',
          'aria-label': color,
          onClick: () => onPick(color),
        })),
      )
    }
