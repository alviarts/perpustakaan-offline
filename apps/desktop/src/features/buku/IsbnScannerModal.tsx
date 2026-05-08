import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { invoke } from '@tauri-apps/api/core';
import { X, Camera, Loader2, BookOpen, User, Building2, Calendar, Hash } from 'lucide-react';

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
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize barcode scanner
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') return;

    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setError(null);

        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          setError('Tidak ada kamera yang terdeteksi');
          setScanMode('manual');
          return;
        }

        // Use first camera (usually back camera on mobile)
        const firstDevice = videoInputDevices[0];
        if (!firstDevice) {
          setError('Tidak dapat mengakses kamera');
          setScanMode('manual');
          return;
        }
        const selectedDeviceId = firstDevice.deviceId;

        if (!videoRef.current) {
          setError('Video element not ready');
          return;
        }

        await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          async (result, error) => {
            if (result) {
              const isbn = result.getText();
              console.log('ISBN detected:', isbn);
              
              // Stop scanning
              codeReader.reset();
              setIsScanning(false);

              // Lookup book
              await lookupIsbn(isbn);
            }

            if (error && !(error instanceof NotFoundException)) {
              console.error('Scanner error:', error);
            }
          }
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
        setError('Gagal mengakses kamera. Gunakan input manual.');
        setScanMode('manual');
        setIsScanning(false);
      }
    };

    startScanning();

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isOpen, scanMode]);

  // Lookup ISBN from backend
  const lookupIsbn = async (isbn: string) => {
    setIsLoading(true);
    setError(null);
    setMetadata(null);
    setCoverPath(null);

    try {
      // Validate ISBN first
      const [normalizedIsbn, isbnType] = await invoke<[string, string]>('validate_isbn', {
        isbnInput: isbn,
      });

      console.log(`Valid ${isbnType}: ${normalizedIsbn}`);

      // Lookup and download cover
      const [bookMetadata, localCoverPath] = await invoke<[BookMetadata, string | null]>(
        'lookup_and_download_cover',
        { isbn: normalizedIsbn }
      );

      console.log('Book found:', bookMetadata);
      setMetadata(bookMetadata);
      setCoverPath(localCoverPath);
    } catch (err: any) {
      console.error('ISBN lookup error:', err);
      setError(err.message || 'Buku tidak ditemukan untuk ISBN ini');
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
    setMetadata(null);
    setCoverPath(null);
    setScanMode('camera');
    onClose();
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
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
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
            </div>
          ) : (
            <div className="space-y-4">
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
                {/* Cover Image */}
                {coverPath ? (
                  <img
                    src={`asset://localhost/${coverPath}`}
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

                  <div className="pt-2">
                    <p className="text-xs text-gray-400">
                      Sumber: {metadata.source === 'google_books' ? 'Google Books' : metadata.source === 'open_library' ? 'Open Library' : 'Gramedia'}
                    </p>
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
