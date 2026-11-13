// Stylesheet. Every rule is prefixed dswp- and reads DSH theme tokens.
    const CSS = `
.dswp-section { display: flex; flex-direction: column; gap: 12px; max-width: 760px; color: var(--dsw-alias-label-primary); }
.dswp-heading { margin: 0; font-size: 18px; font-weight: 600; }
.dswp-intro { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); }
.dswp-tabs { display: flex; align-items: flex-end; gap: 22px; margin-top: 2px; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dswp-tab { position: relative; padding: 7px 1px 9px; border: 0; background: none; color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; }
.dswp-tab[data-active="true"] { color: var(--dsw-alias-label-primary); }
.dswp-tab[data-active="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 2px 2px 0 0; background: var(--dsw-alias-label-primary); }
.dswp-tab:hover { color: var(--dsw-alias-label-primary); }
.dswp-panel { display: flex; flex-direction: column; gap: 10px; padding-top: 2px; }
.dswp-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dswp-panel-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
.dswp-notice { display: flex; align-items: center; gap: 7px; margin: 0; padding: 8px 11px; border-radius: var(--dsw-radius-md); font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary); }
.dswp-notice svg { flex: none; color: var(--dsw-alias-state-warn-primary); }
.dswp-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dswp-empty { margin: 0; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.dswp-card { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: .5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.dswp-card-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.dswp-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; line-height: 20px; }
.dswp-card-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-card-desc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-card-actions { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.dswp-code { font-family: var(--ds-font-family-code); font-size: 12px; line-height: 18px; padding: 1px 6px; border-radius: var(--dsw-radius-xs); background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-dot { width: 12px; height: 12px; flex: none; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.dswp-card-meta { display: flex; min-width: 0; }
.dswp-scroll { display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow: auto; padding-right: 2px; }
.dswp-link { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--dsw-alias-state-business-primary); font: inherit; font-size: 12px; cursor: pointer; }
.dswp-link:hover { text-decoration: underline; }
.dswp-error { margin: 0; padding: 8px 12px; border-radius: var(--dsw-radius-md); font-size: 12px; color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-bg-layer-2); word-break: break-word; }
.dswp-savehint { margin: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }

.dswp-select { display: inline-flex; }
.dswp-select > button { justify-content: space-between; gap: 6px; }
.dswp-select-wide { display: block; width: 100%; }
.dswp-select-wide > button { width: 100%; }
.dswp-select-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-select-chevron { flex: none; opacity: .6; }

.dswp-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; max-width: 170px; }
.dswp-chip:hover, .dswp-chip[data-open="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dswp-chip-label { max-width: 112px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-dot-chip { width: 15px; height: 15px; flex: none; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.dswp-menu-name { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dswp-menu-sub { font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dswp-menu-dot { width: 14px; height: 14px; border-radius: 50%; }

.dswp-modal { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0, 0, 0, .34); }
.dswp-dialog { display: flex; flex-direction: column; width: min(660px, 100%); max-height: calc(100vh - 48px); border: .5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-bg-overlay); box-shadow: 0 24px 56px rgba(0, 0, 0, .28); }
.dswp-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px 10px; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dswp-dialog-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.dswp-danger {
  color: var(--dsw-alias-state-error-primary);
  --dsh-button-outline-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent);
  --dsw-alias-interactive-bg-hover: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
}
.dswp-dialog-body { display: flex; flex-direction: column; gap: 16px; padding: 16px 18px; overflow: auto; }
.dswp-dialog-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 18px 14px; border-top: .5px solid var(--dsw-alias-border-l2); }
.dswp-form-row { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 14px; }
.dswp-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dswp-field-label { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dswp-field-note { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.dswp-field-error { font-size: 11px; line-height: 16px; color: var(--dsw-alias-state-error-primary); }
.dswp-inline-switch { display: inline-flex; align-items: center; gap: 8px; }
.dswp-swatches { display: flex; gap: 8px; }
.dswp-swatch { width: 24px; height: 24px; padding: 0; border: .5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-sm); cursor: pointer; }
.dswp-swatch[data-on="true"] { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.dswp-scheme-row { display: grid; grid-template-columns: 74px 120px minmax(0, 1fr) 92px; gap: 8px; align-items: center; }
.dswp-scheme-label { font-family: var(--ds-font-family-code); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dswp-rule-row { display: grid; grid-template-columns: 132px minmax(0, 1fr) 160px auto; gap: 8px; align-items: center; }
.dswp-section-label { margin: 0; font-size: 13px; font-weight: 600; line-height: 20px; }
.dswp-section-note { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dswp-stack { display: flex; flex-direction: column; gap: 8px; }
.dswp-add-rule { align-self: flex-start; }
`
