package com.wagtw.agent.service

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class WhatsAppAccessibilityService : AccessibilityService() {

    companion object {
        var instance: WhatsAppAccessibilityService? = null
        var isRunning: Boolean = false
        var isWaitingForSend: Boolean = false
        var lastSentMessageId: String? = null

        private val watchdogHandler = Handler(Looper.getMainLooper())
        private var watchdogRunnable: Runnable? = null

        fun startSendWatchdog(msgId: String) {
            cancelWatchdog()
            lastSentMessageId = msgId
            isWaitingForSend = true

            watchdogRunnable = Runnable {
                if (isWaitingForSend) {
                    Log.w("WAGTW_ACCESSIBILITY", "Send watchdog triggered! Message: $lastSentMessageId")
                    val currentMsgId = lastSentMessageId
                    isWaitingForSend = false
                    lastSentMessageId = null

                    AgentForegroundService.appendLog("⚠️ Gagal: Timeout tombol kirim WhatsApp (14 detik)")
                    if (currentMsgId != null) {
                        AgentForegroundService.instance?.reportMessageStatus(
                            currentMsgId,
                            "FAILED",
                            "Timeout: WhatsApp tidak merespons atau tombol kirim tidak muncul (14 detik)"
                        )
                    }

                    // Return to previous screen
                    instance?.performGlobalAction(GLOBAL_ACTION_BACK)
                }
            }
            watchdogHandler.postDelayed(watchdogRunnable!!, 14000)
        }

        fun cancelWatchdog() {
            watchdogRunnable?.let { watchdogHandler.removeCallbacks(it) }
            watchdogRunnable = null
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isRunning = true
        Log.d("WAGTW_ACCESSIBILITY", "WhatsApp Accessibility Service Connected.")
        AgentForegroundService.appendLog("✅ Layanan Aksesibilitas Aktif")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isWaitingForSend) return
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg != "com.whatsapp" && pkg != "com.whatsapp.w4b") return

        val rootNode = rootInActiveWindow ?: return

        // 1. DETECT WHATSAPP ERROR DIALOGS (Nomor tidak terdaftar, Akun dibatasi, dll)
        val errorKeywords = listOf(
            "tidak terdaftar di WhatsApp",
            "isn't on WhatsApp",
            "not on WhatsApp",
            "tidak valid",
            "invalid phone",
            "Akun Anda dibatasi",
            "tidak diizinkan menggunakan WhatsApp",
            "This account is not allowed"
        )

        var detectedError: String? = null
        for (err in errorKeywords) {
            val found = rootNode.findAccessibilityNodeInfosByText(err)
            if (found.isNotEmpty()) {
                detectedError = when {
                    err.contains("terdaftar", true) || err.contains("on WhatsApp", true) ->
                        "Nomor tujuan tidak terdaftar di WhatsApp"
                    err.contains("dibatasi", true) || err.contains("tidak diizinkan", true) || err.contains("not allowed", true) ->
                        "Akun WhatsApp dibatasi / suspended"
                    else -> "Nomor telepon tidak valid di WhatsApp"
                }
                break
            }
        }

        if (detectedError != null) {
            Log.e("WAGTW_ACCESSIBILITY", "WhatsApp Error Detected: $detectedError")
            cancelWatchdog()
            isWaitingForSend = false
            val msgId = lastSentMessageId
            lastSentMessageId = null

            AgentForegroundService.appendLog("❌ Gagal: $detectedError")
            if (msgId != null) {
                AgentForegroundService.instance?.reportMessageStatus(msgId, "FAILED", detectedError)
            }

            // Dismiss dialog: look for "OK" or "BATAL" button
            val okButtons = rootNode.findAccessibilityNodeInfosByText("OK")
            for (btn in okButtons) {
                if (btn.isClickable) {
                    btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    break
                }
            }

            // Return to previous screen
            Handler(Looper.getMainLooper()).postDelayed({
                performGlobalAction(GLOBAL_ACTION_BACK)
            }, 800)
            return
        }

        // 2. SEARCH AND CLICK SEND BUTTON
        val sendNodes = mutableListOf<AccessibilityNodeInfo>()

        // View IDs
        sendNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp:id/send"))
        sendNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp.w4b:id/send"))

        // Text & Content Descriptions
        if (sendNodes.isEmpty()) {
            sendNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Send"))
            sendNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Kirim"))
        }

        for (node in sendNodes) {
            if (node.isClickable || node.parent?.isClickable == true) {
                val clicked = if (node.isClickable) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                } else {
                    node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
                }

                if (clicked) {
                    Log.d("WAGTW_ACCESSIBILITY", "Successfully clicked Send button automatically!")
                    cancelWatchdog()
                    isWaitingForSend = false

                    val msgId = lastSentMessageId
                    lastSentMessageId = null

                    AgentForegroundService.appendLog("🚀 Pesan terkirim otomatis di WhatsApp!")
                    if (msgId != null) {
                        AgentForegroundService.notifyMessageSent(msgId)
                    }

                    // Return to previous screen after brief pause
                    Handler(Looper.getMainLooper()).postDelayed({
                        performGlobalAction(GLOBAL_ACTION_BACK)
                    }, 1200)

                    break
                }
            }
        }
    }

    override fun onInterrupt() {
        isRunning = false
        cancelWatchdog()
        Log.d("WAGTW_ACCESSIBILITY", "WhatsApp Accessibility Service Interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        cancelWatchdog()
        instance = null
    }
}
