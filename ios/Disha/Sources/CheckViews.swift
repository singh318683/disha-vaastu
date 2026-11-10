import SwiftUI

struct InstructView: View {
  @EnvironmentObject private var model: AppModel
  var checkId: String

  var body: some View {
    let locale = model.locale
    let check = model.content?.check(checkId)
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        BackButton(label: model.content?.t("back", locale) ?? "Back") {
          model.route = .home
        }
        Spacer()
        LanguageToggle()
      }
      Text(check?.title.text(locale) ?? "")
        .font(displayFont(size: 36, locale: locale))
        .foregroundStyle(Royal.cream)
        .fixedSize(horizontal: false, vertical: true)
        .minimumScaleFactor(0.7)
      Text(check?.instructions.text(locale) ?? "")
        .font(bodyFont(size: 20, locale: locale))
        .foregroundStyle(Royal.cream)
        .fixedSize(horizontal: false, vertical: true)
      Text(check?.bestNote.text(locale) ?? "")
        .font(bodyFont(size: 15, locale: locale))
        .foregroundStyle(Royal.muted)
        .fixedSize(horizontal: false, vertical: true)
      Spacer()
      GoldButton(title: model.content?.t("continueOn", locale) ?? "Continue", locale: locale) {
        model.route = .compass(checkId)
      }
      .accessibilityIdentifier("continue-check")
    }
    .padding(20)
    .onAppear { model.compass.start() }
    .accessibilityIdentifier("instruct")
  }
}

struct CompassScreen: View {
  @EnvironmentObject private var model: AppModel
  var checkId: String

  var body: some View {
    CompassBody(model: model, compass: model.compass, checkId: checkId)
      .onAppear { model.compass.start() }
      .accessibilityIdentifier("compass")
  }
}

private struct CompassBody: View {
  @ObservedObject var model: AppModel
  @ObservedObject var compass: CompassModel
  var checkId: String

  private let directions: [(String, Double)] = [
    ("N", 0), ("NE", 45), ("E", 90), ("SE", 135),
    ("S", 180), ("SW", 225), ("W", 270), ("NW", 315),
  ]

  var body: some View {
    let locale = model.locale
    let content = model.content
    let check = content?.check(checkId)
    let label = content.map { directionLabel(directionFromHeading(compass.displayHeading), locale: locale, strings: $0.strings) } ?? ""
    VStack(spacing: 8) {
      HStack {
        BackButton(label: content?.t("back", locale) ?? "Back") {
          model.route = .instruct(checkId)
        }
        Text(check?.title.text(locale) ?? "")
          .font(displayFont(size: 26, locale: locale))
          .foregroundStyle(Royal.cream)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      Text(check?.instructions.text(locale) ?? "")
        .font(bodyFont(size: 14, locale: locale))
        .foregroundStyle(Royal.muted)
        .lineLimit(3)
        .minimumScaleFactor(0.75)
        .frame(maxWidth: .infinity, alignment: .leading)

      CompassDial(
        heading: compass.displayHeading,
        interactive: !compass.live || compass.manual,
        onHeading: { compass.setManual($0) }
      )
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .layoutPriority(1)

      Text(label)
        .font(displayFont(size: 32, locale: locale))
        .foregroundStyle(Royal.cream)
        .lineLimit(1)
        .minimumScaleFactor(0.6)

      statusLine(content: content, locale: locale)
        .frame(minHeight: 36)

      if !compass.live || compass.manual {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 8) {
            ForEach(directions, id: \.0) { name, degrees in
              Button(content.map { directionLabel(name, locale: locale, strings: $0.strings) } ?? name) {
                compass.setManual(degrees)
              }
              .font(bodyFont(size: 14, locale: locale, bold: true))
              .foregroundStyle(Royal.cream)
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .background(Capsule().fill(Royal.card))
            }
          }
        }
      }

      GoldButton(
        title: content?.t("lock", locale) ?? "Lock direction",
        locale: locale,
        disabled: !compass.hasHeading
      ) {
        model.lock(checkId: checkId)
      }
      .accessibilityIdentifier("lock-direction")
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 10)
  }

  private func statusLine(content: ContentBundle?, locale: AppLocale) -> some View {
    VStack(spacing: 2) {
      if !compass.hasHeading {
        Text(content?.t("waitingCompass", locale) ?? "Waiting for the compass…")
        Text(content?.t("setByHand", locale) ?? "")
      } else if headingNeedsCalibration(compass.accuracy) && compass.live && !compass.manual {
        Text(content?.t("calibration", locale) ?? "")
      } else if compass.manual {
        Text(content?.t("setByHand", locale) ?? "")
        if compass.live {
          Button(content?.t("followLive", locale) ?? "Follow the live compass") {
            compass.followLive()
          }
          .font(bodyFont(size: 14, locale: locale, bold: true))
          .foregroundStyle(Royal.gold)
        }
      } else if compass.approximate {
        Text(content?.t("approximateNorth", locale) ?? "")
      } else if !compass.trueNorth {
        Text(content?.t("usingMagnetic", locale) ?? "")
        if compass.isDenied {
          Button(content?.t("openSettings", locale) ?? "Open Settings") {
            model.openSettings()
          }
          .font(bodyFont(size: 14, locale: locale, bold: true))
          .foregroundStyle(Royal.gold)
        }
      } else {
        Text(content?.t("steadyEnough", locale) ?? "")
      }
    }
    .font(bodyFont(size: 13, locale: locale))
    .foregroundStyle(Royal.muted)
    .multilineTextAlignment(.center)
  }
}

struct CompassDial: View {
  var heading: Double
  var interactive: Bool
  var onHeading: (Double) -> Void

  var body: some View {
    GeometryReader { geo in
      let side = min(geo.size.width, geo.size.height)
      Canvas { context, size in
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 2 - 4
        let disc = Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
        context.fill(disc, with: .color(Royal.navy))
        context.stroke(disc, with: .color(Royal.gold.opacity(0.85)), lineWidth: 3)
        context.drawLayer { layer in
          layer.translateBy(x: center.x, y: center.y)
          layer.rotate(by: .degrees(-heading))
          layer.translateBy(x: -center.x, y: -center.y)
          for index in 0..<32 {
            let angle = Double(index) * 11.25 * .pi / 180 - .pi / 2
            let major = index % 8 == 0
            let inner = radius * (major ? 0.72 : 0.8)
            let outer = radius * 0.9
            var tick = Path()
            tick.move(to: CGPoint(x: center.x + cos(angle) * inner, y: center.y + sin(angle) * inner))
            tick.addLine(to: CGPoint(x: center.x + cos(angle) * outer, y: center.y + sin(angle) * outer))
            layer.stroke(tick, with: .color(major ? Royal.gold : Royal.gold.opacity(0.4)), lineWidth: major ? 2.2 : 1)
          }
          let letters: [(String, Double)] = [("N", -90), ("E", 0), ("S", 90), ("W", 180)]
          for (letter, degrees) in letters {
            let rad = degrees * .pi / 180
            let point = CGPoint(
              x: center.x + cos(rad) * radius * 0.58,
              y: center.y + sin(rad) * radius * 0.58
            )
            layer.draw(
              Text(letter)
                .font(.custom(Face.displayBold, size: radius * 0.16))
                .foregroundColor(letter == "N" ? Royal.gold : Royal.cream),
              at: point
            )
          }
        }
        var needle = Path()
        needle.move(to: CGPoint(x: center.x, y: center.y - radius + 8))
        needle.addLine(to: CGPoint(x: center.x - 8, y: center.y - radius + 28))
        needle.addLine(to: CGPoint(x: center.x + 8, y: center.y - radius + 28))
        needle.closeSubpath()
        context.fill(needle, with: .color(Royal.gold))
        context.fill(
          Path(ellipseIn: CGRect(x: center.x - 5, y: center.y - 5, width: 10, height: 10)),
          with: .color(Royal.cream)
        )
      }
      .frame(width: side, height: side)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .gesture(drag(in: geo.size))
      .accessibilityLabel("Compass")
    }
  }

  private func drag(in size: CGSize) -> some Gesture {
    DragGesture(minimumDistance: 0)
      .onChanged { value in
        guard interactive else { return }
        let dx = value.location.x - size.width / 2
        let dy = value.location.y - size.height / 2
        onHeading(normalizeDegrees(atan2(dx, -dy) * 180 / .pi))
      }
  }
}

struct VerdictView: View {
  @EnvironmentObject private var model: AppModel
  var checkId: String
  @State private var showMore = false

  var body: some View {
    let locale = model.locale
    let content = model.content
    let check = content?.check(checkId)
    let saved = model.results.first { $0.checkId == checkId }
    let verdict = check.flatMap { item in
      content.map { bundle in
        verdictForHeading(check: item, heading: saved?.heading ?? 0, locale: locale, strings: bundle.strings)
      }
    }
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        HStack {
          BackButton(label: content?.t("back", locale) ?? "Back") { model.route = .home }
          Spacer()
          LanguageToggle()
        }
        if let verdict, let check, let content {
          HStack(spacing: 12) {
            Circle()
              .fill(ratingColor(verdict.rating))
              .frame(width: 18, height: 18)
            Text(content.t(verdict.rating, locale))
              .font(displayFont(size: 28, locale: locale))
              .foregroundStyle(Royal.cream)
          }
          Text(verdict.placementLine)
            .font(displayFont(size: 36, locale: locale))
            .foregroundStyle(Royal.cream)
            .fixedSize(horizontal: false, vertical: true)
          if check.granularity == 32 {
            Text(verdict.slotLine)
              .font(bodyFont(size: 18, locale: locale))
              .foregroundStyle(Royal.cream)
          }
          if let toward = verdict.toward {
            Text(toward).font(bodyFont(size: 15, locale: locale)).foregroundStyle(Royal.muted)
          }
          Text(verdict.meaning)
            .font(bodyFont(size: 17, locale: locale))
            .foregroundStyle(Royal.cream)
            .fixedSize(horizontal: false, vertical: true)
          Text(verdict.bestNote)
            .font(bodyFont(size: 15, locale: locale))
            .foregroundStyle(Royal.cream)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Royal.card))

          let allLines = content.remedyLines(check: check, verdict: verdict, locale: locale)
          let lines = model.access.visibleRemedies(allLines)
          if lines.isEmpty {
            Text(content.t("nothingToMove", locale))
              .font(bodyFont(size: 17, locale: locale))
              .foregroundStyle(Royal.cream)
          } else {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
              Text(line)
                .font(bodyFont(size: 16, locale: locale))
                .foregroundStyle(Royal.cream)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Royal.card))
            }
            if saved != nil {
              Toggle(isOn: Binding(
                get: { saved?.remedyDone ?? false },
                set: { model.setRemedy(checkId: checkId, done: $0) }
              )) {
                Text(content.t("remedyDone", locale))
                  .font(bodyFont(size: 16, locale: locale))
                  .foregroundStyle(Royal.cream)
              }
              .tint(Royal.gold)
            }
            if lines.count < allLines.count {
              Button(content.t("moreRemedies", locale)) { model.showPaywall = true }
                .font(bodyFont(size: 15, locale: locale, bold: true))
                .foregroundStyle(Royal.gold)
                .accessibilityIdentifier("more-remedies")
            }
          }
          if saved?.trueNorth == false {
            Text(content.t("stillMagnetic", locale))
              .font(bodyFont(size: 13, locale: locale))
              .foregroundStyle(Royal.warn)
          }
          Button(content.t("more", locale)) { showMore = true }
            .font(bodyFont(size: 16, locale: locale, bold: true))
            .foregroundStyle(Royal.gold)
            .accessibilityIdentifier("more")
          GoldButton(title: content.t("checkAnother", locale), locale: locale) {
            model.route = .home
          }
          GhostButton(title: content.t("retake", locale), locale: locale) {
            model.route = .compass(checkId)
          }
          Button(content.t("seeHarmony", locale)) { model.route = .summary }
            .font(bodyFont(size: 16, locale: locale))
            .foregroundStyle(Royal.gold)
            .frame(maxWidth: .infinity)
          Text(content.catalog.framing.text(locale))
            .font(bodyFont(size: 12, locale: locale))
            .foregroundStyle(Royal.muted)
        }
      }
      .padding(20)
    }
    .sheet(isPresented: $showMore) {
      if let check, let verdict, let content, let saved {
        MoreSheet(check: check, verdict: verdict, saved: saved, content: content, locale: locale)
          .presentationDetents([.medium, .large])
      }
    }
    .accessibilityIdentifier("verdict")
  }
}

private struct MoreSheet: View {
  var check: VaastuCheck
  var verdict: QuizVerdict
  var saved: StoredResult
  var content: ContentBundle
  var locale: AppLocale

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text(content.t("details", locale))
          .font(displayFont(size: 28, locale: locale))
          .foregroundStyle(Royal.cream)
        Text("\(formatHeading(verdict.heading)) · \(verdict.directionLabel) · \(verdict.slotId)")
          .font(bodyFont(size: 16, locale: locale))
          .foregroundStyle(Royal.gold)
        Text(verdict.meaning)
          .font(bodyFont(size: 16, locale: locale))
          .foregroundStyle(Royal.cream)
        if let detail = check.detailNote?.text(locale) {
          Text(detail)
            .font(bodyFont(size: 15, locale: locale))
            .foregroundStyle(Royal.muted)
        }
        if let rule = content.rule(check.id) {
          Text(rule.reasoning.text(locale))
            .font(bodyFont(size: 15, locale: locale))
            .foregroundStyle(Royal.cream)
        }
        if check.granularity == 32 {
          Text(content.catalog.convention.text(locale))
            .font(bodyFont(size: 13, locale: locale))
            .foregroundStyle(Royal.muted)
        }
        Text(saved.trueNorth ? content.t("trueNorth", locale) : content.t("stillMagnetic", locale))
          .font(bodyFont(size: 14, locale: locale))
          .foregroundStyle(Royal.muted)
        Text(content.catalog.framing.text(locale))
          .font(bodyFont(size: 13, locale: locale))
          .foregroundStyle(Royal.muted)
      }
      .padding(22)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .background(Royal.navy)
  }
}

func formatHeading(_ heading: Double) -> String {
  let degrees = Int(normalizeDegrees(heading).rounded()) % 360
  return "\(degrees)°"
}
