package com.ikshanasolutions.disha.model

/**
 * Wrap any angle into [0, 360).
 * A non-finite sample (a broken sensor reading) becomes 0 instead of throwing
 * on the sensor thread and killing the process.
 */
fun normalizeDegrees(value: Double): Double {
    if (!value.isFinite()) return 0.0
    val wrapped = value % 360.0
    return if (wrapped < 0) wrapped + 360.0 else wrapped
}

/**
 * True heading = magnetic heading + declination.
 * Declination is signed: positive east, negative west.
 * If the correction is not a real number, the magnetic heading is kept.
 */
fun magneticToTrue(magneticHeading: Double, declinationEast: Double): Double {
    if (!magneticHeading.isFinite()) return 0.0
    if (!declinationEast.isFinite()) return normalizeDegrees(magneticHeading)
    return normalizeDegrees(magneticHeading + declinationEast)
}

/** Smallest signed difference `to - from`, in (-180, 180]. */
fun shortestDelta(from: Double, to: Double): Double {
    val delta = normalizeDegrees(to - from)
    return if (delta > 180.0) delta - 360.0 else delta
}
