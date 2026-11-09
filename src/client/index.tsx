/**
 * Browser half of the plugin: registers the GitHub Copilot settings section
 * (`settings.section`, id `github-copilot-models`) and its copy.
 *
 * Only `react` is loaded at runtime; the DSH client services arrive through
 * `ctx` and are described below by minimal local interfaces (no DSH client
 * package is imported, not even for types).
 */
import { LoginSection } from './LoginSection.tsx'
import type { LoginSectionInjected } from './LoginSection.tsx'
import { DICTIONARIES } from './locales.ts'
import type { Translate } from './locales.ts'

/** Locale namespace owned by this plugin. */
const NS = 'settings.github-copilot-models'

/** Section id: the nav key of the settings panel. */
const SECTION_ID = 'github-copilot-models'

/** Nav position, just after the subscription plugins' sections. */
const SECTION_ORDER = 91

/** The part of DSH's client locale service the plugin uses. */
interface LocaleService {
  /** One dictionary per locale id; DSH requires `zh` and `en` and accepts further ids (ui.md U4). */
  register(ns: string, dicts: { readonly zh: Readonly<Record<string, string>>; readonly en: Readonly<Record<string, string>>; readonly [locale: string]: Readonly<Record<string, string>> }): () => void
  bind(ns: string): (key: string, params?: Readonly<Record<string, unknown>>) => string
}

/** Options of one `settings.section` entry. */
interface SectionOptions {
  readonly name: 'settings.section'
  readonly id: string
  readonly order: number
  /** Re-read on every use, so the nav label follows the active locale. */
  readonly label: () => string
  /** Props spread into the component. */
  readonly inject: () => LoginSectionInjected
}

/** The part of DSH's slot service the plugin uses. */
interface SlotService {
  inject(key: string, callback: () => () => void): () => void
  register(options: SectionOptions, component: typeof LoginSection): () => void
}

/** The client context, as far as the plugin uses it. */
interface ClientContext {
  readonly slots: SlotService
  readonly locale: LocaleService
  effect(execute: () => () => void, label?: string): unknown
}

/** Required client services. */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'github-copilot-models: copy')
  const t = ctx.locale.bind(NS) as Translate
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: SECTION_ID,
    order: SECTION_ORDER,
    label: () => t('nav'),
    inject: () => ({ t }),
  }, LoginSection))
}
