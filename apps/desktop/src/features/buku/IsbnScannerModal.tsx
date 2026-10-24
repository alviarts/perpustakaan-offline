import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { invoke } from '@tauri-apps/api/core';
import { X, Camera, Loader2, BookOpen, User, Building2, Calendar, Hash } from 'lucide-react';
import { assetsApi } from '@/lib/assets';

interface BookMetadata {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  page_count: number | null;
  categories: string[];
  language: string | null;
  cover_url: string | null;
  source: string;
  ddc?: string | null;
  price?: string | null;
  source_url?: string | null;
}

/** Friendly label for the source key returned by the Rust lookup engine. */
function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    perpusnas: 'Perpusnas (Registry ISBN Indonesia)',
    jakarta: 'Perpustakaan Jakarta (JAKLITERA)',
    google_books: 'Google Books',
    google_books_html: 'Google Books',
    open_library: 'Open Library',
    onesearch: 'Onesearch.id',
    crossref: 'Crossref',
    archive_org: 'archive.org',
    libris: 'LIBRIS (Swedia)',
    k10plus: 'K10plus (Jerman)',
    ndl: 'NDL Search (Jepang)',
    periplus: 'Periplus',
    belbuk: 'Belbuk',
    deepublish: 'Deepublish Store',
    abebooks: 'AbeBooks',
    inventaire: 'Inventaire.io',
  };
  return map[source] ?? source;
}

interface IsbnScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookFound: (metadata: BookMetadata, coverPath: string | null) => void;
}

export function IsbnScannerModal({ isOpen, onClose, onBookFound }: IsbnScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<BookMetadata | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Render the freshly-downloaded local cover via a data URL. The `asset://`
  // protocol needs an absolute path and is unreliable on Windows, so we read
  // the bytes directly (same approach as useUserAvatar / OPAC covers).
  useEffect(() => {
    setCoverPreviewUrl(null);
    if (!coverPath) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await assetsApi.readDataUrl(coverPath);
        if (!cancelled) setCoverPreviewUrl(data || null);
      } catch {
        if (!cancelled) setCoverPreviewUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coverPath]);

  // Initialize barcode scanner
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') return;

    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setError(null);
        setCameraError(null);

        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          setCameraError(
            'Kamera tidak terdeteksi. Pastikan kamera terpasang dan izin akses kamera diizinkan.',
          );
          setIsScanning(false);
          return;
        }

        // Use first camera (usually back camera on mobile)
        const firstDevice = videoInputDevices[0];
        if (!firstDevice) {
          setCameraError('Tidak dapat mengakses kamera. Coba reset pengaturan kamera.');
          setIsScanning(false);
          return;
        }
        const selectedDeviceId = firstDevice.deviceId;

        if (!videoRef.current) {
          setCameraError('Kamera belum siap. Coba reset pengaturan kamera.');
          setIsScanning(false);
          return;
        }

        await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          async (result) => {
            if (!result) return;
            const isbn = result.getText();

            // Stop scanning
            codeReader.reset();
            setIsScanning(false);

            // Lookup book
            await lookupIsbn(isbn);
          }
        );
      } catch {
        setCameraError(
          'Gagal mengakses kamera (izin ditolak atau kamera sedang dipakai aplikasi lain).',
        );
        setIsScanning(false);
      }
    };

    startScanning();

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isOpen, scanMode, cameraAttempt]);

  // Lookup ISBN from backend
  const lookupIsbn = async (isbn: string) => {
    setIsLoading(true);
    setError(null);
    setMetadata(null);
    setCoverPath(null);

    try {
      // Validate ISBN first
      const [normalizedIsbn] = await invoke<[string, string]>('validate_isbn', {
        isbnInput: isbn,
      });

      // Lookup and download cover
      const [bookMetadata, localCoverPath] = await invoke<[BookMetadata, string | null]>(
        'lookup_and_download_cover',
        { isbn: normalizedIsbn }
      );

      setMetadata(bookMetadata);
      setCoverPath(localCoverPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Buku tidak ditemukan untuk ISBN ini');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual ISBN input
  const handleManualLookup = async () => {
    if (!manualIsbn.trim()) {
      setError('Masukkan ISBN terlebih dahulu');
      return;
    }

    await lookupIsbn(manualIsbn.trim());
  };

  // Handle use book data
  const handleUseBook = () => {
    if (metadata) {
      onBookFound(metadata, coverPath);
      handleClose();
    }
  };

  // Close modal
  const handleClose = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setIsScanning(false);
    setManualIsbn('');
    setError(null);
    setCameraError(null);
    setMetadata(null);
    setCoverPath(null);
    setScanMode('camera');
    onClose();
  };

  // Re-request camera access and restart the scanner. Useful when the user
  // accidentally denied the permission or the OS camera setting is off.
  const handleResetCamera = async () => {
    setCameraError(null);
    setIsScanning(false);
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ video: true });
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      // Still denied — the notice will reappear after the retry.
    }
    setScanMode('camera');
    setCameraAttempt((n) => n + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Buku via ISBN
          </h2>
          <div className="flex items-center gap-2">
            {/* Reset Tutorial Button - always show in dev mode */}
            <button
              onClick={() => {
                localStorage.removeItem('isbn-tutorial-completed');
                window.location.reload();
              }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Reset tutorial dan reload halaman"
            >
              Reset Tutorial
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setScanMode('camera')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                scanMode === 'camera'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Camera className="inline-block w-4 h-4 mr-2" />
              Scan Barcode
            </button>
            <button
              onClick={() => setScanMode('manual')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                scanMode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Hash className="inline-block w-4 h-4 mr-2" />
              Input Manual
            </button>
          </div>

          {/* Scanner / Manual Input */}
          {scanMode === 'camera' ? (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-4 border-blue-500 rounded-lg animate-pulse" />
                </div>
              )}
              {isScanning && (
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                    Arahkan kamera ke barcode ISBN
                  </p>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center">
                  <Camera className="h-10 w-10 text-white/80" />
                  <p className="max-w-md text-sm text-white">{cameraError}</p>
                  <p className="max-w-md text-xs text-white/70">
                    Periksa izin kamera di pengaturan sistem (Windows: Settings → Privacy &amp;
                    security → Camera), izinkan aplikasi ini, lalu tekan tombol di bawah.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetCamera}
                    data-testid="rescan-camera"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Reset Pengaturan Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('manual')}
                    className="text-xs text-white/80 underline"
                  >
                    Gunakan input manual
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {cameraError && (
                <div
                  className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                  data-testid="camera-error-notice"
                >
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={handleResetCamera}
                    className="mt-2 font-medium text-blue-600 underline dark:text-blue-400"
                  >
                    Reset Pengaturan Kamera
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ISBN (10 atau 13 digit)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualIsbn}
                    onChange={(e) => setManualIsbn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                    placeholder="978-0-306-40615-7 atau 9780306406157"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleManualLookup}
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Cari'
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Contoh: 9780306406157 atau 978-0-306-40615-7
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Mencari data buku...
              </span>
            </div>
          )}

          {/* Book Metadata Preview */}
          {metadata && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-4">
                {/* Cover Image — prefer the freshly-downloaded local file
                    (rendered as a data URL), fall back to the remote thumb. */}
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt={metadata.title}
                    className="w-32 h-48 object-cover rounded-lg shadow-md"
                  />
                ) : metadata.cover_url ? (
                  <img
                    src={metadata.cover_url}
                    alt={metadata.title}
                    className="w-32 h-48 object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-32 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                {/* Metadata */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metadata.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ISBN: {metadata.isbn}
                    </p>
                  </div>

                  {metadata.authors.length > 0 && (
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pengarang</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {metadata.authors.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {metadata.publisher && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Penerbit</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {metadata.publisher}
                        </p>
                      </div>
                    </div>
                  )}

                  {metadata.published_date && (
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tahun Terbit</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {metadata.published_date}
                        </p>
                      </div>
                    </div>
                  )}

                  {metadata.page_count && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Jumlah Halaman</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {metadata.page_count} halaman
                      </p>
                    </div>
                  )}

                  {metadata.categories.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kategori</p>
                      <div className="flex flex-wrap gap-1">
                        {metadata.categories.slice(0, 3).map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5 pt-2">
                    <p className="text-xs text-gray-400">
                      Sumber: {sourceLabel(metadata.source)}
                    </p>
                    {metadata.price && (
                      <p className="text-xs text-gray-400">
                        Harga referensi: {metadata.price}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {metadata.description && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Deskripsi</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4">
                    {metadata.description}
                  </p>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleUseBook}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Gunakan Data Ini
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
