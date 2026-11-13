// HTTP client for /proxy-switch plus the slot error boundary.
    async function requestJson(path, body) {
      const init = body === undefined
        ? { credentials: 'same-origin', headers: { accept: 'application/json' } }
        : {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
          }
      const response = await fetch(`${API}${path}`, init)
      return await response.json()
    }

    function report(kind, detail) {
      try {
        void fetch(`${API}/log`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind, detail, href: String(location.href).slice(0, 200) }),
        }).catch(() => {})
      } catch {}
    }

    class SlotBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error) {
        report('render-crash', {
          slot: this.props.slot,
          message: String(error?.message ?? error),
          stack: String(error?.stack ?? '').split('\n').slice(0, 6).join('\n'),
        })
      }
      render() {
        if (this.state.error !== null) {
          console.warn('[dsh-omega-proxy] slot failed', this.props.slot, this.state.error)
          return null
        }
        return this.props.children
      }
    }

    /** Menu-backed select: an outline button that opens the official menu. */
