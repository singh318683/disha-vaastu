package com.ikshanasolutions.disha.model

import org.json.JSONObject

private val CANONICAL_FREE = setOf(
    "house_facing",
    "main_door",
    "kitchen",
    "master_bedroom",
    "pooja",
    "living",
)

fun parseCatalog(text: String): CheckCatalog {
    val root = JSONObject(text)
    val free = mutableListOf<String>()
    if (root.has("freeChecks")) {
        val array = root.getJSONArray("freeChecks")
        for (index in 0 until array.length()) {
            val id = array.optString(index)
            if (id.isNotEmpty()) free += id
        }
    }
    val freeIds = if (free.isEmpty()) CANONICAL_FREE else free.toSet()
    val checksArray = root.getJSONArray("checks")
    val checks = buildList {
        for (index in 0 until checksArray.length()) {
            add(parseCheck(checksArray.getJSONObject(index), freeIds))
        }
    }
    return CheckCatalog(
        version = root.optInt("version", 1),
        framing = parseL10n(root.getJSONObject("framing")),
        convention = parseL10n(root.getJSONObject("convention")),
        freeChecks = if (free.isEmpty()) CANONICAL_FREE.toList() else free,
        checks = checks,
    )
}

fun parseStringTable(text: String): StringTable {
    val root = JSONObject(text)
    val entries = linkedMapOf<String, L10n>()
    val keys = root.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        val value = root.optJSONObject(key) ?: continue
        entries[key] = parseL10n(value)
    }
    return StringTable(entries)
}

private fun parseCheck(source: JSONObject, freeIds: Set<String>): VaastuCheck {
    val id = source.getString("id")
    val declared = source.optString("tier")
    val tier = when (declared) {
        "free", "premium" -> declared
        else -> if (id in freeIds) "free" else "premium"
    }
    val facing = linkedMapOf<String, L10n>()
    val notes = source.optJSONObject("facingNotes")
    if (notes != null) {
        val keys = notes.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = notes.optJSONObject(key) ?: continue
            facing[key] = parseL10n(value)
        }
    }
    val zonesArray = source.getJSONArray("zones")
    val zones = buildList {
        for (index in 0 until zonesArray.length()) {
            add(parseZone(zonesArray.getJSONObject(index)))
        }
    }
    val noun = source.optJSONObject("resultNoun")?.let { parseL10n(it) }
    return VaastuCheck(
        id = id,
        weight = source.optInt("weight", 1).coerceIn(1, 5),
        tier = tier,
        title = parseL10n(source.getJSONObject("title")),
        blurb = parseL10n(source.getJSONObject("blurb")),
        icon = source.optString("icon", "house"),
        group = parseL10n(source.getJSONObject("group")),
        reference = source.optString("reference", "facing-out"),
        granularity = source.optInt("granularity", 8),
        instructions = parseL10n(source.getJSONObject("instructions")),
        bestNote = parseL10n(source.getJSONObject("bestNote")),
        facingNotes = facing,
        resultNoun = noun,
        zones = zones,
    )
}

private fun parseZone(source: JSONObject): CheckZone {
    val remediesArray = source.optJSONArray("remedies")
    val remedies = buildList {
        if (remediesArray != null) {
            for (index in 0 until remediesArray.length()) {
                val item = remediesArray.optJSONObject(index) ?: continue
                add(parseL10n(item))
            }
        }
    }
    return CheckZone(
        id = source.getString("id"),
        name = parseL10n(source.getJSONObject("name")),
        rating = source.optString("rating", "neutral"),
        meaning = parseL10n(source.getJSONObject("meaning")),
        remedies = remedies,
    )
}

private fun parseL10n(source: JSONObject): L10n {
    val en = source.optString("en")
    val hi = source.optString("hi").ifEmpty { en }
    return L10n(en, hi)
}
