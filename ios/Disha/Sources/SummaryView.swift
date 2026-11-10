import SwiftUI

struct SummaryView: View {
  @EnvironmentObject private var model: AppModel
  @State private var cardURL: URL?
  @State private var pdfURL: URL?
  @State private var confirmClear = false

  var body: some View {
    let locale = model.locale
    let content = model.content
    let score = model.score
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        HStack {
          BackButton(label: content?.t("back", locale) ?? "Back") { model.route = .home }
          Spacer()
          LanguageToggle()
        }
        Text(content?.t("homeScore", locale) ?? "Home score")
          .font(bodyFont(size: 13, locale: locale, bold: true))
          .foregroundStyle(Royal.gold)
          .textCase(locale == .en ? Text.Case.uppercase : nil)
          .tracking(locale == .en ? 1.4 : 0)
        HStack(alignment: .center, spacing: 16) {
          ScoreRing(score: score?.score, diameter: 120, locale: locale)
          VStack(alignment: .leading, spacing: 6) {
            Text(score?.band?.title(content?.strings ?? StringTable(entries: [:]), locale) ?? content?.t("nothingChecked", locale) ?? "")
              .font(displayFont(size: 32, locale: locale))
              .foregroundStyle(Royal.cream)
              .minimumScaleFactor(0.7)
            if let score {
              Text(coverageLine(done: score.done, total: score.total, locale: locale))
                .font(bodyFont(size: 14, locale: locale))
                .foregroundStyle(Royal.muted)
                .fixedSize(horizontal: false, vertical: true)
            }
          }
        }
        .accessibilityIdentifier("score-summary")

        if let content, let score {
          Text(content.t("byArea", locale))
            .font(displayFont(size: 24, locale: locale))
            .foregroundStyle(Royal.cream)
          ForEach(score.categories, id: \.group.en) { category in
            HStack {
              Text(category.group.text(locale))
                .font(bodyFont(size: 16, locale: locale))
                .foregroundStyle(Royal.cream)
              Spacer()
              Text(category.score.map(String.init) ?? "—")
                .font(displayFont(size: 22, locale: locale))
                .foregroundStyle(Royal.gold)
              Text("\(category.done)/\(category.total)")
                .font(bodyFont(size: 13, locale: locale))
                .foregroundStyle(Royal.muted)
                .frame(width: 36, alignment: .trailing)
            }
            .padding(.vertical, 6)
            .overlay(alignment: .bottom) {
              Rectangle().fill(Royal.cardEdge).frame(height: 1)
            }
          }

          if !score.boosts.isEmpty {
            Text(content.t("boosts", locale))
              .font(displayFont(size: 24, locale: locale))
              .foregroundStyle(Royal.cream)
              .padding(.top, 4)
            ForEach(score.boosts) { boost in
              HStack {
                Text("+\(boost.points)")
                  .font(displayFont(size: 22, locale: locale))
                  .foregroundStyle(Royal.gold)
                  .frame(width: 52, alignment: .leading)
                Text(boost.title.text(locale))
                  .font(bodyFont(size: 16, locale: locale))
                  .foregroundStyle(Royal.cream)
                Spacer()
              }
            }
            Text(content.t("boostLine", locale))
              .font(bodyFont(size: 12, locale: locale))
              .foregroundStyle(Royal.muted)
          }

          if let cardURL {
            ShareLink(item: cardURL, preview: SharePreview(content.t("shareCard", locale))) {
              shareLabel(content.t("shareCard", locale), locale: locale, filled: true)
            }
            .accessibilityIdentifier("share-card")
          }
          if let pdfURL {
            ShareLink(item: pdfURL, preview: SharePreview(content.t("downloadPdf", locale))) {
              shareLabel(content.t("downloadPdf", locale), locale: locale, filled: false)
            }
            .accessibilityIdentifier("download-pdf")
          }

          let counts = ratingCounts(results: model.results, content: content)
          HStack {
            count(counts.auspicious, content.t("auspicious", locale), Royal.good, locale)
            count(counts.neutral, content.t("neutral", locale), Royal.gold, locale)
            count(counts.inauspicious, content.t("toSoften", locale), Royal.avoid, locale)
          }
          ForEach(content.catalog.checks) { check in
            if let saved = model.results.first(where: { $0.checkId == check.id }) {
              let verdict = verdictForHeading(check: check, heading: saved.heading, locale: locale, strings: content.strings)
              HStack(spacing: 10) {
                Circle().fill(ratingColor(verdict.rating)).frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 2) {
                  Text(check.title.text(locale))
                    .font(bodyFont(size: 16, locale: locale, bold: true))
                    .foregroundStyle(Royal.cream)
                  Text(verdict.placementLine)
                    .font(bodyFont(size: 13, locale: locale))
                    .foregroundStyle(Royal.muted)
                }
                Spacer()
              }
            }
          }
          Text(content.catalog.framing.text(locale))
            .font(bodyFont(size: 12, locale: locale))
            .foregroundStyle(Royal.muted)
          if !model.results.isEmpty {
            Button(content.t("clearChecks", locale)) { confirmClear = true }
              .font(bodyFont(size: 14, locale: locale))
              .foregroundStyle(Royal.muted)
              .frame(maxWidth: .infinity)
          }
        }
      }
      .padding(20)
    }
    .onAppear(perform: refresh)
    .onChange(of: model.locale) { _, _ in refresh() }
    .onChange(of: model.results) { _, _ in refresh() }
    .confirmationDialog(
      content?.t("clearConfirm", locale) ?? "Clear every saved check on this iPhone?",
      isPresented: $confirmClear,
      titleVisibility: .visible
    ) {
      Button(content?.t("clearChecks", locale) ?? "Clear", role: .destructive) {
        model.clearResults()
      }
      Button(content?.t("cancel", locale) ?? "Cancel", role: .cancel) {}
    }
    .accessibilityIdentifier("summary")
  }

  private func refresh() {
    guard let content = model.content, let score = model.score else { return }
    let image = ReportExport.cardImage(content: content, results: model.results, locale: model.locale, score: score)
    if let data = image.pngData() {
      cardURL = writeReportFile(data, name: "disha-home-harmony.png")
    }
    let pdf = ReportExport.pdf(content: content, results: model.results, score: score)
    pdfURL = writeReportFile(pdf, name: "disha-vaastu-report.pdf")
  }

  private func shareLabel(_ title: String, locale: AppLocale, filled: Bool) -> some View {
    Text(title)
      .font(bodyFont(size: 17, locale: locale, bold: true))
      .foregroundStyle(filled ? Royal.ink : Royal.gold)
      .frame(maxWidth: .infinity)
      .frame(height: 52)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(filled ? Royal.gold : Color.clear)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(Royal.gold, lineWidth: filled ? 0 : 1)
      )
  }

  private func count(_ value: Int, _ label: String, _ color: Color, _ locale: AppLocale) -> some View {
    VStack(spacing: 4) {
      Text("\(value)")
        .font(displayFont(size: 28, locale: locale))
        .foregroundStyle(color)
      Text(label)
        .font(bodyFont(size: 11, locale: locale))
        .foregroundStyle(Royal.muted)
        .lineLimit(2)
        .minimumScaleFactor(0.7)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Royal.card))
  }
}
