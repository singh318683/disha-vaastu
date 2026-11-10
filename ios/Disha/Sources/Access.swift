import Foundation

/// Product ids and legal links. Prices are never stored here; the paywall
/// shows `Product.displayPrice` from StoreKit.
enum StoreConfig {
  static let monthly = "com.ikshanasolutions.disha.premium.monthly"
  static let yearly = "com.ikshanasolutions.disha.premium.yearly"
  static let lifetime = "com.ikshanasolutions.disha.premium.lifetime"
  static let homeReport = "com.ikshanasolutions.disha.report.single"
  static let termsURL = URL(string: "https://disha-vaastu.vercel.app/terms")!
  static let privacyURL = URL(string: "https://disha-vaastu.vercel.app/privacy")!

  static let premiumIDs: Set<String> = [monthly, yearly, lifetime]

  static func grantsPremium(_ productID: String) -> Bool {
    premiumIDs.contains(productID)
  }

  static func isHomeReport(_ productID: String) -> Bool {
    productID == homeReport
  }
}

enum ContentTier: String, Equatable {
  case free
  case premium
}

/// House facing, main door, kitchen, master bedroom, pooja, and living.
/// Used only when the synced catalog has neither `tier` nor `freeChecks`.
enum FreeCatalog {
  static let ids: Set<String> = [
    "house_facing",
    "main_door",
    "kitchen",
    "master_bedroom",
    "pooja",
    "living",
  ]
}

enum ScoreKind: String, Equatable {
  case preview
  case full
}

struct LibraryAccess: Equatable {
  var premium: Bool
  var homeReport: Bool

  var full: Bool { premium || homeReport }
  var kind: ScoreKind { full ? .full : .preview }

  func tier(id: String, tierField: String?, freeChecks: Set<String>?) -> ContentTier {
    contentTier(id: id, tierField: tierField, freeChecks: freeChecks)
  }

  func isUnlocked(id: String, tierField: String?, freeChecks: Set<String>?) -> Bool {
    full || tier(id: id, tierField: tierField, freeChecks: freeChecks) == .free
  }

  func isUnlocked(_ check: VaastuCheck, freeChecks: Set<String>?) -> Bool {
    isUnlocked(id: check.id, tierField: check.tier, freeChecks: freeChecks)
  }

  /// Free readings keep the verdict and the first remedy. Premium and a
  /// Home Report for this home keep the whole list.
  func visibleRemedies<T>(_ remedies: [T]) -> [T] {
    if full || remedies.count <= 1 { return remedies }
    return Array(remedies.prefix(1))
  }
}

func contentTier(id: String, tierField: String?, freeChecks: Set<String>?) -> ContentTier {
  if tierField == ContentTier.free.rawValue { return .free }
  if tierField == ContentTier.premium.rawValue { return .premium }
  if let freeChecks {
    return freeChecks.contains(id) ? .free : .premium
  }
  return FreeCatalog.ids.contains(id) ? .free : .premium
}

func scopedResults(
  _ results: [StoredResult],
  checks: [VaastuCheck],
  freeChecks: Set<String>?,
  access: LibraryAccess
) -> [StoredResult] {
  if access.full { return results }
  let tiers = Dictionary(uniqueKeysWithValues: checks.map { ($0.id, $0.tier) })
  return results.filter { result in
    contentTier(id: result.checkId, tierField: tiers[result.checkId] ?? nil, freeChecks: freeChecks) == .free
  }
}

func presentedScore(
  results: [StoredResult],
  content: ContentBundle,
  access: LibraryAccess
) -> PresentedScore {
  let freeList = content.catalog.freeChecks.map { Set($0) }
  let scoped = scopedResults(results, checks: content.catalog.checks, freeChecks: freeList, access: access)
  let total = access.full
    ? content.catalog.checks.count
    : content.catalog.checks.filter { access.tier(id: $0.id, tierField: $0.tier, freeChecks: freeList) == .free }.count
  return PresentedScore(
    score: scoreResults(scoped, content: content, catalogCount: total),
    kind: access.kind
  )
}

struct PresentedScore: Equatable {
  var score: HomeScoreResult
  var kind: ScoreKind
}

func mergeReportGrant(_ existing: Set<String>, homeID: String) -> Set<String> {
  var next = existing
  if !homeID.isEmpty { next.insert(homeID) }
  return next
}
