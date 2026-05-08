import { useEffect, useRef } from 'react';
import Shepherd from 'shepherd.js';
import type { Tour } from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './isbn-tutorial.css';

interface UseIsbnTutorialOptions {
  enabled?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function useIsbnTutorial(options: UseIsbnTutorialOptions = {}) {
  const { enabled = true, onComplete, onSkip } = options;
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Check if dark mode is active
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Initialize tour
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true,
        },
        classes: isDarkMode ? 'shepherd-theme-custom dark' : 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
      },
    });

    // Step 1: Welcome
    tour.addStep({
      id: 'welcome',
      title: '🎉 Fitur Baru: ISBN Scanner',
      text: `
        <p>Sekarang kamu bisa import buku dengan mudah menggunakan ISBN Scanner!</p>
        <p>Mari saya tunjukkan caranya.</p>
      `,
      buttons: [
        {
          text: 'Skip Tutorial',
          action: () => {
            tour.cancel();
            onSkip?.();
          },
          secondary: true,
        },
        {
          text: 'Mulai',
          action: tour.next,
        },
      ],
    });

    // Step 2: Import Button
    tour.addStep({
      id: 'import-button',
      title: 'Tombol Impor via ISBN',
      text: `
        <p>Klik tombol <strong>"Impor via ISBN"</strong> untuk membuka scanner.</p>
        <p>Tombol ini ada di bagian atas halaman Buku.</p>
      `,
      attachTo: {
        element: '[data-tour="isbn-import-button"]',
        on: 'bottom',
      },
      buttons: [
        {
          text: 'Kembali',
          action: tour.back,
          secondary: true,
        },
        {
          text: 'Lanjut',
          action: tour.next,
        },
      ],
    });

    // Step 3: Scanner Modes
    tour.addStep({
      id: 'scanner-modes',
      title: 'Dua Cara Input ISBN',
      text: `
        <p>Ada 2 cara untuk input ISBN:</p>
        <ul>
          <li><strong>Scan Barcode:</strong> Gunakan webcam untuk scan barcode ISBN</li>
          <li><strong>Input Manual:</strong> Ketik ISBN secara manual</li>
        </ul>
        <p>Pilih yang paling nyaman untukmu!</p>
      `,
      buttons: [
        {
          text: 'Kembali',
          action: tour.back,
          secondary: true,
        },
        {
          text: 'Lanjut',
          action: tour.next,
        },
      ],
    });

    // Step 4: Metadata Preview
    tour.addStep({
      id: 'metadata-preview',
      title: 'Preview Metadata Buku',
      text: `
        <p>Setelah ISBN ditemukan, kamu akan melihat preview:</p>
        <ul>
          <li>Judul & Pengarang</li>
          <li>Penerbit & Tahun Terbit</li>
          <li>Deskripsi & Kategori</li>
          <li>Cover Buku</li>
        </ul>
        <p>Semua data ini akan otomatis mengisi form buku!</p>
      `,
      buttons: [
        {
          text: 'Kembali',
          action: tour.back,
          secondary: true,
        },
        {
          text: 'Lanjut',
          action: tour.next,
        },
      ],
    });

    // Step 5: Auto-fill Form
    tour.addStep({
      id: 'auto-fill',
      title: 'Auto-fill Form Buku',
      text: `
        <p>Klik <strong>"Gunakan Data Ini"</strong> untuk mengisi form secara otomatis.</p>
        <p>Kamu masih bisa edit data sebelum menyimpan buku.</p>
      `,
      buttons: [
        {
          text: 'Kembali',
          action: tour.back,
          secondary: true,
        },
        {
          text: 'Lanjut',
          action: tour.next,
        },
      ],
    });

    // Step 6: Tips
    tour.addStep({
      id: 'tips',
      title: '💡 Tips & Trik',
      text: `
        <ul>
          <li>Pastikan barcode ISBN terlihat jelas di kamera</li>
          <li>Gunakan pencahayaan yang cukup</li>
          <li>Jika scan gagal, coba input manual</li>
          <li>Tidak semua buku Indonesia ada di database internasional</li>
        </ul>
      `,
      buttons: [
        {
          text: 'Kembali',
          action: tour.back,
          secondary: true,
        },
        {
          text: 'Lanjut',
          action: tour.next,
        },
      ],
    });

    // Step 7: Finish
    tour.addStep({
      id: 'finish',
      title: '✅ Selesai!',
      text: `
        <p>Sekarang kamu siap menggunakan ISBN Scanner!</p>
        <p>Selamat mencoba dan semoga memudahkan pekerjaanmu. 📚</p>
      `,
      buttons: [
        {
          text: 'Mulai Scan',
          action: () => {
            tour.complete();
            onComplete?.();
          },
        },
      ],
    });

    // Event handlers
    tour.on('complete', () => {
      onComplete?.();
    });

    tour.on('cancel', () => {
      onSkip?.();
    });

    // Add dark mode class to shepherd element when step shows
    tour.on('show', () => {
      if (isDarkMode) {
        const shepherdElement = document.querySelector('.shepherd-element');
        if (shepherdElement) {
          shepherdElement.classList.add('dark');
        }
      }
    });

    tourRef.current = tour;

    // Cleanup
    return () => {
      if (tourRef.current) {
        tourRef.current.complete();
        tourRef.current = null;
      }
    };
  }, [enabled, onComplete, onSkip]);

  const startTour = () => {
    tourRef.current?.start();
  };

  const cancelTour = () => {
    tourRef.current?.cancel();
  };

  return {
    startTour,
    cancelTour,
    tour: tourRef.current,
  };
}
