/**
 * Writes and reads CHANGELOG.md (docs/cicd.md section 6).
 *
 *   node scripts/changelog.ts write [--dry-run]   add the section for package.json's version; `npm version` runs this
 *   node scripts/changelog.ts notes [<version>]   print a version's section without its heading: the GitHub Release notes
 *
 * A section lists the commit subjects since the previous `v*` tag that follow
 * CONTRIBUTING.md: `feat` under Features, `fix` under Fixes, and any type marked
 * `!` under Breaking changes. The other types are left out.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface Entry {
  type: string
  breaking: boolean
  summary: string
}

/** The pull request title form of CONTRIBUTING.md. */
export const SUBJECT = /^(feat|fix|docs|refactor|test|ci|chore)(!?): (\S.*)$/

export function parseSubject(subject: string): Entry | undefined {
  const match = SUBJECT.exec(subject.trim())
  if (match === null) return undefined
  return { type: match[1] ?? '', breaking: match[2] === '!', summary: match[3] ?? '' }
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** One version's section, ending with a newline. */
export function renderSection(version: string, date: string, subjects: readonly string[]): string {
  const entries = subjects.map(parseSubject).filter((entry): entry is Entry => entry !== undefined)
  const groups: [string, Entry[]][] = [
    ['Breaking changes', entries.filter((entry) => entry.breaking)],
    ['Features', entries.filter((entry) => !entry.breaking && entry.type === 'feat')],
    ['Fixes', entries.filter((entry) => !entry.breaking && entry.type === 'fix')],
  ]
  const lines = [`## ${version} - ${date}`, '']
  const listed = groups.filter(([, list]) => list.length > 0)
  if (listed.length === 0) lines.push('No changes to features or fixes.', '')
  for (const [title, list] of listed) {
    lines.push(`### ${title}`, '', ...list.map((entry) => `- ${sentence(entry.summary)}`), '')
  }
  return lines.join('\n')
}

function headingIndex(lines: readonly string[], version: string): number {
  return lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `))
}

/** Puts the section above the newest one. Refuses a version that already has a section. */
export function insertSection(changelog: string, section: string, version: string): string {
  if (headingIndex(changelog.split('\n'), version) >= 0) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`)
  }
  const first = changelog.search(/^## /m)
  if (first < 0) return `${changelog.trimEnd()}\n\n${section}`
  return `${changelog.slice(0, first)}${section}\n${changelog.slice(first)}`
}

/** A version's section without its heading, or undefined when there is none. */
export function sectionNotes(changelog: string, version: string): string | undefined {
  const lines = changelog.split('\n')
  const start = headingIndex(lines, version)
  if (start < 0) return undefined
  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  return lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim()
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function previousTag(): string | undefined {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v*')
  } catch {
    return undefined
  }
}

function subjectsSince(tag: string | undefined): string[] {
  const log = git('log', '--format=%s', tag === undefined ? 'HEAD' : `${tag}..HEAD`)
  return log === '' ? [] : log.split('\n')
}

function today(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function main(args: readonly string[]): number {
  const changelogFile = new URL('../CHANGELOG.md', import.meta.url)
  const packageFile = new URL('../package.json', import.meta.url)
  const version = (JSON.parse(readFileSync(packageFile, 'utf8')) as { version: string }).version
  const changelog = readFileSync(changelogFile, 'utf8')
  const [command, argument] = args

  if (command === 'write') {
    const section = renderSection(version, today(), subjectsSince(previousTag()))
    if (args.includes('--dry-run')) {
      process.stdout.write(section)
      return 0
    }
    writeFileSync(changelogFile, insertSection(changelog, section, version))
    return 0
  }
  if (command === 'notes') {
    const wanted = argument ?? version
    const notes = sectionNotes(changelog, wanted)
    if (notes === undefined) {
      process.stderr.write(`CHANGELOG.md has no section for ${wanted}\n`)
      return 1
    }
    process.stdout.write(`${notes}\n`)
    return 0
  }
  process.stderr.write('usage: node scripts/changelog.ts write [--dry-run] | notes [<version>]\n')
  return 2
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
