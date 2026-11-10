package com.ikshanasolutions.disha.billing

import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.IncomingPurchase
import com.ikshanasolutions.disha.model.Products
import com.ikshanasolutions.disha.model.PurchaseDecision
import com.ikshanasolutions.disha.model.PurchaseState
import com.ikshanasolutions.disha.model.StoreProduct
import com.ikshanasolutions.disha.model.decidePurchase
import com.ikshanasolutions.disha.model.reconcileEntitlements
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.UUID

/**
 * Debug stand-in for Play Billing so the paywall, restore, pending payment,
 * already-owned, and interrupted purchase paths can be exercised without a
 * Play Console app. The formatted prices are stand-in ProductDetails values.
 * The release build never constructs this class.
 *
 * Purchases are kept, including unacknowledged ones, and replayed on start and
 * resume through the same [decidePurchase] path as Play.
 */
class FakeBillingGateway(initial: Entitlements) : BillingPort {
    private val _state = MutableStateFlow(
        BillingUi(
            products = catalog(),
            loading = false,
            failed = false,
            entitlements = initial,
            fake = true,
        ),
    )
    override val state: StateFlow<BillingUi> = _state.asStateFlow()

    private val purchases = mutableListOf<IncomingPurchase>()
    private var next: DebugBilling? = null
    private var disconnected = false
    private var emptyCatalog = false

    override fun start() {
        resume()
    }

    override fun resume() {
        if (disconnected) return
        deliver(querySucceeded = true)
    }

    override fun retry() {
        disconnected = false
        emptyCatalog = false
        _state.update { it.copy(products = catalog(), loading = false, failed = false, notice = BillingNotice.NONE) }
        deliver(querySucceeded = true)
    }

    override fun restore() {
        if (disconnected) {
            _state.update { it.copy(notice = BillingNotice.RETRY, failed = true, loading = false) }
            return
        }
        deliver(querySucceeded = true)
    }

    override fun purchase(productId: String, homeId: String) {
        if (disconnected || emptyCatalog) {
            _state.update { it.copy(notice = BillingNotice.RETRY, failed = true, loading = false, purchasingId = null) }
            return
        }
        val action = next
        next = null
        when (action) {
            DebugBilling.CANCEL_NEXT -> {
                _state.update { it.copy(purchasingId = null, notice = BillingNotice.NONE) }
                return
            }
            DebugBilling.ALREADY_OWNED_NEXT -> {
                if (purchases.none { productId in it.products && it.state == PurchaseState.PURCHASED }) {
                    purchases += owned(productId, homeId, acknowledged = true)
                }
                deliver(querySucceeded = true)
                return
            }
            DebugBilling.PENDING_NEXT -> {
                purchases.removeAll { productId in it.products }
                purchases += owned(productId, homeId, acknowledged = false, state = PurchaseState.PENDING)
                deliver(querySucceeded = true)
                return
            }
            DebugBilling.LEAVE_UNACKNOWLEDGED -> {
                purchases.removeAll { productId in it.products }
                purchases += owned(productId, homeId, acknowledged = false)
                _state.update { it.copy(purchasingId = null, notice = BillingNotice.NONE) }
                return
            }
            else -> Unit
        }
        if (purchases.any { productId in it.products && it.state == PurchaseState.PURCHASED }) {
            deliver(querySucceeded = true)
            return
        }
        purchases += owned(productId, homeId, acknowledged = false)
        deliver(querySucceeded = true)
    }

    override fun debug(action: DebugBilling) {
        when (action) {
            DebugBilling.DISCONNECT -> {
                disconnected = true
                _state.update { it.copy(loading = false, failed = true, products = emptyList(), notice = BillingNotice.UNAVAILABLE) }
            }
            DebugBilling.EMPTY_CATALOG -> {
                emptyCatalog = true
                _state.update { it.copy(loading = false, failed = true, products = emptyList(), notice = BillingNotice.RETRY) }
            }
            DebugBilling.REVOKE -> {
                purchases.clear()
                deliver(querySucceeded = true)
            }
            DebugBilling.COMPLETE_PENDING -> {
                for (index in purchases.indices) {
                    val purchase = purchases[index]
                    if (purchase.state == PurchaseState.PENDING) {
                        purchases[index] = purchase.copy(state = PurchaseState.PURCHASED, acknowledged = false)
                    }
                }
                deliver(querySucceeded = true)
            }
            else -> next = action
        }
    }

    private fun deliver(querySucceeded: Boolean) {
        val decisions = purchases.map { purchase ->
            decidePurchase(purchase, purchase.profileId.orEmpty(), licenseKey = "", allowDebug = true)
        }
        val nextEntitlements = reconcileEntitlements(querySucceeded, _state.value.entitlements, decisions)
        for (index in purchases.indices) {
            val decision = decisions.getOrNull(index)
            if (decision is PurchaseDecision.Grant && decision.acknowledgeToken != null) {
                purchases[index] = purchases[index].copy(acknowledged = true)
            }
        }
        val pending = decisions.any { it is PurchaseDecision.Pending }
        val rejected = decisions.any { it is PurchaseDecision.Rejected }
        _state.update {
            it.copy(
                entitlements = nextEntitlements,
                purchasingId = null,
                loading = false,
                notice = when {
                    rejected -> BillingNotice.VERIFY
                    pending -> BillingNotice.PENDING
                    else -> BillingNotice.NONE
                },
            )
        }
    }

    private fun owned(
        productId: String,
        homeId: String,
        acknowledged: Boolean,
        state: PurchaseState = PurchaseState.PURCHASED,
    ): IncomingPurchase {
        return IncomingPurchase(
            products = listOf(productId),
            state = state,
            acknowledged = acknowledged,
            profileId = homeId,
            token = UUID.randomUUID().toString(),
            signedData = "",
            signature = "",
            debugUnsigned = true,
        )
    }

    private fun catalog(): List<StoreProduct> {
        return listOf(
            StoreProduct(Products.MONTHLY, "₹149", "fake-monthly", null, "P1M", "Monthly"),
            StoreProduct(Products.YEARLY, "₹999", "fake-yearly", 7, "P1Y", "Yearly"),
            StoreProduct(Products.LIFETIME, "₹2,499", null, null, null, "Lifetime"),
            StoreProduct(Products.HOME_REPORT, "₹299", null, null, null, "Home Report"),
        )
    }
}
