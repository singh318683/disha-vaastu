package com.ikshanasolutions.disha.compass

import com.ikshanasolutions.disha.model.CircularSmooth
import com.ikshanasolutions.disha.model.HeadingSample
import com.ikshanasolutions.disha.model.accuracyNeedsCalibration
import com.ikshanasolutions.disha.model.averageRecentHeading
import com.ikshanasolutions.disha.model.magneticToTrue
import com.ikshanasolutions.disha.model.normalizeDegrees
import com.ikshanasolutions.disha.model.phoneIsFlat
import com.ikshanasolutions.disha.model.smoothHeading

data class CompassSnapshot(
    val displayHeading: Double = 0.0,
    val hasHeading: Boolean = false,
    val live: Boolean = false,
    val manual: Boolean = false,
    val trueNorth: Boolean = false,
    val needsCalibration: Boolean = false,
    val flat: Boolean = true,
    val noSensor: Boolean = false,
    val waiting: Boolean = true,
)

/**
 * Turns magnetic fixes into the heading shown on the dial.
 * The dial is smoothed. Lock averages the raw fixes from the last second.
 */
class CompassPipeline {
    private var smooth: CircularSmooth? = null
    private var lastSmoothMs: Long? = null
    private val samples = ArrayDeque<HeadingSample>()
    private var manual = false
    private var noSensor = false
    private var hasSensorFix = false
    var snapshot = CompassSnapshot()
        private set

    fun markNoSensor() {
        noSensor = true
        if (!snapshot.hasHeading) {
            setManual(0.0, 0L)
        } else {
            snapshot = snapshot.copy(noSensor = true, live = false, waiting = false, manual = true)
        }
    }

    fun onSensor(
        magneticDegrees: Double,
        pitchRadians: Double,
        rollRadians: Double,
        accuracy: Int,
        nowMs: Long,
        declinationEast: Double?,
    ) {
        if (noSensor) return
        hasSensorFix = true
        val resolved = resolve(magneticDegrees, declinationEast)
        samples.addLast(HeadingSample(nowMs, resolved))
        while (samples.size > 80) samples.removeFirst()
        val dt = lastSmoothMs?.let { (nowMs - it).toDouble() } ?: 0.0
        val (next, smoothed) = smoothHeading(smooth, resolved, dt)
        smooth = next
        lastSmoothMs = nowMs
        val flat = phoneIsFlat(pitchRadians, rollRadians)
        val calibrate = accuracyNeedsCalibration(accuracy)
        if (!manual) {
            snapshot = CompassSnapshot(
                displayHeading = smoothed,
                hasHeading = true,
                live = true,
                manual = false,
                trueNorth = declinationEast != null,
                needsCalibration = calibrate,
                flat = flat,
                noSensor = false,
                waiting = false,
            )
        } else {
            snapshot = snapshot.copy(
                live = true,
                trueNorth = false,
                needsCalibration = false,
                flat = flat,
                noSensor = false,
                waiting = false,
            )
        }
    }

    fun setManual(heading: Double, nowMs: Long) {
        manual = true
        val value = normalizeDegrees(heading)
        samples.clear()
        samples.addLast(HeadingSample(nowMs, value))
        smooth = null
        lastSmoothMs = null
        snapshot = CompassSnapshot(
            displayHeading = value,
            hasHeading = true,
            live = hasSensorFix && !noSensor,
            manual = true,
            trueNorth = false,
            needsCalibration = false,
            flat = true,
            noSensor = noSensor,
            waiting = false,
        )
    }

    fun followLive(nowMs: Long) {
        if (noSensor || !hasSensorFix) return
        manual = false
        smooth = null
        lastSmoothMs = nowMs
    }

    /** Circular mean of the last second. Falls back to the heading on screen. */
    fun lock(nowMs: Long): Double? {
        if (!snapshot.hasHeading) return null
        val averaged = averageRecentHeading(samples.toList(), nowMs, 1_000L)
        return averaged ?: snapshot.displayHeading
    }

    private fun resolve(magneticDegrees: Double, declinationEast: Double?): Double {
        val magnetic = normalizeDegrees(magneticDegrees)
        return if (declinationEast != null && declinationEast.isFinite()) {
            magneticToTrue(magnetic, declinationEast)
        } else {
            magnetic
        }
    }
}
