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
        const val CHANNEL_ALERT_ID = "wagtw_agent_alert_channel"
        const val NOTIFICATION_ID = 1001
        const val ALERT_NOTIFICATION_ID = 2002

        var onLogReceived: ((String) -> Unit)? = null
        var onStatusChanged: ((Boolean) -> Unit)? = null
        var instance: AgentForegroundService? = null

        fun appendLog(text: String) {
            Handler(Looper.getMainLooper()).post {
                onLogReceived?.invoke(text)
            }
        }

        fun showNotificationAlert(context: Context, title: String, message: String, isError: Boolean = true) {
            try {
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                val notif = NotificationCompat.Builder(context, CHANNEL_ALERT_ID)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setSmallIcon(if (isError) android.R.drawable.stat_notify_error else android.R.drawable.stat_notify_chat)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                    .build()
                manager.notify(ALERT_NOTIFICATION_ID, notif)
            } catch (e: Exception) {
                Log.e("WAGTW_AGENT", "Failed to show notification alert: ${e.message}")
            }
        }

        fun updateServiceStatus(contentText: String) {
            instance?.let { s ->
                try {
                    val notif = s.createNotification(contentText)
                    val manager = s.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.notify(NOTIFICATION_ID, notif)
                } catch (e: Exception) {}
            }
        }

        fun notifyMessageSent(messageId: String) {
            instance?.reportMessageStatus(messageId, "SENT")
            instance?.let {
                showNotificationAlert(it.applicationContext, "✅ Pesan WhatsApp Terkirim", "Pesan berhasil dikirim otomatis via WhatsApp.", isError = false)
                updateServiceStatus("✅ Pesan terakhir berhasil dikirim")
            }
        }

        fun notifyMessageFailed(messageId: String, error: String, deviceStatus: String? = null) {
            instance?.reportMessageStatus(messageId, "FAILED", error, deviceStatus)
            instance?.let {
                val title = if (deviceStatus == "SUSPENDED") "⚠️ WhatsApp Belum Login / Terputus!" else "❌ Gagal Mengirim Pesan WhatsApp"
                showNotificationAlert(it.applicationContext, title, error, isError = true)
                updateServiceStatus("❌ Gagal: $error")
            }
        }

        fun isPackageInstalled(context: Context, pkg: String): Boolean {
            return try {
                context.packageManager.getPackageInfo(pkg, 0)
                true
            } catch (e: Exception) {
                false
            }
        }

        fun resolveSafeTargetPackage(context: Context, requestedPkg: String?): String {
            val isBusinessInstalled = isPackageInstalled(context, "com.whatsapp.w4b")
            val isPersonalInstalled = isPackageInstalled(context, "com.whatsapp")

            if (requestedPkg == "com.whatsapp.w4b") {
                if (isBusinessInstalled) return "com.whatsapp.w4b"
                if (isPersonalInstalled) {
                    appendLog("⚠️ WhatsApp Business tidak terpasang di HP ini, dialihkan otomatis ke WhatsApp Personal")
                    return "com.whatsapp"
                }
            } else if (requestedPkg == "com.whatsapp") {
                if (isPersonalInstalled) return "com.whatsapp"
                if (isBusinessInstalled) {
                    appendLog("⚠️ WhatsApp Personal tidak terpasang di HP ini, dialihkan otomatis ke WhatsApp Business")
                    return "com.whatsapp.w4b"
                }
            }

            return if (isPersonalInstalled) "com.whatsapp" else if (isBusinessInstalled) "com.whatsapp.w4b" else (requestedPkg ?: "com.whatsapp")
        }

        fun sendDirectTest(context: Context, to: String, text: String, forcedPkg: String? = null, dualAppTarget: String? = null) {
            val prefs = PrefsManager(context)
            val defaultPkg = if (prefs.isPersonalEnabled && !prefs.isBusinessEnabled) "com.whatsapp" else if (prefs.isBusinessEnabled) "com.whatsapp.w4b" else "com.whatsapp"
            val targetPkg = resolveSafeTargetPackage(context, forcedPkg ?: defaultPkg)
            val appLabel = if (targetPkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp Personal"

            try {
                WhatsAppAccessibilityService.startSendWatchdog("test_${System.currentTimeMillis()}", dualAppTarget)

                var cleaned = to.replace(Regex("[^0-9]"), "")
                if (cleaned.startsWith("0")) cleaned = "62" + cleaned.substring(1)

                val encoded = URLEncoder.encode(text, "UTF-8")
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleaned&text=$encoded")

                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    if (isPackageInstalled(context, targetPkg)) {
                        setPackage(targetPkg)
                    }
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
        WhatsAppAccessibilityService.cancelWatchdog()
        sendDisconnect()
        appendLog("🛑 Layanan agen dimatikan")
        onStatusChanged?.invoke(false)
        instance = null
    }

    private fun sendDisconnect() {
        Thread {
            try {
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val ids = listOfNotNull(
                    prefs.businessDeviceId.ifEmpty { null },
                    prefs.businessDeviceId2.ifEmpty { null },
                    prefs.personalDeviceId.ifEmpty { null },
                    prefs.personalDeviceId2.ifEmpty { null },
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
            val isBusinessInstalled = isPackageInstalled(applicationContext, "com.whatsapp.w4b")
            val isPersonalInstalled = isPackageInstalled(applicationContext, "com.whatsapp")

            // Auto-detect installed packages
            val enableBusiness = prefs.isBusinessEnabled && isBusinessInstalled
            val enableBusiness2 = prefs.isBusiness2Enabled && isBusinessInstalled
            val enablePersonal = if (!isBusinessInstalled && isPersonalInstalled) true else prefs.isPersonalEnabled
            val enablePersonal2 = prefs.isPersonal2Enabled

            val json = JSONObject().apply {
                put("phoneId", prefs.phoneId)
                put("name", prefs.deviceName)
                put("businessPhone", prefs.businessPhone)
                put("enableBusiness", enableBusiness)
                put("businessPhone2", prefs.businessPhone2)
                put("enableBusiness2", enableBusiness2)
                put("personalPhone", prefs.personalPhone)
                put("enablePersonal", enablePersonal)
                put("personalPhone2", prefs.personalPhone2)
                put("enablePersonal2", enablePersonal2)
                put("phone", if (enablePersonal && prefs.personalPhone.isNotEmpty()) prefs.personalPhone else prefs.businessPhone.ifEmpty { prefs.personalPhone })
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
                val b2Id = resObj.optString("businessDeviceId2", "")
                val pId = resObj.optString("personalDeviceId", "")
                val p2Id = resObj.optString("personalDeviceId2", "")
                val mainId = resObj.optString("deviceId", "")

                if (bId.isNotEmpty()) prefs.businessDeviceId = bId
                if (b2Id.isNotEmpty()) prefs.businessDeviceId2 = b2Id
                if (pId.isNotEmpty()) prefs.personalDeviceId = pId
                if (p2Id.isNotEmpty()) prefs.personalDeviceId2 = p2Id
                if (mainId.isNotEmpty()) prefs.deviceId = mainId

                appendLog("✅ Terhubung ke Server WAGTW (Grup: ${prefs.deviceName})!")
                if (bId.isNotEmpty()) appendLog("💼 WA Bisnis (Slot 1): $bId")
                if (b2Id.isNotEmpty()) appendLog("💼 WA Bisnis (Slot 2 Dual): $b2Id")
                if (pId.isNotEmpty()) appendLog("🟢 WA Personal (Slot 1): $pId")
                if (p2Id.isNotEmpty()) appendLog("🟢 WA Personal (Slot 2 Dual): $p2Id")
            }
        } catch (e: Exception) {
            appendLog("⚠️ Gagal mendaftarkan perangkat: ${e.message}")
        }
    }

    private fun pollLoop() {
        while (isLoopRunning) {
            val serverUrl = prefs.serverUrl.trimEnd('/')
            val activeIds = mutableListOf<String>()
            if (prefs.isBusinessEnabled && prefs.businessDeviceId.isNotEmpty()) activeIds.add(prefs.businessDeviceId)
            if (prefs.isBusiness2Enabled && prefs.businessDeviceId2.isNotEmpty()) activeIds.add(prefs.businessDeviceId2)
            if (prefs.isPersonalEnabled && prefs.personalDeviceId.isNotEmpty()) activeIds.add(prefs.personalDeviceId)
            if (prefs.isPersonal2Enabled && prefs.personalDeviceId2.isNotEmpty()) activeIds.add(prefs.personalDeviceId2)
            if (activeIds.isEmpty() && prefs.deviceId.isNotEmpty()) activeIds.add(prefs.deviceId)

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
                                    val type = msg.optString("type", "MESSAGE")
                                    val msgDeviceId = msg.optString("deviceId", "")
                                    
                                    val serverTargetPkg = msg.optString("targetPackage", "")
                                    val computedPkg = when (msgDeviceId) {
                                        prefs.businessDeviceId2, prefs.businessDeviceId -> "com.whatsapp.w4b"
                                        prefs.personalDeviceId2, prefs.personalDeviceId -> "com.whatsapp"
                                        else -> if (prefs.isPersonalEnabled && !prefs.isBusinessEnabled) "com.whatsapp" else if (prefs.isBusinessEnabled) "com.whatsapp.w4b" else "com.whatsapp"
                                    }
                                    val rawPkg = if (serverTargetPkg.isNotEmpty()) serverTargetPkg else computedPkg
                                    val targetPkg = resolveSafeTargetPackage(applicationContext, rawPkg)
                                    val label = if (targetPkg == "com.whatsapp.w4b") "Business" else "Personal"

                                    val autoDualAppTarget = when (msgDeviceId) {
                                        prefs.businessDeviceId2, prefs.personalDeviceId2 -> "ACCOUNT_2"
                                        else -> "ACCOUNT_1"
                                    }
                                    val dualAppTarget = if (msg.has("dualAppTarget")) msg.getString("dualAppTarget") else autoDualAppTarget

                                    if (type == "JOIN_GROUP") {
                                        val inviteUrl = msg.getString("inviteUrl")
                                        appendLog("👥 Membuka tautan grup ($label): $inviteUrl")
                                        dispatchJoinGroup(msgId, inviteUrl, targetPkg, dualAppTarget)
                                        Thread.sleep(12000)
                                    } else {
                                        val to = msg.getString("to")
                                        val text = msg.getString("text")
                                        appendLog("📤 Mengirim ke $to ($label): $text")
                                        dispatchWhatsAppMessage(msgId, to, text, targetPkg, dualAppTarget)
                                        // Wait between messages (human delay 6-10s)
                                        Thread.sleep(7000)
                                    }
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

    private fun dispatchWhatsAppMessage(messageId: String, to: String, text: String, targetPkg: String, dualAppTarget: String? = null) {
        try {
            WhatsAppAccessibilityService.startSendWatchdog(messageId, dualAppTarget)

            // Clean number to digits
            var cleaned = to.replace(Regex("[^0-9]"), "")
            if (cleaned.startsWith("0")) cleaned = "62" + cleaned.substring(1)

            val encoded = URLEncoder.encode(text, "UTF-8")
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleaned&text=$encoded")

            val appLabel = if (targetPkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp Personal"
            appendLog("📲 Membuka $appLabel untuk $cleaned...")

            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                if (isPackageInstalled(applicationContext, targetPkg)) {
                    setPackage(targetPkg)
                }
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }

            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            appendLog("❌ Gagal membuka WhatsApp: ${e.message}")
            reportMessageStatus(messageId, "FAILED", e.message)
        }
    }

    private fun dispatchJoinGroup(taskId: String, inviteUrl: String, targetPkg: String, dualAppTarget: String? = null) {
        try {
            WhatsAppAccessibilityService.startSendWatchdog(taskId, dualAppTarget)
            val appLabel = if (targetPkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp Personal"
            appendLog("📲 Membuka tautan undangan grup via $appLabel...")

            val uri = Uri.parse(inviteUrl)
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                if (isPackageInstalled(applicationContext, targetPkg)) {
                    setPackage(targetPkg)
                }
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }

            applicationContext.startActivity(intent)
        } catch (e: Exception) {
            appendLog("❌ Gagal membuka tautan grup: ${e.message}")
            reportMessageStatus(taskId, "FAILED", e.message)
        }
    }

    fun reportMessageStatus(messageId: String, status: String, error: String? = null, deviceStatus: String? = null) {
        Thread {
            try {
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val json = JSONObject().apply {
                    put("messageId", messageId)
                    put("status", status)
                    if (error != null) put("error", error)
                    if (deviceStatus != null) put("deviceStatus", deviceStatus)
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
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val channel = NotificationChannel(
                CHANNEL_ID,
                "WAGTW Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)

            val alertChannel = NotificationChannel(
                CHANNEL_ALERT_ID,
                "WAGTW Peringatan & Status Pesan",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pemberitahuan status pesan terkirim atau gagal dan akun terputus"
                enableVibration(true)
            }
            manager.createNotificationChannel(alertChannel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
