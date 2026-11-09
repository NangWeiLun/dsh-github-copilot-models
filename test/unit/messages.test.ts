/**
 * The Card's text helpers (no DOM): numbers and the time have one form in every
 * language (ui.md U4), the size fields take digits 0–9 only, so no language's
 * separators can be misread (models.md A4), and a row's prices (models.md A4).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DICTIONARIES } from '../../src/client/locales.ts'
import type { Key, TranslateParams } from '../../src/client/locales.ts'
import {
  checkText,
  formatCount,
  formatPrice,
  formatTime,
  normalizeSizeField,
  parseSizeField,
  priceColumns,
  pricesKind,
  sizeFieldText,
  tierLabel,
} from '../../src/client/messages.ts'
import { analyseRows, buildModels } from '../../src/host/rows.ts'
import { CHAT_NO_BILLING, ONE_TIER_RESPONSES, PICKER_OFF_FREE, TWO_TIER_MESSAGES } from './model-fixtures.ts'

// ── Numbers and the time (ui.md U4) ──────────────────────────────────────────

/** One language's translate function, filling `{name}` placeholders like DSH's locale service. */
const translate = (dictionary: Readonly<Record<string, string>>) => (key: Key, params?: TranslateParams): string =>
  (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (match, name: string) =>
    params !== undefined && Object.hasOwn(params, name) ? String(params[name]) : match)

test('U4 a count is plain digits: no separators, never an exponent', () => {
  assert.equal(formatCount(272_000), '272000')
  assert.equal(formatCount(1_000_000), '1000000')
  assert.equal(formatCount('936000'), '936000')
  assert.equal(formatCount(1e21), '1000000000000000000000')
  // Not a number: shown as received.
  assert.equal(formatCount('abc'), 'abc')
})

test('U4 a size check shows its limit the way the size fields take it, in every language', () => {
  for (const [language, dictionary] of Object.entries(DICTIONARIES)) {
    const text = checkText(translate(dictionary), 'context-above-window', 272_000)
    // Every number in the text, with any separator a language might put inside it.
    const numbers = text.match(/\d(?:[\d.,\s\u00a0\u202f]*\d)?/g) ?? []
    assert.deepEqual(numbers, ['272000'], `${language}: "${text}"`)
    assert.equal(parseSizeField(numbers[0] ?? ''), 272_000, language)
  }
})

test('U4 the fetch time is local time as 24-hour HH:MM, without the browser\'s language', () => {
  assert.equal(formatTime(new Date(2026, 10, 8, 15, 58).getTime()), '15:58')
  assert.equal(formatTime(new Date(2026, 10, 8, 3, 5).getTime()), '03:05')
  assert.equal(formatTime(new Date(2026, 10, 8, 0, 0, 59).getTime()), '00:00')
  assert.equal(formatTime(new Date(2026, 10, 8, 23, 59, 59).getTime()), '23:59')
  assert.equal(formatTime(Number.NaN), '')
})

// ── Size fields (models.md A4) ───────────────────────────────────────────────

test('A4 a size field reads digits only; empty means Copilot\'s value; spaces around the digits are ignored', () => {
  assert.equal(parseSizeField('128000'), 128_000)
  assert.equal(parseSizeField('  1000000 '), 1_000_000)
  assert.equal(parseSizeField(''), undefined)
  assert.equal(parseSizeField('   '), undefined)
  // Full-width digits, as Chinese and Japanese input methods type them, are digits.
  assert.equal(parseSizeField('１２８０００'), 128_000)
  // Zero is digits: the positive check refuses it, not this one.
  assert.equal(parseSizeField('0'), 0)
})

test('A4 a size field refuses every separator, sign and exponent, whatever the language means by it', () => {
  // German and Spanish 128 thousand, English 128 thousand, French 128 thousand, then a decimal, signs, exponent, underscore.
  for (const typed of ['128.000', '128,000', '128 000', '128\u00a0000', '128\u202f000', '1.000.000', '128,5', '128.5', '-128000', '+128000', '1e6', '128_000', '128k', '１２８，０００']) {
    assert.equal(parseSizeField(typed), null, JSON.stringify(typed))
  }
})

test('A4 a size field shows digits only, the form it accepts', () => {
  assert.equal(sizeFieldText(328_000), '328000')
  assert.equal(sizeFieldText(undefined), '')
  assert.equal(parseSizeField(sizeFieldText(1_050_000)), 1_050_000)
})

test('A4 leaving a size field shows a value it takes as it will be saved; anything else stays as typed', () => {
  // Full-width digits become 0–9; spaces around the digits and leading zeros go.
  assert.equal(normalizeSizeField('１２８０００'), '128000')
  assert.equal(normalizeSizeField(' 128000 '), '128000')
  assert.equal(normalizeSizeField('0128000'), '128000')
  assert.equal(normalizeSizeField('128000'), '128000')
  // Empty means Copilot's value: the field shows its placeholder.
  assert.equal(normalizeSizeField('   '), '')
  // Refused text stays as typed, so it still matches the refusal beside it.
  for (const typed of ['１２８，０００', '128.000', '128,000', '-128000', '１２８k']) {
    assert.equal(normalizeSizeField(typed), typed, JSON.stringify(typed))
  }
})

test('A4 the refusal has its own text in every language', () => {
  for (const [language, dictionary] of Object.entries(DICTIONARIES)) {
    const t = (key: Key) => (dictionary as Readonly<Record<string, string>>)[key] ?? key
    const text = checkText(t, 'not-digits', undefined)
    assert.ok(text.includes('0–9'), `${language}: "${text}"`)
    assert.notEqual(text, checkText(t, 'not-positive', undefined), language)
  }
})

// ── Prices (models.md A4) ────────────────────────────────────────────────────

const rows = buildModels(analyseRows([TWO_TIER_MESSAGES, ONE_TIER_RESPONSES, CHAT_NO_BILLING, PICKER_OFF_FREE]), { visibility: {}, limits: {} }).rows

test('A4 prices: "not reported" without billing, one line when every price is 0, else the prices', () => {
  const [two, one, noBilling, free] = rows
  assert.equal(pricesKind(two?.prices), 'priced')
  // A single non-zero price is enough: cache write 0 beside other prices stays listed.
  assert.equal(pricesKind(one?.prices), 'priced')
  assert.equal(pricesKind(noBilling?.prices), 'none')
  assert.equal(pricesKind(free?.prices), 'zero')
  // billing without any price counts as not reported.
  assert.equal(pricesKind({ batchSize: 1_000_000, tiers: [] }), 'none')
  assert.equal(pricesKind({ tiers: [{ name: 'default', maxPromptTokens: 1000 }] }), 'none')
})

test('A4 prices are shown as received, as plain numbers (ui.md U4): no separators, a dot for decimals, no rounding or exponent', () => {
  assert.equal(formatPrice(2000), '2000')
  assert.equal(formatPrice(400), '400')
  assert.equal(formatPrice(17.5), '17.5')
  assert.equal(formatPrice(0.0625), '0.0625')
  assert.equal(formatPrice(0), '0')
  assert.equal(formatPrice(0.0000001), '0.0000001')
})

test('A4 price table: a column for each value some tier gives, in table order', () => {
  const [two, one] = rows
  assert.ok(two?.prices !== undefined && one?.prices !== undefined)
  const all = ['maxPromptTokens', 'input', 'output', 'cacheRead', 'cacheWrite']
  assert.deepEqual(priceColumns(two.prices).map(([column]) => column), all)
  assert.deepEqual(priceColumns(one.prices).map(([column]) => column), all)
  // No prompt limit on any tier: no prompt column. Cache write 1h only when a tier has it.
  assert.deepEqual(priceColumns({ tiers: [{ name: 'default', input: 100, output: 500 }] }).map(([column]) => column), ['input', 'output'])
  assert.deepEqual(
    priceColumns({ tiers: [{ name: 'default', input: 400 }, { name: 'long_context', input: 400, cacheWrite1h: 800 }] }).map(([column]) => column),
    ['input', 'cacheWrite1h'],
  )
  assert.deepEqual(priceColumns({ tiers: [{ name: 'default', input: 1 }] }).map(([, header]) => header), ['priceColInput'])
})

test('A4 price table: tiers are named Default and Long, as on the size buttons; another tier as received', () => {
  const t = (key: string): string => `<${key}>`
  assert.equal(tierLabel(t, 'default'), '<tierDefault>')
  assert.equal(tierLabel(t, 'long_context'), '<tierLong>')
  assert.equal(tierLabel(t, 'flex'), 'flex')
})
