import SwiftUI

struct WelcomeView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Wordmark()
        Spacer()
        LanguageToggle()
      }
      Spacer(minLength: 12)
      CompassMark()
        .frame(height: 150)
        .frame(maxWidth: .infinity)
      Spacer(minLength: 12)
      Text(model.content?.t("welcomeTitle", model.locale) ?? "A calmer way to read your home.")
        .font(displayFont(size: 42, locale: model.locale))
        .foregroundStyle(Royal.cream)
        .fixedSize(horizontal: false, vertical: true)
        .minimumScaleFactor(0.7)
      Text(model.content?.t("welcomeLine", model.locale) ?? "")
        .font(bodyFont(size: 18, locale: model.locale))
        .foregroundStyle(Royal.muted)
        .padding(.top, 14)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 20)
      GoldButton(title: model.content?.t("start", model.locale) ?? "Start", locale: model.locale) {
        model.start()
      }
      .accessibilityIdentifier("start")
      Text(model.content?.catalog.framing.text(model.locale) ?? "")
        .font(bodyFont(size: 13, locale: model.locale))
        .foregroundStyle(Royal.muted)
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
        .padding(.top, 12)
    }
    .padding(.horizontal, 24)
    .padding(.vertical, 18)
    .accessibilityIdentifier("welcome")
  }
}

struct CompassMark: View {
  var body: some View {
    Canvas { context, size in
      let center = CGPoint(x: size.width / 2, y: size.height / 2)
      let radius = min(size.width, size.height) * 0.42
      var ring = Path()
      ring.addEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
      context.stroke(ring, with: .color(Royal.gold.opacity(0.85)), lineWidth: 2)
      for index in 0..<32 {
        let angle = Double(index) * .pi / 16 - .pi / 2
        let major = index % 8 == 0
        let inner = radius * (major ? 0.78 : 0.86)
        let outer = radius * 0.96
        var tick = Path()
        tick.move(to: CGPoint(x: center.x + cos(angle) * inner, y: center.y + sin(angle) * inner))
        tick.addLine(to: CGPoint(x: center.x + cos(angle) * outer, y: center.y + sin(angle) * outer))
        context.stroke(tick, with: .color(major ? Royal.gold : Royal.gold.opacity(0.45)), lineWidth: major ? 2 : 1)
      }
      var rose = Path()
      rose.move(to: CGPoint(x: center.x, y: center.y - radius * 0.62))
      rose.addLine(to: CGPoint(x: center.x + 8, y: center.y))
      rose.addLine(to: CGPoint(x: center.x, y: center.y + radius * 0.62))
      rose.addLine(to: CGPoint(x: center.x - 8, y: center.y))
      rose.closeSubpath()
      context.fill(rose, with: .color(Royal.gold))
      context.fill(Path(ellipseIn: CGRect(x: center.x - 4, y: center.y - 4, width: 8, height: 8)), with: .color(Royal.cream))
    }
  }
}
