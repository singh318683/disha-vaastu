import Foundation

/// Quiz ratings in checks.json, plus the bands the home score understands.
enum ScoreTier: String, Equatable {
  case best
  case good
  case neutral
  case avoid

  /// Share of a perfect placement. Best 100%, good 75%, neutral 50%, avoid 15%.
  var fraction: Double {
    switch self {
    case .best: return 1
    case .good: return 0.75
    case .neutral: return 0.50
    case .avoid: return 0.15
    }
  }

  /// The next band a finished remedy is credited halfway toward.
  var remedyCeiling: Double {
    switch self {
    case .avoid: return 0.50
    case .neutral: return 0.75
    case .good: return 1
    case .best: return 1
    }
  }
}

func tier(forRating rating: String) -> ScoreTier {
  switch rating {
  case "auspicious", "best", "excellent":
    return .best
  case "good", "favorable":
    return .good
  case "neutral", "acceptable":
    return .neutral
  case "inauspicious", "avoid", "attention", "unfavorable":
    return .avoid
  default:
    return .neutral
  }
}

/// A marked remedy earns halfway from the current band toward the next one.
/// An ideal placement stays at 100%.
func creditedFraction(tier: ScoreTier, remedyDone: Bool) -> Double {
  let base = tier.fraction
  guard remedyDone, tier != .best else { return base }
  return (base + tier.remedyCeiling) / 2
}

enum CheckWeight {
  /// Heavier than a typical check. Matches rules.json where that file names the room,
  /// and gives house facing the same kind of weight — it is not a rule-file room.
  static let heavier: [String: Double] = [
    "main_door": 1.6,
    "house_facing": 1.5,
    "kitchen": 1.4,
    "master_bedroom": 1.3,
    "pooja": 1.2,
    "toilet": 1.3,
  ]

  static func weight(id: String, ruleWeights: [String: Double]) -> Double {
    if let heavy = heavier[id] { return heavy }
    if let rule = ruleWeights[id] { return rule }
    return 1
  }
}

enum ScoreBand: String, Equatable {
  case excellent
  case good
  case fair
  case needsCare

  static func from(score: Int) -> ScoreBand {
    if score >= 85 { return .excellent }
    if score >= 70 { return .good }
    if score >= 50 { return .fair }
    return .needsCare
  }

  func title(_ strings: StringTable, _ locale: AppLocale) -> String {
    switch self {
    case .excellent: return strings.t("bandExcellent", locale)
    case .good: return strings.t("bandGood", locale)
    case .fair: return strings.t("bandFair", locale)
    case .needsCare: return strings.t("needsCare", locale)
    }
  }
}

struct WeightedCheck: Equatable {
  var id: String
  var groupKey: String
  var weight: Double
  var fraction: Double
}

struct CategoryScore: Equatable {
  var group: L10n
  var score: Int?
  var done: Int
  var total: Int
}

struct ScoreBoost: Equatable, Identifiable {
  var id: String
  var title: L10n
  /// Home-score points gained if this check reached the traditional best.
  var points: Int
}

struct HomeScoreResult: Equatable {
  var score: Int?
  var band: ScoreBand?
  var done: Int
  var total: Int
  var categories: [CategoryScore]
  var boosts: [ScoreBoost]
}

func roundScore(_ value: Double) -> Int {
  Int(value.rounded())
}

func coverageLine(done: Int, total: Int, locale: AppLocale) -> String {
  if locale == .hi {
    return "\(total) में से \(done) जाँचों पर आधारित"
  }
  return "Based on \(done) of \(total) checks"
}

/// Change in the rounded home score. Nil when nothing moved.
func scoreDelta(before: Int?, after: Int?) -> Int? {
  switch (before, after) {
  case let (previous?, next?):
    let delta = next - previous
    return delta == 0 ? nil : delta
  case (nil, let next?):
    return next
  default:
    return nil
  }
}

func homeScore(
  checks: [WeightedCheck],
  groups: [(key: String, name: L10n, total: Int)],
  titles: [String: L10n],
  catalogCount: Int
) -> HomeScoreResult {
  let done = checks.count
  let categories: [CategoryScore] = groups.map { group in
    let rows = checks.filter { $0.groupKey == group.key }
    let score = weightedScore(rows)
    return CategoryScore(group: group.name, score: score, done: rows.count, total: group.total)
  }
  guard done > 0 else {
    return HomeScoreResult(
      score: nil,
      band: nil,
      done: 0,
      total: catalogCount,
      categories: categories,
      boosts: []
    )
  }
  let score = weightedScore(checks) ?? 0
  let totalWeight = checks.reduce(0) { $0 + $1.weight }
  let boosts: [ScoreBoost] = checks
    .filter { $0.fraction < 0.999 && totalWeight > 0 }
    .map { row in
      let gain = row.weight * (1 - row.fraction) / totalWeight * 100
      return ScoreBoost(id: row.id, title: titles[row.id] ?? L10n(en: row.id, hi: row.id), points: roundScore(gain))
    }
    .filter { $0.points > 0 }
    .sorted { lhs, rhs in
      if lhs.points != rhs.points { return lhs.points > rhs.points }
      return lhs.id < rhs.id
    }
    .prefix(3)
    .map { $0 }

  return HomeScoreResult(
    score: score,
    band: ScoreBand.from(score: score),
    done: done,
    total: catalogCount,
    categories: categories,
    boosts: Array(boosts)
  )
}

func weightedScore(_ rows: [WeightedCheck]) -> Int? {
  let weight = rows.reduce(0) { $0 + $1.weight }
  guard weight > 0, !rows.isEmpty else { return nil }
  let total = rows.reduce(0) { $0 + $1.weight * $1.fraction }
  return roundScore(total / weight * 100)
}
