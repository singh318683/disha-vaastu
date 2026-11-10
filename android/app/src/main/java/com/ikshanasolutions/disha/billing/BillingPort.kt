package com.ikshanasolutions.disha.billing

import android.app.Activity
import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.StoreProduct
import kotlinx.coroutines.flow.StateFlow

enum class BillingNotice { NONE, PENDING, RETRY, UNAVAILABLE, VERIFY, GENERIC }

enum class DebugBilling {
    PENDING_NEXT,
    CANCEL_NEXT,
    ALREADY_OWNED_NEXT,
    DISCONNECT,
    EMPTY_CATALOG,
    REVOKE,
    LEAVE_UNACKNOWLEDGED,
    COMPLETE_PENDING,
}

data class BillingUi(
    val products: List<StoreProduct> = emptyList(),
    val loading: Boolean = true,
    val failed: Boolean = false,
    val entitlements: Entitlements = Entitlements(),
    val purchasingId: String? = null,
    val notice: BillingNotice = BillingNotice.NONE,
    val fake: Boolean = false,
)

interface BillingPort {
    val state: StateFlow<BillingUi>
    fun start()
    fun resume()
    fun purchase(productId: String, homeId: String)
    fun restore()
    fun retry()
    fun attach(activity: Activity) {}
    fun debug(action: DebugBilling) {}
}
