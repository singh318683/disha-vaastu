import StoreKit
import SwiftUI

struct PaywallView: View {
  @EnvironmentObject private var model: AppModel
  @EnvironmentObject private var entitlements: EntitlementStore
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    let locale = model.locale
    let content = model.content
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        HStack {
          Wordmark()
          Spacer()
          Button(content?.t("cancel", locale) ?? "Cancel") { dismiss() }
            .font(bodyFont(size: 16, locale: locale))
            .foregroundStyle(Royal.gold)
        }
        Text(content?.t("premiumTitle", locale) ?? "Disha Premium")
          .font(displayFont(size: 36, locale: locale))
          .foregroundStyle(Royal.cream)
        Text(content?.t("premiumLine", locale) ?? "")
          .font(bodyFont(size: 16, locale: locale))
          .foregroundStyle(Royal.muted)
          .fixedSize(horizontal: false, vertical: true)

        planButton(id: StoreConfig.yearly, fallback: content?.t("yearlyPlan", locale) ?? "Yearly", highlighted: true, locale: locale, content: content)
        planButton(id: StoreConfig.monthly, fallback: content?.t("monthlyPlan", locale) ?? "Monthly", highlighted: false, locale: locale, content: content)
        planButton(id: StoreConfig.lifetime, fallback: content?.t("lifetimePlan", locale) ?? "Lifetime", highlighted: false, locale: locale, content: content)

        VStack(alignment: .leading, spacing: 6) {
          Text(content?.t("homeReportPlan", locale) ?? "Home Report")
            .font(displayFont(size: 22, locale: locale))
            .foregroundStyle(Royal.cream)
          Text(content?.t("homeReportLine", locale) ?? "")
            .font(bodyFont(size: 14, locale: locale))
            .foregroundStyle(Royal.muted)
          planButton(id: StoreConfig.homeReport, fallback: content?.t("homeReportPlan", locale) ?? "Home Report", highlighted: false, locale: locale, content: content)
        }
        .padding(.top, 6)

        Button(content?.t("restore", locale) ?? "Restore Purchases") {
          Task { await entitlements.restore() }
        }
        .font(bodyFont(size: 16, locale: locale, bold: true))
        .foregroundStyle(Royal.gold)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("restore-purchases")

        if let error = entitlements.lastError {
          Text(error)
            .font(bodyFont(size: 13, locale: locale))
            .foregroundStyle(Royal.avoid)
        }

        HStack(spacing: 16) {
          Link(content?.t("terms", locale) ?? "Terms", destination: StoreConfig.termsURL)
          Link(content?.t("privacy", locale) ?? "Privacy", destination: StoreConfig.privacyURL)
        }
        .font(bodyFont(size: 14, locale: locale))
        .foregroundStyle(Royal.gold)

        Text(content?.t("renewDisclosure", locale) ?? "")
          .font(bodyFont(size: 12, locale: locale))
          .foregroundStyle(Royal.muted)
          .fixedSize(horizontal: false, vertical: true)
        Text(content?.t("reportDisclosure", locale) ?? "")
          .font(bodyFont(size: 12, locale: locale))
          .foregroundStyle(Royal.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
      .padding(22)
    }
    .background(Royal.navy)
    .onChange(of: entitlements.isPremium) { _, premium in
      if premium { model.showPaywall = false }
    }
    .onChange(of: entitlements.reportHomeIDs) { _, ids in
      if ids.contains(model.homeID) { model.showPaywall = false }
    }
    .accessibilityIdentifier("paywall")
  }

  @ViewBuilder
  private func planButton(id: String, fallback: String, highlighted: Bool, locale: AppLocale, content: ContentBundle?) -> some View {
    let product = entitlements.product(id)
    let title = product?.displayName ?? fallback
    let price = product?.displayPrice
    Button {
      guard let product else {
        Task { await entitlements.refresh() }
        return
      }
      Task {
        let bought = await entitlements.purchase(product, homeID: model.homeID)
        if bought, StoreConfig.isHomeReport(product.id) || entitlements.isPremium {
          model.showPaywall = false
        }
      }
    } label: {
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text(title)
            .font(displayFont(size: 22, locale: locale))
            .foregroundStyle(highlighted ? Royal.ink : Royal.cream)
          Spacer()
          if highlighted {
            Text(content?.t("bestValue", locale) ?? "Best value")
              .font(bodyFont(size: 12, locale: locale, bold: true))
              .foregroundStyle(Royal.ink)
              .padding(.horizontal, 8)
              .padding(.vertical, 3)
              .background(Capsule().fill(Royal.goldBright))
          }
        }
        if let trial = product.flatMap({ trialLine($0, locale: locale) }) {
          Text(trial)
            .font(bodyFont(size: 14, locale: locale, bold: true))
            .foregroundStyle(highlighted ? Royal.ink : Royal.gold)
        }
        Text(price ?? (entitlements.isLoading ? (content?.t("loadingPrice", locale) ?? "Loading price…") : (content?.t("priceUnavailable", locale) ?? "Price unavailable")))
          .font(bodyFont(size: 16, locale: locale))
          .foregroundStyle(highlighted ? Royal.ink.opacity(0.8) : Royal.muted)
      }
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(highlighted ? Royal.gold : Royal.card)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Royal.gold, lineWidth: highlighted ? 0 : 1)
      )
    }
    .buttonStyle(.plain)
    .disabled(entitlements.purchasingID != nil)
    .accessibilityIdentifier("plan-\(id)")
  }
}

func trialLine(_ product: Product, locale: AppLocale) -> String? {
  guard let offer = product.subscription?.introductoryOffer, offer.paymentMode == .free else { return nil }
  let days = trialDays(offer.period)
  if locale == .hi { return "\(days)-दिन का मुफ़्त परीक्षण" }
  return "\(days)-day free trial"
}

func trialDays(_ period: Product.SubscriptionPeriod) -> Int {
  switch period.unit {
  case .day: return period.value
  case .week: return period.value * 7
  case .month: return period.value * 30
  case .year: return period.value * 365
  @unknown default: return period.value
  }
}
