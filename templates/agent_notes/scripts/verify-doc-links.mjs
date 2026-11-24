#!/usr/bin/env node
/**
 * Check relative Markdown link targets and warn about unmatched heading anchors.
 * Skip external links, same-page anchors, and code snippets.
 *
 * Usage: node scripts/verify-doc-links.mjs [project-root]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIP_DIRS = new Set(['node_modules', '.git', '.work', 'dist', 'build', 'target', 'lib', 'out'])
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

const root = resolve(process.argv[2] ?? '.')

const walk = (dir) => {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...walk(join(dir, entry.name)))
    } else if (entry.name.endsWith('.md')) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

/** Approximate GitHub heading anchors. */
const slug = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')

const headingsOf = (file) => {
  const set = new Set()
  for (const line of readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const match = /^#{1,6}\s+(.*)$/.exec(line)
    if (match) set.add(slug(match[1]))
  }
  return set
}

const failures = []
const warnings = []
let links = 0

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
  for (const match of text.matchAll(LINK)) {
    const raw = match[1]
    if (/^(https?:|mailto:|tel:|data:|#)/.test(raw) || raw.includes('://')) continue
    const target = raw.replace(/^<|>$/g, '')
    const [pathPart, anchor] = target.split('#')
    links += 1
    if (pathPart === '') continue
    const resolved = resolve(dirname(file), decodeURI(pathPart))
    if (!statSync(resolved, { throwIfNoEntry: false })) {
      failures.push(`${relative(root, file)}: Link target does not exist: ${pathPart}`)
      continue
    }
    if (anchor && resolved.endsWith('.md')) {
      if (!headingsOf(resolved).has(decodeURI(anchor).toLowerCase())) {
        warnings.push(`${relative(root, file)}: Anchor does not match a heading: ${target}`)
      }
    }
  }
}

for (const warning of warnings) console.warn(`Warning: ${warning}`)
for (const failure of failures) console.error(failure)
if (failures.length > 0) {
  console.error(`\nChecked ${links} relative link(s). Broken targets: ${failures.length}. Anchor warnings: ${warnings.length}.`)
  process.exit(1)
}
console.log(`Checked ${links} relative link(s). All targets exist. Anchor warnings: ${warnings.length}.`)
