package com.wagtw.agent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.tabs.TabLayout
import com.wagtw.agent.service.AgentForegroundService
import com.wagtw.agent.service.WhatsAppAccessibilityService
import com.wagtw.agent.util.AppUpdateManager
import com.wagtw.agent.util.PrefsManager
import com.wagtw.agent.util.UpdateInfo

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: PrefsManager

    // Tabs & Containers
    private lateinit var tabLayout: TabLayout
    private lateinit var layoutTabDashboard: View
    private lateinit var layoutTabAccounts: View
    private lateinit var layoutTabSettings: View

    // Dashboard Views
    private lateinit var tvStatusBadge: TextView
    private lateinit var tvDeviceHeaderName: TextView
    private lateinit var badgeBusinessStatus: TextView
    private lateinit var badgePersonalStatus: TextView
    private lateinit var badgeDualStatus: TextView
    private lateinit var btnToggleConnect: MaterialButton
    private lateinit var btnClearLogs: MaterialButton
    private lateinit var tvLogs: TextView
    private lateinit var scrollLogs: ScrollView

    // Update Banner on Tab 1
    private lateinit var cardUpdateBanner: View
    private lateinit var tvUpdateBannerTitle: TextView
    private lateinit var tvUpdateBannerDesc: TextView
    private lateinit var btnBannerUpdate: MaterialButton

    // Accounts Views
    private lateinit var cbEnableBusiness: SwitchMaterial
    private lateinit var etBusinessPhone: EditText
    private lateinit var cbEnableBusiness2: SwitchMaterial
    private lateinit var etBusinessPhone2: EditText
    private lateinit var cbEnablePersonal: SwitchMaterial
    private lateinit var etPersonalPhone: EditText
    private lateinit var cbEnablePersonal2: SwitchMaterial
    private lateinit var etPersonalPhone2: EditText
    private lateinit var rgDualAppMode: RadioGroup
    private lateinit var rbDualAppOff: RadioButton
    private lateinit var rbDualAppAcc1: RadioButton
    private lateinit var rbDualAppAcc2: RadioButton
    private lateinit var rbDualAppRandom: RadioButton
    private lateinit var btnSaveAccounts: MaterialButton

    // Settings & Diagnostics Views
    private lateinit var etServerUrl: EditText
    private lateinit var etDeviceName: EditText
    private lateinit var btnSaveServer: MaterialButton
    private lateinit var btnPermissionNotif: MaterialButton
    private lateinit var btnPermissionAccessibility: MaterialButton
    private lateinit var btnPermissionBattery: MaterialButton
    private lateinit var btnPermissionInstall: MaterialButton
    private lateinit var rgTestWhatsAppType: RadioGroup
    private lateinit var rbTestBusiness: RadioButton
    private lateinit var rbTestPersonal: RadioButton
    private lateinit var etTestPhone: EditText
    private lateinit var btnQuickTestSend: MaterialButton

    // OTA Update Views
    private lateinit var tvCurrentVersionBadge: TextView
    private lateinit var tvUpdateStatusText: TextView
    private lateinit var layoutUpdateProgress: View
    private lateinit var progressBarUpdate: ProgressBar
    private lateinit var tvUpdatePercent: TextView
    private lateinit var btnCheckUpdate: MaterialButton
    private var currentUpdateInfo: UpdateInfo? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = PrefsManager(this)

        initViews()
        setupTabs()
        loadSavedConfig()
        checkPermissions()
        setupListeners()

        // Check for updates silently on startup
        checkForUpdates(silent = true)
    }

    override fun onResume() {
        super.onResume()
        checkPermissions()
        updateBadges()

        // Resume pending APK installation if permission was granted
        AppUpdateManager.pendingInstallApk?.let { apk ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()) {
                AppUpdateManager.pendingInstallApk = null
                AppUpdateManager.installApk(this, apk)
            }
        }
    }

    private fun initViews() {
        tabLayout = findViewById(R.id.tabLayout)
        layoutTabDashboard = findViewById(R.id.layoutTabDashboard)
        layoutTabAccounts = findViewById(R.id.layoutTabAccounts)
        layoutTabSettings = findViewById(R.id.layoutTabSettings)

        // Header & Dashboard
        tvStatusBadge = findViewById(R.id.tvStatusBadge)
        tvDeviceHeaderName = findViewById(R.id.tvDeviceHeaderName)
        badgeBusinessStatus = findViewById(R.id.badgeBusinessStatus)
        badgePersonalStatus = findViewById(R.id.badgePersonalStatus)
        badgeDualStatus = findViewById(R.id.badgeDualStatus)
        btnToggleConnect = findViewById(R.id.btnToggleConnect)
        btnClearLogs = findViewById(R.id.btnClearLogs)
        tvLogs = findViewById(R.id.tvLogs)
        scrollLogs = findViewById(R.id.scrollLogs)

        // Update Banner (Tab 1)
        cardUpdateBanner = findViewById(R.id.cardUpdateBanner)
        tvUpdateBannerTitle = findViewById(R.id.tvUpdateBannerTitle)
        tvUpdateBannerDesc = findViewById(R.id.tvUpdateBannerDesc)
        btnBannerUpdate = findViewById(R.id.btnBannerUpdate)

        // Accounts Tab
        cbEnableBusiness = findViewById(R.id.cbEnableBusiness)
        etBusinessPhone = findViewById(R.id.etBusinessPhone)
        cbEnableBusiness2 = findViewById(R.id.cbEnableBusiness2)
        etBusinessPhone2 = findViewById(R.id.etBusinessPhone2)
        cbEnablePersonal = findViewById(R.id.cbEnablePersonal)
        etPersonalPhone = findViewById(R.id.etPersonalPhone)
        cbEnablePersonal2 = findViewById(R.id.cbEnablePersonal2)
        etPersonalPhone2 = findViewById(R.id.etPersonalPhone2)
        rgDualAppMode = findViewById(R.id.rgDualAppMode)
        rbDualAppOff = findViewById(R.id.rbDualAppOff)
        rbDualAppAcc1 = findViewById(R.id.rbDualAppAcc1)
        rbDualAppAcc2 = findViewById(R.id.rbDualAppAcc2)
        rbDualAppRandom = findViewById(R.id.rbDualAppRandom)
        btnSaveAccounts = findViewById(R.id.btnSaveAccounts)

        // Settings Tab
        etServerUrl = findViewById(R.id.etServerUrl)
        etDeviceName = findViewById(R.id.etDeviceName)
        btnSaveServer = findViewById(R.id.btnSaveServer)
        btnPermissionNotif = findViewById(R.id.btnPermissionNotif)
        btnPermissionAccessibility = findViewById(R.id.btnPermissionAccessibility)
        btnPermissionBattery = findViewById(R.id.btnPermissionBattery)
        btnPermissionInstall = findViewById(R.id.btnPermissionInstall)
        rgTestWhatsAppType = findViewById(R.id.rgTestWhatsAppType)
        rbTestBusiness = findViewById(R.id.rbTestBusiness)
        rbTestPersonal = findViewById(R.id.rbTestPersonal)
        etTestPhone = findViewById(R.id.etTestPhone)
        btnQuickTestSend = findViewById(R.id.btnQuickTestSend)

        // OTA Update Card
        tvCurrentVersionBadge = findViewById(R.id.tvCurrentVersionBadge)
        tvUpdateStatusText = findViewById(R.id.tvUpdateStatusText)
        layoutUpdateProgress = findViewById(R.id.layoutUpdateProgress)
        progressBarUpdate = findViewById(R.id.progressBarUpdate)
        tvUpdatePercent = findViewById(R.id.tvUpdatePercent)
        btnCheckUpdate = findViewById(R.id.btnCheckUpdate)

        val verName = AppUpdateManager.getCurrentVersionName(this)
        tvCurrentVersionBadge.text = "v$verName"
    }

    private fun setupTabs() {
        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> switchTab(layoutTabDashboard)
                    1 -> switchTab(layoutTabAccounts)
                    2 -> switchTab(layoutTabSettings)
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun switchTab(targetView: View) {
        layoutTabDashboard.visibility = if (targetView == layoutTabDashboard) View.VISIBLE else View.GONE
        layoutTabAccounts.visibility = if (targetView == layoutTabAccounts) View.VISIBLE else View.GONE
        layoutTabSettings.visibility = if (targetView == layoutTabSettings) View.VISIBLE else View.GONE
    }

    private fun loadSavedConfig() {
        etServerUrl.setText(prefs.serverUrl)
        etDeviceName.setText(prefs.deviceName)
        tvDeviceHeaderName.text = prefs.deviceName

        val isBusinessInstalled = AgentForegroundService.isPackageInstalled(this, "com.whatsapp.w4b")
        val isPersonalInstalled = AgentForegroundService.isPackageInstalled(this, "com.whatsapp")

        // Business
        etBusinessPhone.setText(prefs.businessPhone)
        cbEnableBusiness.isChecked = if (!isBusinessInstalled) false else prefs.isBusinessEnabled
        etBusinessPhone2.setText(prefs.businessPhone2)
        cbEnableBusiness2.isChecked = if (!isBusinessInstalled) false else prefs.isBusiness2Enabled

        // Personal
        etPersonalPhone.setText(prefs.personalPhone)
        cbEnablePersonal.isChecked = if (!isBusinessInstalled && isPersonalInstalled) true else prefs.isPersonalEnabled
        etPersonalPhone2.setText(prefs.personalPhone2)
        cbEnablePersonal2.isChecked = prefs.isPersonal2Enabled

        when (prefs.dualAppMode) {
            "ACCOUNT_1" -> rbDualAppAcc1.isChecked = true
            "ACCOUNT_2" -> rbDualAppAcc2.isChecked = true
            "RANDOM", "ALTERNATING" -> rbDualAppRandom.isChecked = true
            else -> rbDualAppOff.isChecked = true
        }

        updateStatus(prefs.isServiceRunning)
        updateBadges()
    }

    private fun updateBadges() {
        val businessCount = (if (prefs.isBusinessEnabled) 1 else 0) + (if (prefs.isBusiness2Enabled) 1 else 0)
        badgeBusinessStatus.text = if (businessCount > 0) "💼 Bisnis: $businessCount Akun" else "💼 Bisnis: OFF"
        badgeBusinessStatus.setTextColor(
            ContextCompat.getColor(this, if (businessCount > 0) R.color.primary else R.color.text_muted)
        )

        val personalCount = (if (prefs.isPersonalEnabled) 1 else 0) + (if (prefs.isPersonal2Enabled) 1 else 0)
        badgePersonalStatus.text = if (personalCount > 0) "🟢 Personal: $personalCount Akun" else "🟢 Personal: OFF"
        badgePersonalStatus.setTextColor(
            ContextCompat.getColor(this, if (personalCount > 0) R.color.primary else R.color.text_muted)
        )

        val dualLabel = when (prefs.dualAppMode) {
            "ACCOUNT_1" -> "Slot 1"
            "ACCOUNT_2" -> "Slot 2 (Dual)"
            "RANDOM", "ALTERNATING" -> "Acak"
            else -> "OFF"
        }
        badgeDualStatus.text = "♊ Dual: $dualLabel"
        badgeDualStatus.setTextColor(
            ContextCompat.getColor(this, if (prefs.dualAppMode != "OFF") R.color.primary else R.color.text_muted)
        )
    }

    private fun saveAccountSettings() {
        val isBusinessInstalled = AgentForegroundService.isPackageInstalled(this, "com.whatsapp.w4b")

        prefs.businessPhone = etBusinessPhone.text.toString().trim()
        prefs.isBusinessEnabled = if (!isBusinessInstalled) false else cbEnableBusiness.isChecked
        prefs.businessPhone2 = etBusinessPhone2.text.toString().trim()
        prefs.isBusiness2Enabled = if (!isBusinessInstalled) false else cbEnableBusiness2.isChecked

        prefs.personalPhone = etPersonalPhone.text.toString().trim()
        prefs.isPersonalEnabled = cbEnablePersonal.isChecked
        prefs.personalPhone2 = etPersonalPhone2.text.toString().trim()
        prefs.isPersonal2Enabled = cbEnablePersonal2.isChecked

        prefs.dualAppMode = when {
            rbDualAppAcc1.isChecked -> "ACCOUNT_1"
            rbDualAppAcc2.isChecked -> "ACCOUNT_2"
            rbDualAppRandom.isChecked -> "RANDOM"
            else -> "OFF"
        }

        updateBadges()
        Toast.makeText(this, "✅ Pengaturan Akun Berhasil Disimpan!", Toast.LENGTH_SHORT).show()
    }

    private fun saveServerSettings() {
        prefs.serverUrl = etServerUrl.text.toString().trim()
        prefs.deviceName = etDeviceName.text.toString().trim()
        updateBadges()
        Toast.makeText(this, "✅ Konfigurasi Server Berhasil Disimpan!", Toast.LENGTH_SHORT).show()
    }

    private fun setupListeners() {
        btnSaveAccounts.setOnClickListener {
            saveAccountSettings()
        }

        btnSaveServer.setOnClickListener {
            saveServerSettings()
        }

        btnClearLogs.setOnClickListener {
            tvLogs.text = "[Sistem] Log dibersihkan.\n"
        }

        btnQuickTestSend.setOnClickListener {
            val phone = etTestPhone.text.toString().trim()
            if (phone.isEmpty()) {
                Toast.makeText(this, "Masukkan nomor HP tujuan terlebih dahulu", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            saveAccountSettings()
            val targetPkg = if (rbTestPersonal.isChecked) "com.whatsapp" else "com.whatsapp.w4b"
            AgentForegroundService.sendDirectTest(this, phone, "Halo! Ini pesan tes otomatis dari WAGTW Agent.", targetPkg)
            Toast.makeText(this, "Membuka WhatsApp untuk tes kirim...", Toast.LENGTH_SHORT).show()
        }

        btnPermissionNotif.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        btnPermissionAccessibility.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        btnPermissionBattery.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        }

        btnPermissionInstall.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Izin instalasi sudah diaktifkan oleh sistem Android.", Toast.LENGTH_SHORT).show()
            }
        }

        btnCheckUpdate.setOnClickListener {
            checkForUpdates(silent = false)
        }

        btnBannerUpdate.setOnClickListener {
            currentUpdateInfo?.let { promptUpdateDialog(it) } ?: checkForUpdates(silent = false)
        }

        btnToggleConnect.setOnClickListener {
            saveAccountSettings()
            saveServerSettings()

            if (prefs.isServiceRunning) {
                stopAgentService()
            } else {
                startAgentService()
            }
        }

        AgentForegroundService.onLogReceived = { logText ->
            runOnUiThread {
                tvLogs.append("$logText\n")
                scrollLogs.post {
                    scrollLogs.fullScroll(ScrollView.FOCUS_DOWN)
                }
            }
        }

        AgentForegroundService.onStatusChanged = { isOnline ->
            runOnUiThread {
                updateStatus(isOnline)
            }
        }
    }

    private fun startAgentService() {
        val intent = Intent(this, AgentForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, intent)
        } else {
            startService(intent)
        }
        prefs.isServiceRunning = true
        updateStatus(true)
        Toast.makeText(this, "🚀 Layanan WAGTW Agent Aktif!", Toast.LENGTH_SHORT).show()
    }

    private fun stopAgentService() {
        val intent = Intent(this, AgentForegroundService::class.java)
        stopService(intent)
        prefs.isServiceRunning = false
        updateStatus(false)
        Toast.makeText(this, "⏹️ Layanan WAGTW Agent Dinonaktifkan.", Toast.LENGTH_SHORT).show()
    }

    private fun updateStatus(isOnline: Boolean) {
        if (isOnline) {
            tvStatusBadge.text = "ONLINE"
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_green))
            tvStatusBadge.setBackgroundResource(R.drawable.bg_badge)
            btnToggleConnect.text = "Putuskan Koneksi"
            btnToggleConnect.setBackgroundColor(ContextCompat.getColor(this, R.color.status_red))
        } else {
            tvStatusBadge.text = "OFFLINE"
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_red))
            tvStatusBadge.setBackgroundResource(R.drawable.bg_badge)
            btnToggleConnect.text = "Simpan & Hubungkan"
            btnToggleConnect.setBackgroundColor(ContextCompat.getColor(this, R.color.primary))
        }
    }

    private fun checkPermissions() {
        // 1. Notification Listener Permission
        val isNotifEnabled = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        if (isNotifEnabled) {
            btnPermissionNotif.text = "Aktif ✓"
            btnPermissionNotif.isEnabled = false
            btnPermissionNotif.setTextColor(ContextCompat.getColor(this, R.color.status_green))
        } else {
            btnPermissionNotif.text = "Beri Izin"
            btnPermissionNotif.isEnabled = true
            btnPermissionNotif.setTextColor(ContextCompat.getColor(this, R.color.status_orange))
        }

        // 2. Accessibility Permission
        val isAccessibilityEnabled = isAccessibilityServiceEnabled()
        if (isAccessibilityEnabled) {
            btnPermissionAccessibility.text = "Aktif ✓"
            btnPermissionAccessibility.isEnabled = false
            btnPermissionAccessibility.setTextColor(ContextCompat.getColor(this, R.color.status_green))
        } else {
            btnPermissionAccessibility.text = "Beri Izin"
            btnPermissionAccessibility.isEnabled = true
            btnPermissionAccessibility.setTextColor(ContextCompat.getColor(this, R.color.status_orange))
        }

        // 3. Battery Optimization
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBattery = pm.isIgnoringBatteryOptimizations(packageName)
            if (isIgnoringBattery) {
                btnPermissionBattery.text = "Aktif ✓"
                btnPermissionBattery.isEnabled = false
                btnPermissionBattery.setTextColor(ContextCompat.getColor(this, R.color.status_green))
            } else {
                btnPermissionBattery.text = "Beri Izin"
                btnPermissionBattery.isEnabled = true
                btnPermissionBattery.setTextColor(ContextCompat.getColor(this, R.color.status_orange))
            }
        }

        // 4. Install Unknown Apps Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canInstall = packageManager.canRequestPackageInstalls()
            if (canInstall) {
                btnPermissionInstall.text = "Aktif ✓"
                btnPermissionInstall.isEnabled = false
                btnPermissionInstall.setTextColor(ContextCompat.getColor(this, R.color.status_green))
            } else {
                btnPermissionInstall.text = "Beri Izin"
                btnPermissionInstall.isEnabled = true
                btnPermissionInstall.setTextColor(ContextCompat.getColor(this, R.color.status_orange))
            }
        } else {
            btnPermissionInstall.text = "Aktif ✓"
            btnPermissionInstall.isEnabled = false
            btnPermissionInstall.setTextColor(ContextCompat.getColor(this, R.color.status_green))
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedComponentName = "${packageName}/${WhatsAppAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
        return enabledServices.contains(expectedComponentName)
    }

    // ================= OTA AUTO-UPDATE LOGIC =================

    private fun checkForUpdates(silent: Boolean = false) {
        if (!silent) {
            btnCheckUpdate.isEnabled = false
            btnCheckUpdate.text = "⏳ Memeriksa..."
            tvUpdateStatusText.text = "Sedang memeriksa pembaruan ke server..."
        }

        AppUpdateManager.checkUpdate(this) { info, error ->
            runOnUiThread {
                btnCheckUpdate.isEnabled = true
                btnCheckUpdate.text = "🔄 Cek & Pasang Pembaruan"

                if (info != null) {
                    currentUpdateInfo = info
                    if (info.hasUpdate) {
                        cardUpdateBanner.visibility = View.VISIBLE
                        tvUpdateBannerTitle.text = "Versi Baru Tersedia (${info.latestVersionName})"
                        tvUpdateBannerDesc.text = "Tekan untuk memperbarui otomatis sekarang"
                        tvUpdateStatusText.text = "🎉 Versi baru ${info.latestVersionName} tersedia!"

                        if (!silent) {
                            promptUpdateDialog(info)
                        }
                    } else {
                        cardUpdateBanner.visibility = View.GONE
                        tvUpdateStatusText.text = "✅ Aplikasi sudah dalam versi terbaru (${info.latestVersionName})."
                        if (!silent) {
                            Toast.makeText(this, "Aplikasi sudah dalam versi terbaru!", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else {
                    if (!silent) {
                        tvUpdateStatusText.text = "⚠️ Gagal cek update: $error"
                        Toast.makeText(this, "Gagal memeriksa pembaruan: $error", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun promptUpdateDialog(info: UpdateInfo) {
        val message = "Versi Terbaru: ${info.latestVersionName}\n\nCatatan Rilis:\n${info.releaseNotes}\n\nApakah Anda ingin mengunduh dan memasang pembaruan sekarang?"
        AlertDialog.Builder(this)
            .setTitle("🚀 Pembaruan Aplikasi Tersedia")
            .setMessage(message)
            .setPositiveButton("Perbarui Sekarang") { _, _ ->
                startDownload(info)
            }
            .setNegativeButton("Nanti", null)
            .show()
    }

    private fun startDownload(info: UpdateInfo) {
        layoutUpdateProgress.visibility = View.VISIBLE
        progressBarUpdate.progress = 0
        tvUpdatePercent.text = "0%"
        btnCheckUpdate.isEnabled = false
        btnCheckUpdate.text = "Mengunduh..."
        tvUpdateStatusText.text = "Mengunduh file pembaruan ${info.latestVersionName}..."

        AppUpdateManager.downloadApk(
            context = this,
            downloadUrl = info.downloadUrl,
            onProgress = { progress ->
                runOnUiThread {
                    progressBarUpdate.progress = progress
                    tvUpdatePercent.text = "$progress%"
                }
            },
            onComplete = { apkFile ->
                runOnUiThread {
                    layoutUpdateProgress.visibility = View.GONE
                    btnCheckUpdate.isEnabled = true
                    btnCheckUpdate.text = "🔄 Cek & Pasang Pembaruan"
                    tvUpdateStatusText.text = "✅ Unduhan selesai! Membuka pemasang paket..."

                    // Launch installer
                    AppUpdateManager.installApk(this, apkFile)
                }
            },
            onError = { errMsg ->
                runOnUiThread {
                    layoutUpdateProgress.visibility = View.GONE
                    btnCheckUpdate.isEnabled = true
                    btnCheckUpdate.text = "🔄 Cek & Pasang Pembaruan"
                    tvUpdateStatusText.text = "❌ Gagal mengunduh: $errMsg"
                    Toast.makeText(this, "Gagal mengunduh pembaruan: $errMsg", Toast.LENGTH_LONG).show()
                }
            }
        )
    }
}
