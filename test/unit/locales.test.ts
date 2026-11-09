/** ui.md U4: every language of the Card has English's keys, placeholders and fixed codes (no DOM). */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DICTIONARIES, en } from '../../src/client/locales.ts'
import { analyseRows, pickerBadgeOf } from '../../src/host/rows.ts'
import { CHAT_NO_BILLING } from './model-fixtures.ts'

/** The languages DSH 0.2.2-rc.1 offers (ui.md U4). */
const LANGUAGES = ['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']

const placeholders = (text: string): string => (text.match(/\{\w+\}/g) ?? []).sort().join(',')

/** Texts that must keep these parts verbatim in every language. */
const FIXED: Readonly<Record<string, readonly string[]>> = {
  modelsHint: ['GitHub Copilot (plugin)'],
  reasonNoId: ['NO_ID'],
  reasonNotChat: ['NOT_CHAT'],
  reasonNoEndpoint: ['NO_ENDPOINT'],
  reasonNoLimits: ['NO_LIMITS'],
  reasonDuplicateId: ['DUPLICATE_ID'],
  headersNote: ['/models'],
}

test('U4 the Card has the eight languages DSH offers', () => {
  assert.deepEqual(Object.keys(DICTIONARIES).sort(), [...LANGUAGES].sort())
})

test('U4 every language has exactly English\'s keys, no empty text, and the same placeholders', () => {
  const keys = Object.keys(en)
  for (const [language, dictionary] of Object.entries(DICTIONARIES) as [string, Readonly<Record<string, string>>][]) {
    assert.deepEqual(Object.keys(dictionary).sort(), [...keys].sort(), `${language}: keys`)
    for (const key of keys) {
      const text = dictionary[key] ?? ''
      assert.notEqual(text.trim(), '', `${language}.${key}: empty`)
      assert.equal(placeholders(text), placeholders(en[key as keyof typeof en]), `${language}.${key}: placeholders`)
    }
  }
})

test('U4 codes, header names and the picker group name stay as they are in every language', () => {
  for (const [language, dictionary] of Object.entries(DICTIONARIES) as [string, Readonly<Record<string, string>>][]) {
    for (const [key, parts] of Object.entries(FIXED)) {
      for (const part of parts) assert.ok(dictionary[key]?.includes(part), `${language}.${key}: keeps ${part}`)
    }
  }
})

test('U2/U4 the menu label stays short in every language (the menu cuts labels over about 112 px)', () => {
  for (const [language, dictionary] of Object.entries(DICTIONARIES) as [string, Readonly<Record<string, string>>][]) {
    // CJK characters are about twice as wide as Latin ones.
    const width = [...dictionary['nav'] ?? ''].reduce((sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1), 0)
    assert.ok(width <= 17, `${language}.nav "${dictionary['nav']}" is ${width} units wide`)
  }
})

test('U6 the page heading equals the plugin\'s name on the Plugins page, in every language', () => {
  for (const [language, dictionary] of Object.entries(DICTIONARIES) as [string, Readonly<Record<string, string>>][]) {
    const meta = JSON.parse(readFileSync(new URL(`../../locale/${language}.json`, import.meta.url), 'utf8')).meta
    assert.equal(dictionary['pageTitle'], meta.title, `${language}: pageTitle`)
    assert.ok(typeof meta.description === 'string' && meta.description.trim() !== '', `${language}: description`)
  }
})

test('A9 the picker label "Deprecating" has a text for every language, at most 12 characters', () => {
  const [row] = analyseRows([{ ...CHAT_NO_BILLING, info_messages: [{ code: 'model_pending_deprecation', message: 'Retiring.' }] }])
  assert.ok(row !== undefined)
  const text = pickerBadgeOf(row, 1).text
  assert.equal(typeof text, 'object')
  const texts = text as Readonly<Record<string, string>>
  assert.deepEqual(Object.keys(texts).sort(), [...LANGUAGES].sort())
  for (const [language, label] of Object.entries(texts)) assert.ok([...label].length <= 12, `${language}: "${label}"`)
})
