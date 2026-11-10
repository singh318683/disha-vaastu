package com.ikshanasolutions.disha.model

import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/**
 * Play product ids. Prices are never stored here. The paywall shows
 * ProductDetails.formattedPrice (or the debug stand-in for that field).
 *
 * Home Report (`home_report`) is a non-consumable. Play allows one purchase
 * per Google account and keeps returning it from queryPurchasesAsync, including
 * after a reinstall. The home it unlocks is the id passed as
 * BillingFlowParams.setObfuscatedProfileId and read back from
 * Purchase.accountIdentifiers. A local cache mirrors that id. The purchase is
 * never consumed. A second home needs Premium. If Play omits the profile id,
 * the home that was open when the purchase completed is bound before the
 * purchase is acknowledged.
 */
object Products {
    const val MONTHLY = "premium_monthly"
    const val YEARLY = "premium_yearly"
    const val LIFETIME = "premium_lifetime"
    const val HOME_REPORT = "home_report"

    val subscriptions = listOf(MONTHLY, YEARLY)
    val all = listOf(MONTHLY, YEARLY, LIFETIME, HOME_REPORT)

    fun grantsPremium(id: String): Boolean = id == MONTHLY || id == YEARLY || id == LIFETIME

    fun isHomeReport(id: String): Boolean = id == HOME_REPORT
}

/** Placeholder legal links. Replace both before Play review. */
object Legal {
    const val TERMS = "https://disha.example.com/terms"
    const val PRIVACY = "https://disha.example.com/privacy"
    const val MANAGE_SUBS =
        "https://play.google.com/store/account/subscriptions?package=com.ikshanasolutions.disha"
}

/**
 * Values match BillingClient.BillingResponseCode so the policy can be tested
 * without starting Play Billing.
 */
object BillingCodes {
    const val OK = 0
    const val USER_CANCELED = 1
    const val SERVICE_UNAVAILABLE = 2
    const val BILLING_UNAVAILABLE = 3
    const val ITEM_UNAVAILABLE = 4
    const val DEVELOPER_ERROR = 5
    const val ERROR = 6
    const val ITEM_ALREADY_OWNED = 7
    const val ITEM_NOT_OWNED = 8
    const val SERVICE_DISCONNECTED = -1
}

enum class ResponsePolicy { DELIVER, SILENT, RESTORE, RETRY, ERROR }

fun responsePolicy(code: Int): ResponsePolicy {
    return when (code) {
        BillingCodes.OK -> ResponsePolicy.DELIVER
        BillingCodes.USER_CANCELED -> ResponsePolicy.SILENT
        BillingCodes.ITEM_ALREADY_OWNED -> ResponsePolicy.RESTORE
        BillingCodes.SERVICE_DISCONNECTED,
        BillingCodes.BILLING_UNAVAILABLE,
        BillingCodes.SERVICE_UNAVAILABLE,
        -> ResponsePolicy.RETRY
        else -> ResponsePolicy.ERROR
    }
}

fun shouldRetryConnect(attempt: Int): Boolean = attempt < 5

fun reconnectDelayMs(attempt: Int): Long {
    val shift = attempt.coerceIn(0, 4)
    return minOf(8_000L, 500L shl shift)
}

enum class PurchaseState { PURCHASED, PENDING, OTHER }

data class IncomingPurchase(
    val products: List<String>,
    val state: PurchaseState,
    val acknowledged: Boolean,
    val profileId: String?,
    val token: String,
    val signedData: String,
    val signature: String,
    /** Debug fake only. Real Play purchases leave this false and must verify. */
    val debugUnsigned: Boolean = false,
)

sealed interface PurchaseDecision {
    data class Grant(
        val premium: Boolean,
        val reportHomeId: String?,
        val acknowledgeToken: String?,
    ) : PurchaseDecision

    data class Pending(val productIds: List<String>) : PurchaseDecision

    data object Ignore : PurchaseDecision

    data class Rejected(val reason: String) : PurchaseDecision
}

data class Entitlements(
    val premium: Boolean = false,
    val reportHomeIds: Set<String> = emptySet(),
    val pendingProductIds: Set<String> = emptySet(),
) {
    fun ownsReport(homeId: String): Boolean = homeId in reportHomeIds
}

/**
 * Verify, then grant, then acknowledge. Unacknowledged Play purchases refund
 * after three days, so a grant that is not followed by acknowledgePurchase is
 * unfinished. A failed signature is not acknowledged and not granted.
 *
 * [products] is read in full. An empty list is ignored rather than indexed.
 */
fun decidePurchase(
    purchase: IncomingPurchase,
    fallbackHomeId: String,
    licenseKey: String,
    allowDebug: Boolean,
): PurchaseDecision {
    val ids = purchase.products.filter { it.isNotBlank() }
    if (ids.isEmpty()) return PurchaseDecision.Ignore
    if (purchase.state == PurchaseState.PENDING) return PurchaseDecision.Pending(ids)
    if (purchase.state != PurchaseState.PURCHASED) return PurchaseDecision.Ignore

    val trusted = if (purchase.debugUnsigned && allowDebug) {
        true
    } else {
        verifyPlaySignature(purchase.signedData, purchase.signature, licenseKey)
    }
    if (!trusted) return PurchaseDecision.Rejected("signature")

    var premium = false
    var reportHome: String? = null
    for (id in ids) {
        if (Products.grantsPremium(id)) premium = true
        if (Products.isHomeReport(id)) {
            val bound = purchase.profileId?.takeIf { it.isNotBlank() } ?: fallbackHomeId.takeIf { it.isNotBlank() }
            if (bound == null) return PurchaseDecision.Rejected("home")
            reportHome = bound
        }
    }
    if (!premium && reportHome == null) return PurchaseDecision.Ignore
    val token = if (purchase.acknowledged || purchase.token.isBlank()) null else purchase.token
    return PurchaseDecision.Grant(premium, reportHome, token)
}

/**
 * A successful query replaces the cache with what Play returned, so a refund
 * or expiry drops the entitlement. A failed query keeps the previous cache.
 */
/**
 * A purchase update lists only what just changed. Fold those decisions into
 * the current entitlements instead of replacing them.
 */
fun mergeEntitlements(previous: Entitlements, decisions: List<PurchaseDecision>): Entitlements {
    var premium = previous.premium
    val homes = previous.reportHomeIds.toMutableSet()
    val pending = previous.pendingProductIds.toMutableSet()
    for (decision in decisions) {
        when (decision) {
            is PurchaseDecision.Grant -> {
                if (decision.premium) {
                    premium = true
                    pending.remove(Products.MONTHLY)
                    pending.remove(Products.YEARLY)
                    pending.remove(Products.LIFETIME)
                }
                val home = decision.reportHomeId
                if (home != null) {
                    homes.add(home)
                    pending.remove(Products.HOME_REPORT)
                }
            }
            is PurchaseDecision.Pending -> pending.addAll(decision.productIds)
            is PurchaseDecision.Ignore, is PurchaseDecision.Rejected -> Unit
        }
    }
    return Entitlements(premium, homes, pending)
}

fun reconcileEntitlements(
    querySucceeded: Boolean,
    previous: Entitlements,
    decisions: List<PurchaseDecision>,
): Entitlements {
    if (!querySucceeded) return previous
    var premium = false
    val homes = linkedSetOf<String>()
    val pending = linkedSetOf<String>()
    for (decision in decisions) {
        when (decision) {
            is PurchaseDecision.Grant -> {
                if (decision.premium) premium = true
                decision.reportHomeId?.let { homes += it }
            }
            is PurchaseDecision.Pending -> pending += decision.productIds
            is PurchaseDecision.Ignore, is PurchaseDecision.Rejected -> Unit
        }
    }
    return Entitlements(premium, homes, pending)
}

fun verifyPlaySignature(signedData: String, signatureBase64: String, publicKeyBase64: String): Boolean {
    if (signedData.isBlank() || signatureBase64.isBlank() || publicKeyBase64.isBlank()) return false
    return try {
        val decoder = Base64.getMimeDecoder()
        val keyBytes = decoder.decode(publicKeyBase64)
        val key = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(keyBytes))
        val verifier = Signature.getInstance("SHA1withRSA")
        verifier.initVerify(key)
        verifier.update(signedData.toByteArray(Charsets.UTF_8))
        verifier.verify(decoder.decode(signatureBase64))
    } catch (_: Exception) {
        false
    }
}

data class PricePhase(
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val billingPeriod: String,
)

data class CatalogOffer(
    val offerId: String?,
    val offerToken: String,
    val phases: List<PricePhase>,
)

/** Prefer the offer that includes a free phase, otherwise the base plan. */
fun selectOffer(offers: List<CatalogOffer>): CatalogOffer? {
    if (offers.isEmpty()) return null
    return offers.firstOrNull { offer -> offer.phases.any { it.priceAmountMicros == 0L } }
        ?: offers.firstOrNull { it.offerId == null }
        ?: offers.first()
}

fun paidPhase(offer: CatalogOffer): PricePhase? {
    return offer.phases.lastOrNull { it.priceAmountMicros > 0L }
}

fun trialDays(offer: CatalogOffer): Int? {
    val free = offer.phases.firstOrNull { it.priceAmountMicros == 0L } ?: return null
    return isoPeriodDays(free.billingPeriod)
}

fun isoPeriodDays(period: String): Int? {
    val match = Regex("""P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?""").matchEntire(period) ?: return null
    val years = match.groupValues[1].toIntOrNull() ?: 0
    val months = match.groupValues[2].toIntOrNull() ?: 0
    val weeks = match.groupValues[3].toIntOrNull() ?: 0
    val days = match.groupValues[4].toIntOrNull() ?: 0
    if (years + months + weeks + days == 0) return null
    return years * 365 + months * 30 + weeks * 7 + days
}

data class StoreProduct(
    val id: String,
    val formattedPrice: String,
    val offerToken: String?,
    val trialDays: Int?,
    val billingPeriod: String?,
    val title: String,
)

/** Year, month, or week from an ISO-8601 billing period. Null for a one-time price. */
fun periodWord(period: String?, locale: AppLocale, strings: StringTable): String? {
    val key = when {
        period?.contains("Y") == true -> "periodYear"
        period?.contains("M") == true -> "periodMonth"
        period?.contains("W") == true -> "periodWeek"
        else -> return null
    }
    return strings.t(key, locale)
}

/** `₹999/year` when the offer has a period, otherwise the store price alone. */
fun priceWithPeriod(formattedPrice: String, periodWord: String?): String {
    return if (periodWord.isNullOrBlank()) formattedPrice else "$formattedPrice/$periodWord"
}

fun catalogFailed(responseCode: Int, count: Int): Boolean {
    return responseCode != BillingCodes.OK || count <= 0
}

fun loadingTimedOut(startedMs: Long, nowMs: Long, limitMs: Long = 12_000L): Boolean {
    return nowMs - startedMs >= limitMs
}
