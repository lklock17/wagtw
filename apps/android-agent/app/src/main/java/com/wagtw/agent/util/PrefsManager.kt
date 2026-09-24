package com.wagtw.agent.util

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("wagtw_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "http://16.78.121.191:4010") ?: "http://16.78.121.191:4010"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", "HP Agen 1") ?: "HP Agen 1"
        set(value) = prefs.edit().putString("device_name", value).apply()

    var phoneNumber: String
        get() = prefs.getString("phone_number", "") ?: ""
        set(value) = prefs.edit().putString("phone_number", value).apply()

    var deviceId: String
        get() = prefs.getString("device_id", "") ?: ""
        set(value) = prefs.edit().putString("device_id", value).apply()

    var isServiceRunning: Boolean
        get() = prefs.getBoolean("is_service_running", false)
        set(value) = prefs.edit().putBoolean("is_service_running", value).apply()
}
