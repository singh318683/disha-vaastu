package com.ikshanasolutions.disha.billing

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.ikshanasolutions.disha.model.BillingCodes
import com.ikshanasolutions.disha.model.CatalogOffer
import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.IncomingPurchase
import com.ikshanasolutions.disha.model.PricePhase
import com.ikshanasolutions.disha.model.Products
import com.ikshanasolutions.disha.model.PurchaseDecision
import com.ikshanasolutions.disha.model.PurchaseState
import com.ikshanasolutions.disha.model.ResponsePolicy
import com.ikshanasolutions.disha.model.StoreProduct
import com.ikshanasolutions.disha.model.catalogFailed
import com.ikshanasolutions.disha.model.decidePurchase
import com.ikshanasolutions.disha.model.mergeEntitlements
import com.ikshanasolutions.disha.model.paidPhase
import com.ikshanasolutions.disha.model.reconcileEntitlements
import com.ikshanasolutions.disha.model.reconnectDelayMs
import com.ikshanasolutions.disha.model.responsePolicy
import com.ikshanasolutions.disha.model.selectOffer
import com.ikshanasolutions.disha.model.shouldRetryConnect
import com.ikshanasolutions.disha.model.trialDays
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.lang.ref.WeakReference

/**
 * Google Play Billing Library, no wrapper.
 *
 * Lessons this class is built around:
 * 1. acknowledgePurchase runs only after the signature verifies and the grant is saved.
 * 2. ITEM_ALREADY_OWNED queries purchases and restores. It is not shown as an error.
 * 3. queryPurchasesAsync runs on start and every resume, including pending-to-purchased
 *    and anything still unacknowledged.
 * 4. Purchase.products is never indexed without a guard.
 * 5. Pending shows a notice. User cancel is silent. Unavailable / disconnected reconnects.
 *    An empty catalog becomes a retry state, not a spinner.
 * 6. home_report is a non-consumable bound to one home via obfuscatedProfileId.
 * 7. The Play license public key is read from BuildConfig (local.properties or env).
 *    On-device SHA1withRSA is a client check. Server verification with the Play
 *    Developer API is the recommended follow-up.
 */
class PlayBillingGateway(
    context: android.content.Context,
    private val licenseKey: String,
    initial: Entitlements,
) : BillingPort, PurchasesUpdatedListener {
    private val handler = Handler(Looper.getMainLooper())
    private val _state = MutableStateFlow(BillingUi(entitlements = initial, loading = true, fake = false))
    override val state: StateFlow<BillingUi> = _state.asStateFlow()

    private val client: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder().enableOneTimeProducts().build(),
        )
        .build()

    private var activityRef = WeakReference<Activity>(null)
    private var detailsById: Map<String, ProductDetails> = emptyMap()
    private var attempt = 0
    private var started = false
    private var subsDone = false
    private var inAppDone = false
    private var subsOk = false
    private var inAppOk = false
    private val collected = mutableListOf<Purchase>()
    private var activeHomeId = ""

    override fun attach(activity: Activity) {
        activityRef = WeakReference(activity)
    }

    override fun start() {
        if (started && client.isReady) {
            queryAll()
            return
        }
        started = true
        connect()
    }

    override fun resume() {
        if (client.isReady) queryAll() else connect()
    }

    override fun retry() {
        attempt = 0
        _state.update { it.copy(loading = true, failed = false, notice = BillingNotice.NONE) }
        if (client.isReady) queryAll() else connect()
    }

    override fun restore() {
        if (client.isReady) queryAll() else connect()
    }

    override fun purchase(productId: String, homeId: String) {
        val activity = activityRef.get()
        val details = detailsById[productId]
        if (activity == null || details == null) {
            _state.update { it.copy(notice = BillingNotice.RETRY, failed = it.products.isEmpty(), loading = false) }
            return
        }
        activeHomeId = homeId
        val product = _state.value.products.firstOrNull { it.id == productId }
        val paramsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details)
        val token = product?.offerToken
        if (!token.isNullOrBlank()) paramsBuilder.setOfferToken(token)
        val flow = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(paramsBuilder.build()))
            .setObfuscatedProfileId(homeId)
            .build()
        _state.update { it.copy(purchasingId = productId, notice = BillingNotice.NONE) }
        val result = client.launchBillingFlow(activity, flow)
        when (responsePolicy(result.responseCode)) {
            ResponsePolicy.RESTORE -> queryAll()
            ResponsePolicy.RETRY -> scheduleReconnect()
            ResponsePolicy.SILENT -> _state.update { it.copy(purchasingId = null) }
            ResponsePolicy.DELIVER -> Unit
            ResponsePolicy.ERROR -> _state.update {
                it.copy(purchasingId = null, notice = BillingNotice.GENERIC)
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (responsePolicy(result.responseCode)) {
            ResponsePolicy.SILENT -> _state.update { it.copy(purchasingId = null) }
            ResponsePolicy.RESTORE -> {
                _state.update { it.copy(purchasingId = null) }
                queryAll()
            }
            ResponsePolicy.RETRY -> scheduleReconnect()
            ResponsePolicy.DELIVER -> deliver(purchases.orEmpty(), querySucceeded = true, fromQuery = false)
            ResponsePolicy.ERROR -> _state.update {
                it.copy(purchasingId = null, notice = BillingNotice.GENERIC)
            }
        }
    }

    private fun connect() {
        handler.removeCallbacksAndMessages(null)
        if (client.isReady) {
            queryAll()
            return
        }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingCodes.OK) {
                    attempt = 0
                    queryAll()
                } else if (responsePolicy(result.responseCode) == ResponsePolicy.RETRY) {
                    scheduleReconnect()
                } else {
                    _state.update {
                        it.copy(
                            loading = false,
                            failed = it.products.isEmpty(),
                            notice = BillingNotice.UNAVAILABLE,
                        )
                    }
                }
            }

            override fun onBillingServiceDisconnected() {
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!shouldRetryConnect(attempt)) {
            _state.update {
                it.copy(loading = false, failed = it.products.isEmpty(), notice = BillingNotice.UNAVAILABLE, purchasingId = null)
            }
            return
        }
        val delay = reconnectDelayMs(attempt)
        attempt += 1
        handler.postDelayed({ connect() }, delay)
    }

    private fun queryAll() {
        queryCatalog()
        queryPurchases()
    }

    private fun queryCatalog() {
        val products = Products.subscriptions.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        } + listOf(Products.LIFETIME, Products.HOME_REPORT).map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        client.queryProductDetailsAsync(params) { result, list ->
            val details = list.orEmpty()
            if (catalogFailed(result.responseCode, details.size)) {
                _state.update { current ->
                    current.copy(loading = false, failed = current.products.isEmpty(), notice = BillingNotice.RETRY)
                }
                return@queryProductDetailsAsync
            }
            detailsById = details.associateBy { it.productId }
            val mapped = details.mapNotNull { mapProduct(it) }
            _state.update {
                it.copy(
                    products = mapped,
                    loading = false,
                    failed = mapped.isEmpty(),
                    notice = if (mapped.isEmpty()) BillingNotice.RETRY else BillingNotice.NONE,
                )
            }
        }
    }

    private fun queryPurchases() {
        collected.clear()
        subsDone = false
        inAppDone = false
        subsOk = false
        inAppOk = false
        queryType(BillingClient.ProductType.SUBS)
        queryType(BillingClient.ProductType.INAPP)
    }

    private fun queryType(type: String) {
        val params = QueryPurchasesParams.newBuilder().setProductType(type).build()
        client.queryPurchasesAsync(params) { result, purchases ->
            val ok = result.responseCode == BillingCodes.OK
            if (type == BillingClient.ProductType.SUBS) {
                subsDone = true
                subsOk = ok
            } else {
                inAppDone = true
                inAppOk = ok
            }
            if (ok) collected += purchases.orEmpty()
            if (subsDone && inAppDone) {
                if (subsOk && inAppOk) {
                    deliver(collected.toList(), querySucceeded = true, fromQuery = true)
                } else if (responsePolicy(result.responseCode) == ResponsePolicy.RETRY) {
                    scheduleReconnect()
                } else {
                    _state.update { it.copy(purchasingId = null) }
                }
            }
        }
    }

    private fun deliver(purchases: List<Purchase>, querySucceeded: Boolean, fromQuery: Boolean) {
        val previous = _state.value.entitlements
        val decisions = purchases.map { purchase ->
            decidePurchase(
                purchase = toIncoming(purchase),
                fallbackHomeId = activeHomeId,
                licenseKey = licenseKey,
                allowDebug = false,
            )
        }
        val next = if (fromQuery && querySucceeded) {
            reconcileEntitlements(true, previous, decisions)
        } else if (!querySucceeded) {
            previous
        } else {
            mergeEntitlements(previous, decisions)
        }
        _state.update { current ->
            current.copy(
                entitlements = next,
                purchasingId = null,
                notice = noticeFor(decisions, current.notice, fromQuery),
            )
        }
        for (decision in decisions) {
            val token = (decision as? PurchaseDecision.Grant)?.acknowledgeToken ?: continue
            val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()
            client.acknowledgePurchase(params) { }
        }
    }

    private fun noticeFor(
        decisions: List<PurchaseDecision>,
        previous: BillingNotice,
        fromQuery: Boolean,
    ): BillingNotice {
        if (decisions.any { it is PurchaseDecision.Rejected }) return BillingNotice.VERIFY
        if (decisions.any { it is PurchaseDecision.Pending }) return BillingNotice.PENDING
        if (!fromQuery && decisions.any { it is PurchaseDecision.Grant }) return BillingNotice.NONE
        return if (previous == BillingNotice.PENDING && decisions.none { it is PurchaseDecision.Pending }) {
            BillingNotice.NONE
        } else {
            previous.takeUnless { it == BillingNotice.GENERIC } ?: BillingNotice.NONE
        }
    }

    private fun toIncoming(purchase: Purchase): IncomingPurchase {
        val products = purchase.products.orEmpty().filter { it.isNotBlank() }
        val state = when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> PurchaseState.PURCHASED
            Purchase.PurchaseState.PENDING -> PurchaseState.PENDING
            else -> PurchaseState.OTHER
        }
        return IncomingPurchase(
            products = products,
            state = state,
            acknowledged = purchase.isAcknowledged,
            profileId = purchase.accountIdentifiers?.obfuscatedProfileId,
            token = purchase.purchaseToken,
            signedData = purchase.originalJson,
            signature = purchase.signature,
            debugUnsigned = false,
        )
    }

    private fun mapProduct(details: ProductDetails): StoreProduct? {
        val id = details.productId
        if (id.isBlank()) return null
        if (details.productType == BillingClient.ProductType.SUBS) {
            val offers = details.subscriptionOfferDetails.orEmpty().map { offer ->
                CatalogOffer(
                    offerId = offer.offerId,
                    offerToken = offer.offerToken,
                    phases = offer.pricingPhases.pricingPhaseList.map { phase ->
                        PricePhase(phase.formattedPrice, phase.priceAmountMicros, phase.billingPeriod)
                    },
                )
            }
            val chosen = selectOffer(offers) ?: return null
            val paid = paidPhase(chosen) ?: return null
            return StoreProduct(
                id = id,
                formattedPrice = paid.formattedPrice,
                offerToken = chosen.offerToken,
                trialDays = trialDays(chosen),
                billingPeriod = paid.billingPeriod,
                title = details.name ?: details.title,
            )
        }
        val oneTime = details.oneTimePurchaseOfferDetails ?: return null
        val formatted = oneTime.formattedPrice
        if (formatted.isNullOrBlank()) return null
        return StoreProduct(
            id = id,
            formattedPrice = formatted,
            offerToken = null,
            trialDays = null,
            billingPeriod = null,
            title = details.name ?: details.title,
        )
    }
}
