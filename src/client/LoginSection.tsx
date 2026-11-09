/**
 * The GitHub Copilot settings section (login.md A1, A2, A4–A6, A8): a status
 * card (method, account, Copilot host, Refresh, Sign out), a sign-in card
 * (Domain field, browser sign-in with its notices, PAT field with its note),
 * and below them the Models section (models.md A4, A6; ui.md U3).
 * State and Host calls live in use-login.ts and use-models.ts; the Card never
 * sees a token.
 */
import React, { useId } from 'react'
import type { LoginMethod, LoginState, ModelsState } from '../shared/api.ts'
import { INTEGRATION_ID } from '../shared/api.ts'
import { fallbackTranslate } from './locales.ts'
import type { Translate } from './locales.ts'
import { errorText, showsError } from './messages.ts'
import type { Line } from './messages.ts'
import { ModelsSection } from './ModelsSection.tsx'
import { Busy, Lines, NoticeView } from './parts.tsx'
import { CSS } from './styles.ts'
import { useLogin } from './use-login.ts'
import type { LoginModel } from './use-login.ts'
import { useModels } from './use-models.ts'

/** What the slot injects (`inject: () => ({ t })`). */
export interface LoginSectionInjected {
  readonly t: Translate
}

/** Props of the section: the inject face spread flat, plus the owner's `close`. */
export interface LoginSectionProps extends Partial<LoginSectionInjected> {
  readonly close?: () => void
}

/** The domain a signed-in record uses: the saved value, github.com when empty (A1). */
function shownDomain(state: LoginState): string {
  return state.domain === '' ? 'github.com' : state.domain
}

function statusText(t: Translate, state: LoginState): string {
  if (state.status === 'signed-out') return t('statusSignedOut')
  if (state.status === 'unverified') return t('statusUnverified')
  const method = state.method === undefined ? '' : t('statusMethod', { method: t(state.method === 'pat' ? 'methodPat' : 'methodBrowser') })
  const signedIn = state.account === undefined ? t('statusSignedInNoAccount') : t('statusSignedIn', { account: state.account })
  return signedIn + method
}

function methodName(t: Translate, method: LoginMethod): string {
  return t(method === 'pat' ? 'factMethodPat' : 'factMethodBrowser')
}

/** The line naming the `Copilot-Integration-Id` a login method sends (models.md A1). */
function integrationHint(t: Translate, method: LoginMethod): string {
  return t('integrationHint', { header: `Copilot-Integration-Id: ${INTEGRATION_ID[method]}` })
}

export function LoginSection(props: LoginSectionProps): React.JSX.Element {
  const t = props.t ?? fallbackTranslate
  // The models state arrives with every Login reply (models.md A11); the
  // section re-reads it on its own only while a fetch runs.
  const modelsRef = React.useRef<((models: ModelsState) => void) | undefined>(undefined)
  const model = useLogin((models) => modelsRef.current?.(models))
  const { state } = model
  const models = useModels(state?.modelsFetching === true)
  modelsRef.current = models.apply

  return (
    <div className="gcm-section">
      <style>{CSS}</style>
      {/* The page's own heading and intro, as on DSH's Models page (ui.md U3). */}
      <h2 className="gcm-page-title">{t('pageTitle')}</h2>
      <p className="gcm-intro">{t('intro')}</p>
      {state === undefined
        ? <LoadingCard t={t} model={model} />
        : <>
            <StatusCard t={t} model={model} state={state} />
            <SignInCard t={t} model={model} state={state} />
            <ModelsSection t={t} login={state} model={models} />
          </>}
    </div>
  )
}

function LoadingCard(props: { readonly t: Translate; readonly model: LoginModel }): React.JSX.Element {
  const { t, model } = props
  const problem = model.loadProblem
  return (
    <section className="gcm-card">
      <h3 className="gcm-title">{t('title')}</h3>
      {problem === undefined
        ? <Busy>{t('loading')}</Busy>
        : <div className="gcm-actions">
            <button type="button" className="gcm-button" onClick={model.reload}>{t('retry')}</button>
          </div>}
      <Lines t={t} lines={problem === undefined ? [] : [{ tone: 'error', message: { kind: 'problem', problem } }]} />
    </section>
  )
}

function StatusCard(props: { readonly t: Translate; readonly model: LoginModel; readonly state: LoginState }): React.JSX.Element {
  const { t, model, state } = props
  const signedOut = state.status === 'signed-out'
  const busy = model.pending !== undefined
  const lines: Line[] = []
  if (model.loadProblem !== undefined) lines.push({ tone: 'error', message: { kind: 'problem', problem: model.loadProblem } })
  if (model.result?.area === 'status') lines.push(...model.result.lines)
  // The record's lookup error stays until Refresh succeeds (login.md A3); shown once.
  const stateError = !signedOut && state.error !== undefined && !showsError(lines, state.error) ? state.error : undefined

  return (
    <section className="gcm-card" aria-busy={state.checking || model.pending === 'refresh' || model.pending === 'signOut'}>
      <div className="gcm-head">
        <span className="gcm-dot" data-status={state.status} aria-hidden="true" />
        <h3 className="gcm-title">{t('title')}</h3>
      </div>
      <p className="gcm-text">{statusText(t, state)}</p>
      {stateError !== undefined && <p className="gcm-line gcm-tone-error">{errorText(t, stateError)}</p>}
      {state.checking && <Busy>{t('checking')}</Busy>}
      {state.changedOutside && <p className="gcm-line gcm-tone-warn">{t('changedOutside')}</p>}
      {!signedOut && (
        <dl className="gcm-facts">
          {state.method !== undefined && <><dt>{t('factMethod')}</dt><dd>{methodName(t, state.method)}</dd></>}
          {state.account !== undefined && <><dt>{t('factAccount')}</dt><dd>{state.account}</dd></>}
          {state.copilotHost !== undefined && <><dt>{t('factCopilotHost')}</dt><dd>{state.copilotHost}</dd></>}
          <dt>{t('domainLabel')}</dt><dd>{shownDomain(state)}</dd>
        </dl>
      )}
      {!signedOut && (
        <div className="gcm-actions">
          <button type="button" className="gcm-button" disabled={busy || state.checking || state.signIn !== undefined} onClick={model.refresh}>
            {t('refresh')}
          </button>
          <button type="button" className="gcm-button" disabled={busy} onClick={model.signOut}>
            {t('signOut')}
          </button>
        </div>
      )}
      <Lines t={t} lines={lines} />
    </section>
  )
}

function SignInCard(props: { readonly t: Translate; readonly model: LoginModel; readonly state: LoginState }): React.JSX.Element {
  const { t, model, state } = props
  const domainId = useId()
  const domainHintId = useId()
  const patId = useId()
  const patHintId = useId()

  const signedOut = state.status === 'signed-out'
  const browserRunning = model.pending === 'browser' || state.signIn?.method === 'browser'
  const patRunning = model.pending === 'pat'
  // Sign in and Save wait while any attempt runs or a request of ours is pending (A4, B4).
  const blocked = state.inFlight || model.pending !== undefined || !state.flowAvailable
  const domainEditable = signedOut && !state.inFlight && model.pending === undefined
  const otherAttempt = state.inFlight && model.pending === undefined && state.signIn === undefined
  const browserLines: readonly Line[] = model.result?.area === 'browser' ? model.result.lines : []
  const patLines: readonly Line[] = model.result?.area === 'pat' ? model.result.lines : []
  // Without the flow nothing can start: say why (A8, NO_FLOW), unless a result already says it.
  const noFlow = !state.flowAvailable && !showsError([...browserLines, ...patLines], { code: 'NO_FLOW' })

  return (
    <section className="gcm-card" aria-busy={browserRunning || patRunning}>
      <h3 className="gcm-title">{signedOut ? t('signInTitle') : t('signInAgainTitle')}</h3>
      {!signedOut && <p className="gcm-hint">{t('signInAgainHint')}</p>}
      {noFlow && <p className="gcm-line gcm-tone-warn">{t('errNoFlow')}</p>}

      <div className="gcm-block">
        <label className="gcm-label" htmlFor={domainId}>{t('domainLabel')}</label>
        <input
          id={domainId}
          className="gcm-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="github.com"
          aria-describedby={domainHintId}
          readOnly={!domainEditable}
          value={signedOut ? model.domainDraft : shownDomain(state)}
          onChange={(event) => model.setDomainDraft(event.target.value)}
        />
        <p id={domainHintId} className="gcm-hint">{signedOut ? t('domainHint') : t('domainLocked')}</p>
      </div>

      {otherAttempt && <p className="gcm-line gcm-tone-info">{t('inFlightElsewhere')}</p>}

      <div className="gcm-divider" />
      <div className="gcm-block">
        <h4 className="gcm-subtitle">{t('browserTitle')}</h4>
        <p className="gcm-hint">{t('browserHint')}</p>
        <p className="gcm-hint">{integrationHint(t, 'browser')}</p>
        <div className="gcm-actions">
          <button type="button" className="gcm-button gcm-button-lg gcm-primary" disabled={blocked} onClick={model.signInBrowser}>
            {t('browserSignIn')}
          </button>
          {browserRunning && (
            <button type="button" className="gcm-button gcm-button-lg" disabled={model.cancelling} onClick={model.cancelBrowser}>
              {t('cancel')}
            </button>
          )}
        </div>
        {browserRunning && (
          <div className="gcm-device">
            {model.notices.length === 0
              ? <Busy>{t('browserWaiting')}</Busy>
              : model.notices.map((notice) => <NoticeView key={notice.seq} t={t} notice={notice} />)}
            {/* Closing the page that started the sign-in cancels it (B4); another tab may close freely. */}
            {model.pending === 'browser' && <p className="gcm-caption">{t('keepOpen')}</p>}
          </div>
        )}
        <Lines t={t} lines={browserLines} />
      </div>

      <div className="gcm-divider" />
      <div className="gcm-block">
        <label className="gcm-label" htmlFor={patId}>{t('patLabel')}</label>
        <div className="gcm-row">
          <input
            id={patId}
            className="gcm-input"
            type="password"
            name="github-copilot-pat"
            autoComplete="new-password"
            spellCheck={false}
            aria-describedby={patHintId}
            value={model.patDraft}
            onChange={(event) => model.setPatDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              if (!blocked) model.savePat()
            }}
          />
          <button type="button" className="gcm-button gcm-button-lg" disabled={blocked || model.patDraft.trim() === ''} onClick={model.savePat}>
            {t('patSave')}
          </button>
        </div>
        <div id={patHintId} className="gcm-block">
          <p className="gcm-hint">{t('patHelp')}</p>
          <p className="gcm-hint">{integrationHint(t, 'pat')}</p>
          <p className="gcm-hint">{t('patNote')}</p>
        </div>
        {patRunning && <Busy>{t('patChecking')}</Busy>}
        <Lines t={t} lines={patLines} />
      </div>
    </section>
  )
}
