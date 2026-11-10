import Foundation

/// Eight directions, 45° each, with North centered on 0°.
/// North owns [337.5°, 22.5°). The clockwise edge belongs to the next direction.
let dir8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

func directionFromHeading(_ heading: Double) -> String {
  let shifted = normalizeDegrees(heading + 22.5)
  let index = Int(floor(shifted / 45)) % dir8.count
  return dir8[index]
}

/// Sixteen zones of 22.5°, North centered on 0° ([348.75°, 11.25°)).
let zone16: [String] = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]

func zoneFromBearing(_ bearing: Double) -> String {
  let shifted = normalizeDegrees(bearing + 11.25)
  let index = Int(floor(shifted / 22.5)) % zone16.count
  return zone16[index]
}

/// Thirty-two entrance padas, each 11.25°, clockwise from the corners.
///
/// East [45°, 135°) E1→E8, South [135°, 225°), West [225°, 315°),
/// North [315°, 45°) N1 at the northwest corner. Intervals are half-open.
/// 0° and 360° are N5 (Soma). 45° is E1. 90° is E5, 180° is S5, 270° is W5.
let padaWidth = 11.25
private let padaSides = ["E", "S", "W", "N"]

func padaFromHeading(_ heading: Double) -> String {
  let shifted = normalizeDegrees(heading - 45)
  let index = Int(floor(shifted / padaWidth)) % 32
  let side = padaSides[index / 8]
  let n = (index % 8) + 1
  return "\(side)\(n)"
}

func padaSide(_ id: String) -> String? {
  guard id.count == 2, let side = id.first else { return nil }
  let letter = String(side)
  guard ["E", "S", "W", "N"].contains(letter) else { return nil }
  guard let number = Int(id.dropFirst()), (1...8).contains(number) else { return nil }
  return letter
}

enum Granularity: Int {
  case eight = 8
  case sixteen = 16
  case thirtyTwo = 32
}

func slotFromHeading(_ heading: Double, granularity: Int) -> String {
  switch granularity {
  case 8: return directionFromHeading(heading)
  case 16: return zoneFromBearing(heading)
  case 32: return padaFromHeading(heading)
  default: return directionFromHeading(heading)
  }
}

func expectedSlotIds(_ granularity: Int) -> [String] {
  switch granularity {
  case 8: return dir8
  case 16: return zone16
  default:
    var ids: [String] = []
    for side in ["N", "E", "S", "W"] {
      for n in 1...8 { ids.append("\(side)\(n)") }
    }
    return ids
  }
}
