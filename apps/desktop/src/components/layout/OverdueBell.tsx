import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { peminjamanApi, type OverdueRow } from '@/lib/peminjaman';

const POLL_MS = 60_000;
const PREVIEW_LIMIT = 8;

/**
 * Header bell that surfaces overdue peminjaman_item rows. Polls
 * `peminjaman_overdue_list` every minute and shows a red badge with the
 * count. Clicking opens a dropdown with the top {@link PREVIEW_LIMIT}
 * entries plus a link to the full list.
 */
export function OverdueBell() {
  const { t } = useTranslation(['common']);
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    const refresh = async () => {
      try {
        const list = await peminjamanApi.overdueList(PREVIEW_LIMIT);
        if (!cancel) setRows(list);
      } catch {
        // Silently swallow — bell is best-effort, dashboard panel surfaces errors.
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    void refresh();
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  const count = rows.length;
  const hasOverdue = count > 0;
  const label = t('common:notifications.title', { defaultValue: 'Notifikasi' });

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="overdue-bell"
              aria-label={label}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground relative hidden h-9 w-9 items-center justify-center rounded-md md:flex"
            >
              <Bell className="h-4 w-4" />
              {hasOverdue && (
                <span
                  data-testid="overdue-badge"
                  className="bg-rose-500 text-white absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-[1.1rem]"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-0" data-testid="overdue-menu">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">
            {t('common:notifications.overdueTitle', { defaultValue: 'Peminjaman Terlambat' })}
          </p>
          <p className="text-muted-foreground text-xs">
            {hasOverdue
              ? t('common:notifications.overdueSubtitle', {
                  count,
                  defaultValue: '{{count}} buku belum dikembalikan',
                })
              : t('common:notifications.overdueEmpty', {
                  defaultValue: 'Tidak ada keterlambatan',
                })}
          </p>
        </div>
        {loading ? (
          <p className="text-muted-foreground p-3 text-sm">
            {t('common:states.loading', { defaultValue: 'Memuat…' })}
          </p>
        ) : hasOverdue ? (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {rows.map((r) => (
              <li key={`${r.peminjamanId}-${r.itemId}`}>
                <Link
                  to="/peminjaman/$id"
                  params={{ id: String(r.peminjamanId) }}
                  className="hover:bg-accent block px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.bukuJudul}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.anggotaNama} · {r.anggotaKode}
                        {r.anggotaKelas ? ` · ${r.anggotaKelas}` : ''}
                      </p>
                    </div>
                    <span className="text-rose-600 dark:text-rose-400 shrink-0 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {t('common:notifications.daysLate', {
                        days: r.hariTerlambat,
                        defaultValue: '{{days}} hari',
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-3 text-sm italic text-muted-foreground">
            {t('common:notifications.overdueEmptyHint', {
              defaultValue: 'Semua peminjaman tepat waktu.',
            })}
          </p>
        )}
        {hasOverdue && (
          <div className="border-t px-3 py-2 text-center">
            <Link
              to="/peminjaman"
              className="text-primary text-xs font-medium hover:underline"
              data-testid="overdue-see-all"
            >
              {t('common:notifications.viewAll', { defaultValue: 'Lihat semua di Peminjaman' })}
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
