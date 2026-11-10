package com.ikshanasolutions.disha

import com.ikshanasolutions.disha.model.AppLocale
import com.ikshanasolutions.disha.model.BillingCodes
import com.ikshanasolutions.disha.model.CatalogOffer
import com.ikshanasolutions.disha.model.DisplayAxis
import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.HeadingSample
import com.ikshanasolutions.disha.model.IncomingPurchase
import com.ikshanasolutions.disha.model.PricePhase
import com.ikshanasolutions.disha.model.Products
import com.ikshanasolutions.disha.model.PurchaseDecision
import com.ikshanasolutions.disha.model.PurchaseState
import com.ikshanasolutions.disha.model.ResponsePolicy
import com.ikshanasolutions.disha.model.accuracyNeedsCalibration
import com.ikshanasolutions.disha.model.averageRecentHeading
import com.ikshanasolutions.disha.model.axesForDisplayRotation
import com.ikshanasolutions.disha.model.bandFor
import com.ikshanasolutions.disha.model.catalogFailed
import com.ikshanasolutions.disha.model.circularMean
import com.ikshanasolutions.disha.model.decidePurchase
import com.ikshanasolutions.disha.model.directionFromHeading
import com.ikshanasolutions.disha.model.headingDegreesFromAzimuthRadians
import com.ikshanasolutions.disha.model.headingFromDialPoint
import com.ikshanasolutions.disha.model.homePages
import com.ikshanasolutions.disha.model.homeScore
import com.ikshanasolutions.disha.model.AttemptWindow
import com.ikshanasolutions.disha.model.CodeResult
import com.ikshanasolutions.disha.model.ReviewCode
import com.ikshanasolutions.disha.model.evaluateReviewCode
import com.ikshanasolutions.disha.model.isPremium
import com.ikshanasolutions.disha.model.normalizeReviewCode
import com.ikshanasolutions.disha.model.priceWithPeriod
import com.ikshanasolutions.disha.model.reviewCodeMatches
import com.ikshanasolutions.disha.model.sha256Hex
import com.ikshanasolutions.disha.model.isoPeriodDays
import com.ikshanasolutions.disha.model.magneticToTrue
import com.ikshanasolutions.disha.model.mergeEntitlements
import com.ikshanasolutions.disha.model.normalizeDegrees
import com.ikshanasolutions.disha.model.padaFromHeading
import com.ikshanasolutions.disha.model.paidPhase
import com.ikshanasolutions.disha.model.parseCatalog
import com.ikshanasolutions.disha.model.parseStringTable
import com.ikshanasolutions.disha.model.phoneIsFlat
import com.ikshanasolutions.disha.model.pointsFor
import com.ikshanasolutions.disha.model.presentedScore
import com.ikshanasolutions.disha.model.reconcileEntitlements
import com.ikshanasolutions.disha.model.responsePolicy
import com.ikshanasolutions.disha.model.selectOffer
import com.ikshanasolutions.disha.model.slotFromHeading
import com.ikshanasolutions.disha.model.smoothHeading
import com.ikshanasolutions.disha.model.trialDays
import com.ikshanasolutions.disha.model.verifyPlaySignature
import com.ikshanasolutions.disha.model.verdictForHeading
import com.ikshanasolutions.disha.model.zoneFromBearing
import com.ikshanasolutions.disha.model.LibraryAccess
import com.ikshanasolutions.disha.model.ScoreBand
import com.ikshanasolutions.disha.model.StoredResult
import com.ikshanasolutions.disha.model.ContentBundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import kotlin.math.PI

class PadaMathTest {
    @Test
    fun cornersAndCardinals() {
        assertEquals("N5", padaFromHeading(0.0))
        assertEquals("N5", padaFromHeading(360.0))
        assertEquals("N5", padaFromHeading(-360.0))
        assertEquals("N5", padaFromHeading(720.0))
        assertEquals("E1", padaFromHeading(45.0))
        assertEquals("S1", padaFromHeading(135.0))
        assertEquals("W1", padaFromHeading(225.0))
        assertEquals("N1", padaFromHeading(315.0))
        assertEquals("E5", padaFromHeading(90.0))
        assertEquals("S5", padaFromHeading(180.0))
        assertEquals("W5", padaFromHeading(270.0))
    }

    @Test
    fun wrapAcrossNorth() {
        assertEquals(0.0, normalizeDegrees(359.0 + 1.0), 0.0001)
        assertEquals(0.0, normalizeDegrees(360.0), 0.0001)
        assertEquals(359.0, normalizeDegrees(-1.0), 0.0001)
        assertEquals("N4", padaFromHeading(359.0))
        assertEquals("N5", padaFromHeading(0.001))
        assertEquals("N8", padaFromHeading(44.999))
        assertEquals("N4", slotFromHeading(359.0, 32))
        assertEquals("N5", slotFromHeading(0.0, 32))
    }

    @Test
    fun eightAndSixteenBoundaries() {
        assertEquals("N", directionFromHeading(0.0))
        assertEquals("N", directionFromHeading(360.0))
        assertEquals("N", directionFromHeading(22.499))
        assertEquals("NE", directionFromHeading(22.5))
        assertEquals("N", directionFromHeading(337.5))
        assertEquals("N", zoneFromBearing(0.0))
        assertEquals("N", zoneFromBearing(348.75))
        assertEquals("N", zoneFromBearing(11.249))
        assertEquals("NNE", zoneFromBearing(11.25))
    }
}

class HeadingConversionTest {
    @Test
    fun clockwiseAzimuthIsNotMirrored() {
        val east = headingDegreesFromAzimuthRadians(PI / 2)
        val west = headingDegreesFromAzimuthRadians(-PI / 2)
        val north = headingDegreesFromAzimuthRadians(0.0)
        val south = headingDegreesFromAzimuthRadians(PI)
        assertEquals(90.0, east, 0.0001)
        assertEquals(270.0, west, 0.0001)
        assertEquals(0.0, north, 0.0001)
        assertEquals(180.0, south, 0.0001)
        val mirroredEast = normalizeDegrees(360.0 - east)
        assertEquals(270.0, mirroredEast, 0.0001)
        assertNotEquals(mirroredEast, east)
    }

    @Test
    fun dialDragIsClockwise() {
        assertEquals(0.0, headingFromDialPoint(0.0, -1.0), 0.0001)
        assertEquals(90.0, headingFromDialPoint(1.0, 0.0), 0.0001)
        assertEquals(180.0, headingFromDialPoint(0.0, 1.0), 0.0001)
        assertEquals(270.0, headingFromDialPoint(-1.0, 0.0), 0.0001)
    }

    @Test
    fun displayRotationAxes() {
        assertEquals(DisplayAxis.X to DisplayAxis.Y, axesForDisplayRotation(DisplayAxis.ROTATION_0))
        assertEquals(DisplayAxis.Y to DisplayAxis.MINUS_X, axesForDisplayRotation(DisplayAxis.ROTATION_90))
        assertEquals(DisplayAxis.MINUS_X to DisplayAxis.MINUS_Y, axesForDisplayRotation(DisplayAxis.ROTATION_180))
        assertEquals(DisplayAxis.MINUS_Y to DisplayAxis.X, axesForDisplayRotation(DisplayAxis.ROTATION_270))
    }

    @Test
    fun smoothingStaysNearNorth() {
        var state = smoothHeading(null, 359.0, 0.0)
        state = smoothHeading(state.first, 1.0, 50.0)
        state = smoothHeading(state.first, 2.0, 50.0)
        assertTrue(state.second < 20 || state.second > 340)
        val mean = circularMean(listOf(359.0, 0.0, 1.0, 2.0))
        assertEquals(0.5, mean ?: 180.0, 0.6)
        val across = circularMean(listOf(350.0, 10.0)) ?: 180.0
        assertTrue(minOf(across, 360 - across) < 1.0)
    }

    @Test
    fun lockAveragesTheLastSecond() {
        val now = 10_000L
        val samples = listOf(
            HeadingSample(now - 2_500, 180.0),
            HeadingSample(now - 800, 359.0),
            HeadingSample(now - 200, 1.0),
        )
        val locked = averageRecentHeading(samples, now, 1_000)
        assertTrue(locked != null)
        val value = locked ?: 180.0
        assertTrue(value < 5 || value > 355)
    }

    @Test
    fun declinationAndFlatPhone() {
        assertEquals(348.0, magneticToTrue(0.0, -12.0), 0.001)
        assertEquals(90.0, magneticToTrue(78.0, 12.0), 0.001)
        assertTrue(phoneIsFlat(0.0, 0.0))
        assertFalse(phoneIsFlat(Math.toRadians(40.0), 0.0))
        assertTrue(phoneIsFlat(Math.toRadians(39.0), 0.0))
        assertTrue(accuracyNeedsCalibration(0))
        assertTrue(accuracyNeedsCalibration(1))
        assertFalse(accuracyNeedsCalibration(3))
    }
}

class ScoringCatalogTest {
    private val catalog = parseCatalog(readAsset("checks.json"))
    private val strings = parseStringTable(readAsset("ui.json"))
    private val content = ContentBundle(catalog, strings)

    @Test
    fun catalogMatchesTheWebQuiz() {
        assertEquals(34, catalog.checks.size)
        assertEquals(
            listOf("Entrance", "Kitchen", "Sleep", "Prayer", "Water", "Work", "Living", "Outside"),
            com.ikshanasolutions.disha.model.checkGroups(catalog.checks).map { it.group.en },
        )
        val free = catalog.checks.filter { it.tier == "free" }.map { it.id }.toSet()
        assertEquals(
            setOf("house_facing", "main_door", "kitchen", "master_bedroom", "pooja", "living"),
            free,
        )
        val door = catalog.checks.first { it.id == "main_door" }
        assertEquals(5, door.weight)
        assertTrue(door.weight > catalog.checks.first { it.id == "mirror" }.weight)
        val north = verdictForHeading(door, 0.0, AppLocale.EN, strings)
        assertEquals("N5", north.slotId)
        assertEquals("Soma", north.slotName)
        assertEquals("auspicious", north.rating)
        assertEquals("North-facing", north.placementLine)
        assertEquals("North-facing: Best in N3, N4, or N5 (associated with wealth and children).", north.bestNote)
        assertEquals("N5", verdictForHeading(door, 360.0, AppLocale.EN, strings).slotId)
        assertEquals("E1", verdictForHeading(door, 45.0, AppLocale.EN, strings).slotId)
        assertEquals("N4", verdictForHeading(door, 359.0, AppLocale.EN, strings).slotId)
        val hindi = verdictForHeading(door, 0.0, AppLocale.HI, strings)
        assertEquals("सोम", hindi.slotName)
        assertEquals("उत्तरमुखी", hindi.placementLine)
        assertEquals("Lock direction", strings.t("lock", AppLocale.EN))
        assertEquals("दिशा रोकें", strings.t("lock", AppLocale.HI))
    }

    @Test
    fun pointsBandsAndPartialCredit() {
        assertEquals(100, pointsFor("auspicious", false))
        assertEquals(100, pointsFor("auspicious", true))
        assertEquals(50, pointsFor("neutral", false))
        assertEquals(75, pointsFor("neutral", true))
        assertEquals(15, pointsFor("inauspicious", false))
        assertEquals(50, pointsFor("inauspicious", true))
        assertEquals(ScoreBand.EXCELLENT, bandFor(85))
        assertEquals(ScoreBand.GOOD, bandFor(84))
        assertEquals(ScoreBand.GOOD, bandFor(70))
        assertEquals(ScoreBand.FAIR, bandFor(69))
        assertEquals(ScoreBand.FAIR, bandFor(50))
        assertEquals(ScoreBand.CARE, bandFor(49))

        val doorOnly = homeScore(catalog, listOf(saved("main_door", 20.0)), AppLocale.EN, strings)
        val doorFixed = homeScore(
            catalog,
            listOf(saved("main_door", 20.0, remedy = 20.0)),
            AppLocale.EN,
            strings,
        )
        assertEquals(35, (doorFixed.score ?: 0) - (doorOnly.score ?: 0))
        val mirror = homeScore(catalog, listOf(saved("mirror", 0.0)), AppLocale.EN, strings)
        assertEquals(100, mirror.score)
        val pulled = homeScore(catalog, listOf(saved("main_door", 20.0), saved("mirror", 0.0)), AppLocale.EN, strings)
        assertTrue((pulled.score ?: 100) < 100)
        val one = homeScore(catalog, listOf(saved("pooja", 0.0)), AppLocale.EN, strings)
        assertEquals(1, one.done)
        assertEquals(34, one.total)
        assertEquals("Based on 1 of 34 checks", strings.fill("basedOn", AppLocale.EN, mapOf("done" to "1", "total" to "34")))
        assertTrue(doorOnly.boosts.any { it.gain > 0 })
        assertTrue(doorOnly.boosts.size <= 3)
    }

    @Test
    fun homePagesFitSixChecksAndTheTrialPriceNamesItsPeriod() {
        val pages = homePages(catalog.checks)
        assertEquals(2, pages.first { it.id == "Entrance:0" }.checks.size)
        assertEquals(listOf(6, 1), pages.filter { it.id.startsWith("Work") }.map { it.checks.size })
        assertTrue(pages.all { it.checks.size <= 6 })
        assertEquals("₹999/year", priceWithPeriod("₹999", "year"))
        assertEquals("₹149/month", priceWithPeriod("₹149", "month"))
        assertEquals("₹2,499", priceWithPeriod("₹2,499", null))
        assertEquals(
            "7 days free, then ₹999/year",
            strings.fill("daysFreeThen", AppLocale.EN, mapOf("days" to "7", "price" to "₹999", "period" to "year")),
        )
        assertEquals(
            "7 दिन मुफ़्त, फिर ₹999/वर्ष",
            strings.fill("daysFreeThen", AppLocale.HI, mapOf("days" to "7", "price" to "₹999", "period" to "वर्ष")),
        )
    }

    @Test
    fun previewUsesOnlyFreeChecks() {
        val results = listOf(saved("main_door", 0.0), saved("toilet", 0.0))
        val preview = presentedScore(content, results, LibraryAccess(false, false), AppLocale.EN)
        assertEquals(com.ikshanasolutions.disha.model.ScoreKind.PREVIEW, preview.kind)
        assertEquals(1, preview.score.done)
        assertEquals(34, preview.score.total)
        val full = presentedScore(content, results, LibraryAccess(true, false), AppLocale.EN)
        assertEquals(2, full.score.done)
        val report = presentedScore(content, results, LibraryAccess(false, true), AppLocale.EN)
        assertEquals(com.ikshanasolutions.disha.model.ScoreKind.FULL, report.kind)
        assertEquals(2, report.score.done)
    }

    private fun saved(id: String, heading: Double, remedy: Double? = null): StoredResult {
        return StoredResult(id, heading, true, 1L, remedy)
    }
}

class BillingLogicTest {
    @Test
    fun responsePolicies() {
        assertEquals(ResponsePolicy.DELIVER, responsePolicy(BillingCodes.OK))
        assertEquals(ResponsePolicy.SILENT, responsePolicy(BillingCodes.USER_CANCELED))
        assertEquals(ResponsePolicy.RESTORE, responsePolicy(BillingCodes.ITEM_ALREADY_OWNED))
        assertEquals(ResponsePolicy.RETRY, responsePolicy(BillingCodes.BILLING_UNAVAILABLE))
        assertEquals(ResponsePolicy.RETRY, responsePolicy(BillingCodes.SERVICE_DISCONNECTED))
        assertEquals(ResponsePolicy.RETRY, responsePolicy(BillingCodes.SERVICE_UNAVAILABLE))
        assertTrue(catalogFailed(BillingCodes.OK, 0))
        assertFalse(catalogFailed(BillingCodes.OK, 4))
    }

    @Test
    fun emptyProductListIsIgnored() {
        val decision = decidePurchase(purchase(emptyList()), "home", "key", false)
        assertTrue(decision is PurchaseDecision.Ignore)
    }

    @Test
    fun pendingIsNotGrantedOrAcknowledged() {
        val decision = decidePurchase(
            purchase(listOf(Products.MONTHLY), state = PurchaseState.PENDING),
            "home",
            "key",
            true,
        )
        assertTrue(decision is PurchaseDecision.Pending)
        val kept = reconcileEntitlements(true, Entitlements(premium = false), listOf(decision))
        assertFalse(kept.premium)
        assertTrue(Products.MONTHLY in kept.pendingProductIds)
    }

    @Test
    fun purchasedPremiumIsGrantedThenAcknowledged() {
        val decision = decidePurchase(
            purchase(listOf(Products.YEARLY), acknowledged = false, debug = true),
            "home",
            "",
            true,
        )
        val grant = decision as PurchaseDecision.Grant
        assertTrue(grant.premium)
        assertTrue(grant.acknowledgeToken != null)
        val after = reconcileEntitlements(true, Entitlements(), listOf(grant))
        assertTrue(after.premium)
    }

    @Test
    fun alreadyAcknowledgedRestoresWithoutAnotherAck() {
        val decision = decidePurchase(
            purchase(listOf(Products.LIFETIME), acknowledged = true, debug = true),
            "home",
            "",
            true,
        ) as PurchaseDecision.Grant
        assertNull(decision.acknowledgeToken)
        assertTrue(decision.premium)
    }

    @Test
    fun badSignatureIsNotGranted() {
        val decision = decidePurchase(
            purchase(listOf(Products.MONTHLY), signed = "nope", signature = "nope"),
            "home",
            "not-a-key",
            false,
        )
        assertTrue(decision is PurchaseDecision.Rejected)
        val kept = reconcileEntitlements(true, Entitlements(premium = true), listOf(decision))
        assertFalse(kept.premium)
    }

    @Test
    fun homeReportBindsTheProfileHome() {
        val decision = decidePurchase(
            purchase(listOf(Products.HOME_REPORT), profile = "home-a", debug = true),
            "home-b",
            "",
            true,
        ) as PurchaseDecision.Grant
        assertEquals("home-a", decision.reportHomeId)
        assertFalse(decision.premium)
        val entitlements = reconcileEntitlements(true, Entitlements(), listOf(decision))
        assertTrue(entitlements.ownsReport("home-a"))
        assertFalse(entitlements.ownsReport("home-b"))
    }

    @Test
    fun homeReportFallsBackWhenProfileIsMissing() {
        val decision = decidePurchase(
            purchase(listOf(Products.HOME_REPORT), profile = null, debug = true),
            "home-b",
            "",
            true,
        ) as PurchaseDecision.Grant
        assertEquals("home-b", decision.reportHomeId)
    }

    @Test
    fun purchaseUpdateDoesNotDropAnExistingEntitlement() {
        val previous = Entitlements(premium = true)
        val report = decidePurchase(
            purchase(listOf(Products.HOME_REPORT), profile = "home-a", debug = true),
            "home-a",
            "",
            true,
        )
        val merged = mergeEntitlements(previous, listOf(report))
        assertTrue(merged.premium)
        assertTrue(merged.ownsReport("home-a"))
    }

    @Test
    fun refundDropsPremiumAndAFailedQueryKeepsIt() {
        val previous = Entitlements(premium = true, reportHomeIds = setOf("home-a"))
        val revoked = reconcileEntitlements(true, previous, emptyList())
        assertFalse(revoked.premium)
        assertTrue(revoked.reportHomeIds.isEmpty())
        val kept = reconcileEntitlements(false, previous, emptyList())
        assertTrue(kept.premium)
        assertEquals(setOf("home-a"), kept.reportHomeIds)
    }

    @Test
    fun pendingBecomesPurchasedOnTheNextQuery() {
        val pending = decidePurchase(
            purchase(listOf(Products.MONTHLY), state = PurchaseState.PENDING, debug = true),
            "home",
            "",
            true,
        )
        val waiting = reconcileEntitlements(true, Entitlements(), listOf(pending))
        assertFalse(waiting.premium)
        val bought = decidePurchase(
            purchase(listOf(Products.MONTHLY), state = PurchaseState.PURCHASED, debug = true),
            "home",
            "",
            true,
        )
        val active = reconcileEntitlements(true, waiting, listOf(bought))
        assertTrue(active.premium)
        assertTrue(active.pendingProductIds.isEmpty())
    }

    @Test
    fun offerSelectionPrefersTheFreeTrialAndReadsItsPrice() {
        val base = CatalogOffer(null, "base", listOf(PricePhase("₹999", 999_000_000L, "P1Y")))
        val trial = CatalogOffer(
            "trial",
            "trial-token",
            listOf(PricePhase("₹0", 0L, "P7D"), PricePhase("₹999", 999_000_000L, "P1Y")),
        )
        val chosen = selectOffer(listOf(base, trial))
        assertEquals("trial-token", chosen?.offerToken)
        assertEquals("₹999", paidPhase(chosen!!)?.formattedPrice)
        assertEquals(7, trialDays(chosen))
        assertEquals(7, isoPeriodDays("P7D"))
        val deactivatedYearly = CatalogOffer(
            offerId = null,
            offerToken = "yearly-token",
            phases = listOf(PricePhase("₹999", 999_000_000L, "P1Y")),
            basePlanId = "yearly",
        )
        val annualTrial = CatalogOffer(
            offerId = "trial7",
            offerToken = "annual-trial",
            phases = listOf(
                PricePhase("₹0", 0L, "P7D"),
                PricePhase("₹999", 999_000_000L, "P1Y"),
            ),
            basePlanId = "annual",
        )
        val picked = selectOffer(listOf(deactivatedYearly, annualTrial))
        assertEquals("annual-trial", picked?.offerToken)
        assertEquals("trial7", picked?.offerId)
        assertEquals("annual", picked?.basePlanId)
        assertEquals(365, isoPeriodDays("P1Y"))
        assertEquals(30, isoPeriodDays("P1M"))
    }

    @Test
    fun signatureRoundTrip() {
        val keys = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        val publicKey = Base64.getEncoder().encodeToString(keys.public.encoded)
        val payload = "{\"productId\":\"premium_yearly\"}"
        val signer = Signature.getInstance("SHA1withRSA")
        signer.initSign(keys.private)
        signer.update(payload.toByteArray())
        val signature = Base64.getEncoder().encodeToString(signer.sign())
        assertTrue(verifyPlaySignature(payload, signature, publicKey))
        assertFalse(verifyPlaySignature("$payload ", signature, publicKey))
        assertFalse(verifyPlaySignature(payload, signature, ""))
    }

    private fun purchase(
        products: List<String>,
        state: PurchaseState = PurchaseState.PURCHASED,
        acknowledged: Boolean = false,
        profile: String? = "home",
        signed: String = "signed",
        signature: String = "sig",
        debug: Boolean = false,
    ): IncomingPurchase {
        return IncomingPurchase(
            products = products,
            state = state,
            acknowledged = acknowledged,
            profileId = profile,
            token = "token-1",
            signedData = signed,
            signature = signature,
            debugUnsigned = debug,
        )
    }
}

class ReviewCodeTest {
    @Test
    fun lowercaseAndWhitespaceMatchTheSameDigest() {
        val digest = sha256Hex(normalizeReviewCode("palace"))
        assertEquals(digest, sha256Hex("PALACE"))
        assertTrue(reviewCodeMatches("palace", digest))
        assertTrue(reviewCodeMatches("  PaLaCe  ", digest))
        assertTrue(reviewCodeMatches("PALACE", digest))
        assertFalse(reviewCodeMatches("pal ace", digest))
        assertFalse(reviewCodeMatches("   ", digest))
    }

    @Test
    fun wrongCodeDoesNotMatchTheReviewDigest() {
        assertFalse(reviewCodeMatches("wrong"))
        assertFalse(reviewCodeMatches("  wrong  "))
        assertFalse(reviewCodeMatches(""))
        assertEquals(64, ReviewCode.DIGEST.length)
        assertFalse(reviewCodeMatches("not-the-code", ReviewCode.DIGEST))
    }

    @Test
    fun fiveTriesThenAPause() {
        var window = AttemptWindow()
        val start = 1_000_000L
        repeat(ReviewCode.MAX_TRIES) { index ->
            val (result, next) = evaluateReviewCode("nope", window, start + index)
            assertEquals(CodeResult.REJECTED, result)
            window = next
        }
        val (blocked, held) = evaluateReviewCode("nope", window, start + 10)
        assertEquals(CodeResult.LIMITED, blocked)
        assertEquals(window, held)
        val (again, _) = evaluateReviewCode("nope", window, start + ReviewCode.WINDOW_MS)
        assertEquals(CodeResult.REJECTED, again)
    }

    @Test
    fun reviewGrantIsSeparateFromPlay() {
        val revoked = reconcileEntitlements(true, com.ikshanasolutions.disha.model.Entitlements(premium = true), emptyList())
        assertFalse(revoked.premium)
        assertTrue(isPremium(revoked.premium, reviewCodeUnlocked = true))
        assertTrue(isPremium(playEntitlement = true, reviewCodeUnlocked = false))
        assertFalse(isPremium(playEntitlement = false, reviewCodeUnlocked = false))
    }
}

private fun readAsset(name: String): String {
    val roots = listOf(
        File("src/main/assets"),
        File("app/src/main/assets"),
        File("android/app/src/main/assets"),
    )
    val file = roots.map { File(it, name) }.first { it.exists() }
    return file.readText()
}
