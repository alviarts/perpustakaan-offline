/**
 * Manual book HTML generator (revisi #4 + BUG-010 redesign).
 *
 * Reads `docs/manual.md` (the canonical user manual source) and converts it
 * to a responsive HTML manual with:
 *   - Branded hero / cover section
 *   - Sticky table of contents with collapsible h3 children + scroll-spy
 *   - Reading progress bar
 *   - Full-text search with hit highlighting + result count
 *   - Light/dark mode toggle (icon-based)
 *   - Copy-to-clipboard buttons on code blocks
 *   - Back-to-top floating button
 *   - "Skip to content" a11y link
 *   - Keyboard shortcuts: Ctrl/Cmd+K to focus search, Esc to clear
 *   - Placeholder hooks for the library identity (`{{LIB_NAMA}}`) injected at
 *     runtime by the frontend before opening the manual
 *
 * Output (single self-contained HTML file with CSS + JS inlined):
 *   - `apps/desktop/public/manual/index.html`
 *
 * The CSS / JS are inlined rather than emitted as sibling files because the
 * Tauri 2 production custom-protocol that bundles secondary-window assets has
 * occasionally produced blank manual windows on Windows when it tries to fetch
 * sibling .css/.js (see BUG-009 / BUG-010 + the inline-revert follow-up). A
 * single self-contained HTML sidesteps that loader path entirely.
 *
 * Markdown rendering is intentionally hand-rolled (no external deps) so the
 * build runs offline without network access during CI.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const sources = [resolve(repoRoot, 'docs/manual.md')];
const outDirs = [resolve(repoRoot, 'apps/desktop/public/manual')];

const escapeHtml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/**
 * Tiny Markdown → HTML converter targeted at the subset used in `docs/manual.md`.
 * Supports: headings, paragraphs, fenced/inline code, bold/italic, links,
 * bullet & ordered lists, blockquotes, horizontal rules.
 */
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let i = 0;

  const flushParagraph = (buf) => {
    if (buf.length === 0) return;
    out.push(`<p>${formatInline(buf.join(' '))}</p>`);
    buf.length = 0;
  };

  const formatInline = (raw) => {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, h) => {
      const url = h.startsWith('http') || h.startsWith('#') ? h : escapeHtml(h);
      const ext = url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}"${ext}>${t}</a>`;
    });
    return s;
  };

  const buf = [];
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = /^```([a-zA-Z0-9_-]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph(buf);
      const lang = fence[1] || '';
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const codeText = codeLines.join('\n');
      out.push(
        `<div class="code-block" data-lang="${escapeHtml(lang)}">` +
          `<div class="code-block__header">` +
          `<span class="code-block__lang">${escapeHtml(lang || 'text')}</span>` +
          `<button type="button" class="code-block__copy" aria-label="Salin kode">Salin</button>` +
          `</div>` +
          `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(codeText)}</code></pre>` +
          `</div>`,
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flushParagraph(buf);
      const level = heading[1].length;
      const text = heading[2].replace(/\{#[^}]+\}\s*$/, '').trim();
      const slug = slugify(text);
      if (level <= 3 && level >= 2) {
        toc.push({ level, text, slug });
      }
      out.push(
        `<h${level} id="${slug}"><a href="#${slug}" class="anchor" aria-hidden="true">#</a> ${formatInline(text)}</h${level}>`,
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushParagraph(buf);
      out.push('<hr />');
      i += 1;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushParagraph(buf);
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${formatInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      flushParagraph(buf);
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${formatInline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph(buf);
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      out.push(`<ol>${items.map((it) => `<li>${formatInline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // Blank line ends paragraph
    if (line.trim() === '') {
      flushParagraph(buf);
      i += 1;
      continue;
    }

    buf.push(line);
    i += 1;
  }
  flushParagraph(buf);

  return { html: out.join('\n'), toc };
}

const TEMPLATE_CSS = `
:root {
  --bg: #ffffff;
  --bg-elevated: #f8fafc;
  --bg-card: #ffffff;
  --bg-hero: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #faf5ff 100%);
  --fg: #0f172a;
  --fg-muted: #475569;
  --fg-subtle: #64748b;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-soft: rgba(37, 99, 235, 0.1);
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --code-bg: #f1f5f9;
  --code-fg: #0f172a;
  --shadow: 0 1px 2px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.04);
  --shadow-md: 0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04);
  --highlight: rgba(250, 204, 21, 0.5);
  --radius: 8px;
  --radius-lg: 12px;
}
:root[data-theme='dark'] {
  --bg: #0b1220;
  --bg-elevated: #111a2e;
  --bg-card: #131e36;
  --bg-hero: linear-gradient(135deg, #0f1d3a 0%, #102036 50%, #1a1233 100%);
  --fg: #e6ecf6;
  --fg-muted: #9aa9c2;
  --fg-subtle: #64748b;
  --accent: #60a5fa;
  --accent-hover: #93c5fd;
  --accent-soft: rgba(96, 165, 250, 0.18);
  --border: #1e2a44;
  --border-strong: #2c3a59;
  --code-bg: #0a1325;
  --code-fg: #e6ecf6;
  --shadow: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4);
  --highlight: rgba(250, 204, 21, 0.35);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { scroll-behavior: smooth; height: 100%; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.7;
  font-size: 16px;
  min-height: 100vh;
  width: 100%;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a {
  color: var(--accent);
  text-decoration: none;
  transition: color .15s;
}
a:hover { color: var(--accent-hover); text-decoration: underline; }

/* Skip-link for keyboard users */
.skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  background: var(--accent);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  z-index: 100;
  transition: top .2s;
}
.skip-link:focus { top: 8px; }

/* Reading progress bar */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 0%;
  background: var(--accent);
  z-index: 50;
  transition: width .15s ease-out;
}

/* Top bar */
header.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: .75rem 1.25rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}
header.topbar .brand-block {
  display: flex;
  align-items: center;
  gap: .65rem;
  margin-right: auto;
}
header.topbar .brand-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  display: grid; place-items: center;
  font-size: 18px;
}
header.topbar .brand {
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.25;
}
header.topbar .brand small {
  display: block;
  font-weight: 500;
  color: var(--fg-muted);
  font-size: .75rem;
  margin-top: 1px;
}

/* Search */
.search-wrap {
  position: relative;
  flex: 0 1 360px;
  max-width: 360px;
}
.search-wrap input[type='search'] {
  width: 100%;
  background: var(--bg-elevated);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: .55rem .75rem .55rem 2.25rem;
  font-size: .92rem;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.search-wrap input[type='search']:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: var(--bg);
}
.search-wrap .search-icon {
  position: absolute;
  left: .65rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-muted);
  pointer-events: none;
}
.search-wrap kbd {
  position: absolute;
  right: .5rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: .7rem;
  font-family: inherit;
  color: var(--fg-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  pointer-events: none;
}

/* Top-bar buttons */
.icon-btn {
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: .45rem .55rem;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  transition: color .15s, background .15s, border-color .15s;
  width: 36px;
  height: 36px;
}
.icon-btn:hover {
  color: var(--fg);
  background: var(--bg-elevated);
  border-color: var(--border-strong);
}

/* Layout */
.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
@media (max-width: 880px) {
  .layout { grid-template-columns: 1fr; padding: 1rem; }
  nav.toc { display: none; }
  nav.toc.open { display: block; }
}

/* TOC */
nav.toc {
  position: sticky;
  top: 4.5rem;
  align-self: start;
  font-size: .9rem;
  max-height: calc(100vh - 5.5rem);
  overflow-y: auto;
  padding: .5rem .25rem 1rem 0;
}
nav.toc .toc-title {
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .075em;
  color: var(--fg-subtle);
  padding: .35rem .75rem;
  margin-bottom: .25rem;
}
nav.toc ul { list-style: none; padding: 0; margin: 0; }
nav.toc li { margin: 1px 0; }
nav.toc a {
  display: block;
  padding: .35rem .75rem;
  border-radius: 6px;
  color: var(--fg-muted);
  border-left: 2px solid transparent;
  transition: color .12s, background .12s, border-color .12s;
  line-height: 1.45;
}
nav.toc a:hover {
  color: var(--fg);
  background: var(--bg-elevated);
  text-decoration: none;
}
nav.toc a.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-left-color: var(--accent);
  font-weight: 600;
}
nav.toc .level-3 a {
  padding-left: 1.5rem;
  font-size: .85rem;
}
nav.toc.hidden-by-search li.hidden { display: none; }
nav.toc .toc-empty {
  padding: .5rem .75rem;
  color: var(--fg-muted);
  font-style: italic;
  font-size: .85rem;
  display: none;
}
nav.toc.hidden-by-search.empty .toc-empty { display: block; }

/* Hero */
.hero {
  margin-bottom: 2rem;
  padding: 2rem 2rem 1.75rem;
  background: var(--bg-hero);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}
.hero::after {
  content: '';
  position: absolute;
  right: -40px;
  bottom: -40px;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, var(--accent-soft) 0%, transparent 70%);
  pointer-events: none;
}
.hero h1 {
  margin: 0 0 .5rem;
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
.hero .hero-sub {
  margin: 0 0 .85rem;
  color: var(--fg-muted);
  font-size: 1.02rem;
  max-width: 60ch;
}
.hero .hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  font-size: .82rem;
}
.hero .hero-meta .chip {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .3rem .65rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg-muted);
}
.hero .hero-meta .chip strong { color: var(--fg); }

/* Search status */
.search-status {
  display: none;
  margin-bottom: 1rem;
  padding: .75rem 1rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: .9rem;
  color: var(--fg-muted);
}
.search-status.visible { display: flex; align-items: center; gap: .5rem; }
.search-status strong { color: var(--fg); }
.search-status.empty { border-color: #f87171; background: rgba(248, 113, 113, 0.08); }
:root[data-theme='dark'] .search-status.empty { background: rgba(248, 113, 113, 0.12); }

/* Content */
main.content { min-width: 0; }
main.content h1, main.content h2, main.content h3 {
  scroll-margin-top: 4.5rem;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.005em;
}
main.content h1 { font-size: 2rem; margin-top: 0; }
main.content h2 {
  font-size: 1.5rem;
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  padding-bottom: .35rem;
  border-bottom: 1px solid var(--border);
}
main.content h3 { font-size: 1.18rem; margin-top: 2rem; }
main.content p { margin: .9rem 0; }
main.content ul, main.content ol { margin: .9rem 0; padding-left: 1.6rem; }
main.content li { margin: .25rem 0; }
main.content li::marker { color: var(--fg-muted); }
main.content code {
  background: var(--code-bg);
  color: var(--code-fg);
  padding: .12rem .4rem;
  border-radius: 4px;
  font-size: .88em;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono',
    Menlo, Consolas, 'Liberation Mono', monospace;
}

/* Code block with header */
.code-block {
  margin: 1.1rem 0;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .35rem .8rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: .75rem;
  color: var(--fg-muted);
}
.code-block__lang {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.code-block__copy {
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: .15rem .55rem;
  font-size: .72rem;
  cursor: pointer;
  transition: color .15s, background .15s, border-color .15s;
}
.code-block__copy:hover {
  color: var(--fg);
  background: var(--bg-card);
  border-color: var(--border-strong);
}
.code-block__copy.copied { color: #16a34a; border-color: #16a34a; }
:root[data-theme='dark'] .code-block__copy.copied { color: #4ade80; border-color: #4ade80; }
.code-block pre {
  margin: 0;
  padding: .85rem 1rem;
  overflow-x: auto;
  background: transparent;
}
.code-block pre code {
  background: transparent;
  padding: 0;
  font-size: .88em;
}

/* Blockquote */
main.content blockquote {
  border-left: 4px solid var(--accent);
  padding: .75rem 1rem .75rem 1.1rem;
  background: var(--accent-soft);
  color: var(--fg);
  margin: 1.1rem 0;
  border-radius: 0 var(--radius) var(--radius) 0;
}
main.content blockquote p { margin: .35rem 0; }
main.content blockquote strong { color: var(--accent); }

main.content hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 2.25rem 0;
}

main.content a {
  border-bottom: 1px dashed transparent;
  transition: color .15s, border-color .15s;
}
main.content a:hover { border-bottom-color: var(--accent); }

/* Anchor link icon */
.anchor {
  color: var(--fg-subtle);
  margin-right: .25rem;
  opacity: 0;
  transition: opacity .15s, color .15s;
  font-weight: 400;
  text-decoration: none !important;
}
h2:hover .anchor, h3:hover .anchor, h2 .anchor:focus, h3 .anchor:focus {
  opacity: 1;
}
.anchor:hover { color: var(--accent); }

.match-highlight {
  background: var(--highlight);
  border-radius: 3px;
  padding: 0 2px;
}

/* Back-to-top floating button */
.back-to-top {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity .2s, transform .2s, background .15s;
  z-index: 30;
}
.back-to-top.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
.back-to-top:hover { background: var(--accent-hover); }

/* Mobile TOC toggle */
.toc-mobile-toggle {
  display: none;
  width: 100%;
  margin-bottom: 1rem;
  padding: .55rem .75rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--fg);
  border-radius: var(--radius);
  font-size: .9rem;
  text-align: left;
  cursor: pointer;
}
@media (max-width: 880px) {
  .toc-mobile-toggle { display: block; }
  .search-wrap { display: none; }
}

/* Print */
@media print {
  header.topbar, nav.toc, .back-to-top, .skip-link, .progress-bar,
  .code-block__header { display: none !important; }
  body { font-size: 11pt; line-height: 1.5; color: #000; background: #fff; }
  .layout { grid-template-columns: 1fr; padding: 0; max-width: none; }
  .hero { background: none; border: none; padding: 0; }
  main.content a { color: #000; border-bottom: none; }
  main.content a[href^='http']::after { content: ' (' attr(href) ')'; font-size: .85em; }
  .code-block, main.content pre { border: 1px solid #ccc; background: #f4f4f4; }
}
`;

const TEMPLATE_JS = `
(function () {
  const root = document.documentElement;
  const STORAGE = 'po-manual:theme';
  const stored = localStorage.getItem(STORAGE);
  const initial =
    stored ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', initial);

  const themeBtn = document.getElementById('theme-toggle');
  const updateThemeBtn = () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    themeBtn.setAttribute(
      'aria-label',
      isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap',
    );
    themeBtn.innerHTML = isDark
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  };
  updateThemeBtn();
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE, next);
    updateThemeBtn();
  });

  const tocEl = document.querySelector('nav.toc');
  const tocMobileToggle = document.getElementById('toc-mobile-toggle');
  if (tocMobileToggle) {
    tocMobileToggle.addEventListener('click', () => {
      tocEl.classList.toggle('open');
    });
  }

  const search = document.getElementById('search');
  const searchStatus = document.getElementById('search-status');
  const searchStatusText = document.getElementById('search-status-text');
  const headings = Array.from(
    document.querySelectorAll('main.content h2, main.content h3'),
  );
  const SEARCH_EXCLUDE_IDS = new Set([
    'toc-mobile-toggle',
    'search-status',
  ]);
  // Only filter the actual document content — leave hero, search status, and
  // mobile TOC toggle visible at all times.
  const blocks = Array.from(document.querySelectorAll('main.content > *')).filter(
    (el) =>
      !el.classList.contains('hero') &&
      !el.classList.contains('toc-mobile-toggle') &&
      !el.classList.contains('search-status') &&
      !SEARCH_EXCLUDE_IDS.has(el.id),
  );
  const tocItems = Array.from(tocEl.querySelectorAll('li'));

  function clearHighlights() {
    blocks.forEach((b) => (b.style.display = ''));
    tocEl.classList.remove('hidden-by-search');
    tocEl.classList.remove('empty');
    tocItems.forEach((li) => li.classList.remove('hidden'));
    searchStatus.classList.remove('visible');
    searchStatus.classList.remove('empty');
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (!q) {
      clearHighlights();
      return;
    }
    clearHighlights();
    tocEl.classList.add('hidden-by-search');
    const visibleSlugs = new Set();
    let currentSlug = null;
    let matchCount = 0;
    blocks.forEach((b) => {
      if (b.tagName === 'H2' || b.tagName === 'H3') {
        currentSlug = b.id;
      }
      const t = (b.textContent || '').toLowerCase();
      if (t.includes(q)) {
        b.style.display = '';
        if (currentSlug) visibleSlugs.add(currentSlug);
        matchCount += 1;
      } else {
        b.style.display = 'none';
      }
    });
    headings.forEach((h) => {
      if (visibleSlugs.has(h.id)) h.style.display = '';
    });
    tocItems.forEach((li) => {
      const anchor = li.querySelector('a');
      const slug = anchor && anchor.getAttribute('href').replace(/^#/, '');
      if (slug && visibleSlugs.has(slug)) li.classList.remove('hidden');
      else li.classList.add('hidden');
    });
    searchStatus.classList.add('visible');
    if (matchCount === 0) {
      tocEl.classList.add('empty');
      searchStatus.classList.add('empty');
      searchStatusText.innerHTML =
        'Tidak ada hasil untuk <strong>' + escapeHtml(q) + '</strong>.';
    } else {
      searchStatusText.innerHTML =
        '<strong>' +
        matchCount +
        '</strong> blok cocok di <strong>' +
        visibleSlugs.size +
        '</strong> bagian.';
    }
  });

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      search.value = '';
      clearHighlights();
      e.preventDefault();
    }
  });

  // Ctrl/Cmd+K → focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      search.focus();
      search.select();
    }
  });

  // ScrollSpy: highlight active TOC entry
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id;
          tocItems.forEach((li) => {
            const a = li.querySelector('a');
            if (a && a.getAttribute('href') === '#' + id) a.classList.add('active');
            else if (a) a.classList.remove('active');
          });
        }
      });
    },
    { rootMargin: '-25% 0px -65% 0px' },
  );
  headings.forEach((h) => observer.observe(h));

  // Reading progress bar
  const progressBar = document.getElementById('progress-bar');
  const updateProgress = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
    progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // Back-to-top button
  const backToTop = document.getElementById('back-to-top');
  const updateBackToTop = () => {
    if (window.scrollY > 400) backToTop.classList.add('visible');
    else backToTop.classList.remove('visible');
  };
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  updateBackToTop();

  // Copy-to-clipboard buttons on code blocks
  document.querySelectorAll('.code-block').forEach((block) => {
    const btn = block.querySelector('.code-block__copy');
    const code = block.querySelector('pre code');
    if (!btn || !code) return;
    btn.addEventListener('click', async () => {
      const text = code.textContent || '';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        const original = btn.textContent;
        btn.textContent = 'Disalin';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      } catch (err) {
        btn.textContent = 'Gagal';
        setTimeout(() => {
          btn.textContent = 'Salin';
        }, 1500);
      }
    });
  });

  // Library identity hook (frontend can postMessage to update brand)
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'po:identity') return;
    const brand = document.getElementById('brand-nama');
    if (brand && typeof ev.data.nama === 'string' && ev.data.nama.trim()) {
      brand.textContent = ev.data.nama;
    }
    const heroBrand = document.getElementById('hero-brand');
    if (heroBrand && typeof ev.data.nama === 'string' && ev.data.nama.trim()) {
      heroBrand.textContent = ev.data.nama;
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
`;

function buildHtml({ html, toc }, { libNama }) {
  const tocHtml = toc
    .map((t) => {
      const cls = `level-${t.level}`;
      return `<li class="${cls}"><a href="#${t.slug}">${escapeHtml(t.text)}</a></li>`;
    })
    .join('');

  const sectionCount = toc.filter((t) => t.level === 2).length;
  const subsectionCount = toc.filter((t) => t.level === 3).length;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>Buku Manual — Perpustakaan Offline</title>
  <style>${TEMPLATE_CSS}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Lewati ke konten</a>
  <div class="progress-bar" id="progress-bar" role="progressbar" aria-label="Progres baca"></div>
  <header class="topbar">
    <div class="brand-block">
      <div class="brand-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      </div>
      <div class="brand">
        <span id="brand-nama">${escapeHtml(libNama)}</span>
        <small>Buku Manual Pengguna</small>
      </div>
    </div>
    <div class="search-wrap">
      <span class="search-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="search" type="search" placeholder="Cari di manual…" aria-label="Cari di manual" />
      <kbd>Ctrl K</kbd>
    </div>
    <button id="theme-toggle" class="icon-btn" aria-label="Toggle tema"></button>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="Daftar isi">
      <div class="toc-title">Daftar Isi</div>
      <ul>${tocHtml}</ul>
      <div class="toc-empty">Tidak ada hasil cocok.</div>
    </nav>
    <main class="content" id="main-content">
      <button id="toc-mobile-toggle" class="toc-mobile-toggle" type="button" aria-label="Buka daftar isi">
        Daftar Isi
      </button>
      <section class="hero">
        <h1>Buku Manual <span id="hero-brand">${escapeHtml(libNama)}</span></h1>
        <p class="hero-sub">
          Panduan lengkap untuk pustakawan dan operator. Pelajari setiap menu
          aplikasi sesuai urutan pemakaian sehari-hari.
        </p>
        <div class="hero-meta">
          <span class="chip"><strong>${sectionCount}</strong> bagian utama</span>
          <span class="chip"><strong>${subsectionCount}</strong> sub-bagian</span>
          <span class="chip">Tekan <strong>Ctrl + K</strong> untuk mencari</span>
        </div>
      </section>
      <div id="search-status" class="search-status">
        <span id="search-status-text"></span>
      </div>
      ${html}
    </main>
  </div>
  <button id="back-to-top" class="back-to-top" type="button" aria-label="Kembali ke atas">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
  </button>
  <script>${TEMPLATE_JS}</script>
</body>
</html>
`;
}

function buildAll() {
  const md = sources.map((s) => readFileSync(s, 'utf8')).join('\n\n');
  const rendered = renderMarkdown(md);
  // Default identity placeholder; the frontend can override via postMessage.
  const html = buildHtml(rendered, { libNama: 'Perpustakaan Sekolah' });
  outDirs.forEach((dir) => {
    mkdirSync(dir, { recursive: true });
    // CSS + JS are inlined into the HTML so the manual webview never
    // depends on external file loading at runtime (Tauri 2 bundles all
    // assets via a custom protocol that has occasionally produced blank
    // secondary windows when it tries to fetch sibling .css/.js — see
    // BUG-009/BUG-010 follow-up).
    writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
  });
  // eslint-disable-next-line no-console
  console.log(
    `[manual] wrote ${rendered.toc.length} TOC entries (${
      rendered.toc.filter((t) => t.level === 2).length
    } sections) to ${outDirs.length} target(s).`,
  );
}

buildAll();
