package com.wagtw.agent.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.wagtw.agent.util.PrefsManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WhatsAppNotificationListener : NotificationListenerService() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkg = sbn.packageName
        if (pkg != "com.whatsapp" && pkg != "com.whatsapp.w4b") return

        val extras = sbn.notification.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

        // Ignore empty, system status, or summary notifications
        if (title.isBlank() || text.isBlank()) return
        if (text.contains("messages", ignoreCase = true) && text.contains("new", ignoreCase = true)) return

        val prefs = PrefsManager(applicationContext)
        val serverUrl = prefs.serverUrl.trimEnd('/')
        val isBusiness = pkg == "com.whatsapp.w4b"
        val targetDeviceId = if (isBusiness) {
            prefs.businessDeviceId.ifEmpty { prefs.deviceId }
        } else {
            prefs.personalDeviceId.ifEmpty { prefs.deviceId }
        }

        val appTag = if (isBusiness) "[WA Business]" else "[WA Personal]"
        Log.d("WAGTW_NOTIF", "$appTag incoming message from: $title | text: $text")

        // Broadcast to local activity log
        AgentForegroundService.appendLog("📥 $appTag dari $title: $text")

        // Send to WAGTW Server
        Thread {
            try {
                val json = JSONObject().apply {
                    put("deviceId", targetDeviceId)
                    put("sender", title)
                    put("text", text)
                    put("timestamp", System.currentTimeMillis())
                    put("packageName", pkg)
                }

                val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
                val req = Request.Builder()
                    .url("$serverUrl/api/agent/incoming")
                    .post(body)
                    .build()

                httpClient.newCall(req).execute().use { response ->
                    Log.d("WAGTW_NOTIF", "Sent to server, response code: ${response.code}")
                }
            } catch (e: Exception) {
                Log.e("WAGTW_NOTIF", "Error forwarding incoming message to server: ${e.message}")
            }
        }.start()
    }
}
