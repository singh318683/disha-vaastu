package com.ikshanasolutions.disha.model

enum class AppLocale { EN, HI }

data class L10n(val en: String, val hi: String) {
    fun text(locale: AppLocale): String {
        return when (locale) {
            AppLocale.HI -> hi.trim().ifEmpty { en }
            AppLocale.EN -> en
        }
    }
}

class StringTable(val entries: Map<String, L10n>) {
    fun t(key: String, locale: AppLocale): String = entries[key]?.text(locale) ?: key

    fun fill(key: String, locale: AppLocale, values: Map<String, String>): String {
        var text = t(key, locale)
        for ((name, value) in values) {
            text = text.replace("{$name}", value)
        }
        return text
    }
}

data class CheckZone(
    val id: String,
    val name: L10n,
    val rating: String,
    val meaning: L10n,
    val remedies: List<L10n>,
)

data class VaastuCheck(
    val id: String,
    val weight: Int,
    val tier: String,
    val title: L10n,
    val blurb: L10n,
    val icon: String,
    val group: L10n,
    val reference: String,
    val granularity: Int,
    val instructions: L10n,
    val bestNote: L10n,
    val facingNotes: Map<String, L10n>,
    val resultNoun: L10n?,
    val zones: List<CheckZone>,
)

data class CheckCatalog(
    val version: Int,
    val framing: L10n,
    val convention: L10n,
    val freeChecks: List<String>,
    val checks: List<VaastuCheck>,
)

data class CheckGroup(val group: L10n, val checks: List<VaastuCheck>) {
    val id: String get() = group.en
}

fun checkGroups(checks: List<VaastuCheck>): List<CheckGroup> {
    val order = mutableListOf<String>()
    val map = linkedMapOf<String, MutableList<VaastuCheck>>()
    val names = linkedMapOf<String, L10n>()
    for (check in checks) {
        val key = check.group.en
        if (key !in map) {
            order += key
            map[key] = mutableListOf()
            names[key] = check.group
        }
        map.getValue(key) += check
    }
    return order.map { key -> CheckGroup(names.getValue(key), map.getValue(key)) }
}

data class ContentBundle(
    val catalog: CheckCatalog,
    val strings: StringTable,
) {
    fun check(id: String): VaastuCheck? = catalog.checks.firstOrNull { it.id == id }

    fun t(key: String, locale: AppLocale): String = strings.t(key, locale)

    fun fill(key: String, locale: AppLocale, values: Map<String, String>): String {
        return strings.fill(key, locale, values)
    }
}
