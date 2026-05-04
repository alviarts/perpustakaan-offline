import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// @ts-expect-error - .mjs file outside the desktop workspace, no type defs
import { extractSection, normalizeVersion } from '../../../../scripts/extract-changelog.mjs';

/**
 * Guard for `scripts/extract-changelog.mjs`. The CI release-v2 job feeds the
 * extracted body into `softprops/action-gh-release@v2`, so a regression here
 * silently degrades every future GitHub Release. Lock the contract.
 */

const REPO_ROOT = resolve(__dirname, '../../../..');
const CHANGELOG_PATH = resolve(REPO_ROOT, 'CHANGELOG.md');

const SAMPLE = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- new thing in flight',
  '',
  '## [1.0.1] - 2026-05-04',
  '',
  '### Fixed',
  '- bug a',
  '- bug b',
  '',
  '## [1.0.0] - 2026-05-03',
  '',
  '### Added',
  '- initial release',
].join('\n');

describe('normalizeVersion', () => {
  it('strips leading v and trims', () => {
    expect(normalizeVersion('v1.0.1')).toBe('1.0.1');
    expect(normalizeVersion(' V2.0.0 ')).toBe('2.0.0');
    expect(normalizeVersion('1.2.3')).toBe('1.2.3');
  });

  it('handles nullish input', () => {
    expect(normalizeVersion(undefined)).toBe('');
    expect(normalizeVersion(null)).toBe('');
    expect(normalizeVersion('')).toBe('');
  });
});

describe('extractSection (synthetic)', () => {
  it('returns body between heading and next ## [ heading', () => {
    const out = extractSection(SAMPLE, 'v1.0.1');
    expect(out).toBe('### Fixed\n- bug a\n- bug b');
  });

  it('accepts bare version without leading v', () => {
    expect(extractSection(SAMPLE, '1.0.0')).toBe('### Added\n- initial release');
  });

  it('extracts the trailing section all the way to EOF', () => {
    const out = extractSection(SAMPLE, '1.0.0');
    expect(out.endsWith('- initial release')).toBe(true);
  });

  it('throws for a missing section', () => {
    expect(() => extractSection(SAMPLE, 'v9.9.9')).toThrow(/version 9\.9\.9 not found/);
  });

  it('matches Unreleased heading literally', () => {
    expect(extractSection(SAMPLE, 'Unreleased')).toContain('new thing in flight');
  });
});

describe('extractSection (real CHANGELOG.md)', () => {
  const md = readFileSync(CHANGELOG_PATH, 'utf8');

  it('finds the v1.0.1 section and includes BUG-001 line', () => {
    const out = extractSection(md, 'v1.0.1');
    expect(out).toMatch(/BUG-001/);
    expect(out).toMatch(/BUG-011/);
    // Section must NOT bleed into the next release.
    expect(out).not.toMatch(/^## \[/m);
  });

  it('finds the v1.0.0 section and ends at EOF without leaking another ## [', () => {
    const out = extractSection(md, 'v1.0.0');
    expect(out).toMatch(/Initial v2 stable release/);
    expect(out).not.toMatch(/^## \[/m);
  });
});
