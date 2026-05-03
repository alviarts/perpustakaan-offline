/**
 * Manual book HTML generator (revisi #4).
 *
 * Reads the legacy `docs/manual.md`, converts to a responsive HTML page with:
 *   - sticky table of contents (built from h2/h3 headings)
 *   - full-text search (filters TOC + highlights matches)
 *   - light/dark mode toggle
 *   - placeholder hooks for the library identity (`{{LIB_NAMA}}`) injected at
 *     runtime by the frontend before opening the manual
 *
 * Output is written as three sibling files so the page renders correctly
 * under Tauri 2's strict production CSP (which strips `'unsafe-inline'`
 * for assets it cannot hash at build time):
 *   - `apps/desktop/public/manual/index.html`
 *   - `apps/desktop/public/manual/style.css`
 *   - `apps/desktop/public/manual/app.js`
 *
 * Inline `<style>`/`<script>` tags are intentionally avoided — same-origin
 * external files are allowed by the default `'self'` directives without any
 * nonce/hash plumbing.
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
    // Inline code first to protect from other replacements
    s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
    // Bold **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    // Links [text](href)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, h) => {
      const url = h.startsWith('http') || h.startsWith('#') ? h : escapeHtml(h);
      const ext = url.startsWith('http')
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
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
      out.push(
        `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(
          codeLines.join('\n'),
        )}</code></pre>`,
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
      out.push(
        `<ul>${items.map((it) => `<li>${formatInline(it)}</li>`).join('')}</ul>`,
      );
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
      out.push(
        `<ol>${items.map((it) => `<li>${formatInline(it)}</li>`).join('')}</ol>`,
      );
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
  --bg-elevated: #f7f8fa;
  --fg: #0f172a;
  --fg-muted: #475569;
  --accent: #2563eb;
  --border: #e2e8f0;
  --code-bg: #f1f5f9;
  --shadow: 0 1px 2px rgba(15,23,42,0.08);
}
:root[data-theme='dark'] {
  --bg: #0f172a;
  --bg-elevated: #1e293b;
  --fg: #f1f5f9;
  --fg-muted: #94a3b8;
  --accent: #60a5fa;
  --border: #334155;
  --code-bg: #1e293b;
  --shadow: 0 1px 2px rgba(0,0,0,0.4);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.65;
  font-size: 16px;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
header.topbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}
header.topbar .brand {
  font-weight: 700;
  font-size: 1rem;
  margin-right: auto;
}
header.topbar .brand small {
  display: block; font-weight: 400; color: var(--fg-muted); font-size: 0.78rem;
}
header.topbar input[type='search'] {
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  font-size: 0.9rem;
  min-width: 220px;
}
header.topbar button {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
}
header.topbar button:hover { background: var(--bg); }
.layout { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; max-width: 1200px; margin: 0 auto; padding: 1.5rem 1.25rem; }
@media (max-width: 768px) { .layout { grid-template-columns: 1fr; } }
nav.toc {
  position: sticky; top: 5rem;
  align-self: start;
  font-size: 0.9rem;
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
  padding-right: 0.5rem;
}
nav.toc ul { list-style: none; padding: 0; margin: 0; }
nav.toc li { margin: 0.15rem 0; }
nav.toc a {
  display: block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: var(--fg-muted);
}
nav.toc a:hover, nav.toc a.active { color: var(--fg); background: var(--bg-elevated); text-decoration: none; }
nav.toc .level-3 { padding-left: 1rem; font-size: 0.85rem; }
nav.toc.hidden-by-search li.hidden { display: none; }
@media (max-width: 768px) { nav.toc { position: static; max-height: none; } }
main.content { min-width: 0; }
main.content h1, main.content h2, main.content h3 {
  scroll-margin-top: 5rem;
  line-height: 1.25;
}
main.content h2 { border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; margin-top: 2.25rem; }
main.content code {
  background: var(--code-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.88em;
}
main.content pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  overflow-x: auto;
}
main.content pre code { background: transparent; padding: 0; font-size: 0.88em; }
main.content blockquote {
  border-left: 4px solid var(--accent);
  padding: 0.4rem 1rem;
  background: var(--bg-elevated);
  color: var(--fg-muted);
  margin: 1rem 0;
  border-radius: 0 6px 6px 0;
}
main.content hr { border: 0; border-top: 1px solid var(--border); margin: 2rem 0; }
.anchor { color: var(--fg-muted); margin-right: 0.25rem; opacity: 0; transition: opacity .15s; }
h2:hover .anchor, h3:hover .anchor { opacity: 1; }
.match-highlight { background: rgba(255, 230, 0, 0.55); border-radius: 3px; }
:root[data-theme='dark'] .match-highlight { background: rgba(96, 165, 250, 0.45); color: var(--fg); }
`;

const TEMPLATE_JS = `
(function () {
  const root = document.documentElement;
  const STORAGE = 'po-manual:theme';
  const stored = localStorage.getItem(STORAGE);
  const initial = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', initial);

  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE, next);
  });

  const tocEl = document.querySelector('nav.toc');
  const search = document.getElementById('search');
  const headings = Array.from(document.querySelectorAll('main.content h2, main.content h3'));
  const blocks = Array.from(document.querySelectorAll('main.content > *'));
  const tocItems = Array.from(tocEl.querySelectorAll('li'));

  function clearHighlights() {
    document.querySelectorAll('.match-highlight').forEach((el) => {
      const text = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(text, el);
    });
    blocks.forEach((b) => (b.style.display = ''));
    tocEl.classList.remove('hidden-by-search');
    tocItems.forEach((li) => li.classList.remove('hidden'));
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (!q) { clearHighlights(); return; }
    clearHighlights();
    tocEl.classList.add('hidden-by-search');
    const visibleSlugs = new Set();
    let currentSlug = null;
    blocks.forEach((b) => {
      if (b.tagName === 'H2' || b.tagName === 'H3') {
        currentSlug = b.id;
      }
      const t = (b.textContent || '').toLowerCase();
      if (t.includes(q)) {
        b.style.display = '';
        if (currentSlug) visibleSlugs.add(currentSlug);
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
  });

  // ScrollSpy: highlight active TOC entry
  const observer = new IntersectionObserver((entries) => {
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
  }, { rootMargin: '-30% 0px -65% 0px' });
  headings.forEach((h) => observer.observe(h));

  // Library identity hook (frontend can postMessage to update brand)
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'po:identity') return;
    const brand = document.getElementById('brand-nama');
    if (brand && typeof ev.data.nama === 'string' && ev.data.nama.trim()) {
      brand.textContent = ev.data.nama;
    }
  });
})();
`;

function buildHtml({ html, toc }, { libNama }) {
  const tocHtml = toc
    .map((t) => {
      const cls = `level-${t.level}`;
      return `<li class="${cls}"><a href="#${t.slug}">${escapeHtml(t.text)}</a></li>`;
    })
    .join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buku Manual — Perpustakaan Offline</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span id="brand-nama">${escapeHtml(libNama)}</span>
      <small>Buku Manual Pengguna</small>
    </div>
    <input id="search" type="search" placeholder="Cari di manual…" aria-label="Cari" />
    <button id="theme-toggle" aria-label="Toggle theme">Light / Dark</button>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="Daftar isi">
      <ul>${tocHtml}</ul>
    </nav>
    <main class="content">
      ${html}
    </main>
  </div>
  <script src="./app.js"></script>
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
    writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
    writeFileSync(resolve(dir, 'style.css'), TEMPLATE_CSS.trim() + '\n', 'utf8');
    writeFileSync(resolve(dir, 'app.js'), TEMPLATE_JS.trim() + '\n', 'utf8');
  });
  // eslint-disable-next-line no-console
  console.log(`[manual] wrote ${rendered.toc.length} TOC entries + style.css + app.js to ${outDirs.length} target(s).`);
}

buildAll();
