package com.sit

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class BackgroundSyncHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        val source = extras.getString("source") ?: "workmanager"
        val reason = extras.getString("reason") ?: "periodic_sync"

        val data = Arguments.createMap().apply {
            putString("source", source)
            putString("reason", reason)
        }

        return HeadlessJsTaskConfig(
            "BackgroundSyncTask",
            data,
            15000, // 15 second timeout
            true   // allowInForeground: allows execution when app is in foreground or background
        )
    }
}
