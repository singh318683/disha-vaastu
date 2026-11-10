package com.ikshanasolutions.disha.model

/** Wrap any angle into [0, 360). */
fun normalizeDegrees(value: Double): Double {
    require(value.isFinite()) { "Angle must be a finite number." }
    val wrapped = value % 360.0
    return if (wrapped < 0) wrapped + 360.0 else wrapped
}

/**
 * True heading = magnetic heading + declination.
 * Declination is signed: positive east, negative west.
 */
fun magneticToTrue(magneticHeading: Double, declinationEast: Double): Double {
    return normalizeDegrees(magneticHeading + declinationEast)
}

/** Smallest signed difference `to - from`, in (-180, 180]. */
fun shortestDelta(from: Double, to: Double): Double {
    val delta = normalizeDegrees(to - from)
    return if (delta > 180.0) delta - 360.0 else delta
}
