import Foundation

struct StoredResult: Codable, Equatable, Identifiable {
  var checkId: String
  var heading: Double
  var trueNorth: Bool
  var at: Double
  var remedyDone: Bool

  var id: String { checkId }
}

func upsertResult(_ list: [StoredResult], _ next: StoredResult) -> [StoredResult] {
  list.filter { $0.checkId != next.checkId } + [next]
}

enum StoreKey {
  static let locale = "disha.locale"
  static let results = "disha.quiz.results.v1"
  static let askedLocation = "disha.location.asked"
  static let latitude = "disha.latitude"
  static let longitude = "disha.longitude"
  static let declination = "disha.declination"
  static let homeID = "disha.home.id"
  static let reportHomes = "disha.report.homes"
}

struct PersistedQuiz {
  var locale: AppLocale
  var results: [StoredResult]
  var askedLocation: Bool
  var latitude: Double?
  var longitude: Double?
  var declination: Double?
  var homeID: String

  static func load(defaults: UserDefaults) -> PersistedQuiz {
    let locale: AppLocale
    if let saved = defaults.string(forKey: StoreKey.locale), let parsed = AppLocale(rawValue: saved) {
      locale = parsed
    } else {
      locale = AppLocale.detect()
    }
    var results: [StoredResult] = []
    if let data = defaults.data(forKey: StoreKey.results),
       let decoded = try? JSONDecoder().decode([StoredResult].self, from: data) {
      var byId: [String: StoredResult] = [:]
      for item in decoded where item.heading.isFinite {
        byId[item.checkId] = item
      }
      results = Array(byId.values)
    }
    let latitude = defaults.object(forKey: StoreKey.latitude) as? Double
    let longitude = defaults.object(forKey: StoreKey.longitude) as? Double
    let declination = defaults.object(forKey: StoreKey.declination) as? Double
    let homeID: String
    if let saved = defaults.string(forKey: StoreKey.homeID), UUID(uuidString: saved) != nil {
      homeID = saved
    } else {
      homeID = UUID().uuidString
    }
    return PersistedQuiz(
      locale: locale,
      results: results,
      askedLocation: defaults.bool(forKey: StoreKey.askedLocation),
      latitude: latitude,
      longitude: longitude,
      declination: declination,
      homeID: homeID
    )
  }

  func save(defaults: UserDefaults) {
    defaults.set(locale.rawValue, forKey: StoreKey.locale)
    defaults.set(askedLocation, forKey: StoreKey.askedLocation)
    if let data = try? JSONEncoder().encode(results) {
      defaults.set(data, forKey: StoreKey.results)
    }
    if let latitude { defaults.set(latitude, forKey: StoreKey.latitude) }
    if let longitude { defaults.set(longitude, forKey: StoreKey.longitude) }
    if let declination { defaults.set(declination, forKey: StoreKey.declination) }
    defaults.set(homeID, forKey: StoreKey.homeID)
  }
}
