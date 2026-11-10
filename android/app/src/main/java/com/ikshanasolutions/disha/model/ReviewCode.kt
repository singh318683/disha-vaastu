package com.ikshanasolutions.disha.model

import java.security.MessageDigest
import java.util.Locale

/**
 * Play review has no account to sign in with. Settings accepts a code, and
 * only the SHA-256 of that code lives here. Do not commit the code itself.
 * Rotate it by replacing [DIGEST].
 */
object ReviewCode {
    const val DIGEST = "d71ec7997c44675c82be8e968d82021dcf9e61975ca14e2111b1e1b44aff7c59"
    const val MAX_TRIES = 5
    const val WINDOW_MS = 60_000L
}

fun normalizeReviewCode(raw: String): String = raw.trim().uppercase(Locale.US)

fun sha256Hex(text: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte -> "%02x".format(byte) }
}

fun reviewCodeMatches(raw: String, digest: String = ReviewCode.DIGEST): Boolean {
    val normalized = normalizeReviewCode(raw)
    if (normalized.isEmpty()) return false
    return sha256Hex(normalized) == digest
}

/** Premium is Play's entitlement or the local reviewer code. Billing does not clear the code. */
fun isPremium(playEntitlement: Boolean, reviewCodeUnlocked: Boolean): Boolean {
    return playEntitlement || reviewCodeUnlocked
}

data class AttemptWindow(val times: List<Long> = emptyList()) {
    fun recent(nowMs: Long, windowMs: Long = ReviewCode.WINDOW_MS): List<Long> {
        return times.filter { nowMs - it in 0 until windowMs }
    }

    fun allowed(nowMs: Long, maxTries: Int = ReviewCode.MAX_TRIES, windowMs: Long = ReviewCode.WINDOW_MS): Boolean {
        return recent(nowMs, windowMs).size < maxTries
    }
}

enum class CodeResult { UNLOCKED, REJECTED, LIMITED }

fun evaluateReviewCode(raw: String, window: AttemptWindow, nowMs: Long): Pair<CodeResult, AttemptWindow> {
    if (!window.allowed(nowMs)) return CodeResult.LIMITED to window
    val next = AttemptWindow(window.recent(nowMs) + nowMs)
    val result = if (reviewCodeMatches(raw)) CodeResult.UNLOCKED else CodeResult.REJECTED
    return result to next
}
