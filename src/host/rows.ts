/**
 * Rows of the `/models` reply → what the Card shows (models.md A4) and the pi
 * models DSH serves (A7). Pure functions over a reply, the stored choices and
 * the Copilot host; no I/O, no state.
 *
 * Every limit and price comes from the reply; nothing is hard-coded or
 * guessed. A field the reply does not give stays missing.
 */
import type { LlmModelBadge } from '@deepseek-ai/dsh-llm'
import { PENDING_DEPRECATION } from '../shared/api.ts'
import type {
  GoneModel,
  InfoMessage,
  LimitCheck,
  ModelRow,
  ModelSizes,
  Prices,
  PriceTier,
  ReasonCode,
  StoredChoice,
  ToggleState,
  Wire,
} from '../shared/api.ts'

/** The plugin's route id: every model request carries it as `provider` (models.md A8). */
export const ROUTE_ID = 'github-copilot-models'

/** pi-ai's thinking levels, in its escalation order (models.md A7). */
export const PI_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type PiLevel = (typeof PI_LEVELS)[number]

/** Usable endpoints in the order a wire is chosen (models.md A7). */
const WIRE_ORDER: readonly (readonly [string, Wire])[] = [
  ['/responses', 'openai-responses'],
  ['/v1/messages', 'anthropic-messages'],
  ['/chat/completions', 'openai-completions'],
]

/**
 * The stored choices (models.md A5), as read from `Config`. A sizes entry may
 * carry keys of an earlier design (`tier`); only `context` and `output` are read.
 */
export interface StoredChoices {
  readonly visibility: Readonly<Record<string, boolean>>
  readonly limits: Readonly<Record<string, { readonly context?: number; readonly output?: number }>>
}

/** One row, read once: everything the Card's list and the pi model need. */
export interface AnalysedRow {
  readonly index: number
  readonly raw: unknown
  readonly id?: string
  readonly name: string
  readonly reason?: ReasonCode
  readonly wire?: Wire
  readonly policy?: string
  readonly info?: readonly InfoMessage[]
  readonly pickerEnabled: boolean
  readonly vision: boolean
  /** `max_context_window_tokens`, `max_output_tokens`. */
  readonly window?: number
  readonly maxOutput?: number
  /** `max_prompt_tokens` of the default and long tiers. */
  readonly defaultTierPrompt?: number
  readonly longTierPrompt?: number
  readonly efforts: readonly PiLevel[]
  readonly adaptive: boolean
  readonly prices?: Prices
}

/** The sizes a row ends up with (models.md A4, A7). */
export interface ResolvedSizes {
  readonly view: ModelSizes
  /** What DSH sees; `context` is absent when the model would have no context size. */
  readonly context?: number
  readonly output?: number
}

/** The part of a pi model built from a row (models.md A7); the adapter adds the static fields. */
export interface PiModelSpec {
  readonly id: string
  readonly name: string
  readonly api: Wire
  readonly input: readonly ('text' | 'image')[]
  readonly reasoning: boolean
  readonly thinkingLevelMap?: Readonly<Record<PiLevel, string | null>>
  readonly contextWindow: number
  readonly maxTokens: number
  readonly compat: Readonly<Record<string, unknown>>
  /** The model's label in DSH's model picker (models.md A9); not part of the pi model. */
  readonly badge: LlmModelBadge
}

/** Token counts as the picker label shows them: 328K, 1M, 1.05M. */
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

/**
 * A switched-on row's label in DSH's model picker (models.md A9): its context
 * size as DSH sees it, or "Deprecating" while Copilot announces a planned
 * retirement (`model_pending_deprecation`).
 */
export function pickerBadgeOf(row: AnalysedRow, contextWindow: number): LlmModelBadge {
  if (row.info?.some((info) => info.code === PENDING_DEPRECATION) === true) {
    // One text per DSH language (ui.md U4); DSH falls back to English for any other.
    return {
      text: { en: 'Deprecating', zh: '即将弃用', ja: '廃止予定', es: 'Se retirará', fr: 'Fin annoncée', de: 'Auslaufend', ru: 'Устаревает', pt: 'Em desuso' },
      tone: 'warning',
    }
  }
  return { text: COMPACT.format(contextWindow), tone: 'neutral' }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  return isRecord(value) ? value : {}
}

/** A positive integer from the reply; anything else counts as missing (models.md A7). */
export function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isPiLevel(value: unknown): value is PiLevel {
  return typeof value === 'string' && (PI_LEVELS as readonly string[]).includes(value)
}

/** The wire for a row's `supported_endpoints`, or undefined without a usable one. */
export function wireFor(endpoints: unknown): Wire | undefined {
  if (!Array.isArray(endpoints)) return undefined
  for (const [endpoint, wire] of WIRE_ORDER) {
    if (endpoints.includes(endpoint)) return wire
  }
  return undefined
}

function priceTier(name: string, value: unknown): PriceTier | undefined {
  if (!isRecord(value)) return undefined
  const fields: [keyof PriceTier, unknown][] = [
    ['maxPromptTokens', value.max_prompt_tokens],
    ['input', value.input_price],
    ['output', value.output_price],
    ['cacheRead', value.cache_read_price],
    ['cacheWrite', value.cache_write_price],
    ['cacheWrite1h', value.cache_write_1h_price],
  ]
  const tier: Record<string, number | string> = { name }
  for (const [key, raw] of fields) {
    const number = finiteNumber(raw)
    if (number !== undefined) tier[key] = number
  }
  return tier as unknown as PriceTier
}

/** Prices as received (models.md A4, B3); undefined without `billing`. */
function pricesOf(billing: unknown): Prices | undefined {
  if (!isRecord(billing)) return undefined
  const tokenPrices = recordOf(billing.token_prices)
  const tiers: PriceTier[] = []
  for (const [name, value] of Object.entries(tokenPrices)) {
    if (name === 'batch_size') continue
    const tier = priceTier(name, value)
    if (tier !== undefined) tiers.push(tier)
  }
  // The default tier first, then the others as received.
  tiers.sort((a, b) => Number(b.name === 'default') - Number(a.name === 'default'))
  const batchSize = finiteNumber(tokenPrices.batch_size)
  return batchSize === undefined ? { tiers } : { batchSize, tiers }
}

/** A row's `info_messages` that carry a text, as received (models.md A4, B3); undefined without any. */
function infoOf(value: unknown): InfoMessage[] | undefined {
  if (!Array.isArray(value)) return undefined
  const info = value.flatMap((entry): InfoMessage[] => {
    const item = recordOf(entry)
    if (typeof item.message !== 'string' || item.message.trim() === '') return []
    return [{ ...typeof item.code === 'string' && item.code !== '' ? { code: item.code } : {}, message: item.message }]
  })
  return info.length === 0 ? undefined : info
}

/**
 * Read every row of a reply once, with its reason code (models.md A10).
 * @param data - the reply's `data` array, as received.
 * @returns one analysed row per element, in reply order.
 */
export function analyseRows(data: readonly unknown[]): AnalysedRow[] {
  const seen = new Set<string>()
  return data.map((raw, index) => {
    const row = recordOf(raw)
    const id = typeof row.id === 'string' && row.id !== '' ? row.id : undefined
    const capabilities = recordOf(row.capabilities)
    const limits = recordOf(capabilities.limits)
    const supports = recordOf(capabilities.supports)
    const tokenPrices = recordOf(recordOf(row.billing).token_prices)
    const wire = wireFor(row.supported_endpoints)
    const maxOutput = positiveInt(limits.max_output_tokens)
    const adaptive = supports.adaptive_thinking === true
    const efforts = Array.isArray(supports.reasoning_effort)
      ? PI_LEVELS.filter((level) => level !== 'off' && (supports.reasoning_effort as unknown[]).includes(level))
      : []

    let reason: ReasonCode | undefined
    if (id === undefined) reason = 'NO_ID'
    else if (capabilities.type !== 'chat') reason = 'NOT_CHAT'
    else if (wire === undefined) reason = 'NO_ENDPOINT'
    else if (maxOutput === undefined) reason = 'NO_LIMITS'
    else if (seen.has(id)) reason = 'DUPLICATE_ID'
    if (id !== undefined) seen.add(id)

    const name = typeof row.name === 'string' && row.name !== '' ? row.name : id ?? `#${index + 1}`
    const policy = typeof recordOf(row.policy).state === 'string' ? recordOf(row.policy).state as string : undefined
    const info = infoOf(row.info_messages)
    const window = positiveInt(limits.max_context_window_tokens)
    const defaultTierPrompt = positiveInt(recordOf(tokenPrices.default).max_prompt_tokens)
    const longTierPrompt = positiveInt(recordOf(tokenPrices.long_context).max_prompt_tokens)
    const prices = pricesOf(row.billing)
    return {
      index,
      raw,
      ...id === undefined ? {} : { id },
      name,
      ...reason === undefined ? {} : { reason },
      ...wire === undefined ? {} : { wire },
      ...policy === undefined ? {} : { policy },
      ...info === undefined ? {} : { info },
      pickerEnabled: row.model_picker_enabled === true,
      vision: supports.vision === true,
      ...window === undefined ? {} : { window },
      ...maxOutput === undefined ? {} : { maxOutput },
      ...defaultTierPrompt === undefined ? {} : { defaultTierPrompt },
      ...longTierPrompt === undefined ? {} : { longTierPrompt },
      // On the Messages wire pi-ai sends an effort only with adaptive thinking (A7, B6).
      efforts: wire === 'anthropic-messages' && !adaptive ? [] : efforts,
      adaptive,
      ...prices === undefined ? {} : { prices },
    }
  })
}

/** Whether a row offers the Long size: both tiers give `max_prompt_tokens` (models.md A4). */
export function isTwoTier(row: AnalysedRow): boolean {
  return row.defaultTierPrompt !== undefined && row.longTierPrompt !== undefined && row.maxOutput !== undefined
}

/** A tier's context size: its prompt cap plus the output cap, never above the window. */
function tierContext(prompt: number, output: number, window: number | undefined): number {
  const size = prompt + output
  return window === undefined ? size : Math.min(size, window)
}

/**
 * Copilot's context (models.md A4): the default tier's size when that tier
 * gives `max_prompt_tokens`, otherwise `max_context_window_tokens`. On a
 * two-tier row this is the Default size.
 */
export function copilotContextOf(row: AnalysedRow): number | undefined {
  return row.defaultTierPrompt !== undefined && row.maxOutput !== undefined
    ? tierContext(row.defaultTierPrompt, row.maxOutput, row.window)
    : row.window
}

/** The row's prompt limit (models.md A4): the long tier's `max_prompt_tokens`, else the default tier's. */
function promptLimitOf(row: AnalysedRow): number | undefined {
  return row.longTierPrompt ?? row.defaultTierPrompt
}

/**
 * Check a row's pair in use (models.md A4). An empty field counts as
 * Copilot's value; a value the reply does not give is not checked.
 * @returns the first failed check, or undefined when the pair passes.
 */
export function checkSizes(
  row: AnalysedRow,
  context: number | undefined,
  output: number | undefined,
): { readonly check: LimitCheck; readonly limit?: number } | undefined {
  for (const value of [context, output]) {
    if (value !== undefined && positiveInt(value) === undefined) return { check: 'not-positive' }
  }
  const effectiveContext = context ?? copilotContextOf(row)
  const effectiveOutput = output ?? row.maxOutput
  if (effectiveContext !== undefined && row.window !== undefined && effectiveContext > row.window) {
    return { check: 'context-above-window', limit: row.window }
  }
  if (effectiveOutput !== undefined && row.maxOutput !== undefined && effectiveOutput > row.maxOutput) {
    return { check: 'output-above-max', limit: row.maxOutput }
  }
  if (effectiveContext !== undefined && effectiveOutput !== undefined && effectiveOutput >= effectiveContext) {
    return { check: 'output-not-below-context', limit: effectiveContext }
  }
  const promptLimit = promptLimitOf(row)
  if (effectiveContext !== undefined && effectiveOutput !== undefined && promptLimit !== undefined
    && effectiveContext - effectiveOutput > promptLimit) {
    return { check: 'prompt-above-tier', limit: promptLimit }
  }
  return undefined
}

/** A two-tier row's Long size: the long tier's prompt cap plus the output cap, never above the window (models.md A4). */
function longContextOf(row: AnalysedRow): number | undefined {
  return isTwoTier(row) ? tierContext(row.longTierPrompt as number, row.maxOutput as number, row.window) : undefined
}

/**
 * The sizes of one serviceable row (models.md A4, A7): the stored sizes when
 * they pass the checks, else Copilot's values; and a two-tier row's Long size.
 */
export function resolveSizes(row: AnalysedRow, stored: StoredChoices['limits'][string] | undefined): ResolvedSizes {
  const storedContext = stored?.context
  const storedOutput = stored?.output
  const problem = storedContext === undefined && storedOutput === undefined ? undefined : checkSizes(row, storedContext, storedOutput)
  const useStored = problem === undefined
  const copilotContext = copilotContextOf(row)
  const context = (useStored ? storedContext : undefined) ?? copilotContext
  const output = (useStored ? storedOutput : undefined) ?? row.maxOutput
  const longContext = longContextOf(row)
  const view: ModelSizes = {
    ...storedContext === undefined ? {} : { storedContext },
    ...storedOutput === undefined ? {} : { storedOutput },
    ...copilotContext === undefined ? {} : { copilotContext },
    ...row.maxOutput === undefined ? {} : { copilotOutput: row.maxOutput },
    ...context === undefined ? {} : { effectiveContext: context },
    ...output === undefined ? {} : { effectiveOutput: output },
    ...longContext === undefined ? {} : { longContext },
    ...problem === undefined ? {} : { problem },
  }
  return {
    view,
    ...context === undefined ? {} : { context },
    ...output === undefined ? {} : { output },
  }
}

/** The toggle (models.md A4), decided in order. */
export function toggleOf(row: AnalysedRow, sizes: ResolvedSizes | undefined, visible: boolean | undefined): ToggleState {
  if (row.reason !== undefined || sizes === undefined) return 'locked'
  if (sizes.context === undefined) return 'off'
  if (visible !== undefined) return visible ? 'on' : 'off'
  return row.pickerEnabled ? 'on' : 'off'
}

/** pi-ai's `thinkingLevelMap`: every level explicit, `off` always `null` (models.md A7). */
export function thinkingLevelMapFor(efforts: readonly PiLevel[]): Record<PiLevel, string | null> {
  const map = {} as Record<PiLevel, string | null>
  for (const level of PI_LEVELS) map[level] = level !== 'off' && efforts.includes(level) ? level : null
  return map
}

/** `compat` per wire (models.md A7). */
export function compatFor(wire: Wire, row: AnalysedRow): Record<string, unknown> {
  switch (wire) {
    case 'anthropic-messages':
      return { forceAdaptiveThinking: row.adaptive, supportsEagerToolInputStreaming: false }
    case 'openai-completions':
      return {
        supportsStore: false,
        supportsDeveloperRole: false,
        supportsStrictMode: false,
        supportsReasoningEffort: row.efforts.length > 0,
        thinkingFormat: 'openai',
      }
    case 'openai-responses':
      return { supportsStrictMode: false }
  }
}

/** The stored choices for one id, as the Card shows them. */
export function storedChoiceOf(choices: StoredChoices, id: string | undefined): StoredChoice {
  if (id === undefined) return {}
  const visible = Object.hasOwn(choices.visibility, id) ? choices.visibility[id] : undefined
  const limits = Object.hasOwn(choices.limits, id) ? choices.limits[id] : undefined
  return {
    ...visible === undefined ? {} : { visible },
    ...limits?.context === undefined ? {} : { context: limits.context },
    ...limits?.output === undefined ? {} : { output: limits.output },
  }
}

/** The table and the pi models for one row list (models.md A4, A7). */
export interface BuiltModels {
  readonly rows: readonly ModelRow[]
  readonly specs: readonly PiModelSpec[]
  readonly gone: readonly GoneModel[]
}

/**
 * Build the Card's list, in A4 order, and the pi model specs of the
 * switched-on rows, in reply order.
 * @param analysed - the row list, analysed.
 * @param choices - the stored choices.
 */
export function buildModels(analysed: readonly AnalysedRow[], choices: StoredChoices): BuiltModels {
  const serviceable: ModelRow[] = []
  const locked: ModelRow[] = []
  const specs: PiModelSpec[] = []
  for (const row of analysed) {
    const stored = storedChoiceOf(choices, row.id)
    const limits = row.id !== undefined && Object.hasOwn(choices.limits, row.id) ? choices.limits[row.id] : undefined
    const sizes = row.reason === undefined ? resolveSizes(row, limits) : undefined
    const toggle = toggleOf(row, sizes, stored.visible)
    const view: ModelRow = {
      key: row.id ?? `#${row.index}`,
      ...row.id === undefined ? {} : { id: row.id },
      name: row.name,
      toggle,
      ...row.reason === undefined ? {} : { reason: row.reason },
      ...row.policy === undefined ? {} : { policy: row.policy },
      ...row.info === undefined ? {} : { info: row.info },
      ...row.wire === undefined ? {} : { wire: row.wire },
      ...sizes === undefined ? {} : { sizes: sizes.view },
      ...row.prices === undefined ? {} : { prices: row.prices },
      stored,
      row: row.raw,
    }
    if (toggle === 'locked') locked.push(view)
    else serviceable.push(view)
    if (toggle === 'on' && sizes?.context !== undefined && sizes.output !== undefined && row.id !== undefined && row.wire !== undefined) {
      const reasoning = row.efforts.length > 0
      specs.push({
        id: row.id,
        name: row.name,
        api: row.wire,
        input: row.vision ? ['text', 'image'] : ['text'],
        reasoning,
        ...reasoning ? { thinkingLevelMap: thinkingLevelMapFor(row.efforts) } : {},
        contextWindow: sizes.context,
        maxTokens: sizes.output,
        compat: compatFor(row.wire, row),
        badge: pickerBadgeOf(row, sizes.context),
      })
    }
  }
  const returned = new Set(analysed.flatMap((row) => row.id === undefined ? [] : [row.id]))
  const goneIds = analysed.length === 0
    ? []
    : [...new Set([...Object.keys(choices.visibility), ...Object.keys(choices.limits)])].filter((id) => !returned.has(id))
  const gone = goneIds.map((id) => ({ id, stored: storedChoiceOf(choices, id) }))
  return { rows: [...serviceable, ...locked], specs, gone }
}
