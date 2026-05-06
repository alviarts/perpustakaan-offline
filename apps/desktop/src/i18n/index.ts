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
import idKta from './id/kta.json';
import idLabelBuku from './id/label-buku.json';
import idSirkulasi from './id/sirkulasi.json';
import idReservasi from './id/reservasi.json';
import idStocktake from './id/stocktake.json';
import idOpac from './id/opac.json';
import idErrors from './id/errors.json';
import idSurat from './id/surat.json';
import idWishlist from './id/wishlist.json';

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
import enKta from './en/kta.json';
import enLabelBuku from './en/label-buku.json';
import enSirkulasi from './en/sirkulasi.json';
import enReservasi from './en/reservasi.json';
import enStocktake from './en/stocktake.json';
import enOpac from './en/opac.json';
import enErrors from './en/errors.json';
import enSurat from './en/surat.json';
import enWishlist from './en/wishlist.json';

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
  'kta',
  'label-buku',
  'sirkulasi',
  'reservasi',
  'stocktake',
  'opac',
  'errors',
  'surat',
  'wishlist',
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
    kta: idKta,
    'label-buku': idLabelBuku,
    sirkulasi: idSirkulasi,
    reservasi: idReservasi,
    stocktake: idStocktake,
    opac: idOpac,
    errors: idErrors,
    surat: idSurat,
    wishlist: idWishlist,
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
    kta: enKta,
    'label-buku': enLabelBuku,
    sirkulasi: enSirkulasi,
    reservasi: enReservasi,
    stocktake: enStocktake,
    opac: enOpac,
    errors: enErrors,
    surat: enSurat,
    wishlist: enWishlist,
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
