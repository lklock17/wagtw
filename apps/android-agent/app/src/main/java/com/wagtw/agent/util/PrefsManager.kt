package com.wagtw.agent.util

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("wagtw_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "http://16.78.121.191") ?: "http://16.78.121.191"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", "HP Agen 1") ?: "HP Agen 1"
        set(value) = prefs.edit().putString("device_name", value).apply()

    // Business Number
    var businessPhone: String
        get() = prefs.getString("business_phone", prefs.getString("phone_number", "") ?: "") ?: ""
        set(value) = prefs.edit().putString("business_phone", value).apply()

    var isBusinessEnabled: Boolean
        get() = prefs.getBoolean("is_business_enabled", true)
        set(value) = prefs.edit().putBoolean("is_business_enabled", value).apply()

    var businessDeviceId: String
        get() = prefs.getString("business_device_id", "") ?: ""
        set(value) = prefs.edit().putString("business_device_id", value).apply()

    // Personal Number
    var personalPhone: String
        get() = prefs.getString("personal_phone", "") ?: ""
        set(value) = prefs.edit().putString("personal_phone", value).apply()

    var isPersonalEnabled: Boolean
        get() = prefs.getBoolean("is_personal_enabled", false)
        set(value) = prefs.edit().putBoolean("is_personal_enabled", value).apply()

    var personalDeviceId: String
        get() = prefs.getString("personal_device_id", "") ?: ""
        set(value) = prefs.edit().putString("personal_device_id", value).apply()

    // Legacy / fallback
    var phoneNumber: String
        get() = businessPhone.ifEmpty { personalPhone }
        set(value) {
            businessPhone = value
        }

    var deviceId: String
        get() = businessDeviceId.ifEmpty { personalDeviceId }
        set(value) {
            businessDeviceId = value
        }

    var isServiceRunning: Boolean
        get() = prefs.getBoolean("is_service_running", false)
        set(value) = prefs.edit().putBoolean("is_service_running", value).apply()
}
