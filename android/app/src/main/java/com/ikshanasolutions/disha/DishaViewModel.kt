package com.ikshanasolutions.disha

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.view.Surface
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ikshanasolutions.disha.billing.BillingNotice
import com.ikshanasolutions.disha.billing.BillingPort
import com.ikshanasolutions.disha.billing.BillingUi
import com.ikshanasolutions.disha.billing.DebugBilling
import com.ikshanasolutions.disha.billing.FakeBillingGateway
import com.ikshanasolutions.disha.billing.PlayBillingGateway
import com.ikshanasolutions.disha.compass.CompassEngine
import com.ikshanasolutions.disha.compass.CompassPipeline
import com.ikshanasolutions.disha.compass.CompassSnapshot
import com.ikshanasolutions.disha.data.HomeStore
import com.ikshanasolutions.disha.data.SavedHome
import com.ikshanasolutions.disha.data.SavedState
import com.ikshanasolutions.disha.export.writePdf
import com.ikshanasolutions.disha.export.writeShareCard
import com.ikshanasolutions.disha.location.TrueNorthController
import com.ikshanasolutions.disha.model.AppLocale
import com.ikshanasolutions.disha.model.ContentBundle
import com.ikshanasolutions.disha.model.Entitlements
import com.ikshanasolutions.disha.model.Legal
import com.ikshanasolutions.disha.model.LibraryAccess
import com.ikshanasolutions.disha.model.PresentedScore
import com.ikshanasolutions.disha.model.ScoreKind
import com.ikshanasolutions.disha.model.StoredResult
import com.ikshanasolutions.disha.model.parseCatalog
import com.ikshanasolutions.disha.model.parseStringTable
import com.ikshanasolutions.disha.model.presentedScore
import com.ikshanasolutions.disha.model.scoreDelta
import com.ikshanasolutions.disha.model.upsertResult
import com.ikshanasolutions.disha.model.verdictForHeading
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

sealed interface Route {
    data object Welcome : Route
    data object Home : Route
    data class Compass(val checkId: String) : Route
    data class Verdict(val checkId: String) : Route
    data object Summary : Route
    data object Paywall : Route
    data object Settings : Route
    data object Homes : Route
}

class DishaViewModel(app: Application) : AndroidViewModel(app) {
    private val store = HomeStore(app)
    private var saved: SavedState = store.load()
    val content: ContentBundle? = loadContent(app)
    val loadError: String?

    private val pipeline = CompassPipeline()
    private val engine: CompassEngine
    private val trueNorth: TrueNorthController
    val billing: BillingPort

    private val _route = MutableStateFlow<Route>(if (saved.seenWelcome) Route.Home else Route.Welcome)
    val route: StateFlow<Route> = _route.asStateFlow()
    private val _locale = MutableStateFlow(saved.locale)
    val locale: StateFlow<AppLocale> = _locale.asStateFlow()
    private val _homes = MutableStateFlow(saved.homes)
    val homes: StateFlow<List<SavedHome>> = _homes.asStateFlow()
    private val _homeId = MutableStateFlow(saved.currentHomeId)
    val homeId: StateFlow<String> = _homeId.asStateFlow()
    private val _compass = MutableStateFlow(pipeline.snapshot)
    val compass: StateFlow<CompassSnapshot> = _compass.asStateFlow()
    private val _prompt = MutableStateFlow(false)
    val showLocationPrompt: StateFlow<Boolean> = _prompt.asStateFlow()
    private val _denied = MutableStateFlow(false)
    val locationDenied: StateFlow<Boolean> = _denied.asStateFlow()
    private val _toast = MutableStateFlow<Int?>(null)
    val toast: StateFlow<Int?> = _toast.asStateFlow()
    private val _billing = MutableStateFlow(BillingUi(entitlements = saved.entitlements, fake = BuildConfig.USE_FAKE_BILLING))
    val billingUi: StateFlow<BillingUi> = _billing.asStateFlow()

    private var declination: Double? = saved.declination
    private var askedLocation = saved.askedLocation
    private var displayRotation = 0

    init {
        val loaded = content
        loadError = if (loaded == null) "Could not load the checks." else null
        engine = CompassEngine(
            context = app,
            rotation = { displayRotation },
            onFix = { magnetic, pitch, roll, accuracy ->
                pipeline.onSensor(
                    magneticDegrees = magnetic,
                    pitchRadians = pitch,
                    rollRadians = roll,
                    accuracy = accuracy,
                    nowMs = System.currentTimeMillis(),
                    declinationEast = declination,
                )
                _compass.value = pipeline.snapshot
            },
            onMissing = {
                pipeline.markNoSensor()
                _compass.value = pipeline.snapshot
            },
        )
        trueNorth = TrueNorthController(app) { latitude, longitude, east ->
            declination = east
            saved = saved.copy(latitude = latitude, longitude = longitude, declination = east)
            persist()
            _compass.value = pipeline.snapshot.copy(trueNorth = true)
        }
        billing = if (BuildConfig.USE_FAKE_BILLING) {
            FakeBillingGateway(saved.entitlements)
        } else {
            PlayBillingGateway(app, BuildConfig.BILLING_LICENSE_KEY, saved.entitlements)
        }
        viewModelScope.launch {
            billing.state.collect { ui ->
                _billing.value = ui
                if (ui.entitlements != saved.entitlements) {
                    saved = saved.copy(entitlements = ui.entitlements)
                    persist()
                }
            }
        }
        billing.start()
        persist()
    }

    fun attach(activity: Activity) {
        displayRotation = currentRotation(activity)
        billing.attach(activity)
    }

    fun onHostResume() {
        billing.resume()
    }

    fun setRotation(rotation: Int) {
        displayRotation = rotation
    }

    fun begin() {
        saved = saved.copy(seenWelcome = true)
        persist()
        _route.value = Route.Home
        if (!askedLocation) _prompt.value = true
    }

    fun allowLocationPrompt() {
        askedLocation = true
        saved = saved.copy(askedLocation = true)
        persist()
        _prompt.value = false
    }

    fun skipLocationPrompt() {
        askedLocation = true
        saved = saved.copy(askedLocation = true)
        persist()
        _prompt.value = false
    }

    fun onLocationPermission(granted: Boolean) {
        _denied.value = !granted
        if (granted) trueNorth.fetch()
    }

    fun refreshLocationIfAllowed() {
        trueNorth.fetch()
    }

    fun setLocale(next: AppLocale) {
        _locale.value = next
        saved = saved.copy(locale = next)
        persist()
    }

    fun openCheck(id: String) {
        val check = content?.check(id) ?: return
        if (!access().isUnlocked(check)) {
            _route.value = Route.Paywall
            return
        }
        _route.value = Route.Compass(id)
        engine.start()
    }

    fun leaveCompass() {
        engine.stop()
    }

    fun setManual(heading: Double) {
        pipeline.setManual(heading, System.currentTimeMillis())
        _compass.value = pipeline.snapshot
    }

    fun followLive() {
        pipeline.followLive(System.currentTimeMillis())
        _compass.value = pipeline.snapshot
    }

    fun lock(checkId: String) {
        val heading = pipeline.lock(System.currentTimeMillis()) ?: return
        vibrate()
        val before = presented()?.score?.score
        val previous = currentHome().results.firstOrNull { it.checkId == checkId }
        val remedy = previous?.remedyHeading?.takeIf { it == heading }
        val next = StoredResult(
            checkId = checkId,
            heading = heading,
            trueNorth = pipeline.snapshot.trueNorth && !pipeline.snapshot.manual,
            at = System.currentTimeMillis(),
            remedyHeading = remedy,
        )
        replaceResults(upsertResult(currentHome().results, next))
        val after = presented()?.score?.score
        _toast.value = scoreDelta(before, after)
        engine.stop()
        _route.value = Route.Verdict(checkId)
    }

    fun toggleRemedy(checkId: String) {
        val bundle = content ?: return
        val current = currentHome().results.firstOrNull { it.checkId == checkId } ?: return
        val verdict = verdictForHeading(bundle.check(checkId) ?: return, current.heading, _locale.value, bundle.strings)
        if (verdict.remedies.isEmpty()) return
        val before = presented()?.score?.score
        val updated = current.copy(remedyHeading = if (current.remedyDone()) null else current.heading)
        replaceResults(upsertResult(currentHome().results, updated))
        _toast.value = scoreDelta(before, presented()?.score?.score)
    }

    fun clearHome() {
        replaceResults(emptyList())
        _toast.value = null
    }

    fun openSummary() {
        _route.value = Route.Summary
    }

    fun openPaywall() {
        _route.value = Route.Paywall
    }

    fun openSettings() {
        _route.value = Route.Settings
    }

    fun openHomes() {
        if (access().premium) _route.value = Route.Homes else _route.value = Route.Paywall
    }

    fun back() {
        _route.value = when (_route.value) {
            is Route.Compass, is Route.Verdict, Route.Summary, Route.Settings, Route.Homes -> Route.Home
            Route.Paywall -> Route.Home
            else -> Route.Home
        }
        engine.stop()
    }

    fun addHome(name: String) {
        if (!access().premium) {
            _route.value = Route.Paywall
            return
        }
        val now = System.currentTimeMillis()
        val home = SavedHome(UUID.randomUUID().toString(), name.ifBlank { "Home" }, emptyList(), now, now)
        _homes.value = _homes.value + home
        _homeId.value = home.id
        persist()
    }

    fun switchHome(id: String) {
        if (!access().premium) {
            _route.value = Route.Paywall
            return
        }
        if (_homes.value.none { it.id == id }) return
        _homeId.value = id
        persist()
        _route.value = Route.Home
    }

    fun renameHome(name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        val id = _homeId.value
        _homes.value = _homes.value.map { if (it.id == id) it.copy(name = trimmed, updatedAt = System.currentTimeMillis()) else it }
        persist()
    }

    fun purchase(productId: String) {
        billing.purchase(productId, _homeId.value)
    }

    fun restorePurchases() {
        billing.restore()
    }

    fun retryBilling() {
        billing.retry()
    }

    fun debugBilling(action: DebugBilling) {
        billing.debug(action)
    }

    fun dismissToast() {
        _toast.value = null
    }

    fun currentHome(): SavedHome {
        return _homes.value.firstOrNull { it.id == _homeId.value } ?: _homes.value.first()
    }

    fun access(): LibraryAccess {
        val entitlements = _billing.value.entitlements
        return LibraryAccess(entitlements.premium, entitlements.ownsReport(_homeId.value))
    }

    fun presented(): PresentedScore? {
        val bundle = content ?: return null
        return presentedScore(bundle, currentHome().results, access(), _locale.value)
    }

    fun shareCard(context: Context): File? {
        val bundle = content ?: return null
        val presented = presented() ?: return null
        return writeShareCard(
            context = context,
            content = bundle,
            results = currentHome().results,
            score = presented.score,
            locale = _locale.value,
            preview = presented.kind == ScoreKind.PREVIEW,
        )
    }

    fun sharePdf(context: Context): File? {
        if (!access().full) return null
        val bundle = content ?: return null
        val presented = presented() ?: return null
        return writePdf(context, bundle, currentHome().results, presented.score)
    }

    private fun replaceResults(results: List<StoredResult>) {
        val id = _homeId.value
        _homes.value = _homes.value.map { home ->
            if (home.id == id) home.copy(results = results, updatedAt = System.currentTimeMillis()) else home
        }
        persist()
    }

    private fun persist() {
        saved = SavedState(
            locale = _locale.value,
            askedLocation = askedLocation,
            seenWelcome = saved.seenWelcome || _route.value != Route.Welcome,
            latitude = saved.latitude,
            longitude = saved.longitude,
            declination = declination,
            homes = _homes.value,
            currentHomeId = _homeId.value,
            entitlements = _billing.value.entitlements,
        )
        store.save(saved)
    }

    private fun vibrate() {
        val app = getApplication<Application>()
        val vibrator = if (Build.VERSION.SDK_INT >= 31) {
            app.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            app.getSystemService(Vibrator::class.java)
        }
        vibrator?.vibrate(VibrationEffect.createOneShot(28, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    override fun onCleared() {
        engine.stop()
        trueNorth.stop()
        super.onCleared()
    }

    companion object {
        private fun currentRotation(activity: Activity): Int {
            return if (Build.VERSION.SDK_INT >= 30) {
                activity.display?.rotation ?: Surface.ROTATION_0
            } else {
                @Suppress("DEPRECATION")
                activity.windowManager.defaultDisplay.rotation
            }
        }

        private fun loadContent(context: Context): ContentBundle? {
            return try {
                val catalog = parseCatalog(context.assets.open("checks.json").bufferedReader().use { it.readText() })
                val strings = parseStringTable(context.assets.open("ui.json").bufferedReader().use { it.readText() })
                ContentBundle(catalog, strings)
            } catch (_: Exception) {
                null
            }
        }
    }
}

fun shareFile(context: Context, file: File, mime: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

fun openLink(context: Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}

fun openAppSettings(context: Context) {
    val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

fun openSubscriptionManagement(context: Context) {
    openLink(context, Legal.MANAGE_SUBS)
}

fun noticeText(content: ContentBundle, notice: BillingNotice, locale: AppLocale): String? {
    val key = when (notice) {
        BillingNotice.NONE -> return null
        BillingNotice.PENDING -> "paymentPending"
        BillingNotice.RETRY -> "billingRetry"
        BillingNotice.UNAVAILABLE -> "billingUnavailable"
        BillingNotice.VERIFY -> "verifyFailed"
        BillingNotice.GENERIC -> "billingRetry"
    }
    return content.t(key, locale)
}
