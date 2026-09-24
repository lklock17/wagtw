package com.wagtw.agent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.wagtw.agent.service.AgentForegroundService
import com.wagtw.agent.service.WhatsAppAccessibilityService
import com.wagtw.agent.util.PrefsManager

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: PrefsManager
    private lateinit var etServerUrl: EditText
    private lateinit var etDeviceName: EditText
    private lateinit var etPhoneNumber: EditText
    private lateinit var tvStatusBadge: TextView
    private lateinit var btnToggleConnect: Button
    private lateinit var btnPermissionNotif: Button
    private lateinit var btnPermissionAccessibility: Button
    private lateinit var btnPermissionBattery: Button
    private lateinit var tvLogs: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = PrefsManager(this)

        initViews()
        loadSavedConfig()
        checkPermissions()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        checkPermissions()
    }

    private fun initViews() {
        etServerUrl = findViewById(R.id.etServerUrl)
        etDeviceName = findViewById(R.id.etDeviceName)
        etPhoneNumber = findViewById(R.id.etPhoneNumber)
        tvStatusBadge = findViewById(R.id.tvStatusBadge)
        btnToggleConnect = findViewById(R.id.btnToggleConnect)
        btnPermissionNotif = findViewById(R.id.btnPermissionNotif)
        btnPermissionAccessibility = findViewById(R.id.btnPermissionAccessibility)
        btnPermissionBattery = findViewById(R.id.btnPermissionBattery)
        tvLogs = findViewById(R.id.tvLogs)
    }

    private fun loadSavedConfig() {
        etServerUrl.setText(prefs.serverUrl)
        etDeviceName.setText(prefs.deviceName)
        etPhoneNumber.setText(prefs.phoneNumber)
        updateStatus(prefs.isServiceRunning)
    }

    private fun saveConfig() {
        prefs.serverUrl = etServerUrl.text.toString().trim()
        prefs.deviceName = etDeviceName.text.toString().trim()
        prefs.phoneNumber = etPhoneNumber.text.toString().trim()
    }

    private fun setupListeners() {
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

        btnToggleConnect.setOnClickListener {
            saveConfig()

            if (prefs.isServiceRunning) {
                stopAgentService()
            } else {
                startAgentService()
            }
        }

        AgentForegroundService.onLogReceived = { logText ->
            runOnUiThread {
                tvLogs.append("$logText\n")
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
        Toast.makeText(this, "Layanan WAGTW Agent Aktif!", Toast.LENGTH_SHORT).show()
    }

    private fun stopAgentService() {
        val intent = Intent(this, AgentForegroundService::class.java)
        stopService(intent)
        prefs.isServiceRunning = false
        updateStatus(false)
        Toast.makeText(this, "Layanan Dimatikan.", Toast.LENGTH_SHORT).show()
    }

    private fun updateStatus(isOnline: Boolean) {
        if (isOnline) {
            tvStatusBadge.text = "Aktif (Online)"
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_green))
            btnToggleConnect.text = "Hentikan Layanan Agen"
            btnToggleConnect.backgroundTintList = ContextCompat.getColorStateList(this, R.color.status_red)
        } else {
            tvStatusBadge.text = "Terputus"
            tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_red))
            btnToggleConnect.text = "Mulai Layanan Agen"
            btnToggleConnect.backgroundTintList = ContextCompat.getColorStateList(this, R.color.primary)
        }
    }

    private fun checkPermissions() {
        // 1. Notification Listener Permission
        val isNotifEnabled = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        if (isNotifEnabled) {
            btnPermissionNotif.text = "Aktif ✓"
            btnPermissionNotif.isEnabled = false
        } else {
            btnPermissionNotif.text = "Beri Izin"
            btnPermissionNotif.isEnabled = true
        }

        // 2. Accessibility Permission
        val isAccessibilityEnabled = isAccessibilityServiceEnabled()
        if (isAccessibilityEnabled) {
            btnPermissionAccessibility.text = "Aktif ✓"
            btnPermissionAccessibility.isEnabled = false
        } else {
            btnPermissionAccessibility.text = "Beri Izin"
            btnPermissionAccessibility.isEnabled = true
        }

        // 3. Battery Optimization
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBattery = pm.isIgnoringBatteryOptimizations(packageName)
            if (isIgnoringBattery) {
                btnPermissionBattery.text = "Aktif ✓"
                btnPermissionBattery.isEnabled = false
            } else {
                btnPermissionBattery.text = "Beri Izin"
                btnPermissionBattery.isEnabled = true
            }
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedComponentName = "${packageName}/${WhatsAppAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
        return enabledServices.contains(expectedComponentName)
    }
}
