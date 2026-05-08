package com.perpustakaan.nusantara.notification

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.perpustakaan.nusantara.MainActivity
import com.perpustakaan.nusantara.PerpustakaanApp
import com.perpustakaan.nusantara.R
import com.perpustakaan.nusantara.data.local.ConfigStore
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker that runs daily to check for loans approaching due date.
 * Sends local notifications for H-1 and H-2 reminders.
 */
@HiltWorker
class DueReminderWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val repository: LibraryRepository,
    private val configStore: ConfigStore
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // Sync latest data first
        repository.syncAll()

        // Get current member
        val kodeAnggota = configStore.currentMemberKode
            .let { flow ->
                var value: String? = null
                flow.collect { value = it; return@collect }
                value
            }

        if (kodeAnggota == null) return Result.success()

        // Check active loans
        val activeLoans = repository.getPeminjamanAktif(kodeAnggota)

        activeLoans.forEach { loan ->
            when (loan.sisaHari) {
                2L -> sendNotification(
                    id = loan.nomorPinjam.hashCode(),
                    title = "Pengingat: 2 hari lagi jatuh tempo",
                    body = "Peminjaman ${loan.nomorPinjam} jatuh tempo ${loan.tanggalJatuhTempo}. " +
                        "Segera kembalikan buku ke perpustakaan."
                )
                1L -> sendNotification(
                    id = loan.nomorPinjam.hashCode() + 1,
                    title = "Pengingat: Besok jatuh tempo!",
                    body = "Peminjaman ${loan.nomorPinjam} jatuh tempo BESOK (${loan.tanggalJatuhTempo}). " +
                        "Kembalikan buku hari ini untuk menghindari denda."
                )
                0L -> sendNotification(
                    id = loan.nomorPinjam.hashCode() + 2,
                    title = "Jatuh tempo HARI INI!",
                    body = "Peminjaman ${loan.nomorPinjam} jatuh tempo hari ini. " +
                        "Segera kembalikan buku untuk menghindari denda."
                )
                in Long.MIN_VALUE..-1L -> sendNotification(
                    id = loan.nomorPinjam.hashCode() + 3,
                    title = "Buku terlambat ${-loan.sisaHari} hari",
                    body = "Peminjaman ${loan.nomorPinjam} sudah melewati jatuh tempo. " +
                        "Denda berjalan. Segera kembalikan."
                )
            }
        }

        return Result.success()
    }

    private fun sendNotification(id: Int, title: String, body: String) {
        if (ContextCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) return

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
            applicationContext,
            PerpustakaanApp.CHANNEL_DUE_REMINDER
        )
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(applicationContext).notify(id, notification)
    }

    companion object {
        private const val WORK_NAME = "due_reminder_check"

        /**
         * Schedule daily reminder check. Call this after setup is complete.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<DueReminderWorker>(
                repeatInterval = 12,
                repeatIntervalTimeUnit = TimeUnit.HOURS
            )
                .setConstraints(constraints)
                .setInitialDelay(1, TimeUnit.HOURS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
