package com.ikshanasolutions.disha.ui

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ikshanasolutions.disha.DishaViewModel
import com.ikshanasolutions.disha.Route
import com.ikshanasolutions.disha.billing.BillingNotice
import com.ikshanasolutions.disha.billing.DebugBilling
import com.ikshanasolutions.disha.model.AppLocale
import com.ikshanasolutions.disha.model.ContentBundle
import com.ikshanasolutions.disha.model.Legal
import com.ikshanasolutions.disha.model.Products
import com.ikshanasolutions.disha.model.StoreProduct
import com.ikshanasolutions.disha.model.VaastuCheck
import com.ikshanasolutions.disha.model.homePages
import com.ikshanasolutions.disha.model.periodWord
import com.ikshanasolutions.disha.model.priceWithPeriod
import com.ikshanasolutions.disha.model.verdictForHeading
import com.ikshanasolutions.disha.noticeText
import com.ikshanasolutions.disha.openAppSettings
import com.ikshanasolutions.disha.openLink
import com.ikshanasolutions.disha.openSubscriptionManagement
import com.ikshanasolutions.disha.shareFile
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun DishaRoot(vm: DishaViewModel) {
    val locale by vm.locale.collectAsState()
    val route by vm.route.collectAsState()
    val prompt by vm.showLocationPrompt.collectAsState()
    val toast by vm.toast.collectAsState()
    val context = LocalContext.current
    val view = LocalView.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        vm.onLocationPermission(granted)
    }
    DisposableEffect(view) {
        vm.setRotation(view.display?.rotation ?: 0)
        onDispose { }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(1600)
            vm.dismissToast()
        }
    }
    CompositionLocalProvider(LocalLocale provides locale) {
        Box(Modifier.fillMaxSize().background(Field)) {
            RoyalBackdrop()
            val content = vm.content
            if (content == null) {
                Text(vm.loadError ?: "", style = bodyStyle(), modifier = Modifier.padding(24.dp))
            } else {
                when (val current = route) {
                    Route.Welcome -> WelcomeScreen(vm, content)
                    Route.Home -> HomeScreen(vm, content)
                    is Route.Compass -> CompassScreen(vm, content, current.checkId)
                    is Route.Verdict -> VerdictScreen(vm, content, current.checkId)
                    Route.Summary -> SummaryScreen(vm, content)
                    Route.Paywall -> PaywallScreen(vm, content)
                    Route.Settings -> SettingsScreen(vm, content)
                    Route.Homes -> HomesScreen(vm, content)
                }
            }
            if (prompt && content != null) {
                LocationPrompt(content, locale, onAllow = {
                    vm.allowLocationPrompt()
                    launcher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                }, onSkip = { vm.skipLocationPrompt() })
            }
            val scoreToast = toast
            if (scoreToast != null) {
                Text(
                    text = if (scoreToast > 0) "+$scoreToast" else scoreToast.toString(),
                    style = displayStyle(28.sp, Gold),
                    modifier = Modifier.align(Alignment.Center).background(Navy, RoundedCornerShape(16.dp)).padding(horizontal = 18.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun WelcomeScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    ScreenBox("welcome-screen") {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Wordmark()
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Column {
                Text(content.t("welcomeTitle", locale), style = displayStyle(40.sp))
                Spacer(Modifier.height(12.dp))
                Text(content.t("welcomeLine", locale), style = bodyStyle(18.sp, Muted))
            }
            GoldButton(content.t("start", locale), description = "start") { vm.begin() }
        }
    }
}

@Composable
private fun HomeScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val pages = remember(content) { homePages(content.catalog.checks) }
    val pager = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()
    val presented = vm.presented()
    ScreenBox("home-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Wordmark()
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.openSettings() }) {
                    Text(content.t("settings", locale), style = bodyStyle(14.sp, Gold))
                }
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, Gold.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                    .background(CardNavy)
                    .clickable { vm.openSummary() }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
                    .semantics { contentDescription = "home-score" },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ScoreRing(presented?.score?.score, 52.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        presented?.score?.band?.title(content, locale) ?: content.t("noScoreYet", locale),
                        style = displayStyle(20.sp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    val coverage = presented?.score?.let { score ->
                        content.fill("basedOn", locale, mapOf("done" to score.done.toString(), "total" to score.total.toString()))
                    }
                    Text(
                        if (presented?.kind?.name == "PREVIEW" && coverage != null) {
                            "${content.t("scorePreview", locale)} · $coverage"
                        } else {
                            coverage ?: content.t("standPoint", locale)
                        },
                        style = bodyStyle(12.sp, Muted),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            HorizontalPager(state = pager, modifier = Modifier.weight(1f)) { page ->
                CategoryPage(vm, content, pages[page], locale)
            }
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.Center) {
                pages.forEachIndexed { index, _ ->
                    val selected = pager.currentPage == index
                    Box(
                        Modifier
                            .padding(horizontal = 3.dp)
                            .height(6.dp)
                            .width(if (selected) 16.dp else 6.dp)
                            .clip(CircleShape)
                            .background(if (selected) Gold else Gold.copy(alpha = 0.28f)),
                    )
                }
            }
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                pages.forEachIndexed { index, page ->
                    val selected = pager.currentPage == index
                    Text(
                        page.title.text(locale),
                        style = bodyStyle(12.sp, if (selected) Ink else Cream, bold = selected),
                        maxLines = 1,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (selected) Gold else CardNavy)
                            .clickable { scope.launch { pager.animateScrollToPage(index) } }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryPage(vm: DishaViewModel, content: ContentBundle, page: com.ikshanasolutions.disha.model.HomePage, locale: AppLocale) {
    val homes by vm.homes.collectAsState()
    val homeId by vm.homeId.collectAsState()
    val saved = homes.firstOrNull { it.id == homeId }?.results.orEmpty().associateBy { it.checkId }
    val access = vm.access()
    Column(Modifier.fillMaxSize()) {
        Text(page.title.text(locale), style = displayStyle(26.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(8.dp))
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val gap = 8.dp
            val cardHeight = ((maxHeight - gap * 2) / 3).coerceAtMost(156.dp)
            Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                page.checks.chunked(2).forEach { row ->
                    Row(Modifier.height(cardHeight), horizontalArrangement = Arrangement.spacedBy(gap)) {
                        row.forEach { check ->
                            CheckCard(vm, content, check, saved[check.id], access.isUnlocked(check), locale, Modifier.weight(1f))
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun CheckCard(
    vm: DishaViewModel,
    content: ContentBundle,
    check: VaastuCheck,
    result: com.ikshanasolutions.disha.model.StoredResult?,
    unlocked: Boolean,
    locale: AppLocale,
    modifier: Modifier,
) {
    val verdict = if (unlocked && result != null) verdictForHeading(check, result.heading, locale, content.strings) else null
    Column(
        modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, Gold.copy(alpha = 0.28f), RoundedCornerShape(16.dp))
            .background(CardNavy)
            .clickable { vm.openCheck(check.id) }
            .padding(10.dp)
            .semantics { contentDescription = if (unlocked) "check-${check.id}" else "locked-check" },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MiniCompass(Modifier.size(32.dp))
            Spacer(Modifier.weight(1f))
            if (!unlocked) {
                LockMark(Modifier.size(18.dp))
            } else if (verdict != null) {
                val (label, color) = when (verdict.rating) {
                    "auspicious" -> content.t("chipBest", locale) to Good
                    "neutral" -> content.t("chipNeutral", locale) to Gold
                    else -> content.t("chipAvoid", locale) to Avoid
                }
                Text(
                    label,
                    style = bodyStyle(11.sp, color, bold = true),
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.18f))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
        Text(
            check.title.text(locale),
            style = displayStyle(16.sp),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            check.blurb.text(locale),
            style = bodyStyle(12.sp, Muted),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
        if (unlocked && verdict == null) {
            Text(content.t("notChecked", locale), style = bodyStyle(11.sp, Muted), modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun CompassScreen(vm: DishaViewModel, content: ContentBundle, checkId: String) {
    val locale by vm.locale.collectAsState()
    val reading by vm.compass.collectAsState()
    val denied by vm.locationDenied.collectAsState()
    val check = content.check(checkId)
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        vm.onLocationPermission(granted)
    }
    DisposableEffect(checkId) {
        onDispose { vm.leaveCompass() }
    }
    BackHandler { vm.back() }
    val label = content.strings.t("dir.${reading.let { com.ikshanasolutions.disha.model.directionFromHeading(reading.displayHeading) }}", locale)
    ScreenBox("compass-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), style = bodyStyle(16.sp, Gold)) }
                Text(check?.title?.text(locale) ?: "", style = displayStyle(24.sp), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Text(check?.instructions?.text(locale) ?: "", style = bodyStyle(14.sp, Muted), maxLines = 3, overflow = TextOverflow.Ellipsis)
            CompassDial(
                heading = reading.displayHeading,
                interactive = !reading.live || reading.manual || reading.noSensor,
                onHeading = { vm.setManual(it) },
                modifier = Modifier.weight(1f).padding(vertical = 4.dp),
            )
            Text(label, style = displayStyle(32.sp), modifier = Modifier.align(Alignment.CenterHorizontally))
            Column(Modifier.fillMaxWidth().height(72.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                when {
                    reading.waiting && !reading.hasHeading -> {
                        Text(content.t("waitingCompass", locale), style = bodyStyle(13.sp, Muted), textAlign = TextAlign.Center)
                        Text(content.t("setByHand", locale), style = bodyStyle(13.sp, Muted), textAlign = TextAlign.Center)
                    }
                    reading.needsCalibration && reading.live && !reading.manual -> {
                        Text(content.t("calibration", locale), style = bodyStyle(13.sp, Gold), textAlign = TextAlign.Center)
                    }
                    !reading.flat && reading.live && !reading.manual -> {
                        Text(content.t("flat", locale), style = bodyStyle(13.sp, Gold), textAlign = TextAlign.Center)
                    }
                    reading.manual -> {
                        if (reading.noSensor) {
                            Text(content.t("noCompassDevice", locale), style = bodyStyle(13.sp, Gold), textAlign = TextAlign.Center)
                        }
                        Text(content.t("setByHand", locale), style = bodyStyle(13.sp, Muted), textAlign = TextAlign.Center)
                        if (reading.live) {
                            TextButton(onClick = { vm.followLive() }) {
                                Text(content.t("followLive", locale), style = bodyStyle(14.sp, Gold, bold = true))
                            }
                        }
                    }
                    reading.trueNorth -> Text(content.t("trueNorth", locale), style = bodyStyle(13.sp, Muted), textAlign = TextAlign.Center)
                    else -> {
                        Text(content.t("usingMagnetic", locale), style = bodyStyle(13.sp, Muted), textAlign = TextAlign.Center)
                        TextButton(onClick = {
                            if (denied) openAppSettings(context) else launcher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                        }) {
                            Text(if (denied) content.t("openSettings", locale) else content.t("locationAllow", locale), style = bodyStyle(14.sp, Gold, bold = true))
                        }
                    }
                }
            }
            if (!reading.live || reading.manual || reading.noSensor) {
                DirectionChips(content, locale) { vm.setManual(it) }
            }
            GoldButton(content.t("lock", locale), enabled = reading.hasHeading, description = "lock-direction") {
                vm.lock(checkId)
            }
        }
    }
}

@Composable
private fun DirectionChips(content: ContentBundle, locale: AppLocale, onPick: (Double) -> Unit) {
    val chips = listOf("N" to 0.0, "NE" to 45.0, "E" to 90.0, "SE" to 135.0, "S" to 180.0, "SW" to 225.0, "W" to 270.0, "NW" to 315.0)
    Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        chips.take(4).forEach { (name, degrees) ->
            Text(
                content.strings.t("dir.$name", locale),
                style = bodyStyle(12.sp, Cream, bold = true),
                modifier = Modifier.clip(CircleShape).background(CardNavy).clickable { onPick(degrees) }.padding(horizontal = 8.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun VerdictScreen(vm: DishaViewModel, content: ContentBundle, checkId: String) {
    val locale by vm.locale.collectAsState()
    val homes by vm.homes.collectAsState()
    val homeId by vm.homeId.collectAsState()
    val saved = homes.firstOrNull { it.id == homeId }?.results?.firstOrNull { it.checkId == checkId }
    val check = content.check(checkId)
    BackHandler { vm.back() }
    ScreenBox("verdict-screen") {
        if (check == null || saved == null) {
            TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), color = Gold) }
            return@ScreenBox
        }
        val verdict = verdictForHeading(check, saved.heading, locale, content.strings)
        val access = vm.access()
        val remedies = access.visibleRemedies(verdict.remedies)
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), style = bodyStyle(16.sp, Gold)) }
                Spacer(Modifier.weight(1f))
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Text(check.title.text(locale), style = displayStyle(32.sp), maxLines = 2)
            Text(verdict.placementLine, style = displayStyle(26.sp, ratingColor(verdict.rating)))
            Text(verdict.slotLine, style = bodyStyle(14.sp, Muted), maxLines = 2)
            if (verdict.toward != null) Text(verdict.toward, style = bodyStyle(14.sp, Muted))
            Text(verdict.bestNote, style = bodyStyle(14.sp, Cream), modifier = Modifier.padding(top = 8.dp), maxLines = 3, overflow = TextOverflow.Ellipsis)
            Text(verdict.meaning, style = bodyStyle(14.sp, Muted), modifier = Modifier.padding(top = 4.dp), maxLines = 3, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(8.dp))
            if (verdict.remedies.isEmpty()) {
                Text(content.t("nothingToMove", locale), style = bodyStyle(15.sp))
            } else {
                Text(content.t("toSoften", locale), style = bodyStyle(13.sp, Gold, bold = true))
                remedies.forEach { remedy ->
                    Text(remedy, style = bodyStyle(14.sp), modifier = Modifier.padding(top = 6.dp).background(CardNavy, RoundedCornerShape(14.dp)).padding(12.dp).fillMaxWidth(), maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
                if (!access.full && verdict.remedies.size > 1) {
                    TextButton(onClick = { vm.openPaywall() }) {
                        Text(content.t("moreRemedies", locale), style = bodyStyle(14.sp, Gold, bold = true))
                    }
                }
                TextButton(onClick = { vm.toggleRemedy(checkId) }) {
                    val label = if (saved.remedyDone()) content.t("remedyDone", locale) else content.t("markRemedy", locale)
                    Text(label, style = bodyStyle(14.sp, Gold, bold = true))
                }
            }
            Spacer(Modifier.weight(1f))
            GoldButton(content.t("checkAnother", locale)) { vm.back() }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("seeHarmony", locale)) { vm.openSummary() }
        }
    }
}

@Composable
private fun SummaryScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val context = LocalContext.current
    val presented = vm.presented()
    val score = presented?.score
    var confirm by remember { mutableStateOf(false) }
    BackHandler { vm.back() }
    ScreenBox("score-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), style = bodyStyle(16.sp, Gold)) }
                Spacer(Modifier.weight(1f))
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Text(
                if (presented?.kind?.name == "PREVIEW") content.t("scorePreview", locale) else content.t("homeScore", locale),
                style = bodyStyle(13.sp, Gold, bold = true),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                ScoreRing(score?.score, 108.dp)
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(score?.band?.title(content, locale) ?: content.t("noScoreYet", locale), style = displayStyle(30.sp))
                    if (score != null) {
                        Text(
                            content.fill("basedOn", locale, mapOf("done" to score.done.toString(), "total" to score.total.toString())),
                            style = bodyStyle(14.sp, Muted),
                        )
                    }
                    if (presented?.kind?.name == "PREVIEW") {
                        Text(content.t("previewNote", locale), style = bodyStyle(13.sp, Gold))
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            if (vm.access().full && score != null) {
                Text(content.t("byArea", locale), style = displayStyle(24.sp))
                score.categories.forEach { category ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(category.group.text(locale), style = bodyStyle(16.sp), modifier = Modifier.weight(1f))
                        Text(category.score?.toString() ?: "—", style = displayStyle(22.sp, Gold))
                        Text("  ${category.done}/${category.total}", style = bodyStyle(13.sp, Muted))
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(content.t("biggestBoosts", locale), style = displayStyle(24.sp))
                if (score.boosts.isEmpty()) {
                    Text(content.t("nothingToLift", locale), style = bodyStyle(13.sp, Muted))
                } else {
                    score.boosts.forEach { boost ->
                        Column(Modifier.padding(vertical = 4.dp)) {
                            Text("+${boost.gain}  ${boost.title.text(locale)}", style = bodyStyle(16.sp))
                            if (boost.remedy.isNotEmpty()) Text(boost.remedy, style = bodyStyle(13.sp, Muted), maxLines = 2)
                        }
                    }
                    Text(content.t("boostLine", locale), style = bodyStyle(12.sp, Muted))
                }
            } else {
                RoyalCard(Modifier.clickable { vm.openPaywall() }) {
                    Text(content.t("lockedFixes", locale), style = bodyStyle(15.sp))
                }
            }
            Spacer(Modifier.height(12.dp))
            RoyalCard(Modifier.clickable { vm.openHomes() }) {
                Text(content.t("savedHomes", locale), style = displayStyle(20.sp))
                Text(
                    if (vm.access().premium) content.t("savedHomeOpen", locale) else content.t("savedHomeLocked", locale),
                    style = bodyStyle(14.sp, Muted),
                )
            }
            Spacer(Modifier.height(12.dp))
            GoldButton(content.t("shareCard", locale), enabled = (score?.done ?: 0) > 0) {
                vm.shareCard(context)?.let { shareFile(context, it, "image/png") }
            }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("downloadPdf", locale)) {
                if (vm.access().full) {
                    vm.sharePdf(context)?.let { shareFile(context, it, "application/pdf") }
                } else {
                    vm.openPaywall()
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { confirm = true }) {
                Text(content.t("clearChecks", locale), style = bodyStyle(14.sp, Muted))
            }
            if (confirm) {
                Text(content.t("clearConfirm", locale), style = bodyStyle(14.sp))
                Row {
                    TextButton(onClick = { vm.clearHome(); confirm = false }) { Text(content.t("done", locale), color = Gold) }
                    TextButton(onClick = { confirm = false }) { Text(content.t("cancel", locale), color = Muted) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PaywallScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val billing by vm.billingUi.collectAsState()
    val context = LocalContext.current
    var showTerms by remember { mutableStateOf(false) }
    BackHandler { vm.back() }
    ScreenBox("paywall-screen") {
        BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            val tight = maxHeight < 700.dp
            val titleSize = if (tight) 26.sp else 30.sp
            val gap = if (tight) 6.dp else 8.dp
            Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = if (tight) 6.dp else 10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Wordmark()
                    TextButton(onClick = { vm.back() }) { Text(content.t("cancel", locale), style = bodyStyle(15.sp, Gold)) }
                }
                Text(content.t("paywallTitle", locale), style = displayStyle(titleSize), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(content.t("paywallLine", locale), style = bodyStyle(if (tight) 13.sp else 14.sp, Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (billing.entitlements.premium) {
                    Text(content.t("premiumOn", locale), style = bodyStyle(13.sp, Gold), maxLines = 1)
                }
                val notice = noticeText(content, billing.notice, locale)
                if (notice != null) {
                    Text(
                        notice,
                        style = bodyStyle(13.sp, if (billing.notice == BillingNotice.PENDING) Gold else Avoid),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Spacer(Modifier.height(gap))
                if (billing.failed && billing.products.isEmpty()) {
                    RoyalCard {
                        Text(content.t("billingRetry", locale), style = bodyStyle(15.sp))
                        Spacer(Modifier.height(8.dp))
                        GoldButton(content.t("retry", locale)) { vm.retryBilling() }
                    }
                } else {
                    PlanButton(content, locale, billing.products, Products.YEARLY, content.t("yearlyPlan", locale), highlighted = true, tight = tight) { vm.purchase(Products.YEARLY) }
                    Spacer(Modifier.height(gap))
                    PlanButton(content, locale, billing.products, Products.MONTHLY, content.t("monthlyPlan", locale), highlighted = false, tight = tight) { vm.purchase(Products.MONTHLY) }
                    Spacer(Modifier.height(gap))
                    PlanButton(content, locale, billing.products, Products.LIFETIME, content.t("lifetimePlan", locale), highlighted = false, tight = tight) { vm.purchase(Products.LIFETIME) }
                    Spacer(Modifier.height(gap))
                    PlanButton(content, locale, billing.products, Products.HOME_REPORT, content.t("homeReportPlan", locale), highlighted = false, tight = tight, detail = content.t("homeReportLine", locale)) { vm.purchase(Products.HOME_REPORT) }
                }
                Spacer(Modifier.weight(1f))
                Text(content.t("termsShort", locale), style = bodyStyle(12.sp, Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { showTerms = true }, modifier = Modifier.semantics { contentDescription = "subscription-terms" }) {
                        Text(content.t("subscriptionTerms", locale), style = bodyStyle(13.sp, Gold, bold = true))
                    }
                    TextButton(onClick = { vm.restorePurchases() }, modifier = Modifier.semantics { contentDescription = "restore-purchases" }) {
                        Text(content.t("restore", locale), style = bodyStyle(13.sp, Gold, bold = true))
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { openLink(context, Legal.TERMS) }) { Text(content.t("terms", locale), style = bodyStyle(13.sp, Gold)) }
                    TextButton(onClick = { openLink(context, Legal.PRIVACY) }) { Text(content.t("privacy", locale), style = bodyStyle(13.sp, Gold)) }
                    TextButton(onClick = { openSubscriptionManagement(context) }) { Text(content.t("manageSubs", locale), style = bodyStyle(13.sp, Gold)) }
                }
            }
        }
        if (showTerms) {
            ModalBottomSheet(
                onDismissRequest = { showTerms = false },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                containerColor = Navy,
            ) {
                Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp).verticalScroll(rememberScrollState())) {
                    Text(content.t("subscriptionTerms", locale), style = displayStyle(26.sp))
                    Spacer(Modifier.height(10.dp))
                    Text(content.t("renewDisclosure", locale), style = bodyStyle(14.sp, Muted))
                    Spacer(Modifier.height(10.dp))
                    Text(content.t("reportDisclosure", locale), style = bodyStyle(14.sp, Muted))
                    TextButton(onClick = { openSubscriptionManagement(context) }) {
                        Text(content.t("manageSubs", locale), style = bodyStyle(15.sp, Gold, bold = true))
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanButton(
    content: ContentBundle,
    locale: AppLocale,
    products: List<StoreProduct>,
    id: String,
    fallback: String,
    highlighted: Boolean,
    tight: Boolean,
    detail: String? = null,
    onClick: () -> Unit,
) {
    val product = products.firstOrNull { it.id == id }
    val period = product?.let { periodWord(it.billingPeriod, locale, content.strings) }
    val price = when {
        product == null && products.isEmpty() -> content.t("loadingPrice", locale)
        product == null -> content.t("priceUnavailable", locale)
        else -> priceWithPeriod(product.formattedPrice, period)
    }
    val trial = product?.trialDays?.let { days ->
        content.fill(
            "daysFreeThen",
            locale,
            mapOf("days" to days.toString(), "price" to product.formattedPrice, "period" to (period ?: "")),
        )
    }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (highlighted) Gold else CardNavy)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = if (tight) 7.dp else 9.dp)
            .semantics { contentDescription = "plan-$id" },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(fallback, style = displayStyle(if (tight) 18.sp else 20.sp, if (highlighted) Ink else Cream), modifier = Modifier.weight(1f), maxLines = 1)
            if (highlighted) {
                Text(
                    content.t("bestValue", locale),
                    style = bodyStyle(11.sp, Ink, bold = true),
                    modifier = Modifier.background(GoldBright, CircleShape).padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
        if (detail != null) {
            Text(detail, style = bodyStyle(12.sp, if (highlighted) Ink else Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(
            trial ?: price,
            style = bodyStyle(if (tight) 13.sp else 14.sp, if (highlighted) Ink else if (trial != null) Gold else Muted, bold = trial != null),
            maxLines = 2,
        )
    }
}

@Composable
private fun SettingsScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val billing by vm.billingUi.collectAsState()
    val review by vm.reviewUnlocked.collectAsState()
    val context = LocalContext.current
    var showCode by remember { mutableStateOf(false) }
    var unlockedNote by remember { mutableStateOf(false) }
    BackHandler { vm.back() }
    ScreenBox("settings-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(18.dp)) {
            Row {
                TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), style = bodyStyle(16.sp, Gold)) }
                Spacer(Modifier.weight(1f))
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Text(content.t("settings", locale), style = displayStyle(36.sp))
            Text("Disha", style = displayStyle(22.sp, Gold))
            Text(content.catalog.framing.text(locale), style = bodyStyle(14.sp, Muted), modifier = Modifier.padding(vertical = 8.dp))
            OutlineButton(content.t("savedHomes", locale)) { vm.openHomes() }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("restore", locale)) { vm.restorePurchases() }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("terms", locale)) { openLink(context, Legal.TERMS) }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("privacy", locale)) { openLink(context, Legal.PRIVACY) }
            Spacer(Modifier.height(8.dp))
            OutlineButton(content.t("manageSubs", locale)) { openSubscriptionManagement(context) }
            if (billing.entitlements.premium) {
                Text(content.t("premiumOn", locale), style = bodyStyle(14.sp, Gold), modifier = Modifier.padding(top = 12.dp))
            }
            if (review) {
                Text(content.t("premiumCode", locale), style = bodyStyle(14.sp, Gold), modifier = Modifier.padding(top = 12.dp).semantics { contentDescription = "premium-code" })
                if (unlockedNote) {
                    Text(content.t("premiumUnlocked", locale), style = bodyStyle(13.sp, Cream))
                }
                TextButton(onClick = {
                    vm.clearReviewCode()
                    unlockedNote = false
                }) {
                    Text(content.t("removeCode", locale), style = bodyStyle(13.sp, Muted))
                }
            } else {
                Text(
                    content.t("haveCode", locale),
                    style = bodyStyle(13.sp, Muted),
                    modifier = Modifier
                        .padding(top = 18.dp)
                        .clickable { showCode = true }
                        .semantics { contentDescription = "have-a-code" },
                )
            }
            val notice = noticeText(content, billing.notice, locale)
            if (notice != null) Text(notice, style = bodyStyle(14.sp, Gold), modifier = Modifier.padding(top = 8.dp))
            if (billing.fake) DebugLab(vm, content, locale)
        }
        if (showCode) {
            ReviewCodeDialog(
                content = content,
                locale = locale,
                onDismiss = { showCode = false },
                onSubmit = { raw ->
                    when (vm.submitReviewCode(raw)) {
                        com.ikshanasolutions.disha.model.CodeResult.UNLOCKED -> {
                            unlockedNote = true
                            showCode = false
                            null
                        }
                        com.ikshanasolutions.disha.model.CodeResult.REJECTED -> content.t("codeRejected", locale)
                        com.ikshanasolutions.disha.model.CodeResult.LIMITED -> content.t("codeLimited", locale)
                    }
                },
            )
        }
    }
}

@Composable
private fun ReviewCodeDialog(
    content: ContentBundle,
    locale: AppLocale,
    onDismiss: () -> Unit,
    onSubmit: (String) -> String?,
) {
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    Box(
        Modifier
            .fillMaxSize()
            .background(Field.copy(alpha = 0.72f))
            .padding(24.dp)
            .semantics { contentDescription = "review-code-dialog" },
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.background(Navy, RoundedCornerShape(22.dp)).padding(22.dp)) {
            Text(content.t("haveCode", locale), style = displayStyle(28.sp))
            Spacer(Modifier.height(12.dp))
            androidx.compose.material3.OutlinedTextField(
                value = draft,
                onValueChange = {
                    draft = it
                    error = null
                },
                singleLine = true,
                label = { Text(content.t("codeHint", locale)) },
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "review-code-field" },
                colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Gold,
                    unfocusedBorderColor = Gold.copy(alpha = 0.45f),
                    cursorColor = Gold,
                    focusedTextColor = Cream,
                    unfocusedTextColor = Cream,
                    focusedLabelColor = Gold,
                    unfocusedLabelColor = Muted,
                ),
            )
            if (error != null) {
                Text(error ?: "", style = bodyStyle(13.sp, Avoid), modifier = Modifier.padding(top = 8.dp))
            }
            Spacer(Modifier.height(14.dp))
            GoldButton(content.t("unlock", locale)) {
                error = onSubmit(draft)
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                Text(content.t("cancel", locale), style = bodyStyle(15.sp, Gold))
            }
        }
    }
}

@Composable
private fun HomesScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val homes by vm.homes.collectAsState()
    val current by vm.homeId.collectAsState()
    var naming by remember { mutableStateOf(false) }
    BackHandler { vm.back() }
    ScreenBox("homes-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(18.dp)) {
            TextButton(onClick = { vm.back() }) { Text(content.t("back", locale), style = bodyStyle(16.sp, Gold)) }
            Text(content.t("savedHomes", locale), style = displayStyle(36.sp))
            homes.forEach { home ->
                val mark = if (home.id == current) " · ${content.t("thisHome", locale)}" else ""
                Text(
                    home.name + mark,
                    style = bodyStyle(18.sp, if (home.id == current) Gold else Cream),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable { vm.switchHome(home.id) },
                )
            }
            Spacer(Modifier.height(12.dp))
            if (naming) {
                var draft by remember { mutableStateOf("") }
                androidx.compose.material3.OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text(content.t("homeName", locale)) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                GoldButton(content.t("done", locale)) {
                    vm.addHome(draft)
                    naming = false
                }
            } else {
                GoldButton(content.t("newHome", locale)) { naming = true }
            }
        }
    }
}

@Composable
private fun LocationPrompt(
    content: ContentBundle,
    locale: AppLocale,
    onAllow: () -> Unit,
    onSkip: () -> Unit,
) {
    Box(Modifier.fillMaxSize().background(Field.copy(alpha = 0.72f)).padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.background(Navy, RoundedCornerShape(22.dp)).padding(22.dp).semantics { contentDescription = "location-prompt" }) {
            Text(content.t("locationTitle", locale), style = displayStyle(32.sp))
            Spacer(Modifier.height(8.dp))
            Text(content.t("locationBody", locale), style = bodyStyle(16.sp, Muted))
            Spacer(Modifier.height(16.dp))
            GoldButton(content.t("locationAllow", locale)) { onAllow() }
            TextButton(onClick = onSkip, modifier = Modifier.fillMaxWidth()) {
                Text(content.t("locationSkip", locale), style = bodyStyle(16.sp, Gold))
            }
        }
    }
}

@Composable
private fun DebugLab(vm: DishaViewModel, content: ContentBundle, locale: AppLocale) {
    Column(Modifier.padding(top = 16.dp)) {
        Text(content.t("debugBilling", locale), style = displayStyle(22.sp, Gold))
        Text(content.t("debugNote", locale), style = bodyStyle(12.sp, Muted))
        DebugRow("Pending next") { vm.debugBilling(DebugBilling.PENDING_NEXT) }
        DebugRow("Cancel next") { vm.debugBilling(DebugBilling.CANCEL_NEXT) }
        DebugRow("Already owned") { vm.debugBilling(DebugBilling.ALREADY_OWNED_NEXT) }
        DebugRow("Leave unacknowledged") { vm.debugBilling(DebugBilling.LEAVE_UNACKNOWLEDGED) }
        DebugRow("Complete pending") { vm.debugBilling(DebugBilling.COMPLETE_PENDING) }
        DebugRow("Disconnect") { vm.debugBilling(DebugBilling.DISCONNECT) }
        DebugRow("Empty catalog") { vm.debugBilling(DebugBilling.EMPTY_CATALOG) }
        DebugRow("Revoke") { vm.debugBilling(DebugBilling.REVOKE) }
        DebugRow(content.t("retry", locale)) { vm.retryBilling() }
    }
}

@Composable
private fun DebugRow(label: String, onClick: () -> Unit) {
    Text(label, style = bodyStyle(14.sp, Gold), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 6.dp))
}

private fun ratingColor(rating: String) = when (rating) {
    "auspicious" -> Good
    "neutral" -> Gold
    else -> Avoid
}
