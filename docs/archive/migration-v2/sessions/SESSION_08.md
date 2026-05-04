# SESSION 08 — Dashboard modern dengan charts

> **Devin session 8/12.** Halaman Dashboard final: 3 hero card + donut + bar
> + featured row.

## Goal

- Redesign Dashboard (revisi #9):
  - Hero row: 3 KPI card (Total Anggota, Total Buku, Buku Dipinjam) + delta
    bulan-vs-bulan-lalu.
  - Donut chart distribusi DDC.
  - Bar chart kunjungan 7 hari terakhir.
  - Featured row: 5 anggota top + 5 buku top (mini-card).
  - Hapus Treeview (legacy).

## Revisi tercover

- #9 (Dashboard modern) — full

## Dependencies

- Sesi 4, 5, 6 COMPLETED (perlu data anggota/buku/peminjaman).

## Tasks breakdown

### 1. Backend

- `src-tauri/src/commands/dashboard.rs`:
  - `dashboard_kpi()` → { total_anggota, total_buku, buku_dipinjam,
    delta_anggota_pct, delta_buku_pct, delta_pinjam_pct }
  - `dashboard_ddc_distribution()` → [{ ddc_class, count }]
  - `dashboard_kunjungan_7d()` → [{ date, count }]
  - `dashboard_top_peminjam(limit)` → top 5 anggota
  - `dashboard_top_buku(limit)` → top 5 buku

### 2. Frontend Dashboard

- `src/routes/_authed/dashboard.tsx`:
  - **Hero row**: 3 `<KpiCard>` (icon Phosphor, angka besar, delta arrow,
    skeleton saat loading).
  - **Charts row** (2-col):
    - Donut DDC (`<PieChart>` recharts).
    - Bar kunjungan 7d (`<BarChart>` recharts).
  - **Featured row** (2-col):
    - Top Peminjam (mini-card list).
    - Top Buku (mini-card list).
  - Theme-aware: ambil chart color dari Tailwind CSS var.
  - Empty state: ilustrasi + CTA "Tambah anggota / buku" kalau DB kosong.

### 3. Reusable component

- `src/components/shared/KpiCard.tsx`
- `src/components/shared/Chart{Pie,Bar,Line}.tsx` wrapper recharts (theme-aware).

### 4. Tests

- Unit: `kpi-delta.test.ts` (calc bulan-vs-bulan-lalu).
- E2E: `dashboard.spec.ts`:
  - Render KPI > 0 (pakai seed data).
  - Donut & bar visible.
  - Top 5 list visible.

### 5. Update PROGRESS.md

- Sesi 8 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/commands/dashboard.rs`
  - `src/routes/_authed/dashboard.tsx` (replace placeholder dari Devin 2)
  - `src/components/shared/{KpiCard,ChartPie,ChartBar,ChartLine}.tsx`
  - i18n keys
- Tests: 1 unit + 1 e2e.
- Screenshot dashboard light + dark, dengan empty state + filled state.

## Definition of Done

- [ ] 3 KPI card responsif (3-col ≥1024px, 1-col mobile).
- [ ] Donut + bar render dengan data real.
- [ ] Top 5 list render dengan data real.
- [ ] Loading skeleton.
- [ ] Empty state CTA.
- [ ] Treeview legacy hilang.
- [ ] CI pass.
- [ ] PROGRESS.md updated.
