package com.pontomobile.tracking

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class BackgroundLocationTrackingModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BackgroundLocationTracking"

  @ReactMethod
  fun startTracking(config: ReadableMap, promise: Promise) {
    try {
      val baseUrl = config.getString("baseUrl") ?: BackgroundLocationTrackingService.DEFAULT_BASE_URL
      val serviceId = config.getString("serviceId") ?: ""
      val userId = config.getString("userId") ?: ""
      val accessToken = config.getString("accessToken") ?: ""
      val refreshToken = config.getString("refreshToken") ?: ""

      if (serviceId.isBlank() || userId.isBlank() || accessToken.isBlank() || refreshToken.isBlank()) {
        promise.reject("INVALID_CONFIG", "Configuração de rastreamento incompleta.")
        return
      }

      if (!hasLocationPermission()) {
        promise.reject("LOCATION_PERMISSION_MISSING", "Permissão de localização em segundo plano ausente.")
        return
      }

      BackgroundLocationTrackingStore.save(
        reactContext,
        baseUrl,
        accessToken,
        refreshToken,
        serviceId,
        userId,
      )

      val intent = Intent(reactContext, BackgroundLocationTrackingService::class.java).apply {
        action = BackgroundLocationTrackingService.ACTION_START
        putExtra(BackgroundLocationTrackingService.EXTRA_BASE_URL, baseUrl)
        putExtra(BackgroundLocationTrackingService.EXTRA_SERVICE_ID, serviceId)
        putExtra(BackgroundLocationTrackingService.EXTRA_USER_ID, userId)
        putExtra(BackgroundLocationTrackingService.EXTRA_ACCESS_TOKEN, accessToken)
        putExtra(BackgroundLocationTrackingService.EXTRA_REFRESH_TOKEN, refreshToken)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopTracking(promise: Promise) {
    try {
      BackgroundLocationTrackingStore.saveServiceId(reactContext, null)
      val intent = Intent(reactContext, BackgroundLocationTrackingService::class.java)
      reactContext.stopService(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun getStoredTokens(promise: Promise) {
    try {
      val tokens = BackgroundLocationTrackingStore.getTokens(reactContext)
      val map = Arguments.createMap()
      map.putString("accessToken", tokens.first)
      map.putString("refreshToken", tokens.second)
      map.putString("userId", BackgroundLocationTrackingStore.getUserId(reactContext))
      map.putString("serviceId", BackgroundLocationTrackingStore.getServiceId(reactContext))
      map.putString("lastSentAt", BackgroundLocationTrackingStore.getLastSentAt(reactContext))
      map.putDouble("updatedAtMs", BackgroundLocationTrackingStore.getTokensUpdatedAtMs(reactContext).toDouble())
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("TOKEN_READ_FAILED", error)
    }
  }

  private fun hasLocationPermission(): Boolean {
    val hasFine = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!hasFine) return false

    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED
  }
}
