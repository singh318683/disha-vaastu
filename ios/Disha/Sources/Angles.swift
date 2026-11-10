import Foundation

enum AppLocale: String, Codable, CaseIterable, Equatable {
  case en
  case hi

  static func detect(preferred: [String] = Locale.preferredLanguages) -> AppLocale {
    for language in preferred where language.lowercased().hasPrefix("hi") {
      return .hi
    }
    return .en
  }
}

struct L10n: Codable, Equatable {
  var en: String
  var hi: String

  func text(_ locale: AppLocale) -> String {
    switch locale {
    case .hi:
      let trimmed = hi.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? en : hi
    case .en:
      return en
    }
  }
}

struct StringTable {
  var entries: [String: L10n]

  func t(_ key: String, _ locale: AppLocale) -> String {
    entries[key]?.text(locale) ?? key
  }
}

/// Wrap any angle into [0, 360).
func normalizeDegrees(_ value: Double) -> Double {
  precondition(value.isFinite, "Angle must be a finite number.")
  let wrapped = value.truncatingRemainder(dividingBy: 360)
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/// True heading = magnetic heading + declination. East is positive.
func magneticToTrue(_ magneticHeading: Double, declinationEast: Double) -> Double {
  normalizeDegrees(magneticHeading + declinationEast)
}

/// Smallest signed difference `to - from`, in (-180, 180].
func shortestDelta(from: Double, to: Double) -> Double {
  let delta = normalizeDegrees(to - from)
  return delta > 180 ? delta - 360 : delta
}
