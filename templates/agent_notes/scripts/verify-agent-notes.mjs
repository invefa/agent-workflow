#!/usr/bin/env node
/**
 * Check note paths, statuses, and headings under .agents/notes.
 *
 * Usage: node scripts/verify-agent-notes.mjs [project-root]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Allowed category directories. */
const CLASSES = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing']

/** Directory names for active note states. */
const STATES = ['proposed', 'implemented', 'rejected']

/** First proposal date followed by a snake_case topic. */
const FILE_NAME = /^\d{8}-[a-z0-9]+(?:_[a-z0-9]+)*\.md$/

/** Status line with an optional reason suffix. */
const STATUS_LINE = /^Status: (proposed|implemented|rejected)(?: — .+)?$/

/** Required and forbidden headings by state. */
const REQUIRED = {
  proposed: ['## Problem', '## Proposal', '## Alternatives considered'],
  implemented: ['## Problem', '## Decision', '## Alternatives considered', '## Consequences'],
  rejected: ['## Problem', '## Proposal', '## Alternatives considered'],
}
const FORBIDDEN = {
  proposed: [],
  implemented: ['## Proposal', '## Plan', '## Migration plan', '## Acceptance criteria'],
  rejected: [],
}

const root = process.argv[2] ?? '.'
const notesRoot = join(root, '.agents', 'notes')

/** Match headings on their own lines. */
const hasSection = (text, heading) =>
  new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(text)

const problems = []
const report = (file, message) => problems.push(`${relative(root, file)}: ${message}`)

if (!statSync(notesRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Missing directory: ${relative(root, notesRoot)}. Run from the project root or pass its path.`)
  process.exit(1)
}

let checked = 0
for (const state of STATES) {
  const stateDir = join(notesRoot, state)
  if (!statSync(stateDir, { throwIfNoEntry: false })?.isDirectory()) continue
  for (const entry of readdirSync(stateDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name.endsWith('.md')) {
        report(join(stateDir, entry.name), 'Missing category directory. Expected {lifecycle}/{class}/yyyyMMdd-topic.md.')
      }
      continue
    }
    if (!CLASSES.includes(entry.name)) {
      report(join(stateDir, entry.name), `Unknown category: ${entry.name}.`)
      continue
    }
    const classDir = join(stateDir, entry.name)
    for (const file of readdirSync(classDir)) {
      if (!file.endsWith('.md') || file.endsWith('.zh.md')) continue
      const full = join(classDir, file)
      checked += 1
      if (!FILE_NAME.test(file)) {
        report(full, 'Expected yyyyMMdd-topic.md with a lowercase topic using letters, digits, and underscores.')
      }
      const lines = readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n')
      if (!/^# Agent Note: \S/.test(lines[0] ?? '')) {
        report(full, 'First line must be `# Agent Note: <title>`.')
      }
      if ((lines[1] ?? '').trim() !== '') {
        report(full, 'Expected a blank line between the title and status.')
      }
      const status = lines[2] ?? ''
      const match = STATUS_LINE.exec(status)
      if (!match) {
        report(full, 'Third line must start with `Status:` and specify `proposed`, `implemented`, or `rejected`.')
      } else if (match[1] !== state) {
        report(full, `Status ${match[1]} does not match directory ${state}.`)
      }
      if (match && match[1] === 'rejected' && !/: rejected/.test(status) === false && !/— .+/.test(status)) {
        report(full, 'Rejected notes must include a reason on the status line.')
      }
      const text = lines.slice(3).join('\n')
      const bodyLines = text.split('\n')
      const firstHeading = bodyLines.find((line) => line.startsWith('#') && line.trim() !== '')
      if ((firstHeading ?? '').trim() !== '## Problem') {
        report(full, 'First section must be `## Problem`.')
      }
      for (const heading of REQUIRED[state]) {
        if (!hasSection(text, heading)) report(full, `Missing required heading: ${heading}.`)
      }
      for (const heading of FORBIDDEN[state]) {
        if (hasSection(text, heading)) report(full, `Heading ${heading} is not allowed in ${state} notes.`)
      }
    }
  }
}

if (checked === 0) {
  console.error(`No note files found under ${relative(root, notesRoot)}.`)
  process.exit(1)
}

for (const problem of problems) console.error(problem)
if (problems.length > 0) {
  console.error(`\nChecked ${checked} note(s). Found ${problems.length} issue(s).`)
  process.exit(1)
}
console.log(`Checked ${checked} note(s). All passed.`)
