import XCTest
@testable import Disha

final class PadaTests: XCTestCase {
  func testNorthAndEastCorners() {
    XCTAssertEqual(padaFromHeading(0), "N5")
    XCTAssertEqual(padaFromHeading(360), "N5")
    XCTAssertEqual(padaFromHeading(-360), "N5")
    XCTAssertEqual(padaFromHeading(720), "N5")
    XCTAssertEqual(padaFromHeading(45), "E1")
    XCTAssertEqual(padaFromHeading(135), "S1")
    XCTAssertEqual(padaFromHeading(225), "W1")
    XCTAssertEqual(padaFromHeading(315), "N1")
    XCTAssertEqual(padaFromHeading(90), "E5")
    XCTAssertEqual(padaFromHeading(180), "S5")
    XCTAssertEqual(padaFromHeading(270), "W5")
  }

  func testWrap359ToZero() {
    XCTAssertEqual(normalizeDegrees(359 + 1), 0, accuracy: 0.0001)
    XCTAssertEqual(normalizeDegrees(360), 0, accuracy: 0.0001)
    XCTAssertEqual(normalizeDegrees(-1), 359, accuracy: 0.0001)
    XCTAssertEqual(padaFromHeading(359), "N4")
    XCTAssertEqual(padaFromHeading(0.001), "N5")
    XCTAssertEqual(padaFromHeading(44.999), "N8")
    XCTAssertEqual(slotFromHeading(359, granularity: 32), "N4")
    XCTAssertEqual(slotFromHeading(0, granularity: 32), "N5")
  }

  func testEightAndSixteenBoundaries() {
    XCTAssertEqual(directionFromHeading(0), "N")
    XCTAssertEqual(directionFromHeading(360), "N")
    XCTAssertEqual(directionFromHeading(22.499), "N")
    XCTAssertEqual(directionFromHeading(22.5), "NE")
    XCTAssertEqual(directionFromHeading(337.5), "N")
    XCTAssertEqual(zoneFromBearing(0), "N")
    XCTAssertEqual(zoneFromBearing(348.75), "N")
    XCTAssertEqual(zoneFromBearing(11.249), "N")
    XCTAssertEqual(zoneFromBearing(11.25), "NNE")
  }
}

final class HeadingSmoothTests: XCTestCase {
  func testStepAcrossNorthDoesNotSpinSouth() {
    var state = smoothHeading(state: nil, heading: 359, dtMs: 0)
    state = smoothHeading(state: state.state, heading: 1, dtMs: 50)
    state = smoothHeading(state: state.state, heading: 2, dtMs: 50)
    XCTAssertTrue(state.heading < 20 || state.heading > 340)
    let mean = circularMean([359, 0, 1, 2])
    XCTAssertNotNil(mean)
    XCTAssertEqual(mean ?? 0, 0.5, accuracy: 0.6)
    let across = circularMean([350, 10]) ?? 180
    XCTAssertLessThan(min(across, 360 - across), 1)
  }

  func testLockAveragesTheLastSecond() {
    let now: TimeInterval = 10_000
    let samples = [
      HeadingSample(time: now - 2.5, heading: 180),
      HeadingSample(time: now - 0.8, heading: 359),
      HeadingSample(time: now - 0.2, heading: 1),
    ]
    let locked = averageRecentHeading(samples: samples, now: now, window: 1)
    XCTAssertNotNil(locked)
    let value = locked ?? 180
    XCTAssertTrue(value < 5 || value > 355)
  }

  func testResolvedHeadingPrefersTrueNorth() {
    let trued = resolvedHeading(trueHeading: 10, magneticHeading: 22, locationAuthorized: true, declinationEast: -12)
    XCTAssertEqual(trued?.degrees ?? -1, 10, accuracy: 0.001)
    XCTAssertEqual(trued?.trueNorth, true)
    XCTAssertEqual(trued?.approximate, false)

    let fallback = resolvedHeading(trueHeading: -1, magneticHeading: 0, locationAuthorized: true, declinationEast: -12)
    XCTAssertEqual(fallback?.trueNorth, false)
    XCTAssertEqual(fallback?.approximate, true)
    XCTAssertEqual(fallback?.degrees ?? 0, 348, accuracy: 0.001)

    let magnetic = resolvedHeading(trueHeading: -1, magneticHeading: 20, locationAuthorized: false, declinationEast: nil)
    XCTAssertEqual(magnetic?.degrees ?? 0, 20, accuracy: 0.001)
    XCTAssertEqual(magnetic?.trueNorth, false)
    XCTAssertEqual(headingNeedsCalibration(-1), true)
    XCTAssertEqual(headingNeedsCalibration(40), true)
    XCTAssertEqual(headingNeedsCalibration(10), false)
    XCTAssertEqual(headingNeedsCalibration(nil), false)
  }
}

final class ScoringTests: XCTestCase {
  func testPointTableAndRemedyCredit() {
    XCTAssertEqual(ScoreTier.best.fraction, 1)
    XCTAssertEqual(ScoreTier.good.fraction, 0.75)
    XCTAssertEqual(ScoreTier.neutral.fraction, 0.50)
    XCTAssertEqual(ScoreTier.avoid.fraction, 0.15)
    XCTAssertEqual(creditedFraction(tier: .avoid, remedyDone: false), 0.15, accuracy: 0.0001)
    XCTAssertEqual(creditedFraction(tier: .avoid, remedyDone: true), 0.325, accuracy: 0.0001)
    XCTAssertEqual(creditedFraction(tier: .neutral, remedyDone: true), 0.625, accuracy: 0.0001)
    XCTAssertEqual(creditedFraction(tier: .good, remedyDone: true), 0.875, accuracy: 0.0001)
    XCTAssertEqual(creditedFraction(tier: .best, remedyDone: true), 1, accuracy: 0.0001)
    XCTAssertEqual(tier(forRating: "auspicious"), .best)
    XCTAssertEqual(tier(forRating: "good"), .good)
    XCTAssertEqual(tier(forRating: "neutral"), .neutral)
    XCTAssertEqual(tier(forRating: "inauspicious"), .avoid)
  }

  func testHeavierChecksAndBands() {
    let rules = ["living": 1.0, "balcony": 0.5, "main_door": 1.6]
    XCTAssertEqual(CheckWeight.weight(id: "main_door", ruleWeights: rules), 1.6)
    XCTAssertEqual(CheckWeight.weight(id: "house_facing", ruleWeights: rules), 1.5)
    XCTAssertEqual(CheckWeight.weight(id: "kitchen", ruleWeights: rules), 1.4)
    XCTAssertEqual(CheckWeight.weight(id: "master_bedroom", ruleWeights: rules), 1.3)
    XCTAssertEqual(CheckWeight.weight(id: "pooja", ruleWeights: rules), 1.2)
    XCTAssertEqual(CheckWeight.weight(id: "toilet", ruleWeights: rules), 1.3)
    XCTAssertGreaterThan(CheckWeight.weight(id: "house_facing", ruleWeights: rules), CheckWeight.weight(id: "living", ruleWeights: rules))
    XCTAssertEqual(CheckWeight.weight(id: "balcony", ruleWeights: rules), 0.5)
    XCTAssertEqual(CheckWeight.weight(id: "mirror", ruleWeights: rules), 1)

    XCTAssertEqual(ScoreBand.from(score: 85), .excellent)
    XCTAssertEqual(ScoreBand.from(score: 84), .good)
    XCTAssertEqual(ScoreBand.from(score: 70), .good)
    XCTAssertEqual(ScoreBand.from(score: 69), .fair)
    XCTAssertEqual(ScoreBand.from(score: 50), .fair)
    XCTAssertEqual(ScoreBand.from(score: 49), .needsCare)

    let rows = [
      WeightedCheck(id: "main_door", groupKey: "Entrance", weight: 1.6, fraction: 1),
      WeightedCheck(id: "mirror", groupKey: "Living", weight: 1, fraction: 0.15),
    ]
    XCTAssertEqual(weightedScore(rows), 67 as Int?)
    var credited = rows
    credited[1].fraction = creditedFraction(tier: .avoid, remedyDone: true)
    XCTAssertEqual(weightedScore(credited), 74 as Int?)
    XCTAssertEqual(scoreDelta(before: 67, after: 74), 7)
    XCTAssertEqual(scoreDelta(before: 74, after: 67), -7)
    XCTAssertNil(scoreDelta(before: 70, after: 70))
    XCTAssertEqual(scoreDelta(before: nil, after: 15), 15)
  }

  func testCoverageBoostsAndEmptyHome() {
    XCTAssertEqual(coverageLine(done: 3, total: 34, locale: .en), "Based on 3 of 34 checks")
    XCTAssertEqual(coverageLine(done: 0, total: 34, locale: .hi), "34 में से 0 जाँचों पर आधारित")
    let groups = [(key: "Entrance", name: L10n(en: "Entrance", hi: "प्रवेश"), total: 2)]
    let empty = homeScore(checks: [], groups: groups, titles: [:], catalogCount: 34)
    XCTAssertNil(empty.score)
    XCTAssertEqual(empty.done, 0)
    XCTAssertEqual(empty.total, 34)
    XCTAssertTrue(empty.boosts.isEmpty)

    let titles = [
      "main_door": L10n(en: "Main door", hi: "मुख्य द्वार"),
      "toilet": L10n(en: "Toilet", hi: "शौचालय"),
      "mirror": L10n(en: "Mirror", hi: "दर्पण"),
    ]
    let scored = homeScore(
      checks: [
        WeightedCheck(id: "main_door", groupKey: "Entrance", weight: 1.6, fraction: 1),
        WeightedCheck(id: "toilet", groupKey: "Water", weight: 1.3, fraction: 0.15),
        WeightedCheck(id: "mirror", groupKey: "Living", weight: 1, fraction: 0.5),
      ],
      groups: groups,
      titles: titles,
      catalogCount: 34
    )
    XCTAssertEqual(scored.boosts.map(\.id), ["toilet", "mirror"])
    XCTAssertLessThanOrEqual(scored.boosts.count, 3)
    XCTAssertGreaterThan(scored.boosts[0].points, scored.boosts[1].points)
  }
}

final class CatalogTests: XCTestCase {
  private func content() throws -> ContentBundle {
    let directory = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("Disha/Resources")
    return try ContentLoader.load(directory: directory)
  }

  func testCatalogMatchesTheWebQuiz() throws {
    let bundle = try content()
    XCTAssertEqual(bundle.catalog.checks.count, 34)
    XCTAssertEqual(checkGroups(bundle.catalog.checks).map(\.group.en), [
      "Entrance", "Kitchen", "Sleep", "Prayer", "Water", "Work", "Living", "Outside",
    ])
    let door = try XCTUnwrap(bundle.check("main_door"))
    XCTAssertEqual(door.granularity, 32)
    let north = verdictForHeading(check: door, heading: 0, locale: .en, strings: bundle.strings)
    XCTAssertEqual(north.slotId, "N5")
    XCTAssertEqual(north.slotName, "Soma")
    XCTAssertEqual(north.rating, "auspicious")
    XCTAssertEqual(north.placementLine, "North-facing")
    XCTAssertEqual(verdictForHeading(check: door, heading: 360, locale: .en, strings: bundle.strings).slotId, "N5")
    XCTAssertEqual(verdictForHeading(check: door, heading: 45, locale: .en, strings: bundle.strings).slotId, "E1")
    XCTAssertEqual(verdictForHeading(check: door, heading: 359, locale: .en, strings: bundle.strings).slotId, "N4")
    let hindi = verdictForHeading(check: door, heading: 0, locale: .hi, strings: bundle.strings)
    XCTAssertEqual(hindi.slotName, "सोम")
    XCTAssertEqual(hindi.placementLine, "उत्तरमुखी")
    XCTAssertEqual(bundle.strings.t("lock", .en), "Lock direction")
    XCTAssertEqual(bundle.strings.t("bandGood", .en), "Good")
    XCTAssertEqual(bundle.strings.t("bandGood", .hi), "अच्छा")
    XCTAssertFalse(bundle.remedies.isEmpty)
    XCTAssertFalse(bundle.rules.isEmpty)
    for rule in bundle.rules {
      for id in rule.remedies.best + rule.remedies.avoid {
        XCTAssertNotNil(bundle.remedy(id), id)
      }
    }
    XCTAssertEqual(bundle.ruleWeights["kitchen"], 1.4 as Double?)
    XCTAssertEqual(CheckWeight.weight(id: "kitchen", ruleWeights: bundle.ruleWeights), 1.4)
  }

  func testDeclinationFallbackForNewJersey() throws {
    let model = try content().wmm
    let jersey = magneticDeclination(latitude: 40.0583, longitude: -74.4057, decimalYear: 2025, model: model)
    XCTAssertEqual(jersey, -12.23, accuracy: 0.15)
    let delhi = magneticDeclination(latitude: 28.6139, longitude: 77.2090, decimalYear: 2025, model: model)
    XCTAssertEqual(delhi, 1.30, accuracy: 0.15)
    XCTAssertEqual(magneticToTrue(0, declinationEast: jersey), normalizeDegrees(jersey), accuracy: 0.001)
  }
}

final class StoreTests: XCTestCase {
  func testResultsRoundTrip() {
    let name = "disha.tests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: name)!
    defaults.removePersistentDomain(forName: name)
    var stored = PersistedQuiz.load(defaults: defaults)
    XCTAssertEqual(stored.results.count, 0)
    stored.results = upsertResult([], StoredResult(checkId: "kitchen", heading: 135, trueNorth: true, at: 10, remedyDone: false))
    stored.results = upsertResult(stored.results, StoredResult(checkId: "kitchen", heading: 90, trueNorth: false, at: 11, remedyDone: true))
    stored.locale = .hi
    stored.askedLocation = true
    stored.save(defaults: defaults)
    let loaded = PersistedQuiz.load(defaults: defaults)
    XCTAssertEqual(loaded.locale, .hi)
    XCTAssertEqual(loaded.askedLocation, true)
    XCTAssertEqual(loaded.results.count, 1)
    XCTAssertEqual(loaded.results[0].heading, 90)
    XCTAssertEqual(loaded.results[0].remedyDone, true)
    defaults.removePersistentDomain(forName: name)
  }
}
