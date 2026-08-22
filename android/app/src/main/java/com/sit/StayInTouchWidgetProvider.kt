package com.sit

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.util.concurrent.Executors

class StayInTouchWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action ?: return
        val validActions = setOf(
            "com.sit.ACTION_WIDGET_NEXT",
            "com.sit.ACTION_WIDGET_UPDATE",
            AppWidgetManager.ACTION_APPWIDGET_UPDATE,
            AppWidgetManager.ACTION_APPWIDGET_ENABLED,
            AppWidgetManager.ACTION_APPWIDGET_DISABLED,
            AppWidgetManager.ACTION_APPWIDGET_DELETED,
            AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED
        )
        if (!validActions.contains(action)) {
            return
        }

        if (action == "com.sit.ACTION_WIDGET_NEXT") {
            val prefs = context.getSharedPreferences("widget_prefs", Context.MODE_PRIVATE)
            val current = prefs.getInt("current_index", 0)
            prefs.edit().putInt("current_index", current + 1).apply()
            updateAllWidgets(context)
        } else if (action == "com.sit.ACTION_WIDGET_UPDATE" || action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            updateAllWidgets(context)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        BackgroundSyncWorker.schedulePeriodicWork(context)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        BackgroundSyncWorker.schedulePeriodicWork(context)
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, StayInTouchWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            executor.execute {
                try {
                    val views = RemoteViews(context.packageName, R.layout.stay_in_touch_widget)

                    val isPortrait = context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT
                    val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
                    val widgetWidthDp = if (options != null) {
                        if (isPortrait) options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                        else options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 250)
                    } else 250
                    val widgetHeightDp = if (options != null) {
                        if (isPortrait) options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 180)
                        else options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 140)
                    } else 180

                    var presenceText = "No updates yet..."
                    var displayName = "Stay in Touch"
                    var updatedAt = "Updated"
                    var imagePath: String? = null
                    var profileImagePath: String? = null
                    var counterText = "0/0"

                    val activeHashes = HashSet<String>()
                    try {
                        val snapshotFile = File(context.filesDir, "widget_snapshot.json")
                        if (snapshotFile.exists()) {
                            val content = snapshotFile.readText(Charsets.UTF_8)
                            val json = JSONObject(content)
                            val membersArray = json.optJSONArray("members")
                            if (membersArray != null && membersArray.length() > 0) {
                                val count = membersArray.length()
                                val prefs = context.getSharedPreferences("widget_prefs", Context.MODE_PRIVATE)
                                val rawIndex = prefs.getInt("current_index", 0)
                                val activeIndex = (rawIndex % count + count) % count

                                for (i in 0 until count) {
                                    val m = membersArray.getJSONObject(i)
                                    val imgP = m.optString("imageLocalPath", null)
                                    val profP = m.optString("profileImageLocalPath", null)
                                    if (!imgP.isNullOrEmpty() && imgP.startsWith("http")) {
                                        activeHashes.add("widget_img_${Math.abs(imgP.hashCode())}.jpg")
                                    }
                                    if (!profP.isNullOrEmpty() && profP.startsWith("http")) {
                                        activeHashes.add("widget_img_${Math.abs(profP.hashCode())}.jpg")
                                    }
                                }

                                val targetMember = membersArray.getJSONObject(activeIndex)
                                displayName = targetMember.optString("displayName", "Stay in Touch")
                                presenceText = targetMember.optString("description", "No updates yet...")
                                updatedAt = targetMember.optString("updatedAt", "Updated")
                                imagePath = targetMember.optString("imageLocalPath", null)
                                profileImagePath = targetMember.optString("profileImageLocalPath", null)
                                counterText = "${activeIndex + 1}/$count"
                            }
                        }
                        cleanupObsoleteMedia(context, activeHashes)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }

                    views.setTextViewText(R.id.widget_title, displayName)
                    views.setTextViewText(R.id.widget_counter, counterText)
                    views.setTextViewText(R.id.widget_presence_text, presenceText)
                    views.setTextViewText(R.id.widget_updated_at, "$updatedAt • Tap to cycle")

                    // Render avatar in widget (rounded circular crop) with max dimension 150px
                    if (!profileImagePath.isNullOrEmpty() && profileImagePath != "null") {
                        val avatarBitmap = loadBitmap(context, profileImagePath, 150, 150)
                        if (avatarBitmap != null) {
                            val circularAvatar = getCircularBitmap(avatarBitmap)
                            views.setImageViewBitmap(R.id.widget_avatar, circularAvatar)
                            views.setViewVisibility(R.id.widget_avatar, View.VISIBLE)
                        } else {
                            views.setViewVisibility(R.id.widget_avatar, View.GONE)
                        }
                    } else {
                        views.setViewVisibility(R.id.widget_avatar, View.GONE)
                    }

                    // Render presence photo in widget or display clean placeholder if no image attached
                    if (!imagePath.isNullOrEmpty() && imagePath != "null") {
                        val bitmap = loadBitmap(context, imagePath, 800, 800)
                        if (bitmap != null) {
                            val adaptiveBitmap = renderAdaptivePresenceBitmap(context, bitmap, widgetWidthDp, widgetHeightDp)
                            if (adaptiveBitmap != null) {
                                views.setImageViewBitmap(R.id.widget_image, adaptiveBitmap)
                                views.setViewVisibility(R.id.widget_image, View.VISIBLE)
                                views.setViewVisibility(R.id.widget_placeholder, View.GONE)
                            } else {
                                views.setViewVisibility(R.id.widget_image, View.GONE)
                                views.setViewVisibility(R.id.widget_placeholder, View.VISIBLE)
                            }
                        } else {
                            views.setViewVisibility(R.id.widget_image, View.GONE)
                            views.setViewVisibility(R.id.widget_placeholder, View.VISIBLE)
                        }
                    } else {
                        views.setViewVisibility(R.id.widget_image, View.GONE)
                        views.setViewVisibility(R.id.widget_placeholder, View.VISIBLE)
                    }

                    // Tap anywhere on widget to cycle to next friend's presence update
                    val nextIntent = Intent(context, StayInTouchWidgetProvider::class.java).apply {
                        action = "com.sit.ACTION_WIDGET_NEXT"
                    }
                    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = PendingIntent.getBroadcast(context, 0, nextIntent, flags)
                    views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

                    appWidgetManager.updateAppWidget(appWidgetId, views)
                } catch (t: Throwable) {
                    Log.e("StayInTouchWidget", "Failed to update widget $appWidgetId", t)
                }
            }
        }

        private fun renderAdaptivePresenceBitmap(
            context: Context,
            rawBitmap: Bitmap,
            widgetWidthDp: Int,
            widgetHeightDp: Int
        ): Bitmap? {
            try {
                val displayMetrics = context.resources.displayMetrics
                val density = displayMetrics.density

                // True Polaroid layout non-image height breakdown:
                // 24dp (top+bottom padding 12dp) + 10dp (chin padding) + 22dp (header) + 16dp (caption) + 12dp (timestamp) + 6dp (margins) = 90dp
                val actualNonImageHeightDp = 90
                val availableImageHeightDp = widgetHeightDp - actualNonImageHeightDp

                if (availableImageHeightDp <= 4) {
                    // Insufficient vertical space for image; omit image to guarantee timestamp visibility
                    return null
                }

                val availableWidthDp = (widgetWidthDp - 20).coerceAtLeast(80)

                val bitmapW = rawBitmap.width
                val bitmapH = rawBitmap.height
                if (bitmapW <= 0 || bitmapH <= 0) return null

                val aspectRatio = bitmapW.toFloat() / bitmapH.toFloat()
                val naturalHeightDp = (availableWidthDp / aspectRatio).toInt()

                val targetHeightDp: Int
                val targetWidthDp: Int

                if (naturalHeightDp <= availableImageHeightDp) {
                    targetWidthDp = availableWidthDp
                    targetHeightDp = naturalHeightDp
                } else {
                    targetHeightDp = availableImageHeightDp
                    targetWidthDp = (availableImageHeightDp * aspectRatio).toInt().coerceAtMost(availableWidthDp)
                }

                if (targetHeightDp <= 4 || targetWidthDp <= 4) return null

                val widthPx = (targetWidthDp * density).toInt()
                val heightPx = (targetHeightDp * density).toInt()

                val output = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(output)
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.FILTER_BITMAP_FLAG)

                val srcRect = android.graphics.RectF(0f, 0f, bitmapW.toFloat(), bitmapH.toFloat())
                val dstRect = android.graphics.RectF(0f, 0f, widthPx.toFloat(), heightPx.toFloat())

                val matrix = android.graphics.Matrix()
                matrix.setRectToRect(srcRect, dstRect, android.graphics.Matrix.ScaleToFit.CENTER)

                canvas.drawBitmap(rawBitmap, matrix, paint)
                return output
            } catch (e: Exception) {
                e.printStackTrace()
                return rawBitmap
            }
        }

        private fun getCircularBitmap(bitmap: Bitmap): Bitmap {
            try {
                val size = Math.min(bitmap.width, bitmap.height)
                val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(output)
                val paint = android.graphics.Paint().apply {
                    isAntiAlias = true
                    shader = android.graphics.BitmapShader(
                        bitmap,
                        android.graphics.Shader.TileMode.CLAMP,
                        android.graphics.Shader.TileMode.CLAMP
                    )
                }
                val radius = size / 2f
                canvas.drawCircle(radius, radius, radius, paint)
                return output
            } catch (e: Exception) {
                e.printStackTrace()
                return bitmap
            }
        }

        private fun loadBitmap(context: Context, path: String, reqWidth: Int = 600, reqHeight: Int = 600): Bitmap? {
            try {
                if (path.startsWith("http://") || path.startsWith("https://")) {
                    val hash = Math.abs(path.hashCode()).toString()
                    val mediaDir = File(context.filesDir, "widget_media")
                    if (!mediaDir.exists()) mediaDir.mkdirs()
                    val cacheFile = File(mediaDir, "widget_img_$hash.jpg")
                    if (!cacheFile.exists() || cacheFile.length() == 0L) {
                        val url = URL(path)
                        val conn = url.openConnection()
                        conn.connectTimeout = 5000
                        conn.readTimeout = 5000
                        val input = conn.getInputStream()
                        val output = FileOutputStream(cacheFile)
                        input.copyTo(output)
                        input.close()
                        output.close()
                    }
                    return decodeSampledBitmapFromFile(cacheFile.absolutePath, reqWidth, reqHeight)
                } else {
                    val cleanPath = path.replace("file://", "")
                    val imgFile = File(cleanPath)
                    if (imgFile.exists()) {
                        return decodeSampledBitmapFromFile(imgFile.absolutePath, reqWidth, reqHeight)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return null
        }

        private fun decodeSampledBitmapFromFile(filePath: String, reqWidth: Int, reqHeight: Int): Bitmap? {
            try {
                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeFile(filePath, options)
                if (options.outWidth <= 0 || options.outHeight <= 0) return null

                val sampleSize = calculateInSampleSize(options, reqWidth, reqHeight)
                val decodeOptions = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                }
                val decoded = BitmapFactory.decodeFile(filePath, decodeOptions) ?: return null

                if (decoded.width > reqWidth || decoded.height > reqHeight) {
                    val scale = Math.min(
                        reqWidth.toFloat() / decoded.width,
                        reqHeight.toFloat() / decoded.height
                    )
                    val targetW = Math.max(1, (decoded.width * scale).toInt())
                    val targetH = Math.max(1, (decoded.height * scale).toInt())
                    val scaled = Bitmap.createScaledBitmap(decoded, targetW, targetH, true)
                    if (scaled != decoded) {
                        decoded.recycle()
                    }
                    return scaled
                }
                return decoded
            } catch (e: Exception) {
                e.printStackTrace()
                return null
            }
        }

        private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
            val height = options.outHeight
            val width = options.outWidth
            var inSampleSize = 1

            if (height > reqHeight || width > reqWidth) {
                val halfHeight = height / 2
                val halfWidth = width / 2

                while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                    inSampleSize *= 2
                }
            }
            return inSampleSize
        }

        private fun cleanupObsoleteMedia(context: Context, activeHashes: Set<String>) {
            try {
                val mediaDir = File(context.filesDir, "widget_media")
                if (mediaDir.exists() && mediaDir.isDirectory) {
                    val files = mediaDir.listFiles()
                    if (files != null) {
                        for (file in files) {
                            if (file.isFile && file.name.endsWith(".jpg") && !activeHashes.contains(file.name)) {
                                file.delete()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
