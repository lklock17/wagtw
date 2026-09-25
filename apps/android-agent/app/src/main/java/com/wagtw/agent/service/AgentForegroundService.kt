package com.wagtw.agent.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.wagtw.agent.util.PrefsManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class AgentForegroundService : Service() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private var isLoopRunning = false
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var prefs: PrefsManager

    companion object {
        const val CHANNEL_ID = "wagtw_agent_channel"
        const val NOTIFICATION_ID = 1001

        var onLogReceived: ((String) -> Unit)? = null
        var onStatusChanged: ((Boolean) -> Unit)? = null
        private var instance: AgentForegroundService? = null

        fun appendLog(text: String) {
            Handler(Looper.getMainLooper()).post {
                onLogReceived?.invoke(text)
            }
        }

        fun notifyMessageSent(messageId: String) {
            instance?.reportMessageStatus(messageId, "SENT")
        }

        fun sendDirectTest(context: Context, to: String, text: String, forcedPkg: String? = null) {
            val prefs = PrefsManager(context)
            val targetPkg = forcedPkg ?: if (prefs.isBusinessEnabled) "com.whatsapp.w4b" else "com.whatsapp"
            val appLabel = if (targetPkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp Personal"

            try {
                WhatsAppAccessibilityService.startSendWatchdog("test_${System.currentTimeMillis()}")

                var cleaned = to.replace(Regex("[^0-9]"), "")
                if (cleaned.startsWith("0")) cleaned = "62" + cleaned.substring(1)

                val encoded = URLEncoder.encode(text, "UTF-8")
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleaned&text=$encoded")

                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    setPackage(targetPkg)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                context.startActivity(intent)
                appendLog("🚀 Menjalankan tes kirim via $appLabel ke $cleaned")
            } catch (e: Exception) {
                appendLog("❌ Gagal membuka $appLabel: ${e.message}")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = PrefsManager(applicationContext)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Menghubungkan ke Server WAGTW...")
        startForeground(NOTIFICATION_ID, notification)

        startAgentLoop()
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isLoopRunning = false
        sendDisconnect()
        appendLog("🛑 Layanan agen dimatikan")
        onStatusChanged?.invoke(false)
    }

    private fun sendDisconnect() {
        Thread {
            try {
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val ids = listOfNotNull(
                    prefs.businessDeviceId.ifEmpty { null },
                    prefs.personalDeviceId.ifEmpty { null },
                    prefs.deviceId.ifEmpty { null }
                ).distinct()

                if (ids.isNotEmpty()) {
                    val json = JSONObject().apply {
                        val arr = JSONArray()
                        ids.forEach { arr.put(it) }
                        put("deviceIds", arr)
                    }

                    val body = json.toString().toRequestBody("application/json".toMediaType())
                    val req = Request.Builder()
                        .url("$serverUrl/api/agent/disconnect")
                        .post(body)
                        .build()

                    httpClient.newCall(req).execute().close()
                }
            } catch (e: Exception) {
                Log.e("WAGTW_AGENT", "Disconnect error: ${e.message}")
            }
        }.start()
    }

    private fun startAgentLoop() {
        if (isLoopRunning) return
        isLoopRunning = true

        appendLog("🚀 Layanan latar belakang dimulai")
        onStatusChanged?.invoke(true)

        // Register device with server first
        Thread {
            registerDevice()
            pollLoop()
        }.start()
    }

    private fun registerDevice() {
        try {
            val serverUrl = prefs.serverUrl.trimEnd('/')
            val json = JSONObject().apply {
                put("name", prefs.deviceName)
                put("businessPhone", prefs.businessPhone)
                put("enableBusiness", prefs.isBusinessEnabled)
                put("personalPhone", prefs.personalPhone)
                put("enablePersonal", prefs.isPersonalEnabled)
                put("phone", prefs.businessPhone.ifEmpty { prefs.personalPhone })
                put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
            }

            val body = json.toString().toRequestBody("application/json".toMediaType())
            val req = Request.Builder()
                .url("$serverUrl/api/agent/register")
                .post(body)
                .build()

            httpClient.newCall(req).execute().use { res ->
                val str = res.body?.string() ?: ""
                val resObj = JSONObject(str)
                val bId = resObj.optString("businessDeviceId", "")
                val pId = resObj.optString("personalDeviceId", "")
                val mainId = resObj.optString("deviceId", "")

                if (bId.isNotEmpty()) prefs.businessDeviceId = bId
                if (pId.isNotEmpty()) prefs.personalDeviceId = pId
                if (mainId.isNotEmpty()) prefs.deviceId = mainId

                appendLog("✅ Terhubung ke Server WAGTW!")
                if (bId.isNotEmpty()) appendLog("💼 WA Business ID: $bId")
                if (pId.isNotEmpty()) appendLog("🟢 WA Personal ID: $pId")
            }
        } catch (e: Exception) {
            appendLog("⚠️ Gagal mendaftarkan perangkat: ${e.message}")
        }
    }

    private fun pollLoop() {
        while (isLoopRunning) {
            val serverUrl = prefs.serverUrl.trimEnd('/')
            val activeIds = listOfNotNull(
                if (prefs.isBusinessEnabled && prefs.businessDeviceId.isNotEmpty()) prefs.businessDeviceId else null,
                if (prefs.isPersonalEnabled && prefs.personalDeviceId.isNotEmpty()) prefs.personalDeviceId else null
            ).ifEmpty {
                if (prefs.deviceId.isNotEmpty()) listOf(prefs.deviceId) else emptyList()
            }

            if (activeIds.isNotEmpty()) {
                val queryParam = activeIds.joinToString(",")
                try {
                    val req = Request.Builder()
                        .url("$serverUrl/api/agent/pending-messages/$queryParam")
                        .get()
                        .build()

                    httpClient.newCall(req).execute().use { res ->
                        if (res.isSuccessful) {
                            val str = res.body?.string() ?: ""
                            val resObj = JSONObject(str)
                            val messages = resObj.optJSONArray("messages")

                            if (messages != null && messages.length() > 0) {
                                for (i in 0 until messages.length()) {
                                    val msg = messages.getJSONObject(i)
                                    val msgId = msg.getString("id")
                                    val to = msg.getString("to")
                                    val text = msg.getString("text")
                                    val msgDeviceId = msg.optString("deviceId", "")

                                    val targetPkg = if (msgDeviceId == prefs.personalDeviceId) {
                                        "com.whatsapp"
                                    } else {
                                        "com.whatsapp.w4b"
                                    }

                                    val label = if (targetPkg == "com.whatsapp.w4b") "Business" else "Personal"
                                    appendLog("📤 Mengirim ke $to ($label): $text")
                                    dispatchWhatsAppMessage(msgId, to, text, targetPkg)

                                    // Wait between messages (human delay 6-10s)
                                    Thread.sleep(7000)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("WAGTW_AGENT", "Poll error: ${e.message}")
                }
            }

            try {
                Thread.sleep(4000)
            } catch (e: InterruptedException) {
                break
            }
        }
    }

    private fun dispatchWhatsAppMessage(messageId: String, to: String, text: String, targetPkg: String) {
        try {
            WhatsAppAccessibilityService.startSendWatchdog(messageId)

            // Clean number to digits
            var cleaned = to.replace(Regex("[^0-9]"), "")
            if (cleaned.startsWith("0")) cleaned = "62" + cleaned.substring(1)

            val encoded = URLEncoder.encode(text, "UTF-8")
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleaned&text=$encoded")

            val appLabel = if (targetPkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp Personal"
            appendLog("📲 Membuka $appLabel untuk $cleaned...")

            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage(targetPkg)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }

            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            appendLog("❌ Gagal membuka WhatsApp: ${e.message}")
            reportMessageStatus(messageId, "FAILED", e.message)
        }
    }

    fun reportMessageStatus(messageId: String, status: String, error: String? = null) {
        Thread {
            try {
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val json = JSONObject().apply {
                    put("messageId", messageId)
                    put("status", status)
                    if (error != null) put("error", error)
                }

                val body = json.toString().toRequestBody("application/json".toMediaType())
                val req = Request.Builder()
                    .url("$serverUrl/api/agent/message-status")
                    .post(body)
                    .build()

                httpClient.newCall(req).execute().close()
            } catch (e: Exception) {
                Log.e("WAGTW_AGENT", "Report status error: ${e.message}")
            }
        }.start()
    }

    private fun createNotification(contentText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("WAGTW WhatsApp Agent")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "WAGTW Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isLoopRunning = false
        WhatsAppAccessibilityService.cancelWatchdog()
        onStatusChanged?.invoke(false)
        appendLog("🛑 Layanan dimatikan")
        instance = null
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
