import Foundation

struct CircularSmooth: Equatable {
  var x: Double
  var y: Double
}

/// Low-pass on the unit circle. A step from 359° to 1° stays near north.
func smoothHeading(
  state: CircularSmooth?,
  heading: Double,
  dtMs: Double,
  tauMs: Double = 140
) -> (state: CircularSmooth, heading: Double) {
  let norm = normalizeDegrees(heading)
  let rad = norm * .pi / 180
  let x = cos(rad)
  let y = sin(rad)
  guard let state, dtMs > 0 else {
    return (CircularSmooth(x: x, y: y), norm)
  }
  let gain = 1 - exp(-dtMs / tauMs)
  let nextX = state.x + (x - state.x) * gain
  let nextY = state.y + (y - state.y) * gain
  let magnitude = hypot(nextX, nextY)
  if magnitude < 1e-6 {
    return (CircularSmooth(x: x, y: y), norm)
  }
  return (
    CircularSmooth(x: nextX / magnitude, y: nextY / magnitude),
    normalizeDegrees(atan2(nextY, nextX) * 180 / .pi)
  )
}

/// Mean on the circle. Samples around 0° average to north, not to south.
func circularMean(_ samples: [Double]) -> Double? {
  if samples.isEmpty { return nil }
  var x = 0.0
  var y = 0.0
  for sample in samples {
    let rad = sample * .pi / 180
    x += cos(rad)
    y += sin(rad)
  }
  if x * x + y * y < 1e-8 { return nil }
  return normalizeDegrees(atan2(y, x) * 180 / .pi)
}

struct HeadingSample: Equatable {
  var time: TimeInterval
  var heading: Double
}

/// Average of samples in the last `window` seconds. Empty windows return nil.
func averageRecentHeading(
  samples: [HeadingSample],
  now: TimeInterval,
  window: TimeInterval = 1
) -> Double? {
  let recent = samples.filter { now - $0.time <= window && now - $0.time >= 0 }
  return circularMean(recent.map(\.heading))
}

struct ResolvedHeading: Equatable {
  var degrees: Double
  /// True only when Core Location supplied `trueHeading`.
  var trueNorth: Bool
  /// Signed degrees, east positive. Nil when the fix is already true north.
  var declination: Double?
  /// The model stood in for a missing true heading.
  var approximate: Bool
}

/// Prefer `trueHeading` once location is authorized. Otherwise magnetic heading
/// plus declination when a model or a cached correction is available.
func resolvedHeading(
  trueHeading: Double,
  magneticHeading: Double,
  locationAuthorized: Bool,
  declinationEast: Double?
) -> ResolvedHeading? {
  if locationAuthorized, trueHeading >= 0, trueHeading <= 360 {
    return ResolvedHeading(
      degrees: normalizeDegrees(trueHeading),
      trueNorth: true,
      declination: nil,
      approximate: false
    )
  }
  guard magneticHeading >= 0, magneticHeading <= 360 else { return nil }
  let magnetic = normalizeDegrees(magneticHeading)
  if let declinationEast, declinationEast.isFinite {
    return ResolvedHeading(
      degrees: magneticToTrue(magnetic, declinationEast: declinationEast),
      trueNorth: false,
      declination: declinationEast,
      approximate: abs(declinationEast) > 0.05
    )
  }
  return ResolvedHeading(degrees: magnetic, trueNorth: false, declination: 0, approximate: false)
}

/// `headingAccuracy` is degrees. Negative means the fix is invalid.
func headingNeedsCalibration(_ accuracy: Double?) -> Bool {
  guard let accuracy else { return false }
  return accuracy < 0 || accuracy > 25
}
