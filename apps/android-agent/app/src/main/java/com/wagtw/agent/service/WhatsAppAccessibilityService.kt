package com.wagtw.agent.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.wagtw.agent.util.PrefsManager
import java.util.Random

class WhatsAppAccessibilityService : AccessibilityService() {

    companion object {
        var instance: WhatsAppAccessibilityService? = null
        var isRunning: Boolean = false
        var isWaitingForSend: Boolean = false
        var lastSentMessageId: String? = null
        var forcedDualAppAccount: String? = null

        private val watchdogHandler = Handler(Looper.getMainLooper())
        private var watchdogRunnable: Runnable? = null
        private var pollingRunnable: Runnable? = null
        private var earlyCheckRunnable: Runnable? = null

        fun startSendWatchdog(msgId: String, dualAppTarget: String? = null) {
            cancelWatchdog()
            lastSentMessageId = msgId
            forcedDualAppAccount = dualAppTarget
            isWaitingForSend = true

            // 1. ACTIVE POLLING LOOP: Check every 300ms to immediately detect and click the Send button
            // as soon as WhatsApp finishes rendering the chat and compose box!
            var elapsed = 0
            pollingRunnable = object : Runnable {
                override fun run() {
                    elapsed += 300
                    if (isWaitingForSend && instance != null) {
                        try {
                            val activeRoot = instance?.rootInActiveWindow
                            if (activeRoot != null) {
                                val pkg = activeRoot.packageName?.toString() ?: ""
                                val isDualAppDialog = pkg.contains("miui") || pkg == "android" || pkg.contains("resolver") || pkg.contains("xspace")

                                if (isDualAppDialog) {
                                    instance!!.handleXiaomiDualAppDialog(activeRoot)
                                } else {
                                    if (instance!!.handleTrustDialog(activeRoot)) return
                                    if (instance!!.detectAndHandleErrors(activeRoot)) return
                                    if (instance!!.handleGroupJoinErrors(activeRoot)) return
                                    if (instance!!.handleGroupJoin(activeRoot)) return
                                    if (instance!!.tryClickSendButton(activeRoot)) return
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("WAGTW_ACCESSIBILITY", "Watchdog polling error: ${e.message}")
                        }
                    }
                    if (isWaitingForSend && elapsed < 7000) {
                        watchdogHandler.postDelayed(this, 300)
                    }
                }
            }
            watchdogHandler.postDelayed(pollingRunnable!!, 300)

            // 2. Early check at 1.8s for restricted account banner or fast error popups
            earlyCheckRunnable = Runnable {
                if (isWaitingForSend && instance != null) {
                    try {
                        val activeRoot = instance?.rootInActiveWindow
                        if (activeRoot != null) {
                            val isRestricted = instance!!.findTextRecursive(activeRoot, "dibatasi") ||
                                               instance!!.findTextRecursive(activeRoot, "chat baru") ||
                                               instance!!.findTextRecursive(activeRoot, "tampilkan detail")
                            if (isRestricted) {
                                Log.w("WAGTW_ACCESSIBILITY", "Early check: Account restriction banner detected!")
                                cancelWatchdog()
                                val currentMsgId = lastSentMessageId
                                isWaitingForSend = false
                                lastSentMessageId = null
                                forcedDualAppAccount = null
                                AgentForegroundService.appendLog("❌ Gagal: Akun Anda dibatasi oleh WhatsApp (Limit chat baru)")
                                if (currentMsgId != null) {
                                    AgentForegroundService.notifyMessageFailed(
                                        currentMsgId,
                                        "Akun Anda dibatasi oleh WhatsApp (Limit chat baru)",
                                        "SUSPENDED"
                                    )
                                }
                                instance?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                            }
                        }
                    } catch (e: Exception) {}
                }
            }
            watchdogHandler.postDelayed(earlyCheckRunnable!!, 1800)

            // 3. Final Watchdog Timeout at 7s
            watchdogRunnable = Runnable {
                if (isWaitingForSend) {
                    Log.w("WAGTW_ACCESSIBILITY", "Send watchdog triggered! Message: $lastSentMessageId")
                    val currentMsgId = lastSentMessageId
                    isWaitingForSend = false
                    lastSentMessageId = null
                    forcedDualAppAccount = null

                    AgentForegroundService.appendLog("⚠️ Gagal: Timeout respon WhatsApp (7 detik)")
                    if (currentMsgId != null) {
                        AgentForegroundService.notifyMessageFailed(
                            currentMsgId,
                            "Timeout: WhatsApp tidak merespons atau tombol kirim tidak muncul (7 detik)",
                            "TIMEOUT"
                        )
                    }

                    // Return to previous screen
                    instance?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                }
            }
            watchdogHandler.postDelayed(watchdogRunnable!!, 7000)
        }

        fun cancelWatchdog() {
            watchdogRunnable?.let { watchdogHandler.removeCallbacks(it) }
            pollingRunnable?.let { watchdogHandler.removeCallbacks(it) }
            earlyCheckRunnable?.let { watchdogHandler.removeCallbacks(it) }
            watchdogRunnable = null
            pollingRunnable = null
            earlyCheckRunnable = null
            forcedDualAppAccount = null
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

        val isWhatsApp = pkg == "com.whatsapp" || pkg == "com.whatsapp.w4b"
        val isDualAppDialog = pkg.contains("miui") || pkg == "android" || pkg.contains("resolver") || pkg.contains("xspace")

        if (!isWhatsApp && !isDualAppDialog) return

        val rootNode = rootInActiveWindow ?: return

        // 0. HANDLE XIAOMI DUAL APP DIALOG
        if (isDualAppDialog) {
            handleXiaomiDualAppDialog(rootNode)
            return
        }

        // 0.1 AUTO-CONFIRM "Lanjutkan obrolan" / "Continue chat"
        if (handleTrustDialog(rootNode)) return

        // 1. DETECT WHATSAPP ERROR DIALOGS, LOGGED OUT SCREEN, & SUSPEND / BANNED
        if (detectAndHandleErrors(rootNode)) return

        // 2. DETECT GROUP JOIN ERRORS
        if (handleGroupJoinErrors(rootNode)) return

        // 3. SEARCH AND CLICK "GABUNG KE GRUP" (AUTO JOIN GROUP WARMUP)
        if (handleGroupJoin(rootNode)) return

        // 4. SEARCH AND CLICK SEND BUTTON
        tryClickSendButton(rootNode)
    }

    fun handleTrustDialog(rootNode: AccessibilityNodeInfo): Boolean {
        val hasTrustDialog = rootNode.findAccessibilityNodeInfosByText("Apakah Anda percaya bisnis ini").isNotEmpty() ||
                             rootNode.findAccessibilityNodeInfosByText("Do you trust this business").isNotEmpty() ||
                             rootNode.findAccessibilityNodeInfosByText("Batalkan obrolan").isNotEmpty() ||
                             rootNode.findAccessibilityNodeInfosByText("Cancel chat").isNotEmpty()

        val continueButtons = mutableListOf<AccessibilityNodeInfo>()
        continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Lanjutkan obrolan"))
        continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Continue chat"))
        continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Lanjutkan ke obrolan"))
        continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Lanjutkan ke chat"))
        if (hasTrustDialog && continueButtons.isEmpty()) {
            continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Lanjutkan"))
            continueButtons.addAll(rootNode.findAccessibilityNodeInfosByText("Continue"))
        }

        for (btn in continueButtons) {
            var curr: AccessibilityNodeInfo? = btn
            var clicked = false
            var depth = 0
            while (curr != null && depth < 4) {
                if (curr.isClickable) {
                    clicked = curr.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    if (clicked) break
                }
                curr = curr.parent
                depth++
            }

            if (clicked) {
                Log.d("WAGTW_ACCESSIBILITY", "Clicked 'Lanjutkan obrolan' (Trust business prompt)")
                AgentForegroundService.appendLog("🛡️ Mengonfirmasi 'Lanjutkan obrolan' (Dialog keamanan WhatsApp)...")
                startSendWatchdog(lastSentMessageId ?: "retry", forcedDualAppAccount)
                return true
            }
        }
        return false
    }

    fun detectAndHandleErrors(rootNode: AccessibilityNodeInfo): Boolean {
        val errorKeywords = listOf(
            // Welcome / Logged out / Reset Screen (from fresh install, reset, or ban logout)
            "Selamat datang di WhatsApp",
            "Welcome to WhatsApp",
            "Setuju dan lanjutkan",
            "Agree and continue",
            "Kebijakan Privasi kami",
            "Ketentuan Layanan kami",

            // Unregistered / Invalid Number
            "Kirim undangan melalui SMS",
            "tidak terdaftar di WhatsApp",
            "isn't on WhatsApp",
            "not on WhatsApp",
            "tidak valid",
            "invalid phone",

            // Rate Limited / New Chat Restrictions
            "tidak bisa memulai obrolan baru",
            "tidak bisa memulai chat baru",
            "Akun Anda dibatasi",

            // Banned / Suspended / Logout
            "tidak diizinkan menggunakan WhatsApp",
            "This account is not allowed",
            "telah diblokir",
            "has been banned",
            "is banned",
            "telah dinonaktifkan",
            "tidak dapat lagi menggunakan",
            "can no longer use",
            "Daftarkan nomor telepon",
            "Verifikasi nomor Anda",
            "Enter your phone number",
            "spam"
        )

        var detectedError: String? = null
        var isSuspended = false

        for (err in errorKeywords) {
            val found = rootNode.findAccessibilityNodeInfosByText(err)
            if (found.isNotEmpty()) {
                when {
                    err.contains("Selamat datang", true) || err.contains("Welcome to", true) ||
                    err.contains("Setuju dan lanjutkan", true) || err.contains("Agree and continue", true) -> {
                        detectedError = "WhatsApp belum login / ter-logout (Layar Selamat Datang)"
                        isSuspended = true
                    }
                    err.contains("terdaftar", true) || err.contains("undangan", true) || err.contains("on WhatsApp", true) || err.contains("valid", true) -> {
                        detectedError = "Nomor tujuan tidak terdaftar di WhatsApp"
                    }
                    err.contains("chat baru", true) || err.contains("obrolan baru", true) || err.contains("dibatasi", true) -> {
                        detectedError = "Akun Anda dibatasi oleh WhatsApp (Limit chat baru)"
                        isSuspended = true
                    }
                    err.contains("tidak diizinkan", true) || err.contains("not allowed", true) ||
                    err.contains("diblokir", true) || err.contains("banned", true) ||
                    err.contains("dinonaktifkan", true) || err.contains("tidak dapat lagi", true) ||
                    err.contains("Daftarkan nomor", true) || err.contains("Verifikasi nomor", true) ||
                    err.contains("Enter your phone", true) || err.contains("spam", true) -> {
                        detectedError = "Akun WhatsApp ditangguhkan / banned / logout"
                        isSuspended = true
                    }
                    else -> {
                        detectedError = "Nomor telepon tidak valid di WhatsApp"
                    }
                }
                break
            }
        }

        // Deep fallback recursive scan for restriction banner on custom view trees
        if (detectedError == null) {
            val isRestricted = findTextRecursive(rootNode, "dibatasi") ||
                               findTextRecursive(rootNode, "chat baru") ||
                               findTextRecursive(rootNode, "obrolan baru") ||
                               findTextRecursive(rootNode, "tampilkan detail")
            if (isRestricted) {
                detectedError = "Akun Anda dibatasi oleh WhatsApp (Limit chat baru)"
                isSuspended = true
            }
        }

        if (detectedError != null) {
            Log.e("WAGTW_ACCESSIBILITY", "WhatsApp Error Detected: $detectedError")
            cancelWatchdog()
            isWaitingForSend = false
            val msgId = lastSentMessageId
            lastSentMessageId = null

            // If account is suspended and Dual App is active, auto-lock to Account 1
            if (isSuspended) {
                val prefs = PrefsManager(applicationContext)
                if (prefs.dualAppMode != "OFF") {
                    prefs.dualAppMode = "ACCOUNT_1"
                    AgentForegroundService.appendLog("⚠️ Terdeteksi akun terblokir pada Dual App! Mengunci otomatis ke Akun 1.")
                }
            }

            AgentForegroundService.appendLog("❌ Gagal: $detectedError")
            if (msgId != null) {
                AgentForegroundService.notifyMessageFailed(
                    msgId, 
                    detectedError, 
                    if (isSuspended) "SUSPENDED" else null
                )
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
            }, 600)
            return true
        }
        return false
    }

    fun handleGroupJoinErrors(rootNode: AccessibilityNodeInfo): Boolean {
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
                return true
            }
        }
        return false
    }

    fun handleGroupJoin(rootNode: AccessibilityNodeInfo): Boolean {
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
                    return true
                }
            }
        }
        return false
    }

    fun tryClickSendButton(rootNode: AccessibilityNodeInfo): Boolean {
        val candidateNodes = mutableListOf<AccessibilityNodeInfo>()

        // 1. By View IDs
        val viewIds = listOf(
            "com.whatsapp:id/send",
            "com.whatsapp.w4b:id/send",
            "com.whatsapp:id/send_button",
            "com.whatsapp.w4b:id/send_button",
            "com.whatsapp:id/btn_send",
            "com.whatsapp.w4b:id/btn_send",
            "com.whatsapp:id/entry_action"
        )
        for (id in viewIds) {
            candidateNodes.addAll(rootNode.findAccessibilityNodeInfosByViewId(id))
        }

        // 2. Recursive search in view tree for Send button by ContentDescription & ViewId suffix
        findSendNodesRecursive(rootNode, candidateNodes)

        // 3. Fallback: by Text (filtered to bottom of screen to avoid matching chat bubbles)
        if (candidateNodes.isEmpty()) {
            val textNodes = mutableListOf<AccessibilityNodeInfo>()
            textNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Send"))
            textNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Kirim"))
            val displayMetrics = resources.displayMetrics
            for (tn in textNodes) {
                val rect = Rect()
                tn.getBoundsInScreen(rect)
                if (rect.bottom > displayMetrics.heightPixels * 0.65) {
                    candidateNodes.add(tn)
                }
            }
        }

        // 4. Try clicking or tapping candidates
        for (node in candidateNodes) {
            val clicked = clickNodeOrGesture(node)
            if (clicked) {
                Log.d("WAGTW_ACCESSIBILITY", "Successfully clicked / dispatched Send button!")
                cancelWatchdog()
                isWaitingForSend = false

                val msgId = lastSentMessageId
                lastSentMessageId = null

                // Give a brief moment to check if chat bubble showed failure icon
                Handler(Looper.getMainLooper()).postDelayed({
                    val currentWindow = rootInActiveWindow
                    val hasSendError = currentWindow?.findAccessibilityNodeInfosByText("Pesan tidak terkirim")?.isNotEmpty() == true ||
                                      currentWindow?.findAccessibilityNodeInfosByText("Not delivered")?.isNotEmpty() == true ||
                                      currentWindow?.findAccessibilityNodeInfosByText("Ketuk untuk mencoba lagi")?.isNotEmpty() == true

                    if (hasSendError) {
                        AgentForegroundService.appendLog("⚠️ Gagal: Pesan tertahan / tidak terkirim di WhatsApp")
                        if (msgId != null) {
                            AgentForegroundService.notifyMessageFailed(msgId, "Pesan tidak terkirim di WhatsApp (jaringan atau dibatasi)")
                        }
                    } else {
                        AgentForegroundService.appendLog("🚀 Pesan terkirim otomatis di WhatsApp!")
                        if (msgId != null) {
                            AgentForegroundService.notifyMessageSent(msgId)
                        }
                    }

                    // Return to previous screen
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }, 1200)

                return true
            }
        }
        return false
    }

    private fun findSendNodesRecursive(node: AccessibilityNodeInfo?, results: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return

        val desc = node.contentDescription?.toString()?.trim()?.lowercase() ?: ""
        val viewId = node.viewIdResourceName?.lowercase() ?: ""

        val isSendDesc = (desc == "kirim" || desc == "send" || desc == "kirim pesan" || desc == "send message" || desc == "kirimkan") &&
                         !desc.contains("suara") && !desc.contains("voice") && !desc.contains("audio")

        val isSendId = viewId.endsWith(":id/send") || viewId.endsWith(":id/send_button") || viewId.endsWith(":id/btn_send")

        if (isSendDesc || isSendId) {
            results.add(node)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            findSendNodesRecursive(child, results)
        }
    }

    private fun clickNodeOrGesture(node: AccessibilityNodeInfo): Boolean {
        // A. Walk up hierarchy (node -> parent -> grandparent) to find clickable element
        var curr: AccessibilityNodeInfo? = node
        var depth = 0
        while (curr != null && depth < 4) {
            if (curr.isClickable) {
                val clicked = curr.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                if (clicked) {
                    Log.d("WAGTW_ACCESSIBILITY", "Clicked send node at depth $depth via ACTION_CLICK")
                    return true
                }
            }
            curr = curr.parent
            depth++
        }

        // B. Fallback: Dispatch simulated gesture tap on screen coordinates
        val rect = Rect()
        node.getBoundsInScreen(rect)
        if (rect.width() > 0 && rect.height() > 0) {
            val x = rect.centerX().toFloat()
            val y = rect.centerY().toFloat()
            val path = Path().apply { moveTo(x, y) }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
                .build()
            val dispatched = dispatchGesture(gesture, null, null)
            if (dispatched) {
                Log.d("WAGTW_ACCESSIBILITY", "Dispatched gesture tap at ($x, $y)")
                return true
            }
        }

        return false
    }
    }

    private var lastDualAppClickTime: Long = 0L

    private fun handleXiaomiDualAppDialog(rootNode: AccessibilityNodeInfo) {
        if (System.currentTimeMillis() - lastDualAppClickTime < 1500) return

        val prefs = PrefsManager(applicationContext)
        val mode = forcedDualAppAccount ?: prefs.dualAppMode
        if (mode == "OFF") {
            // Dual App auto-choice is disabled in settings
            return
        }

        // Find candidate WhatsApp items in Xiaomi / Android resolver dialog
        val waNodes = mutableListOf<AccessibilityNodeInfo>()
        waNodes.addAll(rootNode.findAccessibilityNodeInfosByText("WhatsApp"))
        waNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Dual"))
        waNodes.addAll(rootNode.findAccessibilityNodeInfosByText("Ganda"))

        val candidates = mutableListOf<AccessibilityNodeInfo>()
        for (node in waNodes) {
            // Traverse up to find the clickable container or the node itself
            var curr: AccessibilityNodeInfo? = node
            var clickableContainer: AccessibilityNodeInfo? = null
            var depth = 0
            while (curr != null && depth < 5) {
                if (curr.isClickable) {
                    clickableContainer = curr
                    break
                }
                curr = curr.parent
                depth++
            }
            val target = clickableContainer ?: node
            if (!candidates.contains(target)) {
                candidates.add(target)
            }
        }

        if (candidates.isEmpty()) return

        // Determine which candidate to pick
        // candidates[0] is typically Akun 1 (Utama)
        // candidates[1] is typically Akun 2 (Dual App / Kloningan)
        val chosenIndex: Int = when (mode) {
            "ACCOUNT_1", "1" -> 0
            "ACCOUNT_2", "2" -> if (candidates.size > 1) 1 else 0
            "RANDOM" -> if (candidates.size > 1) Random().nextInt(candidates.size) else 0
            "ALTERNATING" -> {
                val next = (prefs.lastDualAppIndex + 1) % candidates.size
                prefs.lastDualAppIndex = next
                next
            }
            else -> 0
        }

        val chosenNode = candidates.getOrNull(chosenIndex) ?: candidates.firstOrNull() ?: return

        val clicked = if (chosenNode.isClickable) {
            chosenNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        } else {
            chosenNode.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
        }

        if (clicked) {
            lastDualAppClickTime = System.currentTimeMillis()
            val label = when {
                mode == "ACCOUNT_1" || mode == "1" -> "Akun 1 (Utama)"
                mode == "ACCOUNT_2" || mode == "2" -> "Akun 2 (Dual App)"
                mode == "RANDOM" -> "Acak (Pilihan #${chosenIndex + 1})"
                mode == "ALTERNATING" -> "Bergantian (Pilihan #${chosenIndex + 1})"
                else -> "Pilihan #${chosenIndex + 1}"
            }
            AgentForegroundService.appendLog("📲 [Xiaomi Dual App] Memilih otomatis: $label")

            // In some MIUI versions, there is a "Hanya sekali" (Just once) button
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    val activeWindow = rootInActiveWindow ?: return@postDelayed
                    val onceButtons = mutableListOf<AccessibilityNodeInfo>()
                    onceButtons.addAll(activeWindow.findAccessibilityNodeInfosByText("Hanya sekali"))
                    onceButtons.addAll(activeWindow.findAccessibilityNodeInfosByText("Just once"))
                    onceButtons.addAll(activeWindow.findAccessibilityNodeInfosByText("Buka"))
                    onceButtons.addAll(activeWindow.findAccessibilityNodeInfosByViewId("android:id/button_once"))

                    for (btn in onceButtons) {
                        if (btn.isClickable) {
                            btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            break
                        } else if (btn.parent?.isClickable == true) {
                            btn.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            break
                        }
                    }
                } catch (e: Exception) {
                    Log.e("WAGTW_ACCESSIBILITY", "Error confirming once button: ${e.message}")
                }
            }, 300)
        }
    }

    fun findTextRecursive(node: AccessibilityNodeInfo?, targetLower: String): Boolean {
        if (node == null) return false
        val text = node.text?.toString()?.lowercase()
        if (text != null && text.contains(targetLower)) return true
        val desc = node.contentDescription?.toString()?.lowercase()
        if (desc != null && desc.contains(targetLower)) return true

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (findTextRecursive(child, targetLower)) {
                return true
            }
        }
        return false
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
