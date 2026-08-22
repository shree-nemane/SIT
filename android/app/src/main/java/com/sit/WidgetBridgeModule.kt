package com.sit

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File
import java.io.FileOutputStream
import java.net.URL

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    /**
     * Atomically write widget snapshot JSON to internal storage and notify widget provider
     */
    @ReactMethod
    fun updateWidgetSnapshot(jsonString: String, promise: Promise) {
        try {
            val filesDir = reactContext.filesDir
            val tmpFile = File(filesDir, "widget_snapshot.json.tmp")
            val targetFile = File(filesDir, "widget_snapshot.json")

            // Atomic write: write to .tmp first, flush completely, then replace target file
            tmpFile.writeText(jsonString, Charsets.UTF_8)

            var success = false
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                try {
                    java.nio.file.Files.move(
                        tmpFile.toPath(),
                        targetFile.toPath(),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                        java.nio.file.StandardCopyOption.ATOMIC_MOVE
                    )
                    success = true
                } catch (e: Exception) {
                    if (targetFile.exists()) targetFile.delete()
                    success = tmpFile.renameTo(targetFile)
                }
            } else {
                if (targetFile.exists()) targetFile.delete()
                success = tmpFile.renameTo(targetFile)
            }

            if (!success && !targetFile.exists()) {
                targetFile.writeText(jsonString, Charsets.UTF_8)
            }

            notifyWidgetUpdate()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message, e)
        }
    }

    /**
     * Send explicit broadcast intent to StayInTouchWidgetProvider
     */
    @ReactMethod
    fun notifyWidgetUpdate() {
        val intent = Intent(reactContext, StayInTouchWidgetProvider::class.java).apply {
            action = "com.sit.ACTION_WIDGET_UPDATE"
        }
        reactContext.sendBroadcast(intent)
    }

    /**
     * Download and cache media file from cloud storage to persistent internal storage.
     * Called exclusively by Sync Engine during cloud reconciliation.
     */
    @ReactMethod
    fun downloadAndCacheMedia(storagePath: String, signedUrl: String, promise: Promise) {
        Thread {
            try {
                val mediaDir = File(reactContext.filesDir, "media_cache")
                if (!mediaDir.exists()) mediaDir.mkdirs()

                val hash = Math.abs(storagePath.hashCode()).toString()
                val targetFile = File(mediaDir, "media_img_$hash.jpg")

                if (targetFile.exists() && targetFile.length() > 0) {
                    promise.resolve("file://${targetFile.absolutePath}")
                    return@Thread
                }

                val url = URL(signedUrl)
                val conn = url.openConnection()
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                val input = conn.getInputStream()

                val tmpFile = File(mediaDir, "media_img_$hash.jpg.tmp")
                val output = FileOutputStream(tmpFile)
                input.copyTo(output)
                output.flush()
                output.close()
                input.close()

                var success = false
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    try {
                        java.nio.file.Files.move(
                            tmpFile.toPath(),
                            targetFile.toPath(),
                            java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                            java.nio.file.StandardCopyOption.ATOMIC_MOVE
                        )
                        success = true
                    } catch (e: Exception) {
                        if (targetFile.exists()) targetFile.delete()
                        success = tmpFile.renameTo(targetFile)
                    }
                } else {
                    if (targetFile.exists()) targetFile.delete()
                    success = tmpFile.renameTo(targetFile)
                }

                if (success || targetFile.exists()) {
                    promise.resolve("file://${targetFile.absolutePath}")
                } else {
                    promise.resolve("file://${tmpFile.absolutePath}")
                }
            } catch (e: Exception) {
                promise.reject("MEDIA_DOWNLOAD_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Check if a local media file exists for storage path (100% network-free local check)
     */
    @ReactMethod
    fun getLocalMediaFile(storagePath: String, promise: Promise) {
        try {
            val mediaDir = File(reactContext.filesDir, "media_cache")
            val hash = Math.abs(storagePath.hashCode()).toString()
            val targetFile = File(mediaDir, "media_img_$hash.jpg")

            if (targetFile.exists() && targetFile.length() > 0) {
                promise.resolve("file://${targetFile.absolutePath}")
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    /**
     * Crop, scale, and compress local image file to persistent internal storage.
     * 100% offline local operation.
     */
    @ReactMethod
    fun cropAndResizeImage(
        sourceUri: String,
        cropX: Double,
        cropY: Double,
        cropWidth: Double,
        cropHeight: Double,
        targetWidth: Int,
        targetHeight: Int,
        promise: Promise
    ) {
        Thread {
            try {
                val cleanPath = sourceUri.replace("file://", "")
                val srcFile = File(cleanPath)
                if (!srcFile.exists()) {
                    promise.reject("CROP_ERROR", "Source file does not exist: $cleanPath")
                    return@Thread
                }

                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeFile(cleanPath, options)
                val origW = options.outWidth
                val origH = options.outHeight

                val decodeOptions = BitmapFactory.Options()
                val originalBitmap = BitmapFactory.decodeFile(cleanPath, decodeOptions)
                    ?: throw Exception("Failed to decode source image")

                val x = (cropX * origW).toInt().coerceIn(0, origW - 1)
                val y = (cropY * origH).toInt().coerceIn(0, origH - 1)
                var w = (cropWidth * origW).toInt().coerceIn(1, origW - x)
                var h = (cropHeight * origH).toInt().coerceIn(1, origH - y)

                val croppedBitmap = Bitmap.createBitmap(originalBitmap, x, y, w, h)

                val scaledBitmap = if (w == h && targetWidth == targetHeight) {
                    Bitmap.createScaledBitmap(croppedBitmap, targetWidth, targetHeight, true)
                } else {
                    val cropAspect = w.toFloat() / h.toFloat()
                    var dstW = targetWidth
                    var dstH = (targetWidth / cropAspect).toInt()
                    if (dstH > targetHeight) {
                        dstH = targetHeight
                        dstW = (targetHeight * cropAspect).toInt()
                    }
                    Bitmap.createScaledBitmap(croppedBitmap, dstW.coerceAtLeast(1), dstH.coerceAtLeast(1), true)
                }

                val mediaDir = File(reactContext.filesDir, "media_cache")
                if (!mediaDir.exists()) mediaDir.mkdirs()

                val hash = Math.abs("${sourceUri}_${cropX}_${cropY}_${cropWidth}_${cropHeight}".hashCode()).toString()
                val targetFile = File(mediaDir, "crop_img_$hash.jpg")

                val outputStream = FileOutputStream(targetFile)
                scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
                outputStream.flush()
                outputStream.close()

                if (croppedBitmap != originalBitmap) croppedBitmap.recycle()
                if (scaledBitmap != croppedBitmap) scaledBitmap.recycle()
                originalBitmap.recycle()

                promise.resolve("file://${targetFile.absolutePath}")
            } catch (e: Exception) {
                promise.reject("CROP_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Enqueue on-demand unique one-time background sync job via WorkManager
     */
    @ReactMethod
    fun triggerBackgroundSync(promise: Promise) {
        try {
            BackgroundSyncWorker.enqueueOneTimeWork(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WORKER_ERROR", e.message, e)
        }
    }
}
