package com.wagtw.agent.service

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class WhatsAppAccessibilityService : AccessibilityService() {

    companion object {
        var isRunning: Boolean = false
        var isWaitingForSend: Boolean = false
        var lastSentMessageId: String? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
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

        // Search for WhatsApp send button by view ID or text/contentDescription
        val sendNodes = mutableListOf<AccessibilityNodeInfo>()

        // Common WhatsApp send button view IDs
        sendNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp:id/send"))
        sendNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId("com.whatsapp.w4b:id/send"))

        if (sendNodes.isEmpty()) {
            sendNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Send"))
            sendNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Kirim"))
        }

        for (node in sendNodes) {
            if (node.isClickable || node.parent?.isClickable == true) {
                // Click the send button
                val clicked = if (node.isClickable) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                } else {
                    node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
                }

                if (clicked) {
                    Log.d("WAGTW_ACCESSIBILITY", "Successfully clicked Send button automatically!")
                    AgentForegroundService.appendLog("🚀 Pesan terkirim otomatis di WhatsApp!")
                    isWaitingForSend = false

                    // Inform server that message has been sent
                    val msgId = lastSentMessageId
                    if (msgId != null) {
                        AgentForegroundService.notifyMessageSent(msgId)
                        lastSentMessageId = null
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
        Log.d("WAGTW_ACCESSIBILITY", "WhatsApp Accessibility Service Interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
    }
}
