package com.ikshanasolutions.disha.model

import kotlin.math.floor

/**
 * Eight directions, 45° each, with North centered on 0°.
 * North owns [337.5°, 22.5°). The clockwise edge belongs to the next direction.
 */
val DIR8 = listOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")

fun directionFromHeading(heading: Double): String {
    val shifted = normalizeDegrees(heading + 22.5)
    val index = floor(shifted / 45.0).toInt() % DIR8.size
    return DIR8[index]
}

/** Sixteen zones of 22.5°, North centered on 0° ([348.75°, 11.25°)). */
val ZONE16 = listOf(
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
)

fun zoneFromBearing(bearing: Double): String {
    val shifted = normalizeDegrees(bearing + 11.25)
    val index = floor(shifted / 22.5).toInt() % ZONE16.size
    return ZONE16[index]
}

/**
 * Thirty-two entrance padas, each 11.25°, clockwise from the corners.
 *
 * East [45°, 135°) E1→E8, South [135°, 225°), West [225°, 315°),
 * North [315°, 45°) with N1 at the northwest corner. Intervals are half-open.
 * 0° and 360° are N5. 45° is E1. 90° is E5, 180° is S5, 270° is W5.
 */
const val PADA_WIDTH = 11.25
private val PADA_SIDES = listOf("E", "S", "W", "N")

fun padaFromHeading(heading: Double): String {
    val shifted = normalizeDegrees(heading - 45.0)
    val index = floor(shifted / PADA_WIDTH).toInt() % 32
    val side = PADA_SIDES[index / 8]
    val n = (index % 8) + 1
    return "$side$n"
}

fun padaSide(id: String): String? {
    if (id.length < 2) return null
    val side = id.substring(0, 1)
    if (side != "E" && side != "S" && side != "W" && side != "N") return null
    val number = id.substring(1).toIntOrNull() ?: return null
    if (number !in 1..8) return null
    return side
}

fun slotFromHeading(heading: Double, granularity: Int): String {
    return when (granularity) {
        8 -> directionFromHeading(heading)
        16 -> zoneFromBearing(heading)
        32 -> padaFromHeading(heading)
        else -> directionFromHeading(heading)
    }
}
