package com.sit

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.facebook.react.HeadlessJsTaskService
import androidx.core.content.ContextCompat
import java.util.concurrent.TimeUnit

class BackgroundSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "BackgroundSyncWorker started execution. InputData: ${inputData.keyValueMap}")

        return try {
            val reason = inputData.getString("reason") ?: if (tags.contains(UNIQUE_PERIODIC_WORK_NAME)) "periodic_sync" else "on_demand"
            val source = inputData.getString("source") ?: "workmanager"

            val serviceIntent = Intent(applicationContext, BackgroundSyncHeadlessService::class.java).apply {
                putExtra("source", source)
                putExtra("reason", reason)
            }

            // Acquire wake lock to keep CPU active during JS runtime initialization
            HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
            applicationContext.startService(serviceIntent)

            Log.d(TAG, "BackgroundSyncHeadlessService started successfully with source: $source, reason: $reason")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "BackgroundSyncWorker failed to launch HeadlessJsTaskService: ${e.message}", e)
            Result.retry()
        }
    }

    companion object {
        const val TAG = "BackgroundSyncWorker"
        const val UNIQUE_ONE_TIME_WORK_NAME = "sit_one_time_background_sync"
        const val UNIQUE_PERIODIC_WORK_NAME = "sit_periodic_background_sync"

        /**
         * Enqueue a unique one-time background sync job (e.g. triggered on-demand or by FCM).
         * Uses ExistingWorkPolicy.KEEP to prevent duplicate simultaneous background executions.
         */
        fun enqueueOneTimeWork(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val inputData = workDataOf(
                "source" to "workmanager",
                "reason" to "on_demand"
            )

            val workRequest = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
                .setConstraints(constraints)
                .setInputData(inputData)
                .addTag(TAG)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_ONE_TIME_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                workRequest
            )
            Log.d(TAG, "One-time background sync work enqueued with CONNECTED network constraint.")
        }

        /**
         * Schedule periodic background sync work as a fallback mechanism.
         * Enqueued with ExistingPeriodicWorkPolicy.KEEP so it's registered only once.
         */
        fun schedulePeriodicWork(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val inputData = workDataOf(
                "source" to "workmanager",
                "reason" to "periodic_sync"
            )

            val periodicWorkRequest = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
                15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setInputData(inputData)
                .addTag(TAG)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )
            Log.d(TAG, "Periodic background sync work scheduled (15 min fallback).")
        }
    }
}
