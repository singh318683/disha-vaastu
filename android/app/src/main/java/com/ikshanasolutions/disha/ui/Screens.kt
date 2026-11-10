package com.ikshanasolutions.disha.ui

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.ikshanasolutions.disha.model.checkGroups
import com.ikshanasolutions.disha.model.periodWord
import com.ikshanasolutions.disha.model.verdictForHeading
import com.ikshanasolutions.disha.noticeText
import com.ikshanasolutions.disha.openAppSettings
import com.ikshanasolutions.disha.openLink
import com.ikshanasolutions.disha.openSubscriptionManagement
import com.ikshanasolutions.disha.shareFile
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.ceil

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
            if (toast != null) {
                Text(
                    text = if (toast!! > 0) "+$toast" else toast.toString(),
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
    val homes by vm.homes.collectAsState()
    val homeId by vm.homeId.collectAsState()
    val home = homes.firstOrNull { it.id == homeId }
    val groups = remember(content) { checkGroups(content.catalog.checks) }
    val pager = rememberPagerState(pageCount = { groups.size })
    val scope = rememberCoroutineScope()
    val presented = vm.presented()
    ScreenBox("home-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Wordmark()
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.openSettings() }) {
                    Text(content.t("settings", locale), style = bodyStyle(14.sp, Gold))
                }
                LanguageToggle(locale) { vm.setLocale(it) }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(content.t("whatCheck", locale), style = displayStyle(28.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(content.t("standPoint", locale), style = bodyStyle(13.sp, Muted), maxLines = 2)
                }
                Box(Modifier.clickable { vm.openSummary() }.semantics { contentDescription = "home-score" }) {
                    ScoreRing(presented?.score?.score, 58.dp)
                    if (presented?.kind?.name == "PREVIEW") {
                        Text(
                            content.t("scorePreview", locale),
                            style = bodyStyle(9.sp, Ink, bold = true),
                            modifier = Modifier.align(Alignment.BottomCenter).background(Gold, CircleShape).padding(horizontal = 6.dp, vertical = 1.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                groups.forEachIndexed { index, group ->
                    val selected = pager.currentPage == index
                    Text(
                        group.group.text(locale),
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
            HorizontalPager(state = pager, modifier = Modifier.weight(1f).padding(top = 8.dp)) { page ->
                CategoryPage(vm, content, groups[page].checks, locale)
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center) {
                groups.forEachIndexed { index, _ ->
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
            if (home != null) {
                Text(home.name, style = bodyStyle(12.sp, Muted), modifier = Modifier.align(Alignment.CenterHorizontally))
            }
        }
    }
}

@Composable
private fun CategoryPage(vm: DishaViewModel, content: ContentBundle, checks: List<VaastuCheck>, locale: AppLocale) {
    val homes by vm.homes.collectAsState()
    val homeId by vm.homeId.collectAsState()
    val saved = homes.firstOrNull { it.id == homeId }?.results.orEmpty().associateBy { it.checkId }
    val access = vm.access()
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val columns = 2
        val rows = ceil(checks.size / columns.toDouble()).toInt().coerceAtLeast(1)
        val gap = 8.dp
        val tileHeight = (maxHeight - gap * (rows - 1)) / rows
        Column(verticalArrangement = Arrangement.spacedBy(gap), modifier = Modifier.fillMaxSize()) {
            checks.chunked(columns).forEach { row ->
                Row(Modifier.height(tileHeight), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    row.forEach { check ->
                        val unlocked = access.isUnlocked(check)
                        val result = saved[check.id]
                        Column(
                            Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(16.dp))
                                .background(CardNavy)
                                .clickable { vm.openCheck(check.id) }
                                .padding(10.dp)
                                .semantics { contentDescription = if (unlocked) "check-${check.id}" else "locked-check" },
                            verticalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(check.title.text(locale), style = displayStyle(18.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                            if (!unlocked) {
                                Text(content.t("lockedCheck", locale), style = bodyStyle(12.sp, Gold, bold = true))
                            } else if (result != null) {
                                val verdict = verdictForHeading(check, result.heading, locale, content.strings)
                                Text(verdict.placementLine, style = bodyStyle(12.sp, ratingColor(verdict.rating)), maxLines = 2, overflow = TextOverflow.Ellipsis)
                            } else {
                                Text(check.blurb.text(locale), style = bodyStyle(12.sp, Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
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

@Composable
private fun PaywallScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val billing by vm.billingUi.collectAsState()
    val context = LocalContext.current
    BackHandler { vm.back() }
    ScreenBox("paywall-screen") {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(22.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Wordmark()
                TextButton(onClick = { vm.back() }) { Text(content.t("cancel", locale), style = bodyStyle(16.sp, Gold)) }
            }
            Text(content.t("paywallTitle", locale), style = displayStyle(36.sp))
            Text(content.t("paywallLine", locale), style = bodyStyle(16.sp, Muted))
            if (billing.entitlements.premium) {
                Text(content.t("premiumOn", locale), style = bodyStyle(16.sp, Gold), modifier = Modifier.padding(top = 8.dp))
            }
            Spacer(Modifier.height(12.dp))
            val notice = noticeText(content, billing.notice, locale)
            if (notice != null) {
                Text(notice, style = bodyStyle(14.sp, if (billing.notice == BillingNotice.PENDING) Gold else Avoid), modifier = Modifier.padding(bottom = 8.dp))
            }
            if (billing.failed && billing.products.isEmpty()) {
                RoyalCard {
                    Text(content.t("billingRetry", locale), style = bodyStyle(16.sp))
                    Spacer(Modifier.height(8.dp))
                    GoldButton(content.t("retry", locale)) { vm.retryBilling() }
                }
            } else {
                PlanButton(content, locale, billing.products, Products.YEARLY, content.t("yearlyPlan", locale), highlighted = true) { vm.purchase(Products.YEARLY) }
                Spacer(Modifier.height(8.dp))
                PlanButton(content, locale, billing.products, Products.MONTHLY, content.t("monthlyPlan", locale), highlighted = false) { vm.purchase(Products.MONTHLY) }
                Spacer(Modifier.height(8.dp))
                PlanButton(content, locale, billing.products, Products.LIFETIME, content.t("lifetimePlan", locale), highlighted = false) { vm.purchase(Products.LIFETIME) }
                Spacer(Modifier.height(14.dp))
                Text(content.t("homeReportPlan", locale), style = displayStyle(22.sp))
                Text(content.t("homeReportLine", locale), style = bodyStyle(14.sp, Muted))
                Spacer(Modifier.height(8.dp))
                PlanButton(content, locale, billing.products, Products.HOME_REPORT, content.t("homeReportPlan", locale), highlighted = false) { vm.purchase(Products.HOME_REPORT) }
            }
            TextButton(onClick = { vm.restorePurchases() }, modifier = Modifier.fillMaxWidth().semantics { contentDescription = "restore-purchases" }) {
                Text(content.t("restore", locale), style = bodyStyle(16.sp, Gold, bold = true))
            }
            Row {
                TextButton(onClick = { openLink(context, Legal.TERMS) }) { Text(content.t("terms", locale), color = Gold) }
                TextButton(onClick = { openLink(context, Legal.PRIVACY) }) { Text(content.t("privacy", locale), color = Gold) }
            }
            TextButton(onClick = { openSubscriptionManagement(context) }) {
                Text(content.t("manageSubs", locale), style = bodyStyle(14.sp, Gold))
            }
            billing.products.filter { it.id == Products.YEARLY || it.id == Products.MONTHLY }.forEach { product ->
                val period = periodWord(product.billingPeriod, locale, content.strings)
                val line = content.fill("perPeriod", locale, mapOf("price" to product.formattedPrice, "period" to period))
                Text(line, style = bodyStyle(13.sp, Muted))
                if (product.trialDays != null) {
                    Text(
                        content.fill("daysFreeThen", locale, mapOf("days" to product.trialDays.toString(), "price" to product.formattedPrice)),
                        style = bodyStyle(13.sp, Gold),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(content.t("renewDisclosure", locale), style = bodyStyle(12.sp, Muted))
            Spacer(Modifier.height(6.dp))
            Text(content.t("reportDisclosure", locale), style = bodyStyle(12.sp, Muted))
            if (billing.fake) DebugLab(vm, content, locale)
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
    onClick: () -> Unit,
) {
    val product = products.firstOrNull { it.id == id }
    val price = when {
        product != null -> product.formattedPrice
        products.isEmpty() -> content.t("loadingPrice", locale)
        else -> content.t("priceUnavailable", locale)
    }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (highlighted) Gold else CardNavy)
            .clickable(onClick = onClick)
            .padding(14.dp)
            .semantics { contentDescription = "plan-$id" },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(fallback, style = displayStyle(22.sp, if (highlighted) Ink else Cream), modifier = Modifier.weight(1f))
            if (highlighted) {
                Text(content.t("bestValue", locale), style = bodyStyle(12.sp, Ink, bold = true), modifier = Modifier.background(GoldBright, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp))
            }
        }
        if (product?.trialDays != null) {
            Text(
                content.fill("daysFreeThen", locale, mapOf("days" to product.trialDays.toString(), "price" to product.formattedPrice)),
                style = bodyStyle(14.sp, if (highlighted) Ink else Gold, bold = true),
            )
        }
        Text(price, style = bodyStyle(16.sp, if (highlighted) Ink else Muted))
    }
}

@Composable
private fun SettingsScreen(vm: DishaViewModel, content: ContentBundle) {
    val locale by vm.locale.collectAsState()
    val billing by vm.billingUi.collectAsState()
    val context = LocalContext.current
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
            val notice = noticeText(content, billing.notice, locale)
            if (notice != null) Text(notice, style = bodyStyle(14.sp, Gold), modifier = Modifier.padding(top = 8.dp))
            if (billing.fake) DebugLab(vm, content, locale)
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
