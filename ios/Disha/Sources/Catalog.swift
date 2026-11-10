import Foundation

struct CheckZone: Codable, Equatable, Identifiable {
  var id: String
  var name: L10n
  var rating: String
  var meaning: L10n
  var remedies: [L10n]
}

struct VaastuCheck: Codable, Equatable, Identifiable {
  var id: String
  var title: L10n
  var blurb: L10n
  var icon: String
  var group: L10n
  var reference: String
  var granularity: Int
  var instructions: L10n
  var bestNote: L10n
  var facingNotes: [String: L10n]?
  var resultNoun: L10n?
  var detailNote: L10n?
  /// "free" or "premium", stamped by ios/scripts/sync-content.mjs.
  var tier: String?
  var zones: [CheckZone]
}

struct CheckCatalog: Codable, Equatable {
  var version: Int
  var framing: L10n
  var convention: L10n
  var freeChecks: [String]?
  var checks: [VaastuCheck]
}

struct CheckGroup: Equatable, Identifiable {
  var group: L10n
  var checks: [VaastuCheck]
  var id: String { group.en }
}

func checkGroups(_ checks: [VaastuCheck]) -> [CheckGroup] {
  var order: [String] = []
  var map: [String: CheckGroup] = [:]
  for check in checks {
    let key = check.group.en
    if var existing = map[key] {
      existing.checks.append(check)
      map[key] = existing
    } else {
      map[key] = CheckGroup(group: check.group, checks: [check])
      order.append(key)
    }
  }
  return order.compactMap { map[$0] }
}

struct RemedyBands: Codable, Equatable {
  var best: [String]
  var favorable: [String]
  var neutral: [String]
  var avoid: [String]
  var center: [String]
  var nearToilet: [String]
}

struct RuleRoom: Decodable, Equatable, Identifiable {
  var id: String
  var weight: Double
  var reasoning: L10n
  var remedies: RemedyBands

  enum CodingKeys: String, CodingKey {
    case id
    case weight
    case reasoning
    case remedies
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    reasoning = try container.decode(L10n.self, forKey: .reasoning)
    remedies = try container.decode(RemedyBands.self, forKey: .remedies)
    if let value = try? container.decode(Double.self, forKey: .weight) {
      weight = value
    } else {
      weight = Double(try container.decode(Int.self, forKey: .weight))
    }
  }
}

struct RulesFile: Decodable, Equatable {
  var version: Int
  var rooms: [RuleRoom]
}

struct RemedyItem: Codable, Equatable, Identifiable {
  var id: String
  var title: L10n
  var detail: L10n
}

struct RemediesFile: Codable, Equatable {
  var items: [RemedyItem]
}

struct ContentBundle {
  var catalog: CheckCatalog
  var rules: [RuleRoom]
  var remedies: [RemedyItem]
  var strings: StringTable
  var wmm: WMMCoefficients

  var ruleWeights: [String: Double] {
    Dictionary(uniqueKeysWithValues: rules.map { ($0.id, $0.weight) })
  }

  func rule(_ id: String) -> RuleRoom? {
    rules.first { $0.id == id }
  }

  func remedy(_ id: String) -> RemedyItem? {
    remedies.first { $0.id == id }
  }

  func check(_ id: String) -> VaastuCheck? {
    catalog.checks.first { $0.id == id }
  }

  func t(_ key: String, _ locale: AppLocale) -> String {
    strings.t(key, locale)
  }

  /// Zone remedies win. An ideal zone with none falls back to the rule's "best" notes.
  func remedyLines(check: VaastuCheck, verdict: QuizVerdict, locale: AppLocale) -> [String] {
    if !verdict.remedies.isEmpty { return verdict.remedies }
    guard let rule = rule(check.id) else { return [] }
    return rule.remedies.best.prefix(2).compactMap { remedy($0)?.title.text(locale) }
  }
}

enum ContentLoader {
  static func load(bundle: Bundle = .main) throws -> ContentBundle {
    guard let resource = bundle.resourceURL else {
      throw CocoaError(.fileReadNoSuchFile)
    }
    return try load(directory: resource)
  }

  static func load(directory: URL) throws -> ContentBundle {
    let decoder = JSONDecoder()
    let catalog = try decoder.decode(CheckCatalog.self, from: Data(contentsOf: directory.appendingPathComponent("checks.json")))
    let rules = try decoder.decode(RulesFile.self, from: Data(contentsOf: directory.appendingPathComponent("rules.json")))
    let remedies = try decoder.decode(RemediesFile.self, from: Data(contentsOf: directory.appendingPathComponent("remedies.json")))
    let ui = try decoder.decode([String: L10n].self, from: Data(contentsOf: directory.appendingPathComponent("ui.json")))
    let wmm = try decoder.decode(WMMCoefficients.self, from: Data(contentsOf: directory.appendingPathComponent("wmm-2025.json")))
    return ContentBundle(
      catalog: catalog,
      rules: rules.rooms,
      remedies: remedies.items,
      strings: StringTable(entries: ui),
      wmm: wmm
    )
  }
}

func weightedChecks(results: [StoredResult], content: ContentBundle) -> [WeightedCheck] {
  results.compactMap { stored in
    guard let check = content.check(stored.checkId) else { return nil }
    let verdict = verdictForHeading(check: check, heading: stored.heading, locale: .en, strings: content.strings)
    return WeightedCheck(
      id: check.id,
      groupKey: check.group.en,
      weight: CheckWeight.weight(id: check.id, ruleWeights: content.ruleWeights),
      fraction: creditedFraction(tier: verdict.tier, remedyDone: stored.remedyDone)
    )
  }
}

func scoreResults(_ results: [StoredResult], content: ContentBundle, catalogCount: Int? = nil) -> HomeScoreResult {
  let groups = checkGroups(content.catalog.checks).map { group in
    (key: group.group.en, name: group.group, total: group.checks.count)
  }
  var titles: [String: L10n] = [:]
  for check in content.catalog.checks {
    titles[check.id] = check.title
  }
  return homeScore(
    checks: weightedChecks(results: results, content: content),
    groups: groups,
    titles: titles,
    catalogCount: catalogCount ?? content.catalog.checks.count
  )
}
