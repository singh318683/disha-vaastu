package com.ikshanasolutions.disha.model

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.sin

/**
 * Axis values matching [android.hardware.SensorManager]. Duplicated here so the
 * display-rotation table can be unit-tested without an Android runtime.
 * AXIS_MINUS_* is the positive axis OR 0x80.
 */
object DisplayAxis {
    const val X = 1
    const val Y = 2
    const val MINUS_X = 129
    const val MINUS_Y = 130

    const val ROTATION_0 = 0
    const val ROTATION_90 = 1
    const val ROTATION_180 = 2
    const val ROTATION_270 = 3
}

/**
 * Axes passed to SensorManager.remapCoordinateSystem so the top of the screen,
 * not the phone's natural earpiece, is the heading reference.
 */
fun axesForDisplayRotation(rotation: Int): Pair<Int, Int> {
    return when (rotation) {
        DisplayAxis.ROTATION_90 -> DisplayAxis.Y to DisplayAxis.MINUS_X
        DisplayAxis.ROTATION_180 -> DisplayAxis.MINUS_X to DisplayAxis.MINUS_Y
        DisplayAxis.ROTATION_270 -> DisplayAxis.MINUS_Y to DisplayAxis.X
        else -> DisplayAxis.X to DisplayAxis.Y
    }
}

/**
 * Azimuth from SensorManager.getOrientation, in radians.
 *
 * 0 is north and +π/2 is east: the angle grows clockwise. An earlier web bug
 * subtracted that from 360 on Android, which mirrored the dial and swapped
 * east with west. This conversion does not mirror.
 */
fun headingDegreesFromAzimuthRadians(azimuthRadians: Double): Double {
    return normalizeDegrees(Math.toDegrees(azimuthRadians))
}

/** Drag point on the dial. Up is north, right is east. Clockwise. */
fun headingFromDialPoint(dx: Double, dy: Double): Double {
    return normalizeDegrees(Math.toDegrees(atan2(dx, -dy)))
}

data class CircularSmooth(val x: Double, val y: Double)

/**
 * Low-pass on the unit circle. A step from 359° to 1° stays near north
 * instead of spinning through south.
 */
fun smoothHeading(
    state: CircularSmooth?,
    heading: Double,
    dtMs: Double,
    tauMs: Double = 140.0,
): Pair<CircularSmooth, Double> {
    val norm = normalizeDegrees(heading)
    val rad = Math.toRadians(norm)
    val x = cos(rad)
    val y = sin(rad)
    if (state == null || dtMs <= 0.0) {
        return CircularSmooth(x, y) to norm
    }
    val gain = 1.0 - exp(-dtMs / tauMs)
    val nextX = state.x + (x - state.x) * gain
    val nextY = state.y + (y - state.y) * gain
    val magnitude = hypot(nextX, nextY)
    if (magnitude < 1e-6) return CircularSmooth(x, y) to norm
    return CircularSmooth(nextX / magnitude, nextY / magnitude) to
        normalizeDegrees(Math.toDegrees(atan2(nextY, nextX)))
}

/** Mean on the circle. Samples around 0° average to north, not to south. */
fun circularMean(samples: List<Double>): Double? {
    if (samples.isEmpty()) return null
    var x = 0.0
    var y = 0.0
    for (sample in samples) {
        val rad = Math.toRadians(sample)
        x += cos(rad)
        y += sin(rad)
    }
    if (x * x + y * y < 1e-8) return null
    return normalizeDegrees(Math.toDegrees(atan2(y, x)))
}

data class HeadingSample(val timeMs: Long, val heading: Double)

/** Average of samples in the last [windowMs]. Empty windows return null. */
fun averageRecentHeading(
    samples: List<HeadingSample>,
    nowMs: Long,
    windowMs: Long = 1_000L,
): Double? {
    val recent = samples.filter { sample ->
        val age = nowMs - sample.timeMs
        age in 0..windowMs
    }
    return circularMean(recent.map { it.heading })
}

/** Hand-held "flat" is looser than a phone lying on a table. About 40°. */
fun phoneIsFlat(pitchRadians: Double, rollRadians: Double, limitDegrees: Double = 40.0): Boolean {
    val pitch = Math.toDegrees(pitchRadians)
    val roll = Math.toDegrees(rollRadians)
    return hypot(pitch, roll) < limitDegrees
}

/** SENSOR_STATUS_UNRELIABLE = 0, SENSOR_STATUS_ACCURACY_LOW = 1. */
fun accuracyNeedsCalibration(accuracy: Int): Boolean = accuracy == 0 || accuracy == 1
