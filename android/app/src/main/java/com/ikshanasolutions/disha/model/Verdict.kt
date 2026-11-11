package com.ikshanasolutions.disha.model

data class QuizVerdict(
    val heading: Double,
    val slotId: String,
    val slotName: String,
    val rating: String,
    val meaning: String,
    val remedies: List<String>,
    val direction: String,
    val directionLabel: String,
    val facingLabel: String,
    val placementLine: String,
    val slotLine: String,
    val bestNote: String,
    val toward: String?,
)

fun directionLabel(id: String, locale: AppLocale, strings: StringTable): String {
    val key = "dir.$id"
    val value = strings.t(key, locale)
    return if (value == key) id else value
}

fun facingLabel(side: String, locale: AppLocale, strings: StringTable): String {
    val key = "facing.$side"
    val value = strings.t(key, locale)
    return if (value == key) side else value
}

fun verdictForHeading(
    check: VaastuCheck,
    heading: Double,
    locale: AppLocale,
    strings: StringTable,
): QuizVerdict {
    val normalized = normalizeDegrees(heading)
    val slotId = slotFromHeading(normalized, check.granularity)
    val zone = check.zones.firstOrNull { it.id == slotId }
    val direction = directionFromHeading(normalized)
    val directionName = directionLabel(direction, locale, strings)
    val slotName = zone?.name?.text(locale) ?: slotId
    val rating = zone?.rating ?: "neutral"
    var facing = slotName
    var placement = ""
    var slotLine = slotName
    var bestNote = check.bestNote.text(locale)
    var toward: String? = null

    val side = if (check.granularity == 32) padaSide(slotId) else null
    if (side != null) {
        facing = facingLabel(side, locale, strings)
        placement = facing
        val noun = check.resultNoun?.text(locale).orEmpty()
        slotLine = if (noun.isNotEmpty()) {
            if (locale == AppLocale.HI) {
                "आपका $noun $slotId · $slotName में है"
            } else {
                "Your $noun is in $slotId · $slotName"
            }
        } else {
            "$slotId · $slotName"
        }
        check.facingNotes[side]?.let { bestNote = it.text(locale) }
        if (direction == "NE" || direction == "SE" || direction == "SW" || direction == "NW") {
            toward = if (locale == AppLocale.HI) {
                "$directionName की तरफ़।"
            } else {
                "Toward the ${directionName.lowercase()}."
            }
        }
    } else if (locale == AppLocale.HI) {
        placement = if (check.reference == "facing-out") "$slotName की ओर मुख" else "$slotName की ओर"
        facing = placement
        slotLine = slotName
    } else if (check.reference == "facing-out") {
        placement = "Facing ${slotName.lowercase()}"
        facing = placement
        slotLine = slotName
    } else {
        placement = "Toward the ${slotName.lowercase()}"
        facing = placement
        slotLine = slotName
    }

    return QuizVerdict(
        heading = normalized,
        slotId = slotId,
        slotName = slotName,
        rating = rating,
        meaning = zone?.meaning?.text(locale) ?: "",
        remedies = zone?.remedies?.map { it.text(locale) } ?: emptyList(),
        direction = direction,
        directionLabel = directionName,
        facingLabel = facing,
        placementLine = placement,
        slotLine = slotLine,
        bestNote = bestNote,
        toward = toward,
    )
}
