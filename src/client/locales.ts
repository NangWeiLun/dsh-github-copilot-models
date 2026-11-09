/**
 * Card copy, registered under the namespace `settings.github-copilot-models`
 * (ui.md U4): one dictionary per language in `locales/`, with English the
 * source of every key. Each other language has exactly English's keys (the
 * type checker enforces it) and the same `{name}` placeholders (a unit test
 * checks it). Placeholders are filled from the params of `t(key, params)`.
 *
 * Error texts follow login.md A8. LOOKUP_FAILED is built from fragments so
 * each language chooses its own separators (see messages.ts).
 */
import { de } from './locales/de.ts'
import { en } from './locales/en.ts'
import type { Key } from './locales/en.ts'
import { es } from './locales/es.ts'
import { fr } from './locales/fr.ts'
import { ja } from './locales/ja.ts'
import { pt } from './locales/pt.ts'
import { ru } from './locales/ru.ts'
import { zh } from './locales/zh.ts'

export { en, zh }
export type { Key }

/** Every language of the Card, by DSH locale id: the eight DSH 0.2.2-rc.1 offers. DSH requires `en` and `zh`. */
export const DICTIONARIES = { en, zh, ja, es, fr, de, ru, pt } as const

/** Placeholder values accepted by {@link Translate}. */
export type TranslateParams = Readonly<Record<string, string | number>>

/** The locale-bound translate function the slot injects (`ctx.locale.bind(NS)`). */
export type Translate = (key: Key, params?: TranslateParams) => string

/**
 * English fallback for a render without the injected `t`. Fills `{name}`
 * placeholders in one pass, like the DSH locale service.
 */
export function fallbackTranslate(key: Key, params?: TranslateParams): string {
  const template = en[key]
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match)
}
