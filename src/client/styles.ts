/**
 * The Card's stylesheet, rendered as a `<style>` element inside the section
 * so it goes away with it. Every class is prefixed `gcm-`; every colour,
 * radius, focus ring and font is a DSH theme token (`--dsw-*`; fonts through
 * `font()`). Geometry follows the host's settings pages (cards, fields,
 * buttons); DSH has no tokens for sizes and spacing.
 */

/**
 * One of DSH's font token sets, `--dsw-font-<token>-*` (for example
 * `xs-strong-13`): family, size, weight and line height from the theme, so
 * text follows the host instead of pixel sizes.
 */
function font(token: string): string {
  return `font-family: var(--dsw-font-${token}-font-family); font-size: var(--dsw-font-${token}-font-size); font-weight: var(--dsw-font-${token}-font-weight); line-height: var(--dsw-font-${token}-line-height);`
}

export const CSS = `
.gcm-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  color: var(--dsw-alias-label-primary);
  ${font('xs-13')}
}
.gcm-section *, .gcm-section *::before, .gcm-section *::after { box-sizing: border-box; }
/* The page heading and intro: DSH's Models page title and intro (ui.md U3). */
.gcm-page-title { margin: 0; color: var(--dsw-alias-label-primary); ${font('base-strong-16')} }
.gcm-intro { margin: 0; color: var(--dsw-alias-label-tertiary); ${font('s-14')} }
.gcm-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-settings-card-fill);
}
.gcm-head { display: flex; align-items: center; gap: 8px; }
.gcm-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); }
.gcm-dot[data-status="signed-in"] { background: var(--dsw-alias-state-success-primary); }
.gcm-dot[data-status="unverified"] { background: var(--dsw-alias-state-warn-label); }
.gcm-title { margin: 0; ${font('s-strong-14')} }
.gcm-subtitle { margin: 0; ${font('xs-strong-13')} }
.gcm-text { margin: 0; overflow-wrap: anywhere; }
.gcm-hint { margin: 0; color: var(--dsw-alias-label-tertiary); ${font('xxs-12')} }
.gcm-caption { margin: 0; color: var(--dsw-alias-label-secondary); ${font('xxs-12')} }
.gcm-line { margin: 0; ${font('xxs-12')} overflow-wrap: anywhere; }
.gcm-tone-success { color: var(--dsw-alias-state-success-primary); }
.gcm-tone-error { color: var(--dsw-alias-state-error-primary); }
.gcm-tone-warn { color: var(--dsw-alias-state-warn-label); }
.gcm-tone-info { color: var(--dsw-alias-label-secondary); }
.gcm-lines { display: flex; flex-direction: column; gap: 4px; }
.gcm-lines:empty {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.gcm-busy { display: flex; align-items: center; gap: 8px; }
.gcm-facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 16px;
  margin: 0;
  ${font('xxs-12')}
}
.gcm-facts dt { color: var(--dsw-alias-label-tertiary); }
.gcm-facts dd { margin: 0; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.gcm-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.gcm-divider { margin: 4px 0; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.gcm-block { display: flex; flex-direction: column; gap: 6px; }
.gcm-label { ${font('xs-strong-13')} }
.gcm-row { display: flex; align-items: center; gap: 8px; }
.gcm-row > .gcm-input { flex: 1 1 auto; }
.gcm-input {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  ${font('xs-13')}
}
.gcm-input::placeholder { color: var(--dsw-alias-label-tertiary); opacity: 1; }
.gcm-input:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.gcm-input[readonly], .gcm-input:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.gcm-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  ${font('xxs-12')}
  white-space: nowrap;
  cursor: pointer;
}
.gcm-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gcm-button:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.gcm-button:disabled { opacity: 0.4; cursor: default; }
.gcm-button-lg { height: 34px; padding: 0 14px; border-radius: var(--dsw-radius-md); ${font('xs-13')} }
.gcm-primary {
  border-color: transparent;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: var(--dsw-font-xxs-strong-12-font-weight);
}
.gcm-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.gcm-button:focus-visible, .gcm-link:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}
.gcm-device {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.gcm-notice { display: flex; flex-direction: column; gap: 6px; }
.gcm-code-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.gcm-code {
  font-family: var(--dsw-font-markdown-code-font-family, monospace);
  font-size: var(--dsw-font-l-20-font-size);
  font-weight: var(--dsw-font-l-20-font-weight);
  line-height: var(--dsw-font-l-20-line-height);
  letter-spacing: 0.12em;
  user-select: all;
}
.gcm-link { color: var(--dsw-alias-link); text-decoration: none; overflow-wrap: anywhere; border-radius: var(--dsw-radius-xs); }
.gcm-link:hover { text-decoration: underline; }
.gcm-spinner {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--dsw-alias-border-l3);
  border-top-color: var(--dsw-alias-label-secondary);
  border-radius: 50%;
  animation: gcm-spin 0.8s linear infinite;
}
@keyframes gcm-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .gcm-spinner { animation: none; } }
.gcm-mono { font-family: var(--dsw-font-markdown-code-font-family, monospace); font-size: var(--dsw-font-markdown-code-font-size); }
.gcm-models { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.gcm-model {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.gcm-model-locked .gcm-model-name { color: var(--dsw-alias-label-tertiary); }
.gcm-model-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gcm-model-titles { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.gcm-model-name { ${font('xs-strong-13')} color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.gcm-badge {
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-xs);
  color: var(--dsw-alias-label-secondary);
  ${font('xxxs-11')}
  white-space: nowrap;
}
/* A policy that is not enabled (models.md A4). */
.gcm-badge-warn { border-color: var(--dsw-alias-state-warn-label); color: var(--dsw-alias-state-warn-label); }
/* Copilot's info messages, as received (models.md A4); the tone class gives the colour. */
.gcm-model-info { margin: 0; ${font('xxs-12')} overflow-wrap: anywhere; }
/* The labels of Context and Output: 72 px, or wider when a language's label needs it (ui.md U4). */
.gcm-model-facts { grid-template-columns: minmax(72px, max-content) minmax(0, 1fr); align-items: start; }
/*
 * Folds (ui.md U3): the "Customized" section of DSH's Models page, copied. The title's
 * chevron points right, and down while open; the body is indented to the title's text.
 */
.gcm-fold-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  margin-left: -4px;
  padding: 2px 4px;
  border-radius: var(--dsw-radius-sm);
  color: var(--dsw-alias-label-secondary);
  ${font('xxs-strong-12')}
  list-style: none;
  cursor: pointer;
}
.gcm-fold-summary::-webkit-details-marker { display: none; }
.gcm-fold-summary::before {
  content: "";
  width: 5px;
  height: 5px;
  border-right: 1.5px solid;
  border-bottom: 1.5px solid;
  transform: rotate(-45deg) translate(-1px, -1px);
  transition: transform 0.12s;
}
.gcm-fold[open] > .gcm-fold-summary::before { transform: rotate(45deg) translate(-1px, -1px); }
@media (hover: hover) { .gcm-fold-summary:hover { color: var(--dsw-alias-label-primary); } }
.gcm-fold-summary:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
@media (prefers-reduced-motion: reduce) { .gcm-fold-summary::before { transition: none; } }
.gcm-fold-body { padding: 4px 0 0 11px; }
/* The fold of rows that cannot be served, after the list: a thin line above it, as DSH's "Customized" section (models.md A4). */
.gcm-fold-group { padding-top: 10px; border-top: 0.5px solid var(--dsw-alias-border-l2); }
/* A fold with nothing to open: its title and the one fact on a line, the title level with the folds' titles (models.md A4). */
.gcm-fold-line { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding-left: 11px; ${font('xxs-12')} }
.gcm-fold-label { color: var(--dsw-alias-label-secondary); font-weight: var(--dsw-font-xxs-strong-12-font-weight); }
.gcm-details {
  max-height: 320px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  font-family: var(--dsw-font-markdown-code-block-small-font-family, monospace);
  font-size: var(--dsw-font-markdown-code-block-small-font-size);
  line-height: var(--dsw-font-markdown-code-block-small-line-height);
  white-space: pre;
}
/*
 * DSH's Switch primitive (DSH 0.2.2-rc.1), copied: DSH's plugin guide asks plugins
 * not to import Harness Client packages and to copy the primitive instead. Colours
 * and the focus ring are theme tokens; DSH has no size tokens, so the sizes are DSH's own.
 */
.gcm-switch {
  box-sizing: border-box;
  position: relative;
  flex: 0 0 auto;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsw-alias-border-l3);
  cursor: pointer;
}
.gcm-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
.gcm-switch:disabled { cursor: default; opacity: 0.5; }
.gcm-switch:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.gcm-switch-thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--dsw-alias-label-primary-foreground);
  transition: transform 0.12s ease;
}
.gcm-switch[aria-checked="false"] .gcm-switch-thumb { background: var(--dsw-alias-switch-thumb); }
.gcm-switch[aria-checked="true"] .gcm-switch-thumb { transform: translate(16px); }
@media (prefers-reduced-motion: reduce) { .gcm-switch-thumb { transition: none; } }
/* Context and output (ui.md U3): rows of the block's facts, each label level with its field. */
.gcm-facts dt.gcm-size-term { line-height: 28px; }
.gcm-size-row, .gcm-size-save { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding-bottom: 4px; }
/* Save sits under the two fields; its messages beside it, or under it when the panel is narrow. */
.gcm-size-save { grid-column: 2; align-items: flex-start; padding-bottom: 8px; }
.gcm-size-messages { flex: 1 1 200px; min-width: 0; padding-top: 5px; }
.gcm-input-sm { width: 120px; height: 28px; padding: 0 8px; ${font('xxs-12')} }
.gcm-presets { display: flex; flex-wrap: wrap; gap: 6px; }
/* The button whose value the field holds: DSH's own selected look (ghost-active fill and border). */
.gcm-preset[aria-pressed="true"] {
  border-color: var(--dsw-alias-button-ghost-active-border);
  background: var(--dsw-alias-button-ghost-active-fill);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-button-ghost-active-border);
  font-weight: var(--dsw-font-xxs-strong-12-font-weight);
}
.gcm-preset[aria-pressed="true"]:hover:not(:disabled) { background: var(--dsw-alias-button-ghost-active-hover); }
/*
 * Prices (models.md A4): a small table, one row per tier; the unit is its caption. Cells never break
 * inside a word; headers wrap only on a panel too narrow for one line: at spaces and hyphens, and in
 * Japanese at the break points its headers mark (U+200B), since keep-all keeps CJK words whole.
 */
.gcm-price-table { border-collapse: collapse; ${font('xxs-12')} font-variant-numeric: tabular-nums; }
.gcm-price-table caption { padding-bottom: 2px; color: var(--dsw-alias-label-tertiary); text-align: left; }
.gcm-price-table th, .gcm-price-table td { padding: 0 0 0 10px; overflow-wrap: normal; font-weight: inherit; text-align: right; white-space: nowrap; }
.gcm-price-table th:first-child, .gcm-price-table td:first-child { padding-left: 0; text-align: left; }
.gcm-price-table thead th { color: var(--dsw-alias-label-tertiary); white-space: normal; word-break: keep-all; vertical-align: bottom; }
.gcm-price-table tbody th { color: var(--dsw-alias-label-secondary); }
.gcm-gone { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.gcm-gone li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.gcm-row > .gcm-input.gcm-mono { flex: 1 1 0; }
`
