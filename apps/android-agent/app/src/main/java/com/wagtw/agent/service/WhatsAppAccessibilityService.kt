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
                        AgentForegroundService.notifyMessageFailed(
                            currentMsgId,
                            "Timeout: WhatsApp tidak merespons atau tombol kirim tidak muncul (14 detik)"
                        )
                    }

                    // Return to previous screen
                    instance?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
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

        // 1. DETECT WHATSAPP ERROR DIALOGS & BOTTOM SHEETS
        val errorKeywords = listOf(
            "Kirim undangan melalui SMS",
            "tidak terdaftar di WhatsApp",
            "tidak bisa memulai obrolan baru",
            "tidak bisa memulai chat baru",
            "Akun Anda dibatasi",
            "isn't on WhatsApp",
            "not on WhatsApp",
            "tidak valid",
            "invalid phone",
            "tidak diizinkan menggunakan WhatsApp",
            "This account is not allowed"
        )

        var detectedError: String? = null
        for (err in errorKeywords) {
            val found = rootNode.findAccessibilityNodeInfosByText(err)
            if (found.isNotEmpty()) {
                detectedError = when {
                    err.contains("terdaftar", true) || err.contains("undangan", true) || err.contains("on WhatsApp", true) ->
                        "Nomor tujuan tidak terdaftar di WhatsApp"
                    err.contains("chat baru", true) || err.contains("obrolan baru", true) || err.contains("dibatasi", true) ->
                        "Akun Anda dibatasi oleh WhatsApp (tidak bisa memulai chat/obrolan baru)"
                    err.contains("tidak diizinkan", true) || err.contains("not allowed", true) ->
                        "Akun WhatsApp ditangguhkan / banned"
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
                AgentForegroundService.notifyMessageFailed(msgId, detectedError)
            }

            // Dismiss dialog / bottom sheet: look for "Nanti", "Not now", "OK", "BATAL", "Batal"
            val dismissLabels = listOf("Nanti", "Not now", "OK", "Batal", "BATAL", "Cancel")
            for (label in dismissLabels) {
                val dismissButtons = rootNode.findAccessibilityNodeInfosByText(label)
                var handled = false
                for (btn in dismissButtons) {
                    if (btn.isClickable) {
                        btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        handled = true
                        break
                    } else if (btn.parent?.isClickable == true) {
                        btn.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        handled = true
                        break
                    }
                }
                if (handled) break
            }

            // Return to previous screen
            Handler(Looper.getMainLooper()).postDelayed({
                performGlobalAction(GLOBAL_ACTION_BACK)
            }, 800)
            return
        }

        // 2. DETECT GROUP JOIN ERRORS (Grup Penuh, Tautan Kadaluwarsa)
        val groupErrorKeywords = listOf("Grup ini penuh", "This group is full", "Tautan ini telah disetel ulang", "This invite link has been reset", "Tidak dapat bergabung", "Couldn't join")
        for (gErr in groupErrorKeywords) {
            val found = rootNode.findAccessibilityNodeInfosByText(gErr)
            if (found.isNotEmpty()) {
                Log.w("WAGTW_ACCESSIBILITY", "Group join error: $gErr")
                cancelWatchdog()
                isWaitingForSend = false
                val taskId = lastSentMessageId
                lastSentMessageId = null

                AgentForegroundService.appendLog("⚠️ Gagal gabung grup: $gErr")
                if (taskId != null) {
                    AgentForegroundService.notifyMessageFailed(taskId, "Gagal gabung grup: $gErr")
                }

                // Dismiss
                val okButtons = rootNode.findAccessibilityNodeInfosByText("OK")
                for (btn in okButtons) {
                    if (btn.isClickable) {
                        btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    } else {
                        btn.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    }
                }

                Handler(Looper.getMainLooper()).postDelayed({
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }, 800)
                return
            }
        }

        // 3. SEARCH AND CLICK "GABUNG KE GRUP" (AUTO JOIN GROUP WARMUP)
        val joinKeywords = listOf("Gabung ke grup", "Join group", "Gabung grup", "GABUNG KE GRUP", "JOIN GROUP")
        val joinNodes = mutableListOf<AccessibilityNodeInfo>()
        for (kw in joinKeywords) {
            joinNodes.addAll(rootNode.findAccessibilityNodeInfosByText(kw))
        }
        joinNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp:id/ok"))
        joinNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp.w4b:id/ok"))
        joinNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp:id/join_group"))
        joinNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp.w4b:id/join_group"))

        for (node in joinNodes) {
            val nodeText = node.text?.toString() ?: ""
            val nodeDesc = node.contentDescription?.toString() ?: ""
            val nodeRes = node.viewIdResourceName ?: ""
            val isJoin = nodeText.contains("gabung", true) || nodeText.contains("join", true) ||
                         nodeDesc.contains("gabung", true) || nodeDesc.contains("join", true) ||
                         nodeRes.contains("join", true)

            if (isJoin && (node.isClickable || node.parent?.isClickable == true)) {
                val clicked = if (node.isClickable) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                } else {
                    node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
                }

                if (clicked) {
                    Log.d("WAGTW_ACCESSIBILITY", "Successfully clicked Join Group button!")
                    cancelWatchdog()
                    isWaitingForSend = false

                    val taskId = lastSentMessageId
                    lastSentMessageId = null

                    AgentForegroundService.appendLog("🎉 Berhasil bergabung ke grup WhatsApp!")
                    if (taskId != null) {
                        AgentForegroundService.notifyMessageSent(taskId)
                    }

                    // Return to previous screen after brief pause
                    Handler(Looper.getMainLooper()).postDelayed({
                        performGlobalAction(GLOBAL_ACTION_BACK)
                    }, 1500)
                    return
                }
            }
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
