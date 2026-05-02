package com.pontomobile.tracking

import android.content.Context

object BackgroundLocationTrackingStore {
  private const val PREFS = "pontotools_background_tracking"
  private const val KEY_BASE_URL = "base_url"
  private const val KEY_ACCESS_TOKEN = "access_token"
  private const val KEY_REFRESH_TOKEN = "refresh_token"
  private const val KEY_SERVICE_ID = "service_id"
  private const val KEY_USER_ID = "user_id"
  private const val KEY_TOKENS_UPDATED_AT_MS = "tokens_updated_at_ms"
  private const val KEY_LAST_SENT_AT = "last_sent_at"

  fun save(
    context: Context,
    baseUrl: String,
    accessToken: String,
    refreshToken: String,
    serviceId: String,
    userId: String,
  ) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_BASE_URL, baseUrl)
      .putString(KEY_ACCESS_TOKEN, accessToken)
      .putString(KEY_REFRESH_TOKEN, refreshToken)
      .putString(KEY_SERVICE_ID, serviceId)
      .putString(KEY_USER_ID, userId)
      .putLong(KEY_TOKENS_UPDATED_AT_MS, System.currentTimeMillis())
      .apply()
  }

  fun saveTokens(context: Context, accessToken: String, refreshToken: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ACCESS_TOKEN, accessToken)
      .putString(KEY_REFRESH_TOKEN, refreshToken)
      .putLong(KEY_TOKENS_UPDATED_AT_MS, System.currentTimeMillis())
      .apply()
  }

  fun saveServiceId(context: Context, serviceId: String?) {
    val editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_SERVICE_ID, serviceId)

    if (serviceId == null) {
      editor.remove(KEY_LAST_SENT_AT)
    }

    editor.apply()
  }

  fun saveLastSentAt(context: Context, lastSentAt: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_LAST_SENT_AT, lastSentAt)
      .apply()
  }

  fun getBaseUrl(context: Context): String =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_BASE_URL, BackgroundLocationTrackingService.DEFAULT_BASE_URL)
      ?: BackgroundLocationTrackingService.DEFAULT_BASE_URL

  fun getTokens(context: Context): Pair<String?, String?> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return Pair(
      prefs.getString(KEY_ACCESS_TOKEN, null),
      prefs.getString(KEY_REFRESH_TOKEN, null),
    )
  }

  fun getServiceId(context: Context): String? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_SERVICE_ID, null)

  fun getUserId(context: Context): String? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_USER_ID, null)

  fun getTokensUpdatedAtMs(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getLong(KEY_TOKENS_UPDATED_AT_MS, 0L)

  fun getLastSentAt(context: Context): String? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_LAST_SENT_AT, null)
}
