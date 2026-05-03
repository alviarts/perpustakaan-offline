import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import idCommon from './id/common.json';
import idAuth from './id/auth.json';
import idDashboard from './id/dashboard.json';
import idAnggota from './id/anggota.json';
import idBuku from './id/buku.json';
import idPeminjaman from './id/peminjaman.json';
import idPengembalian from './id/pengembalian.json';
import idKunjungan from './id/kunjungan.json';
import idLaporan from './id/laporan.json';
import idSettings from './id/settings.json';
import idMasterData from './id/master-data.json';
import idErrors from './id/errors.json';

import enCommon from './en/common.json';
import enAuth from './en/auth.json';
import enDashboard from './en/dashboard.json';
import enAnggota from './en/anggota.json';
import enBuku from './en/buku.json';
import enPeminjaman from './en/peminjaman.json';
import enPengembalian from './en/pengembalian.json';
import enKunjungan from './en/kunjungan.json';
import enLaporan from './en/laporan.json';
import enSettings from './en/settings.json';
import enMasterData from './en/master-data.json';
import enErrors from './en/errors.json';

export const NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'anggota',
  'buku',
  'peminjaman',
  'pengembalian',
  'kunjungan',
  'laporan',
  'settings',
  'masterData',
  'errors',
] as const;

export const SUPPORTED_LOCALES = ['id', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  id: {
    common: idCommon,
    auth: idAuth,
    dashboard: idDashboard,
    anggota: idAnggota,
    buku: idBuku,
    peminjaman: idPeminjaman,
    pengembalian: idPengembalian,
    kunjungan: idKunjungan,
    laporan: idLaporan,
    settings: idSettings,
    masterData: idMasterData,
    errors: idErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    anggota: enAnggota,
    buku: enBuku,
    peminjaman: enPeminjaman,
    pengembalian: enPengembalian,
    kunjungan: enKunjungan,
    laporan: enLaporan,
    settings: enSettings,
    masterData: enMasterData,
    errors: enErrors,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'id',
  fallbackLng: 'id',
  defaultNS: 'common',
  ns: NAMESPACES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
