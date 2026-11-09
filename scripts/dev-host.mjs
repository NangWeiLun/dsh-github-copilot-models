/**
 * Call this plugin's Host routes on a running DSH Web profile, the same way
 * the Card does. For live testing without typing a secret into a browser.
 *
 *   node scripts/dev-host.mjs [--log <dsh log>] <step>...
 *
 * Steps (run in order):
 *   state            GET  state (local, no GitHub request)
 *   notices          GET  notices?after=0
 *   save-pat         POST patSave with COPILOT_GITHUB_TOKEN from .env (two requests: the host lookup, then GET /models)
 *   refresh          POST refresh (two requests: the host lookup, then GET /models)
 *   sign-out         POST signOut (no GitHub request)
 *   leak-check       report whether the PAT appears in the DSH log (count only)
 *
 * The DSH launch URL, with its one-time token, is read from the DSH log
 * (default `.tmp/web-dev.log`). Neither that token nor the PAT is printed.
 */
import { readFile } from 'node:fs/promises'

const args = process.argv.slice(2)
let logPath = '.tmp/web-dev.log'
const steps = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--log') logPath = args[(index += 1)]
  else steps.push(args[index])
}
if (steps.length === 0) {
  console.error('usage: node scripts/dev-host.mjs [--log <dsh log>] state|notices|save-pat|refresh|sign-out|leak-check ...')
  process.exit(2)
}

/** The PAT from `.env`, read only when a step needs it. Never printed. */
let pat
async function readPat() {
  if (pat !== undefined) return pat
  const text = await readFile(new URL('../.env', import.meta.url), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?COPILOT_GITHUB_TOKEN\s*=\s*(.*)$/.exec(line)
    if (match === null) continue
    let value = match[1].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (value !== '') {
      pat = value
      return pat
    }
  }
  throw new Error('COPILOT_GITHUB_TOKEN is not set in .env')
}

const log = await readFile(logPath, 'utf8')
const launches = log.match(/https?:\/\/[^\s'"]*[?&]token=[^\s'"]+/g)
if (launches === null) throw new Error(`no launch URL with a token in ${logPath}`)
const launch = new URL(launches.at(-1))
const base = new URL('./', launch)
base.search = ''

const exchange = await fetch(launch, { redirect: 'manual' })
const cookie = exchange.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
if (cookie === '') throw new Error(`the login exchange answered ${exchange.status} without a cookie`)
await exchange.body?.cancel()
console.log(`DSH at ${base.href} (signed in to the Web UI)`)

/** Print a reply, refusing to print one that contains the PAT. */
function show(label, status, text) {
  if (pat !== undefined && text.includes(pat)) {
    console.error(`${label}: HTTP ${status} — LEAK: the reply contains the PAT (not printed)`)
    process.exitCode = 1
    return
  }
  let body = text
  try {
    body = JSON.stringify(JSON.parse(text), null, 2)
  } catch {}
  console.log(`\n${label}: HTTP ${status}\n${body}`)
}

async function call(label, route, init = {}) {
  const url = new URL(`api/github-copilot-models/${route}`, base)
  const started = Date.now()
  const response = await fetch(url, {
    ...init,
    headers: { cookie, accept: 'application/json', ...init.headers },
  })
  show(`${label} (${Date.now() - started} ms)`, response.status, await response.text())
}

const post = (label, route, body) => call(label, route, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

for (const step of steps) {
  switch (step) {
    case 'state':
      await call('state', 'state')
      break
    case 'notices':
      await call('notices', 'notices?after=0')
      break
    case 'save-pat':
      await post('patSave', 'patSave', { domain: '', pat: await readPat() })
      break
    case 'refresh':
      await post('refresh', 'refresh', {})
      break
    case 'sign-out':
      await post('signOut', 'signOut', {})
      break
    case 'leak-check': {
      const secret = await readPat()
      const current = await readFile(logPath, 'utf8')
      const count = current.split(secret).length - 1
      console.log(`\nleak-check: the PAT appears ${count} time(s) in ${logPath}`)
      if (count > 0) process.exitCode = 1
      break
    }
    default:
      throw new Error(`unknown step "${step}"`)
  }
}
