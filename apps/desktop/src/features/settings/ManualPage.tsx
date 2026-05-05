import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search } from 'lucide-react';
import manualSrc from '@docs/manual.md?raw';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SettingsSection } from './SettingsSection';

/**
 * Extract a plain-text string from a React node tree. Used to compute slug
 * IDs from heading children that may include inline markdown elements (e.g.
 * a heading with a link or code). `String(node)` would render `[object
 * Object]` for those cases — this walker handles them.
 */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return nodeText(props.children);
  }
  return '';
}

/**
 * In-app rendering of `docs/manual.md` (revisi #4 follow-up).
 *
 * Previously the manual was a separate Tauri webview window opened via
 * `open_manual` that pointed at `dist/manual/index.html`, but on some
 * Windows installs that child window had a WebView2 lifecycle bug (the
 * window opened blank or refused to close cleanly). Renders the Markdown
 * source inline as React nodes via `react-markdown` so we never embed an
 * arbitrary HTML document inside the app shell.
 *
 * Features:
 * - Sticky search input that filters on heading text and falls back to a
 *   "no matches" placeholder.
 * - Auto-extracted table of contents from h2/h3 headings; click jumps to
 *   the section.
 * - Tailwind-styled headings, code blocks, lists, tables.
 */

interface TocEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

/**
 * Convert a heading text to its anchor id. We mirror GitHub's heading-anchor
 * algorithm: strip non-alphanumeric characters but preserve every whitespace
 * character as a single dash. This matters for headings containing `&` or
 * em-dash (e.g. "Login & Akun", "Master Data — Anggota") — the surrounding
 * spaces collapse into double-dash slugs (`login--akun`, `master-data--anggota`)
 * which is the convention `docs/manual.md` was authored against. Collapsing
 * runs of whitespace with `\s+` would produce single-dash slugs and break
 * every "Daftar Isi" link in the rendered manual.
 */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');

function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split('\n');
  const out: TocEntry[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(##|###)\s+(.+?)\s*$/.exec(line);
    if (!m || m[1] === undefined || m[2] === undefined) continue;
    const level: 2 | 3 = m[1] === '##' ? 2 : 3;
    const text = m[2].replace(/\{#[^}]+\}\s*$/, '').trim();
    out.push({ level, text, id: slugify(text) });
  }
  return out;
}

const TOC = extractToc(manualSrc);

export function ManualPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const [query, setQuery] = React.useState('');

  const trimmedQuery = query.trim().toLowerCase();
  const filteredToc = React.useMemo(() => {
    if (!trimmedQuery) return TOC;
    return TOC.filter((entry) => entry.text.toLowerCase().includes(trimmedQuery));
  }, [trimmedQuery]);

  const handleJumpTo = (id: string): void => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <SettingsSection i18nKey="manual" testId="settings-section-manual">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside
          className="flex flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
          aria-label={t('sections.manual.toc', { defaultValue: 'Daftar isi' })}
        >
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sections.manual.searchPlaceholder', {
                defaultValue: 'Cari judul bagian…',
              })}
              className="pl-8"
              data-testid="manual-search"
            />
          </div>
          <nav className="flex flex-col gap-0.5 text-sm" data-testid="manual-toc">
            {filteredToc.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {t('sections.manual.noMatches', {
                  defaultValue: 'Tidak ada bagian yang cocok.',
                })}
              </p>
            ) : (
              filteredToc.map((entry) => (
                <Button
                  key={`${entry.level}-${entry.id}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-auto justify-start whitespace-normal text-left text-xs ${
                    entry.level === 3 ? 'text-muted-foreground pl-6' : 'pl-2 font-medium'
                  }`}
                  onClick={() => handleJumpTo(entry.id)}
                  data-testid={`manual-toc-${entry.id}`}
                >
                  {entry.text}
                </Button>
              ))
            )}
          </nav>
        </aside>
        <article
          className="bg-background min-w-0 rounded-md border p-4 text-sm leading-relaxed"
          data-testid="manual-body"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-4 mt-2 text-2xl font-semibold tracking-tight">{children}</h1>
              ),
              h2: ({ children }) => {
                const id = slugify(nodeText(children));
                return (
                  <h2 id={id} className="mb-3 mt-8 border-b pb-1.5 text-xl font-semibold">
                    {children}
                  </h2>
                );
              },
              h3: ({ children }) => {
                const id = slugify(nodeText(children));
                return (
                  <h3 id={id} className="mb-2 mt-6 text-base font-semibold">
                    {children}
                  </h3>
                );
              },
              h4: ({ children }) => (
                <h4 className="mb-1.5 mt-4 text-sm font-semibold">{children}</h4>
              ),
              p: ({ children }) => <p className="my-3 text-sm leading-6">{children}</p>,
              ul: ({ children }) => (
                <ul className="my-3 ml-6 list-disc space-y-1 text-sm">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 ml-6 list-decimal space-y-1 text-sm">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-6">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-primary/40 bg-muted/40 my-3 border-l-2 px-3 py-1 text-sm italic">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="border-border my-6" />,
              a: ({ children, href }) => {
                const isExternal = href != null && /^https?:\/\//.test(href);
                const isHash = href != null && href.startsWith('#');
                // Hash-only links from the manual's "Daftar Isi" should scroll
                // to the matching heading inside the article. We handle this
                // explicitly to bypass the SPA router and to use smooth scroll.
                const handleHashClick = isHash
                  ? (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      const id = href.slice(1);
                      if (!id) return;
                      const node = document.getElementById(id);
                      if (node) {
                        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        window.history.replaceState(null, '', `#${id}`);
                      }
                    }
                  : undefined;
                return (
                  <a
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={handleHashClick}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {children}
                  </a>
                );
              },
              code: ({ children, className }) => {
                const isBlock = className && className.startsWith('language-');
                if (isBlock) {
                  return <code className={`${className} block whitespace-pre`}>{children}</code>;
                }
                return (
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-muted/40 my-3 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="bg-muted/60 border px-2 py-1 text-left font-semibold">{children}</th>
              ),
              td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
            }}
          >
            {manualSrc}
          </ReactMarkdown>
        </article>
      </div>
    </SettingsSection>
  );
}
