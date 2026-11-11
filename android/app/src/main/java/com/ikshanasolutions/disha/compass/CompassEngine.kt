package com.ikshanasolutions.disha.compass

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import com.ikshanasolutions.disha.model.axesForDisplayRotation
import com.ikshanasolutions.disha.model.headingDegreesFromAzimuthRadians

/**
 * Magnetic heading from the rotation vector, then the geomagnetic rotation
 * vector, then accelerometer + magnetometer. No permission is required.
 *
 * Azimuth is taken clockwise (0 north, 90 east). Display rotation is removed
 * with remapCoordinateSystem so the top of the screen is what the person aims.
 */
class CompassEngine(
    context: Context,
    private val rotation: () -> Int,
    private val onFix: (magneticDegrees: Double, pitch: Double, roll: Double, accuracy: Int) -> Unit,
    private val onMissing: () -> Unit,
) : SensorEventListener {
    private val sensorManager = context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val rotationVector = sensor(Sensor.TYPE_ROTATION_VECTOR)
    private val geomagnetic = sensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)
    private val accelerometer = sensor(Sensor.TYPE_ACCELEROMETER)
    private val magnetometer = sensor(Sensor.TYPE_MAGNETIC_FIELD)

    private val rotationMatrix = FloatArray(9)
    private val remapped = FloatArray(9)
    private val orientation = FloatArray(3)
    private val gravity = FloatArray(3)
    private val magnetic = FloatArray(3)
    private var haveGravity = false
    private var haveMagnetic = false
    private var accuracy = SensorManager.SENSOR_STATUS_ACCURACY_HIGH
    private var running = false

    fun start() {
        if (running) return
        running = true
        haveGravity = false
        haveMagnetic = false
        val manager = sensorManager
        val registered = try {
            when {
                manager == null -> false
                rotationVector != null -> {
                    manager.registerListener(this, rotationVector, SensorManager.SENSOR_DELAY_GAME)
                }
                geomagnetic != null -> {
                    manager.registerListener(this, geomagnetic, SensorManager.SENSOR_DELAY_GAME)
                }
                accelerometer != null && magnetometer != null -> {
                    val accelOk = manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
                    val magOk = manager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME)
                    accelOk && magOk
                }
                else -> false
            }
        } catch (_: RuntimeException) {
            false
        }
        if (!registered) {
            running = false
            onMissing()
        }
    }

    fun stop() {
        if (!running) return
        sensorManager?.unregisterListener(this)
        running = false
    }

    override fun onAccuracyChanged(sensor: Sensor?, value: Int) {
        if (sensor == null) return
        if (
            sensor.type == Sensor.TYPE_ROTATION_VECTOR ||
            sensor.type == Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR ||
            sensor.type == Sensor.TYPE_MAGNETIC_FIELD
        ) {
            accuracy = value
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        try {
            when (event.sensor?.type) {
                Sensor.TYPE_ROTATION_VECTOR, Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR -> {
                    val values = event.values ?: return
                    if (values.size < 3) return
                    val vector = if (values.size > 4) values.copyOf(4) else values.copyOf()
                    SensorManager.getRotationMatrixFromVector(rotationMatrix, vector)
                }
                Sensor.TYPE_ACCELEROMETER -> {
                    if (event.values == null || event.values.size < 3) return
                    System.arraycopy(event.values, 0, gravity, 0, 3)
                    haveGravity = true
                    if (!haveMagnetic) return
                    if (!SensorManager.getRotationMatrix(rotationMatrix, null, gravity, magnetic)) return
                }
                Sensor.TYPE_MAGNETIC_FIELD -> {
                    if (event.values == null || event.values.size < 3) return
                    System.arraycopy(event.values, 0, magnetic, 0, 3)
                    haveMagnetic = true
                    if (!haveGravity) return
                    if (!SensorManager.getRotationMatrix(rotationMatrix, null, gravity, magnetic)) return
                }
                else -> return
            }
            publish()
        } catch (_: RuntimeException) {
            // A short or non-finite rotation vector throws inside the platform helper.
        }
    }

    private fun sensor(type: Int): Sensor? {
        return try {
            sensorManager?.getDefaultSensor(type)
        } catch (_: RuntimeException) {
            null
        }
    }

    private fun publish() {
        val (axisX, axisY) = axesForDisplayRotation(rotation().takeIf { it in 0..3 } ?: Surface.ROTATION_0)
        val ok = SensorManager.remapCoordinateSystem(rotationMatrix, axisX, axisY, remapped)
        SensorManager.getOrientation(if (ok) remapped else rotationMatrix, orientation)
        val azimuth = orientation[0].toDouble()
        if (!azimuth.isFinite()) return
        val pitch = orientation[1].toDouble()
        val roll = orientation[2].toDouble()
        onFix(
            headingDegreesFromAzimuthRadians(azimuth),
            if (pitch.isFinite()) pitch else 0.0,
            if (roll.isFinite()) roll else 0.0,
            accuracy,
        )
    }
}
