/**
 * Print an HTML document without opening a pop-up window.
 *
 * Tauri's WebView2 blocks `window.open()` for programmatic pop-ups (and even
 * user-initiated ones are unreliable), so printing via a hidden same-origin
 * iframe is the robust approach: no pop-up permission is required and
 * `iframe.contentWindow.print()` is supported by WebView2.
 *
 * Returns `true` when the print was triggered, `false` when the environment
 * does not allow it (the caller may fall back to opening a window).
 */
export function printHtmlViaIframe(html: string): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'print-frame');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  let printed = false;
  const triggerPrint = (): void => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      // User can still print manually; nothing else we can do.
    }
    // Keep the frame briefly so the print snapshot completes, then clean up.
    window.setTimeout(() => iframe.remove(), 2000);
  };

  try {
    doc.open();
    doc.write(html);
    doc.close();
  } catch {
    iframe.remove();
    return false;
  }

  const onReady = (): void => {
    // A short delay lets layout/paint settle so nothing is cut off.
    window.setTimeout(triggerPrint, 120);
  };

  if (doc.readyState === 'complete') {
    onReady();
  } else {
    win.addEventListener('load', onReady, { once: true });
    // Safety net in case `load` never fires for a written document.
    window.setTimeout(triggerPrint, 1500);
  }

  return true;
}

/**
 * Print via iframe, falling back to a pop-up window when the iframe path is
 * unavailable. Throws only when both fail (caller can show a toast).
 */
export function printHtmlDocument(html: string): void {
  if (printHtmlViaIframe(html)) return;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    throw new Error('Tidak dapat membuka jendela cetak. Coba lagi.');
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // ignore
    }
  }, 200);
}
