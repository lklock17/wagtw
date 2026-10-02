package com.wagtw.agent.util

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

class PrefsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("wagtw_prefs", Context.MODE_PRIVATE)

    var phoneId: String
        get() {
            var id = prefs.getString("phone_id", "") ?: ""
            if (id.isEmpty()) {
                id = "phone_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)
                prefs.edit().putString("phone_id", id).apply()
            }
            return id
        }
        set(value) = prefs.edit().putString("phone_id", value).apply()

    var serverUrl: String
        get() = prefs.getString("server_url", "http://16.78.121.191") ?: "http://16.78.121.191"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", "HP Agen 1") ?: "HP Agen 1"
        set(value) = prefs.edit().putString("device_name", value).apply()

    // Business Number - Slot 1 (Utama)
    var businessPhone: String
        get() = prefs.getString("business_phone", prefs.getString("phone_number", "") ?: "") ?: ""
        set(value) = prefs.edit().putString("business_phone", value).apply()

    var isBusinessEnabled: Boolean
        get() = prefs.getBoolean("is_business_enabled", true)
        set(value) = prefs.edit().putBoolean("is_business_enabled", value).apply()

    var businessDeviceId: String
        get() = prefs.getString("business_device_id", "") ?: ""
        set(value) = prefs.edit().putString("business_device_id", value).apply()

    // Business Number - Slot 2 (Dual App / Kloning)
    var businessPhone2: String
        get() = prefs.getString("business_phone_2", "") ?: ""
        set(value) = prefs.edit().putString("business_phone_2", value).apply()

    var isBusiness2Enabled: Boolean
        get() = prefs.getBoolean("is_business_2_enabled", false)
        set(value) = prefs.edit().putBoolean("is_business_2_enabled", value).apply()

    var businessDeviceId2: String
        get() = prefs.getString("business_device_id_2", "") ?: ""
        set(value) = prefs.edit().putString("business_device_id_2", value).apply()

    // Personal Number - Slot 1 (Utama)
    var personalPhone: String
        get() = prefs.getString("personal_phone", "") ?: ""
        set(value) = prefs.edit().putString("personal_phone", value).apply()

    var isPersonalEnabled: Boolean
        get() = prefs.getBoolean("is_personal_enabled", false)
        set(value) = prefs.edit().putBoolean("is_personal_enabled", value).apply()

    var personalDeviceId: String
        get() = prefs.getString("personal_device_id", "") ?: ""
        set(value) = prefs.edit().putString("personal_device_id", value).apply()

    // Personal Number - Slot 2 (Dual App / Kloning)
    var personalPhone2: String
        get() = prefs.getString("personal_phone_2", "") ?: ""
        set(value) = prefs.edit().putString("personal_phone_2", value).apply()

    var isPersonal2Enabled: Boolean
        get() = prefs.getBoolean("is_personal_2_enabled", false)
        set(value) = prefs.edit().putBoolean("is_personal_2_enabled", value).apply()

    var personalDeviceId2: String
        get() = prefs.getString("personal_device_id_2", "") ?: ""
        set(value) = prefs.edit().putString("personal_device_id_2", value).apply()

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

    // Xiaomi Dual App Settings ("OFF", "ACCOUNT_1", "ACCOUNT_2", "RANDOM", "ALTERNATING")
    var dualAppMode: String
        get() = prefs.getString("dual_app_mode", "OFF") ?: "OFF"
        set(value) = prefs.edit().putString("dual_app_mode", value).apply()

    var lastDualAppIndex: Int
        get() = prefs.getInt("last_dual_app_index", 0)
        set(value) = prefs.edit().putInt("last_dual_app_index", value).apply()
}
