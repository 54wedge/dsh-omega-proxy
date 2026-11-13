// Client runtime handles: React, the official primitives, and identifiers.
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState, useSyncExternalStore } = React
    // Official Harness controls: the same Menu, Button, Input, Switch and Pill
    // the built-in settings pages render, so this page inherits their styling.
    const ui = require('@deepseek-ai/dsh-client-ui-primitives')
    const { Button, Input, Menu, Modal, Pill, Switch } = ui
    const IconChevronDown = ui.IconChevronDownOutlineRegular
    const IconPlus = ui.IconPlusOutlineMedium
    const IconClose = ui.IconCloseOutlineRegular

    const NS = 'dsh-omega-proxy'
    const API = '/proxy-switch'
