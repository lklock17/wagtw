package com.wagtw.agent.util

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

data class UpdateInfo(
    val hasUpdate: Boolean,
    val latestVersionName: String,
    val latestVersionCode: Int,
    val downloadUrl: String,
    val releaseNotes: String
)

object AppUpdateManager {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    var pendingInstallApk: File? = null

    fun getCurrentVersionCode(context: Context): Int {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0).versionCode
            }
        } catch (e: Exception) {
            1
        }
    }

    fun getCurrentVersionName(context: Context): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    fun checkUpdate(context: Context, callback: (UpdateInfo?, String?) -> Unit) {
        val prefs = PrefsManager(context)
        val currentCode = getCurrentVersionCode(context)
        val serverUrl = prefs.serverUrl.trimEnd('/')

        Thread {
            try {
                // 1. Try checking via WAGTW API endpoint
                val apiReq = Request.Builder()
                    .url("$serverUrl/api/agent/update-check")
                    .get()
                    .build()

                try {
                    client.newCall(apiReq).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val body = resp.body?.string()
                            if (body != null) {
                                val json = JSONObject(body)
                                val latestCode = json.optInt("latestVersionCode", currentCode)
                                val latestName = json.optString("latestVersionName", "1.0.0")
                                val downloadUrl = json.optString(
                                    "downloadUrl",
                                    "https://github.com/lklock17/wagtw/releases/download/android-agent-latest/app-debug.apk"
                                )
                                val notes = json.optString("releaseNotes", "Pembaruan sistem & perbaikan performa.")

                                val info = UpdateInfo(
                                    hasUpdate = latestCode > currentCode,
                                    latestVersionName = latestName,
                                    latestVersionCode = latestCode,
                                    downloadUrl = downloadUrl,
                                    releaseNotes = notes
                                )
                                callback(info, null)
                                return@Thread
                            }
                        }
                    }
                } catch (e: Exception) {
                    // Fallback to GitHub API if server is not answering update-check
                }

                // 2. Fallback to GitHub Releases API
                val ghReq = Request.Builder()
                    .url("https://api.github.com/repos/lklock17/wagtw/releases/tags/android-agent-latest")
                    .header("Accept", "application/vnd.github.v3+json")
                    .get()
                    .build()

                client.newCall(ghReq).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val body = resp.body?.string()
                        if (body != null) {
                            val json = JSONObject(body)
                            val tagName = json.optString("tag_name", "")
                            val releaseBody = json.optString("body", "Pembaruan sistem & fitur terbaru.")
                            var downloadUrl = "https://github.com/lklock17/wagtw/releases/download/android-agent-latest/app-debug.apk"

                            val assets = json.optJSONArray("assets")
                            if (assets != null && assets.length() > 0) {
                                for (i in 0 until assets.length()) {
                                    val asset = assets.getJSONObject(i)
                                    if (asset.optString("name", "").endsWith(".apk")) {
                                        downloadUrl = asset.optString("browser_download_url", downloadUrl)
                                        break
                                    }
                                }
                            }

                            // If we don't have code from server, check if published release has changes
                            val info = UpdateInfo(
                                hasUpdate = true, // Prompt if called from fallback
                                latestVersionName = tagName.ifEmpty { "Terbaru" },
                                latestVersionCode = currentCode + 1,
                                downloadUrl = downloadUrl,
                                releaseNotes = releaseBody
                            )
                            callback(info, null)
                            return@Thread
                        }
                    }
                }

                callback(null, "Tidak dapat mengecek pembaruan.")
            } catch (e: Exception) {
                callback(null, e.localizedMessage ?: "Terjadi kesalahan saat cek update.")
            }
        }.start()
    }

    fun downloadApk(
        context: Context,
        downloadUrl: String,
        onProgress: (Int) -> Unit,
        onComplete: (File) -> Unit,
        onError: (String) -> Unit
    ) {
        Thread {
            try {
                val req = Request.Builder()
                    .url(downloadUrl)
                    .get()
                    .build()

                val resp = client.newCall(req).execute()
                if (!resp.isSuccessful) {
                    onError("Gagal mengunduh APK (HTTP ${resp.code})")
                    return@Thread
                }

                val body = resp.body ?: run {
                    onError("Respons unduhan kosong")
                    return@Thread
                }

                val updateDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: File(context.cacheDir, "updates").apply { if (!exists()) mkdirs() }
                if (!updateDir.exists()) updateDir.mkdirs()

                val apkFile = File(updateDir, "wagtw-agent-update.apk")
                if (apkFile.exists()) apkFile.delete()

                val totalLength = body.contentLength()
                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(apkFile)

                val buffer = ByteArray(8 * 1024)
                var bytesRead: Int
                var totalBytesRead: Long = 0
                var lastProgress = 0

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalBytesRead += bytesRead
                    if (totalLength > 0) {
                        val progress = ((totalBytesRead * 100) / totalLength).toInt()
                        if (progress != lastProgress) {
                            lastProgress = progress
                            onProgress(progress)
                        }
                    }
                }

                outputStream.flush()
                outputStream.close()
                inputStream.close()

                apkFile.setReadable(true, false)
                pendingInstallApk = apkFile
                onComplete(apkFile)
            } catch (e: Exception) {
                onError("Gagal mengunduh file update: ${e.localizedMessage}")
            }
        }.start()
    }

    fun installApk(activity: Activity, apkFile: File) {
        try {
            if (!apkFile.exists() || apkFile.length() == 0L) {
                android.widget.Toast.makeText(activity, "File APK tidak ditemukan atau rusak. Silakan unduh ulang.", android.widget.Toast.LENGTH_LONG).show()
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!activity.packageManager.canRequestPackageInstalls()) {
                    pendingInstallApk = apkFile
                    android.widget.Toast.makeText(activity, "Mohon aktifkan 'Izinkan dari sumber ini' untuk memasang pembaruan.", android.widget.Toast.LENGTH_LONG).show()
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${activity.packageName}")
                    }
                    activity.startActivity(intent)
                    return
                }
            }

            apkFile.setReadable(true, false)

            val apkUri: Uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }

            val resolveInfoList = activity.packageManager.queryIntentActivities(installIntent, PackageManager.MATCH_DEFAULT_ONLY)
            for (resolveInfo in resolveInfoList) {
                val pkgName = resolveInfo.activityInfo.packageName
                activity.grantUriPermission(pkgName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(installIntent)
        } catch (e: Exception) {
            e.printStackTrace()
            android.widget.Toast.makeText(activity, "Gagal membuka installer: ${e.localizedMessage}", android.widget.Toast.LENGTH_LONG).show()
        }
    }
}
