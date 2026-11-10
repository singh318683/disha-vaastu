package com.ikshanasolutions.disha.data

import android.content.Context
import com.ikshanasolutions.disha.model.AppLocale
import java.util.Locale
import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.StoredResult
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class SavedHome(
    val id: String,
    val name: String,
    val results: List<StoredResult>,
    val createdAt: Long,
    val updatedAt: Long,
)

data class SavedState(
    val locale: AppLocale,
    val askedLocation: Boolean,
    val seenWelcome: Boolean,
    val latitude: Double?,
    val longitude: Double?,
    val declination: Double?,
    val homes: List<SavedHome>,
    val currentHomeId: String,
    val entitlements: Entitlements,
)

class HomeStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(): SavedState {
        val raw = prefs.getString(KEY, null) ?: return fresh(detectLocale())
        return try {
            decode(JSONObject(raw))
        } catch (_: Exception) {
            fresh()
        }
    }

    fun save(state: SavedState) {
        prefs.edit().putString(KEY, encode(state).toString()).apply()
    }

    private fun detectLocale(): AppLocale {
        return if (Locale.getDefault().language.lowercase().startsWith("hi")) AppLocale.HI else AppLocale.EN
    }

    private fun fresh(locale: AppLocale = AppLocale.EN): SavedState {
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        val home = SavedHome(id, "Home", emptyList(), now, now)
        return SavedState(
            locale = locale,
            askedLocation = false,
            seenWelcome = false,
            latitude = null,
            longitude = null,
            declination = null,
            homes = listOf(home),
            currentHomeId = id,
            entitlements = Entitlements(),
        )
    }

    private fun encode(state: SavedState): JSONObject {
        val homes = JSONArray()
        for (home in state.homes) {
            val results = JSONArray()
            for (result in home.results) {
                val row = JSONObject()
                    .put("checkId", result.checkId)
                    .put("heading", result.heading)
                    .put("trueNorth", result.trueNorth)
                    .put("at", result.at)
                if (result.remedyHeading != null) row.put("remedy", result.remedyHeading)
                results.put(row)
            }
            homes.put(
                JSONObject()
                    .put("id", home.id)
                    .put("name", home.name)
                    .put("created", home.createdAt)
                    .put("updated", home.updatedAt)
                    .put("results", results),
            )
        }
        return JSONObject()
            .put("locale", state.locale.name.lowercase())
            .put("asked", state.askedLocation)
            .put("seen", state.seenWelcome)
            .put("lat", state.latitude ?: JSONObject.NULL)
            .put("lon", state.longitude ?: JSONObject.NULL)
            .put("decl", state.declination ?: JSONObject.NULL)
            .put("current", state.currentHomeId)
            .put("homes", homes)
            .put("premium", state.entitlements.premium)
            .put("reports", JSONArray(state.entitlements.reportHomeIds.toList()))
            .put("pending", JSONArray(state.entitlements.pendingProductIds.toList()))
    }

    private fun decode(json: JSONObject): SavedState {
        val homesArray = json.optJSONArray("homes") ?: JSONArray()
        val homes = buildList {
            for (index in 0 until homesArray.length()) {
                val home = homesArray.optJSONObject(index) ?: continue
                val resultsArray = home.optJSONArray("results") ?: JSONArray()
                val results = buildList {
                    for (rowIndex in 0 until resultsArray.length()) {
                        val row = resultsArray.optJSONObject(rowIndex) ?: continue
                        val heading = row.optDouble("heading", Double.NaN)
                        if (!heading.isFinite()) continue
                        val remedy = if (row.has("remedy") && !row.isNull("remedy")) row.optDouble("remedy") else null
                        add(
                            StoredResult(
                                checkId = row.optString("checkId"),
                                heading = heading,
                                trueNorth = row.optBoolean("trueNorth", true),
                                at = row.optLong("at"),
                                remedyHeading = remedy?.takeIf { it.isFinite() },
                            ),
                        )
                    }
                }
                val id = home.optString("id").ifBlank { UUID.randomUUID().toString() }
                add(
                    SavedHome(
                        id = id,
                        name = home.optString("name").ifBlank { "Home" },
                        results = results,
                        createdAt = home.optLong("created"),
                        updatedAt = home.optLong("updated"),
                    ),
                )
            }
        }
        val safeHomes = homes.ifEmpty { fresh().homes }
        val current = json.optString("current").ifBlank { safeHomes.first().id }
        val currentId = if (safeHomes.any { it.id == current }) current else safeHomes.first().id
        val reports = jsonArrayToSet(json.optJSONArray("reports"))
        val pending = jsonArrayToSet(json.optJSONArray("pending"))
        val locale = if (json.optString("locale") == "hi") AppLocale.HI else AppLocale.EN
        return SavedState(
            locale = locale,
            askedLocation = json.optBoolean("asked"),
            seenWelcome = json.optBoolean("seen"),
            latitude = json.optNullableDouble("lat"),
            longitude = json.optNullableDouble("lon"),
            declination = json.optNullableDouble("decl"),
            homes = safeHomes,
            currentHomeId = currentId,
            entitlements = Entitlements(json.optBoolean("premium"), reports, pending),
        )
    }

    private fun jsonArrayToSet(array: JSONArray?): Set<String> {
        if (array == null) return emptySet()
        return buildSet {
            for (index in 0 until array.length()) {
                val value = array.optString(index)
                if (value.isNotBlank()) add(value)
            }
        }
    }

    private fun JSONObject.optNullableDouble(key: String): Double? {
        if (!has(key) || isNull(key)) return null
        val value = optDouble(key, Double.NaN)
        return value.takeIf { it.isFinite() }
    }

    companion object {
        private const val PREFS = "disha.home"
        private const val KEY = "state"
    }
}
