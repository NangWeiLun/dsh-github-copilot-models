/**
 * The release script that writes CHANGELOG.md (docs/cicd.md section 6): which
 * commit subjects become release notes, and how a section is placed and read back.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { insertSection, parseSubject, renderSection, sectionNotes } from '../../scripts/changelog.ts'

const HEAD = '# Changelog\n\nIntro.\n\n'
const OLD = '## 0.1.0 - 2026-11-10\n\nFirst release.\n\n### Features\n\n- Sign in.\n'

test('subjects follow CONTRIBUTING.md: a known type, an optional !, a colon, a space and a summary', () => {
  assert.deepEqual(parseSubject('feat: show prices'), { type: 'feat', breaking: false, summary: 'show prices' })
  assert.deepEqual(parseSubject('fix!: rename the route id'), { type: 'fix', breaking: true, summary: 'rename the route id' })
  assert.deepEqual(parseSubject('chore: release 0.1.1'), { type: 'chore', breaking: false, summary: 'release 0.1.1' })
  for (const subject of ['Release 0.1.0', 'feature: x', 'fix:no space', 'fix(card): scoped', 'fix: ', 'wip']) {
    assert.equal(parseSubject(subject), undefined, subject)
  }
})

test('a section lists breaking changes, features and fixes, and leaves the other types out', () => {
  const section = renderSection('0.2.0', '2026-12-01', [
    'chore: release 0.2.0',
    'fix: refuse a size above the prompt limit',
    'docs: formalize the docs',
    'feat: show the Long tier',
    'feat!: rename the route id',
    'ci: add the workflows',
    'Merge branch main',
  ])
  assert.equal(section, [
    '## 0.2.0 - 2026-12-01',
    '',
    '### Breaking changes',
    '',
    '- Rename the route id',
    '',
    '### Features',
    '',
    '- Show the Long tier',
    '',
    '### Fixes',
    '',
    '- Refuse a size above the prompt limit',
    '',
  ].join('\n'))
})

test('a version with neither features nor fixes says so', () => {
  assert.equal(
    renderSection('0.1.1', '2026-11-11', ['docs: formalize the docs', 'ci: add the workflows']),
    '## 0.1.1 - 2026-11-11\n\nNo changes to features or fixes.\n',
  )
})

test('a new section goes above the newest one, and a version is never written twice', () => {
  const section = renderSection('0.1.1', '2026-11-11', ['fix: keep sizes'])
  const changelog = insertSection(HEAD + OLD, section, '0.1.1')
  assert.equal(changelog, `${HEAD}## 0.1.1 - 2026-11-11\n\n### Fixes\n\n- Keep sizes\n\n${OLD}`)
  assert.throws(() => insertSection(changelog, section, '0.1.1'), /already has a section for 0.1.1/)
  assert.equal(insertSection(HEAD, section, '0.1.1'), `${HEAD.trimEnd()}\n\n${section}`)
})

test('the release notes are a section without its heading; a missing version gives undefined', () => {
  const changelog = insertSection(HEAD + OLD, renderSection('0.1.1', '2026-11-11', ['fix: keep sizes']), '0.1.1')
  assert.equal(sectionNotes(changelog, '0.1.1'), '### Fixes\n\n- Keep sizes')
  assert.equal(sectionNotes(changelog, '0.1.0'), 'First release.\n\n### Features\n\n- Sign in.')
  assert.equal(sectionNotes(changelog, '0.1'), undefined)
  assert.equal(sectionNotes(changelog, '9.9.9'), undefined)
})

test('CHANGELOG.md has a section for the version in package.json', () => {
  const root = new URL('../../', import.meta.url)
  const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { version: string }
  const notes = sectionNotes(readFileSync(new URL('CHANGELOG.md', root), 'utf8'), version)
  assert.ok(notes !== undefined && notes.length > 0, `no section for ${version}`)
})
