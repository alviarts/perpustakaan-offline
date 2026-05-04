#!/usr/bin/env node
/**
 * Extract a section from CHANGELOG.md for a given version tag.
 *
 * Used by `.github/workflows/ci-v2.yml` `release-v2` job: when a `vX.Y.Z` tag
 * is pushed, the workflow runs this script with the tag name and pipes the
 * matching section into the GitHub Release body via
 * `softprops/action-gh-release@v2`.
 *
 * The script accepts both `vX.Y.Z` and `X.Y.Z` and normalises by stripping a
 * single leading `v`. A section is identified by a heading of the form:
 *
 *     ## [VERSION] - DATE
 *
 * (the `- DATE` portion is optional). The body is everything between that
 * heading and the next `## [` heading or end-of-file, with surrounding blank
 * lines trimmed.
 *
 * Usage:
 *   node scripts/extract-changelog.mjs v1.0.1
 *   node scripts/extract-changelog.mjs 1.0.1 --file=CHANGELOG.md
 *
 * Exit codes:
 *   0 — section found, body printed to stdout
 *   1 — section not found
 *   2 — argument error
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Strip a single leading `v` from a tag name and trim whitespace. */
export function normalizeVersion(input) {
  return String(input ?? '')
    .trim()
    .replace(/^v/i, '');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the body of the section for `version` from CHANGELOG markdown.
 *
 * @param {string} markdown - Full CHANGELOG.md contents.
 * @param {string} version - Tag (`v1.0.1`) or bare version (`1.0.1`).
 * @returns {string} The trimmed section body (may be empty if the section
 *   is present but blank).
 * @throws {Error} If no `## [version]` heading exists in the markdown.
 */
export function extractSection(markdown, version) {
  const v = normalizeVersion(version);
  if (!v) {
    throw new Error('extractSection: version is empty');
  }
  const lines = String(markdown).split(/\r?\n/);
  const headingRe = new RegExp(`^##\\s*\\[${escapeRegex(v)}\\](\\s|$)`);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headingRe.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) {
    throw new Error(`Section for version ${v} not found in CHANGELOG`);
  }
  let end = lines.length;
  for (let j = start; j < lines.length; j += 1) {
    if (/^##\s*\[/.test(lines[j])) {
      end = j;
      break;
    }
  }
  return lines
    .slice(start, end)
    .join('\n')
    .replace(/^\s+|\s+$/g, '');
}

function isMain() {
  if (typeof process === 'undefined' || !process.argv?.[1]) return false;
  try {
    return import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const fileFlag = args.find((a) => a.startsWith('--file='));
  const file = fileFlag ? fileFlag.slice('--file='.length) : 'CHANGELOG.md';
  if (positional.length !== 1) {
    process.stderr.write('Usage: extract-changelog.mjs <version> [--file=CHANGELOG.md]\n');
    process.exit(2);
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const path = resolve(repoRoot, file);
  const md = readFileSync(path, 'utf8');
  try {
    const body = extractSection(md, positional[0]);
    process.stdout.write(`${body}\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
