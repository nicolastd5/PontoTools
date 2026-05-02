package com.pontomobile.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.pontomobile.R
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class BackgroundLocationTrackingService : Service(), LocationListener {
  private val handler = Handler(Looper.getMainLooper())
  private var locationManager: LocationManager? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var accessToken: String? = null
  private var refreshToken: String? = null
  private var baseUrl: String = DEFAULT_BASE_URL
  private var serviceId: String? = null
  private var userId: String? = null
  private var lastLocation: Location? = null
  private var lastSentLocation: Location? = null
  private var lastSentAtMs: Long = 0L
  private var isTracking = false
  @Volatile private var sendInFlight = false
  @Volatile private var refreshInFlight = false

  private val heartbeatRunnable = object : Runnable {
    override fun run() {
      if (!isTracking) return
      refreshEligibleService()
      lastLocation?.let { sendLocation(it, force = true) }
      handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopTracking()
      return START_NOT_STICKY
    }

    val previousServiceId = serviceId
    loadConfig(intent)
    val serviceChanged = !previousServiceId.isNullOrBlank() && previousServiceId != serviceId
    if (serviceChanged) {
      lastSentLocation = null
      lastSentAtMs = 0L
    }

    if (serviceId.isNullOrBlank() || accessToken.isNullOrBlank() || refreshToken.isNullOrBlank()) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForegroundNotification()
    startTracking()
    if (serviceChanged) {
      lastLocation?.let { sendLocation(it, force = true) }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopTracking()
    super.onDestroy()
  }

  override fun onLocationChanged(location: Location) {
    lastLocation = location
    sendLocation(location, force = false)
  }

  @Deprecated("Deprecated in Java")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  override fun onProviderEnabled(provider: String) = Unit

  override fun onProviderDisabled(provider: String) = Unit

  private fun loadConfig(intent: Intent?) {
    baseUrl = intent?.getStringExtra(EXTRA_BASE_URL)
      ?: BackgroundLocationTrackingStore.getBaseUrl(this)
    accessToken = intent?.getStringExtra(EXTRA_ACCESS_TOKEN)
      ?: BackgroundLocationTrackingStore.getTokens(this).first
    refreshToken = intent?.getStringExtra(EXTRA_REFRESH_TOKEN)
      ?: BackgroundLocationTrackingStore.getTokens(this).second
    serviceId = intent?.getStringExtra(EXTRA_SERVICE_ID)
      ?: BackgroundLocationTrackingStore.getServiceId(this)
    userId = intent?.getStringExtra(EXTRA_USER_ID)
      ?: BackgroundLocationTrackingStore.getUserId(this)
  }

  private fun startForegroundNotification() {
    val channelId = "service_location_tracking"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Rastreamento de servico",
        NotificationManager.IMPORTANCE_LOW,
      )
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }

    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("PontoTools")
      .setContentText("Rastreamento ativo enquanto houver servico pendente ou em andamento.")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun startTracking() {
    if (isTracking) return
    if (!hasLocationPermission()) {
      stopSelf()
      return
    }

    isTracking = true
    acquireWakeLock()

    try {
      requestProvider(LocationManager.GPS_PROVIDER)
      requestProvider(LocationManager.NETWORK_PROVIDER)
      primeLastKnownLocation(LocationManager.GPS_PROVIDER)
      primeLastKnownLocation(LocationManager.NETWORK_PROVIDER)
    } catch (error: SecurityException) {
      Log.w(TAG, "Permissao de localizacao ausente.", error)
      stopSelf()
      return
    }

    refreshEligibleService()
    handler.post(heartbeatRunnable)
  }

  private fun stopTracking() {
    isTracking = false
    handler.removeCallbacksAndMessages(null)
    try {
      locationManager?.removeUpdates(this)
    } catch (_: SecurityException) {
    }
    wakeLock?.let {
      if (it.isHeld) it.release()
    }
    wakeLock = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun requestProvider(provider: String) {
    if (locationManager?.isProviderEnabled(provider) != true) return
    locationManager?.requestLocationUpdates(
      provider,
      MIN_SEND_INTERVAL_MS,
      MIN_DISTANCE_METERS,
      this,
      Looper.getMainLooper(),
    )
  }

  private fun primeLastKnownLocation(provider: String) {
    if (locationManager?.isProviderEnabled(provider) != true) return
    val location = locationManager?.getLastKnownLocation(provider) ?: return
    lastLocation = betterLocation(lastLocation, location)
    lastLocation?.let { sendLocation(it, force = false) }
  }

  private fun betterLocation(current: Location?, candidate: Location): Location {
    if (current == null) return candidate
    return if (candidate.time >= current.time) candidate else current
  }

  private fun sendLocation(location: Location, force: Boolean) {
    val currentServiceId = serviceId ?: return
    if (!force && !shouldSend(location, currentServiceId)) return
    if (sendInFlight) return
    sendInFlight = true

    Thread {
      try {
        val body = JSONObject()
          .put("service_order_id", currentServiceId)
          .put("latitude", location.latitude)
          .put("longitude", location.longitude)
          .put("accuracy_meters", if (location.hasAccuracy()) location.accuracy.toDouble() else JSONObject.NULL)
          .put("source", "mobile")
          .put("recorded_at", isoNow())

        val response = authorizedRequest("POST", "/api/service-tracking/location", body)
        if (response.first in 200..299) {
          lastSentLocation = location
          lastSentAtMs = System.currentTimeMillis()
        } else if (response.first == 403) {
          refreshEligibleService()
        }
      } finally {
        sendInFlight = false
      }
    }.start()
  }

  private fun shouldSend(location: Location, currentServiceId: String): Boolean {
    val previous = lastSentLocation ?: return true
    val elapsed = System.currentTimeMillis() - lastSentAtMs
    if (elapsed >= HEARTBEAT_INTERVAL_MS) return true
    if (elapsed < MIN_SEND_INTERVAL_MS) return false
    if (currentServiceId != serviceId) return true
    return previous.distanceTo(location) >= MIN_DISTANCE_METERS
  }

  private fun refreshEligibleService() {
    if (refreshInFlight) return
    refreshInFlight = true

    Thread {
      try {
        val response = authorizedRequest("GET", "/api/services", null)
        if (response.first == 401) {
          stopSelf()
          return@Thread
        }
        if (response.first !in 200..299) return@Thread
        if (response.second.isNullOrBlank()) return@Thread

        val nextServiceId = pickEligibleServiceId(response.second!!)
        if (nextServiceId.isNullOrBlank()) {
          BackgroundLocationTrackingStore.saveServiceId(this, null)
          stopSelf()
          return@Thread
        }

        if (nextServiceId != serviceId) {
          serviceId = nextServiceId
          BackgroundLocationTrackingStore.saveServiceId(this, nextServiceId)
          lastSentLocation = null
          lastSentAtMs = 0L
          lastLocation?.let { sendLocation(it, force = true) }
        }
      } finally {
        refreshInFlight = false
      }
    }.start()
  }

  private fun pickEligibleServiceId(json: String): String? {
    val services = JSONObject(json).optJSONArray("services") ?: return null
    var pendingId: String? = null

    for (index in 0 until services.length()) {
      val service = services.optJSONObject(index) ?: continue
      val status = service.optString("status")
      val id = service.opt("id")?.toString() ?: continue
      if (status == "in_progress") return id
      if (status == "pending" && pendingId == null) pendingId = id
    }

    return pendingId
  }

  private fun authorizedRequest(
    method: String,
    path: String,
    body: JSONObject?,
    retry: Boolean = true,
  ): Pair<Int, String?> {
    val token = accessToken ?: return Pair(401, null)
    val response = request(method, path, body, token)
    if (response.first != 401 || !retry) return response
    if (!refreshAuth()) return response
    return request(method, path, body, accessToken)
  }

  private fun request(
    method: String,
    path: String,
    body: JSONObject?,
    bearerToken: String?,
  ): Pair<Int, String?> {
    val url = URL(baseUrl.trimEnd('/') + path)
    val connection = (url.openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = NETWORK_TIMEOUT_MS
      readTimeout = NETWORK_TIMEOUT_MS
      setRequestProperty("Accept", "application/json")
      setRequestProperty("X-Client-Type", "mobile")
      bearerToken?.let { setRequestProperty("Authorization", "Bearer $it") }
      if (body != null) {
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }
    }

    return try {
      if (body != null) {
        OutputStreamWriter(connection.outputStream).use { writer ->
          writer.write(body.toString())
        }
      }

      val status = connection.responseCode
      val stream = if (status in 200..399) connection.inputStream else connection.errorStream
      val text = stream?.bufferedReader()?.use { it.readText() }
      Pair(status, text)
    } catch (error: Exception) {
      Log.w(TAG, "Falha na requisicao de rastreamento.", error)
      Pair(0, null)
    } finally {
      connection.disconnect()
    }
  }

  private fun refreshAuth(): Boolean {
    val currentRefresh = refreshToken ?: return false
    val body = JSONObject().put("refreshToken", currentRefresh)
    val response = request("POST", "/api/auth/refresh", body, null)
    if (response.first !in 200..299 || response.second.isNullOrBlank()) return false

    val json = JSONObject(response.second!!)
    val newAccess = json.optString("accessToken", "")
    val newRefresh = json.optString("refreshToken", "")
    if (newAccess.isBlank() || newRefresh.isBlank()) return false

    accessToken = newAccess
    refreshToken = newRefresh
    BackgroundLocationTrackingStore.saveTokens(this, newAccess, newRefresh)
    return true
  }

  private fun hasLocationPermission(): Boolean {
    val hasFine = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!hasFine) return false

    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        this,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "PontoTools:BackgroundLocationTracking",
    ).apply {
      setReferenceCounted(false)
      acquire(WAKE_LOCK_TIMEOUT_MS)
    }
  }

  private fun isoNow(): String {
    val now = java.time.Instant.ofEpochMilli(System.currentTimeMillis())
    return now.toString()
  }

  companion object {
    const val ACTION_START = "com.pontomobile.tracking.START"
    const val ACTION_STOP = "com.pontomobile.tracking.STOP"
    const val EXTRA_BASE_URL = "baseUrl"
    const val EXTRA_SERVICE_ID = "serviceId"
    const val EXTRA_USER_ID = "userId"
    const val EXTRA_ACCESS_TOKEN = "accessToken"
    const val EXTRA_REFRESH_TOKEN = "refreshToken"
    const val DEFAULT_BASE_URL = "https://pontotools.shop"

    private const val TAG = "PontoTrackingService"
    private const val NOTIFICATION_ID = 2401
    private const val MIN_SEND_INTERVAL_MS = 5000L
    private const val HEARTBEAT_INTERVAL_MS = 30000L
    private const val MIN_DISTANCE_METERS = 5f
    private const val NETWORK_TIMEOUT_MS = 15000
    private const val WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L
  }
}
