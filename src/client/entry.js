// Slot registrations and the plugin body.
    const inject = ['slots', 'locale']

    function apply(ctx) {
      report('bundle-applied', { controls: Boolean(Button && Menu) })
      ctx.effect(() => ctx.locale.register(NS, STRINGS), `${NS}: dictionaries`)

      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: NS,
        order: -20,
        locale: NS,
        label: 'Proxy',
      }, props => h(SlotBoundary, { slot: 'header' }, h(ProxyMenu, { ...props, api: ctx }))))

      ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({
        name: 'conversation.hero.options',
        id: NS,
        order: 0,
        locale: NS,
        label: 'Proxy',
      }, props => h(SlotBoundary, { slot: 'hero' }, h(ProxyMenu, { ...props, api: ctx, startAlign: true }))))

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 60,
        locale: NS,
        label: () => ctx.locale.bind(NS)('nav'),
      }, props => h(SlotBoundary, { slot: 'settings' }, h(SettingsPage, { ...props, api: ctx }))))
    }
