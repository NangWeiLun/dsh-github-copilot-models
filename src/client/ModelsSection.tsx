/**
 * The Models section of the Card (models.md A4, A6; ui.md U3): the model
 * table, the "no longer returned" list, and the custom request headers.
 * State and Host calls live in use-models.ts; the Card never sees a token.
 */
import React, { useEffect, useId, useState } from 'react'
import { PENDING_DEPRECATION } from '../shared/api.ts'
import type { CardError, GoneModel, LimitCheck, LoginState, ModelRow, ModelSizes, ModelsState, Prices, ReasonCode, StoredChoice } from '../shared/api.ts'
import type { Key, Translate } from './locales.ts'
import { cardError, checkText, errorText, formatCount, formatPrice, formatTime, messageText, normalizeSizeField, parseSizeField, priceColumns, pricesKind, sizeFieldText, tierLabel } from './messages.ts'
import type { Line, Tone } from './messages.ts'
import { Busy, Fold, Lines } from './parts.tsx'
import type { ModelsModel, ModelsResult } from './use-models.ts'

const REASON_KEYS: Readonly<Record<ReasonCode, Key>> = {
  NO_ID: 'reasonNoId',
  NOT_CHAT: 'reasonNotChat',
  NO_ENDPOINT: 'reasonNoEndpoint',
  NO_LIMITS: 'reasonNoLimits',
  DUPLICATE_ID: 'reasonDuplicateId',
}

/** The policy state that needs no badge: only another state is shown (models.md A4). */
const POLICY_ENABLED = 'enabled'

export function ModelsSection(props: {
  readonly t: Translate
  readonly login: LoginState
  readonly model: ModelsModel
}): React.JSX.Element {
  const { t, login, model } = props
  const { models } = model
  const signedOut = login.status === 'signed-out'
  const fetching = login.modelsFetching || models?.fetching === true

  return (
    <section className="gcm-card" aria-busy={fetching}>
      <h3 className="gcm-title">{t('modelsTitle')}</h3>
      <p className="gcm-hint">{t('modelsHint')}</p>
      {model.loadProblem !== undefined && (
        <div className="gcm-actions">
          <Lines t={t} lines={[{ tone: 'error', message: { kind: 'problem', problem: model.loadProblem } }]} />
          <button type="button" className="gcm-button" onClick={model.reload}>{t('retry')}</button>
        </div>
      )}
      {models?.routeError !== undefined && <p className="gcm-line gcm-tone-error">{errorText(t, models.routeError)}</p>}
      {fetching && <Busy>{t('modelsFetching')}</Busy>}
      {models !== undefined && <Summary t={t} models={models} signedOut={signedOut} />}
      {models !== undefined && models.rows.length > 0 && <ModelTable t={t} models={models} model={model} />}
      {models !== undefined && models.gone.length > 0 && <GoneList t={t} gone={models.gone} model={model} />}
      {models !== undefined && <HeadersEditor t={t} headers={models.headers} model={model} />}
    </section>
  )
}

function Summary(props: { readonly t: Translate; readonly models: ModelsState; readonly signedOut: boolean }): React.JSX.Element | null {
  const { t, models, signedOut } = props
  const failed = models.lastFetch?.error
  if (models.rows.length === 0) {
    return (
      <>
        <p className="gcm-text">{signedOut ? t('modelsSignedOut') : t('modelsEmpty')}</p>
        {failed !== undefined && !signedOut && <p className="gcm-line gcm-tone-error">{errorText(t, failed)}</p>}
      </>
    )
  }
  return (
    <>
      <p className="gcm-caption">
        {t('modelsSummary', {
          rows: models.rows.length,
          host: models.host ?? '',
          time: models.fetchedAt === undefined ? '' : formatTime(models.fetchedAt),
          published: models.published,
        })}
      </p>
      {failed !== undefined && (
        <>
          <p className="gcm-line gcm-tone-warn">{t('modelsFetchFailed')}</p>
          <p className="gcm-line gcm-tone-error">{errorText(t, failed)}</p>
        </>
      )}
    </>
  )
}

function ModelTable(props: { readonly t: Translate; readonly models: ModelsState; readonly model: ModelsModel }): React.JSX.Element {
  const { t, models, model } = props
  // A list, not a table: the Settings panel is about 540 px wide (ui.md U3).
  // The rows that cannot be served go into one fold after the others, closed
  // at first unless no row can be served (models.md A4).
  const served = models.rows.filter((row) => row.toggle !== 'locked')
  const locked = models.rows.filter((row) => row.toggle === 'locked')
  const lockedTitle = locked.length === 1 ? t('lockedGroupOne') : t('lockedGroup', { count: locked.length })
  return (
    <>
      {served.length > 0 && (
        <ul className="gcm-models" aria-label={t('modelsTitle')}>
          {served.map((row) => <ModelRowView key={row.key} t={t} row={row} model={model} />)}
        </ul>
      )}
      {locked.length > 0 && (
        <Fold title={lockedTitle} defaultOpen={served.length === 0} className="gcm-fold-group">
          {() => (
            <ul className="gcm-models" aria-label={lockedTitle}>
              {locked.map((row) => <ModelRowView key={row.key} t={t} row={row} model={model} />)}
            </ul>
          )}
        </Fold>
      )}
    </>
  )
}

function ModelRowView(props: { readonly t: Translate; readonly row: ModelRow; readonly model: ModelsModel }): React.JSX.Element {
  const { t, row, model } = props
  const busy = model.pending !== undefined
  const lines = model.result?.area.kind === 'model' && model.result.area.key === row.key ? model.result.lines : []
  const locked = row.toggle === 'locked'
  return (
    <li className={locked ? 'gcm-model gcm-model-locked' : 'gcm-model'}>
      <div className="gcm-model-head">
        <div className="gcm-model-titles">
          <span className="gcm-model-name">{row.name}</span>
          {row.policy !== undefined && row.policy !== POLICY_ENABLED && (
            <span className="gcm-badge gcm-badge-warn">{t('policyBadge', { state: row.policy })}</span>
          )}
        </div>
        {locked
          ? <span className="gcm-hint">{t('toggleLocked')}</span>
          : <Toggle t={t} row={row} busy={busy} model={model} />}
      </div>
      <div className="gcm-mono gcm-hint">
        {[row.id, row.wire].filter((part): part is string => part !== undefined).join(' · ')}
      </div>
      {row.reason !== undefined && <p className="gcm-line gcm-tone-info">{t(REASON_KEYS[row.reason])}</p>}
      {row.info?.map((info, index) => (
        <p key={index} className={`gcm-model-info gcm-tone-${info.code === PENDING_DEPRECATION ? 'warn' : 'info'}`}>{info.message}</p>
      ))}
      {row.sizes !== undefined && row.id !== undefined && (
        <dl className="gcm-facts gcm-model-facts">
          <SizeControl t={t} id={row.id} rowKey={row.key} sizes={row.sizes} model={model} />
        </dl>
      )}
      <PricesView t={t} prices={row.prices} />
      <Lines t={t} lines={lines} />
      <Fold title={t('details')} defaultOpen={false}>
        {() => <pre className="gcm-details">{JSON.stringify(row.row, null, 2)}</pre>}
      </Fold>
    </li>
  )
}

/** A switch, as DSH's own: `role="switch"` with `aria-checked`. */
function Toggle(props: { readonly t: Translate; readonly row: ModelRow; readonly busy: boolean; readonly model: ModelsModel }): React.JSX.Element {
  const { t, row, busy, model } = props
  const on = row.toggle === 'on'
  const id = row.id
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t('toggleLabel', { name: row.name })}
      className="gcm-switch"
      disabled={busy || id === undefined}
      onClick={() => {
        if (id !== undefined) model.setVisibility(row.key, { id, on: !on })
      }}
    >
      <span className="gcm-switch-thumb" aria-hidden="true" />
    </button>
  )
}

/** What Save stores for a field: nothing when it is empty or holds Copilot's value (models.md A4). */
function toStore(value: number | undefined, copilot: number | undefined): number | undefined {
  return value === copilot ? undefined : value
}

interface SizeCheck {
  readonly check: LimitCheck
  readonly limit?: number
}

/**
 * The two checks the Card makes as you type (models.md A4); the Host makes
 * all of them on Save. Going back to Copilot's values is not checked.
 */
function localCheck(context: number | undefined | null, output: number | undefined | null, sizes: ModelSizes): SizeCheck | undefined {
  if (context === null || output === null) return { check: 'not-digits' }
  if ([context, output].some((value) => value !== undefined && !(Number.isInteger(value) && value > 0))) return { check: 'not-positive' }
  if (toStore(context, sizes.copilotContext) === undefined && toStore(output, sizes.copilotOutput) === undefined) return undefined
  const c = context ?? sizes.copilotContext
  const o = output ?? sizes.copilotOutput
  return c !== undefined && o !== undefined && o >= c ? { check: 'output-not-below-context', limit: c } : undefined
}

/**
 * Context and output (models.md A4; ui.md U3), as rows of the block's facts:
 * Context and Output, each a field with buttons that fill it in, then Save
 * with its messages beside it. Nothing is stored until Save.
 */
function SizeControl(props: {
  readonly t: Translate
  readonly id: string
  readonly rowKey: string
  readonly sizes: ModelSizes
  readonly model: ModelsModel
}): React.JSX.Element {
  const { t, id, rowKey, sizes, model } = props
  const [context, setContext] = useState(sizeFieldText(sizes.storedContext ?? sizes.copilotContext))
  const [output, setOutput] = useState(sizeFieldText(sizes.storedOutput ?? sizes.copilotOutput))
  // The fields follow the stored values, or Copilot's, whenever they change on the Host.
  useEffect(() => {
    setContext(sizeFieldText(sizes.storedContext ?? sizes.copilotContext))
  }, [sizes.storedContext, sizes.copilotContext])
  useEffect(() => {
    setOutput(sizeFieldText(sizes.storedOutput ?? sizes.copilotOutput))
  }, [sizes.storedOutput, sizes.copilotOutput])
  const result = model.result?.area.kind === 'sizes' && model.result.area.key === rowKey ? model.result : undefined
  // A result stays until the fields change after it.
  const [editedAfter, setEditedAfter] = useState<ModelsResult | undefined>(undefined)
  const edit = (set: (text: string) => void, text: string): void => {
    set(text)
    setEditedAfter(result)
  }
  const contextId = useId()
  const outputId = useId()
  const busy = model.pending !== undefined
  const c = parseSizeField(context)
  const o = parseSizeField(output)
  const local = localCheck(c, o, sizes)
  const nextContext = c === null ? null : toStore(c, sizes.copilotContext)
  const nextOutput = o === null ? null : toStore(o, sizes.copilotOutput)
  const dirty = nextContext !== sizes.storedContext || nextOutput !== sizes.storedOutput
  const contextDefault = c === undefined || c === sizes.copilotContext
  const contextLong = !contextDefault && sizes.longContext !== undefined && c === sizes.longContext
  const outputDefault = o === undefined || o === sizes.copilotOutput
  const placeholder = (value: number | undefined): string => value === undefined ? t('sizeNotReported') : sizeFieldText(value)
  const save = (): void => {
    if (local !== undefined || nextContext === null || nextOutput === null) return
    model.setLimits(rowKey, nextContext === undefined && nextOutput === undefined
      ? { id, clear: true }
      : { id, ...nextContext === undefined ? {} : { context: nextContext }, ...nextOutput === undefined ? {} : { output: nextOutput } })
  }
  const lines: readonly { readonly tone: Tone; readonly text: string }[] = [
    ...local === undefined ? [] : [{ tone: 'error' as const, text: t('sizeCannotSave', { problem: checkText(t, local.check, local.limit) }) }],
    ...result === undefined || result === editedAfter ? [] : result.lines.map((line) => ({ tone: line.tone, text: messageText(t, line.message) })),
    ...sizes.effectiveContext === undefined ? [{ tone: 'warn' as const, text: t('sizeNeedsContext') }] : [],
    ...sizes.problem === undefined ? [] : [{ tone: 'warn' as const, text: t('sizeStoredProblem', { problem: checkText(t, sizes.problem.check, sizes.problem.limit) }) }],
  ]
  return (
    <>
      <dt className="gcm-size-term"><label htmlFor={contextId}>{t('sizeContext')}</label></dt>
      <dd className="gcm-size-row">
        <input id={contextId} className="gcm-input gcm-input-sm" inputMode="numeric" autoComplete="off" placeholder={placeholder(sizes.copilotContext)} value={context} disabled={busy} onChange={(event) => edit(setContext, event.target.value)} onBlur={(event) => setContext(normalizeSizeField(event.target.value))} />
        <div className="gcm-presets" role="group" aria-label={t('sizeContextPresets')}>
          <button type="button" className="gcm-button gcm-preset" aria-pressed={contextDefault} disabled={busy} onClick={() => edit(setContext, sizeFieldText(sizes.copilotContext))}>
            {t('tierDefault')}
          </button>
          {sizes.longContext !== undefined && (
            <button type="button" className="gcm-button gcm-preset" aria-pressed={contextLong} disabled={busy} onClick={() => edit(setContext, sizeFieldText(sizes.longContext))}>
              {t('tierLong')}
            </button>
          )}
        </div>
      </dd>
      <dt className="gcm-size-term"><label htmlFor={outputId}>{t('sizeOutput')}</label></dt>
      <dd className="gcm-size-row">
        <input id={outputId} className="gcm-input gcm-input-sm" inputMode="numeric" autoComplete="off" placeholder={placeholder(sizes.copilotOutput)} value={output} disabled={busy} onChange={(event) => edit(setOutput, event.target.value)} onBlur={(event) => setOutput(normalizeSizeField(event.target.value))} />
        <div className="gcm-presets" role="group" aria-label={t('sizeOutputPresets')}>
          <button type="button" className="gcm-button gcm-preset" aria-pressed={outputDefault} disabled={busy} onClick={() => edit(setOutput, sizeFieldText(sizes.copilotOutput))}>
            {t('tierDefault')}
          </button>
        </div>
      </dd>
      <dd className="gcm-size-save">
        <button type="button" className="gcm-button" disabled={busy || !dirty || local !== undefined} onClick={save}>{t('sizeSave')}</button>
        {/* One polite live region that stays mounted, as Lines (parts.tsx). */}
        <div className="gcm-lines gcm-size-messages" role="status" aria-live="polite">
          {lines.map((line, index) => <p key={index} className={`gcm-line gcm-tone-${line.tone}`}>{line.text}</p>)}
        </div>
      </dd>
    </>
  )
}

/**
 * A row's prices (models.md A4; ui.md U3): a fold titled Prices, open at
 * first, holding a small table: one row per tier, the columns some tier
 * gives, the unit as its caption. Without a price to show, one plain line.
 */
function PricesView(props: { readonly t: Translate; readonly prices: Prices | undefined }): React.JSX.Element {
  const { t, prices } = props
  const kind = pricesKind(prices)
  // Nothing to open: the title and the fact on one line (A4).
  const plain = (key: Key): React.JSX.Element => (
    <p className="gcm-fold-line"><span className="gcm-fold-label">{t('colPrices')}</span><span className="gcm-hint">{t(key)}</span></p>
  )
  if (prices === undefined || kind === 'none') return plain('pricesNone')
  // Every price 0 (seen with batch_size 0): one line instead of the zeros (A4).
  if (kind === 'zero') return plain('pricesAllZero')
  const batch = prices.batchSize === undefined || prices.batchSize === 0 ? undefined : prices.batchSize
  const columns = priceColumns(prices)
  return (
    <Fold title={t('colPrices')} defaultOpen>
      {() => (
        <table className="gcm-price-table">
          <caption>{batch === undefined ? t('pricesUnitNoBatch') : t('pricesUnit', { batch: formatCount(batch) })}</caption>
          <thead>
            <tr>
              <td />
              {columns.map(([column, header]) => <th key={column} scope="col">{t(header)}</th>)}
            </tr>
          </thead>
          <tbody>
            {prices.tiers.map((tier) => (
              <tr key={tier.name}>
                <th scope="row">{tierLabel(t, tier.name)}</th>
                {columns.map(([column]) => {
                  const value = tier[column]
                  return <td key={column}>{value === undefined ? '' : column === 'maxPromptTokens' ? formatCount(value) : formatPrice(value)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Fold>
  )
}

function storedText(t: Translate, stored: StoredChoice): string {
  return [
    stored.visible === undefined ? undefined : t(stored.visible ? 'storedVisible' : 'storedHidden'),
    stored.context === undefined ? undefined : t('storedContext', { value: formatCount(stored.context) }),
    stored.output === undefined ? undefined : t('storedOutput', { value: formatCount(stored.output) }),
  ].filter((part): part is string => part !== undefined).join(t('listSeparator'))
}

function GoneList(props: { readonly t: Translate; readonly gone: readonly GoneModel[]; readonly model: ModelsModel }): React.JSX.Element {
  const { t, gone, model } = props
  const busy = model.pending !== undefined
  return (
    <div className="gcm-block">
      <h4 className="gcm-subtitle">{t('goneTitle')}</h4>
      <p className="gcm-hint">{t('goneHint')}</p>
      <ul className="gcm-gone">
        {gone.map((entry) => {
          const lines = model.result?.area.kind === 'model' && model.result.area.key === entry.id ? model.result.lines : []
          return (
            <li key={entry.id}>
              <span className="gcm-mono">{entry.id}</span>
              <span className="gcm-hint">{storedText(t, entry.stored)}</span>
              <button
                type="button"
                className="gcm-button"
                disabled={busy}
                onClick={() => model.clearGone(entry)}
              >
                {t('goneClear')}
              </button>
              <Lines t={t} lines={lines} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface HeaderRow {
  readonly key: number
  readonly name: string
  readonly value: string
}

function rowsOf(headers: Readonly<Record<string, string>>): HeaderRow[] {
  return Object.entries(headers).map(([name, value], index) => ({ key: index, name, value }))
}

/**
 * A problem the Card can see before saving: an empty name, or a name given
 * twice (compared without case). Two rows with the same name would collapse
 * into one key of the request, so they are refused here, with the Host's
 * own error code (models.md A6). The Host checks everything again.
 */
function draftProblem(rows: readonly HeaderRow[]): CardError | undefined {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.name.trim() === '') return { code: 'HEADER_REFUSED', params: { name: row.name, reason: 'empty' } }
    const lower = row.name.toLowerCase()
    if (seen.has(lower)) return { code: 'HEADER_REFUSED', params: { name: row.name, reason: 'duplicate' } }
    seen.add(lower)
  }
  return undefined
}

function HeadersEditor(props: { readonly t: Translate; readonly headers: Readonly<Record<string, string>>; readonly model: ModelsModel }): React.JSX.Element {
  const { t, headers, model } = props
  const [rows, setRows] = useState<HeaderRow[]>(() => rowsOf(headers))
  const [nextKey, setNextKey] = useState(rows.length)
  const [localProblem, setLocalProblem] = useState<CardError | undefined>(undefined)
  const stored = JSON.stringify(headers)
  // The list follows the stored headers whenever they change on the Host.
  useEffect(() => {
    const fresh = rowsOf(JSON.parse(stored) as Record<string, string>)
    setRows(fresh)
    setNextKey(fresh.length)
    setLocalProblem(undefined)
  }, [stored])
  const busy = model.pending !== undefined
  const dirty = JSON.stringify(rows.map((row) => [row.name, row.value])) !== JSON.stringify(Object.entries(headers))
  const hostLines = model.result?.area.kind === 'headers' ? model.result.lines : []
  const lines: readonly Line[] = localProblem === undefined ? hostLines : [{ tone: 'error', message: cardError(localProblem) }]
  const update = (key: number, change: Partial<HeaderRow>): void => {
    setLocalProblem(undefined)
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row))
  }
  const save = (): void => {
    const problem = draftProblem(rows)
    setLocalProblem(problem)
    if (problem === undefined) void model.setHeaders(Object.fromEntries(rows.map((row) => [row.name, row.value])))
  }
  return (
    <div className="gcm-block">
      <div className="gcm-divider" />
      <h4 className="gcm-subtitle">{t('headersTitle')}</h4>
      <p className="gcm-hint">{t('headersNote')}</p>
      {rows.length === 0 && <p className="gcm-caption">{t('headersEmpty')}</p>}
      {rows.map((row) => (
        <div key={row.key} className="gcm-row">
          <input className="gcm-input gcm-mono" aria-label={t('headersName')} placeholder={t('headersName')} spellCheck={false} autoComplete="off" value={row.name} disabled={busy} onChange={(event) => update(row.key, { name: event.target.value })} />
          <input className="gcm-input gcm-mono" aria-label={t('headersValue')} placeholder={t('headersValue')} spellCheck={false} autoComplete="off" value={row.value} disabled={busy} onChange={(event) => update(row.key, { value: event.target.value })} />
          <button type="button" className="gcm-button" aria-label={t('headersRemoveLabel', { name: row.name })} disabled={busy} onClick={() => {
            setLocalProblem(undefined)
            setRows((current) => current.filter((entry) => entry.key !== row.key))
          }}>
            {t('headersRemove')}
          </button>
        </div>
      ))}
      <div className="gcm-actions">
        <button type="button" className="gcm-button" disabled={busy} onClick={() => {
          setRows((current) => [...current, { key: nextKey, name: '', value: '' }])
          setNextKey(nextKey + 1)
        }}>
          {t('headersAdd')}
        </button>
        <button type="button" className="gcm-button gcm-primary" disabled={busy || !dirty} onClick={save}>
          {t('headersSave')}
        </button>
      </div>
      <Lines t={t} lines={lines} />
    </div>
  )
}
