import SwiftUI

enum Royal {
  static let field = Color(red: 0.047, green: 0.078, blue: 0.188)
  static let navy = Color(red: 0.063, green: 0.102, blue: 0.227)
  static let card = Color(red: 0.102, green: 0.145, blue: 0.275)
  static let cardEdge = Color(red: 0.78, green: 0.66, blue: 0.38).opacity(0.28)
  static let gold = Color(red: 0.831, green: 0.694, blue: 0.353)
  static let goldBright = Color(red: 0.91, green: 0.81, blue: 0.52)
  static let cream = Color(red: 0.957, green: 0.937, blue: 0.886)
  static let muted = Color(red: 0.72, green: 0.69, blue: 0.62)
  static let ink = Color(red: 0.102, green: 0.078, blue: 0.031)
  static let good = Color(red: 0.49, green: 0.78, blue: 0.58)
  static let warn = Color(red: 0.86, green: 0.62, blue: 0.32)
  static let avoid = Color(red: 0.86, green: 0.55, blue: 0.48)
}

enum Face {
  static let display = "CormorantGaramond-Medium"
  static let displayBold = "CormorantGaramond-SemiBold"
  static let hindi = "NotoSansDevanagari-Regular"
  static let hindiBold = "NotoSansDevanagari-SemiBold"
}

func displayFont(size: CGFloat, locale: AppLocale, bold: Bool = false) -> Font {
  if locale == .hi {
    return .custom(bold ? Face.hindiBold : Face.hindi, size: size)
  }
  return .custom(bold ? Face.displayBold : Face.display, size: size)
}

func bodyFont(size: CGFloat, locale: AppLocale, bold: Bool = false) -> Font {
  if locale == .hi {
    return .custom(bold ? Face.hindiBold : Face.hindi, size: size)
  }
  return .system(size: size, weight: bold ? .semibold : .regular)
}

func ratingColor(_ rating: String) -> Color {
  switch rating {
  case "auspicious": return Royal.good
  case "neutral": return Royal.gold
  default: return Royal.avoid
  }
}

func symbolName(for icon: String) -> String {
  switch icon {
  case "door": return "door.left.hand.open"
  case "house": return "house"
  case "pot": return "frying.pan"
  case "flame": return "flame"
  case "bed": return "bed.double"
  case "pillow": return "bed.double.fill"
  case "child": return "figure.and.child.holdinghands"
  case "guests": return "person.2"
  case "flower": return "camera.macro"
  case "pray": return "hands.sparkles"
  case "spark": return "sparkle"
  case "bath": return "shower"
  case "drop": return "drop"
  case "tank": return "cylinder"
  case "septic": return "arrow.down.to.line"
  case "book": return "book"
  case "laptop": return "laptopcomputer"
  case "lock": return "lock"
  case "sofa": return "sofa"
  case "utensils": return "fork.knife"
  case "stairs": return "figure.stairs"
  case "mirror": return "rectangle.portrait"
  case "tv": return "tv"
  case "window": return "sun.max"
  case "tree": return "tree"
  case "car": return "car"
  case "store": return "storefront"
  case "chair": return "chair"
  default: return "circle"
  }
}

struct RoyalField: View {
  var body: some View {
    Canvas { context, size in
      context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Royal.field))
      var stars = StarSeed(state: 0xD15A_7A11)
      for _ in 0..<80 {
        let x = stars.next() * size.width
        let y = stars.next() * size.height
        let radius = 0.4 + stars.next() * 1.35
        let alpha = 0.12 + stars.next() * 0.45
        let rect = CGRect(x: x, y: y, width: radius, height: radius)
        context.fill(Path(ellipseIn: rect), with: .color(Royal.gold.opacity(alpha)))
      }
      let center = CGPoint(x: size.width / 2, y: size.height * 0.42)
      var mandala = Path()
      for ring in [90.0, 150.0, 220.0] {
        mandala.addEllipse(in: CGRect(x: center.x - ring, y: center.y - ring, width: ring * 2, height: ring * 2))
      }
      for petal in 0..<8 {
        let angle = Double(petal) * .pi / 4 - .pi / 2
        let tip = CGPoint(x: center.x + cos(angle) * 210, y: center.y + sin(angle) * 210)
        mandala.move(to: center)
        mandala.addLine(to: tip)
      }
      context.stroke(mandala, with: .color(Royal.gold.opacity(0.07)), lineWidth: 1)
    }
    .ignoresSafeArea()
  }
}

private struct StarSeed {
  var state: UInt64
  mutating func next() -> Double {
    state &+= 0x9E3779B97F4A7C15
    var z = state
    z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
    z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
    z = z ^ (z >> 31)
    return Double(z % 10_000) / 10_000
  }
}

struct LanguageToggle: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    HStack(spacing: 0) {
      segment("EN", .en, font: .custom(Face.displayBold, size: 14))
      segment("हिन्दी", .hi, font: .custom(Face.hindiBold, size: 14))
    }
    .padding(3)
    .background(Capsule().fill(Royal.card))
    .overlay(Capsule().stroke(Royal.gold.opacity(0.45), lineWidth: 1))
    .accessibilityIdentifier("language-toggle")
  }

  private func segment(_ title: String, _ locale: AppLocale, font: Font) -> some View {
    let selected = model.locale == locale
    return Button {
      model.setLocale(locale)
    } label: {
      Text(title)
        .font(font)
        .foregroundStyle(selected ? Royal.ink : Royal.cream)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(selected ? Royal.gold : Color.clear))
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier(locale == .hi ? "language-hi" : "language-en")
  }
}

struct GoldButton: View {
  var title: String
  var locale: AppLocale = .en
  var disabled: Bool = false
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(bodyFont(size: 18, locale: locale, bold: true))
        .foregroundStyle(Royal.ink)
        .frame(maxWidth: .infinity)
        .frame(height: 54)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(disabled ? Royal.gold.opacity(0.35) : Royal.gold))
    }
    .buttonStyle(.plain)
    .disabled(disabled)
  }
}

struct GhostButton: View {
  var title: String
  var locale: AppLocale
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(bodyFont(size: 16, locale: locale, bold: true))
        .foregroundStyle(Royal.gold)
        .frame(maxWidth: .infinity)
        .frame(height: 48)
        .background(
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .stroke(Royal.gold.opacity(0.7), lineWidth: 1)
        )
    }
    .buttonStyle(.plain)
  }
}

struct ScoreRing: View {
  var score: Int?
  var diameter: CGFloat
  var locale: AppLocale

  var body: some View {
    ZStack {
      Circle().stroke(Royal.gold.opacity(0.22), lineWidth: diameter * 0.06)
      Circle()
        .trim(from: 0, to: CGFloat(score ?? 0) / 100)
        .stroke(Royal.gold, style: StrokeStyle(lineWidth: diameter * 0.06, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text(score.map(String.init) ?? "—")
        .font(displayFont(size: diameter * 0.34, locale: locale))
        .foregroundStyle(Royal.cream)
        .minimumScaleFactor(0.6)
    }
    .frame(width: diameter, height: diameter)
    .accessibilityLabel(score.map { "\($0)" } ?? "—")
  }
}

struct Wordmark: View {
  var body: some View {
    Text("DISHA")
      .font(.custom(Face.displayBold, size: 13))
      .tracking(3)
      .foregroundStyle(Royal.gold)
  }
}

struct BackButton: View {
  var label: String
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: "chevron.left")
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(Royal.cream)
        .frame(width: 40, height: 40)
        .background(Circle().fill(Royal.card))
        .overlay(Circle().stroke(Royal.cardEdge, lineWidth: 1))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }
}

struct ToastBanner: View {
  var delta: Int

  var body: some View {
    Text(delta > 0 ? "+\(delta)" : "−\(abs(delta))")
      .font(.custom(Face.displayBold, size: 28))
      .foregroundStyle(Royal.ink)
      .padding(.horizontal, 18)
      .padding(.vertical, 6)
      .background(Capsule().fill(Royal.gold))
      .accessibilityIdentifier("score-toast")
  }
}
