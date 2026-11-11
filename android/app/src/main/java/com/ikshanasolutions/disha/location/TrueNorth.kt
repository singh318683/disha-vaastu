package com.ikshanasolutions.disha.location

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.GeomagneticField
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Granularity
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import android.Manifest

/**
 * Coarse location, used only to turn magnetic north into true north with
 * [GeomagneticField]. The compass itself does not ask for a permission.
 * Fused location is used when Play services are present. Otherwise the
 * platform [LocationManager] last-known fix is used.
 */
class TrueNorthController(
    context: Context,
    private val onFix: (latitude: Double, longitude: Double, declinationEast: Double) -> Unit,
) {
    private val appContext = context.applicationContext
    private var fused: FusedLocationProviderClient? = null
    private var callback: LocationCallback? = null
    private var manager: LocationManager? = null
    private val listener = LocationListener { location ->
        publish(location)
        stopManager()
    }

    fun fetch() {
        if (!hasCoarsePermission()) return
        try {
            if (playServices()) {
                fetchFused()
            } else {
                fetchManager()
            }
        } catch (_: SecurityException) {
            fetchManager()
        } catch (_: RuntimeException) {
            // Play services can throw if the library is present but the device has no GMS.
        }
    }

    fun stop() {
        try {
            callback?.let { active -> fused?.removeLocationUpdates(active) }
        } catch (_: RuntimeException) {
        }
        callback = null
        stopManager()
    }

    private fun playServices(): Boolean {
        return try {
            GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(appContext) == ConnectionResult.SUCCESS
        } catch (_: Throwable) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    private fun fetchFused() {
        if (!hasCoarsePermission()) return
        val client = try {
            LocationServices.getFusedLocationProviderClient(appContext)
        } catch (_: Throwable) {
            fetchManager()
            return
        }
        fused = client
        try {
            client.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) publish(location) else requestOne(client)
                }
                .addOnFailureListener { fetchManager() }
        } catch (_: SecurityException) {
            fetchManager()
        } catch (_: RuntimeException) {
            fetchManager()
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestOne(client: FusedLocationProviderClient) {
        if (!hasCoarsePermission()) return
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10_000L)
            .setMaxUpdates(1)
            .setGranularity(Granularity.GRANULARITY_COARSE)
            .build()
        val updates = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { publish(it) }
                client.removeLocationUpdates(this)
            }
        }
        callback = updates
        try {
            client.requestLocationUpdates(request, updates, Looper.getMainLooper())
        } catch (_: SecurityException) {
            fetchManager()
        } catch (_: RuntimeException) {
            fetchManager()
        }
    }

    @SuppressLint("MissingPermission")
    private fun fetchManager() {
        if (!hasCoarsePermission()) return
        val locationManager = appContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        manager = locationManager
        val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
        var best: Location? = null
        for (provider in providers) {
            val enabled = runCatching { locationManager.isProviderEnabled(provider) }.getOrDefault(false)
            if (!enabled) continue
            val known = runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
            if (known != null && (best == null || known.time > best.time)) best = known
        }
        if (best != null) {
            publish(best)
            return
        }
        val provider = providers.firstOrNull { name ->
            runCatching { locationManager.isProviderEnabled(name) }.getOrDefault(false)
        } ?: return
        runCatching {
            locationManager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
        }
    }

    private fun stopManager() {
        val locationManager = manager ?: return
        runCatching { locationManager.removeUpdates(listener) }
        manager = null
    }

    private fun publish(location: Location) {
        val latitude = location.latitude
        val longitude = location.longitude
        if (!latitude.isFinite() || !longitude.isFinite()) return
        val declination = try {
            GeomagneticField(
                latitude.toFloat(),
                longitude.toFloat(),
                location.altitude.toFloat(),
                System.currentTimeMillis(),
            ).declination.toDouble()
        } catch (_: RuntimeException) {
            return
        }
        if (!declination.isFinite()) return
        onFix(latitude, longitude, declination)
    }

    private fun hasCoarsePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    }
}
