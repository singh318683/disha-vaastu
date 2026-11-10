import Foundation

/// World Magnetic Model 2025 coefficients (NOAA / NGA, public domain).
/// Used only when Core Location cannot supply `trueHeading`.
struct WMMCoefficients: Decodable, Equatable {
  var name: String
  var epoch: Double
  var nMax: Int
  var g: [Double]
  var h: [Double]
  var dg: [Double]
  var dh: [Double]

  enum CodingKeys: String, CodingKey {
    case name
    case epoch
    case nMax = "n_max"
    case g = "main_field_coeff_g"
    case h = "main_field_coeff_h"
    case dg = "secular_var_coeff_g"
    case dh = "secular_var_coeff_h"
  }
}

/// Declination in degrees, east positive. `decimalYear` is like 2025.0.
/// This is the approximate fallback, not a substitute for `CLHeading.trueHeading`.
func magneticDeclination(
  latitude: Double,
  longitude: Double,
  decimalYear: Double,
  model: WMMCoefficients
) -> Double {
  let nMax = model.nMax
  let dyear = decimalYear - model.epoch
  var gg = [Double](repeating: 0, count: model.g.count)
  var hh = [Double](repeating: 0, count: model.h.count)
  for n in 1...nMax {
    for m in 0...n {
      let i = n * (n + 1) / 2 + m
      gg[i] = model.g[i] + dyear * model.dg[i]
      hh[i] = model.h[i] + dyear * model.dh[i]
    }
  }

  let a = 6378.137
  let b = 6356.7523142
  let re = 6371.2
  let epssq = 1 - (b * b) / (a * a)
  let sinLat = sin(latitude * .pi / 180)
  let cosLat = cos(latitude * .pi / 180)
  let rc = a / sqrt(1 - epssq * sinLat * sinLat)
  let xp = rc * cosLat
  let zp = rc * (1 - epssq) * sinLat
  let radius = hypot(xp, zp)
  let phig = asin(zp / radius) * 180 / .pi
  let sinPhi = sin(phig * .pi / 180)

  let terms = (nMax + 1) * (nMax + 2) / 2
  var pcup = [Double](repeating: 0, count: terms)
  var dpcup = [Double](repeating: 0, count: terms)
  pcup[0] = 1
  let z = sqrt((1 - sinPhi) * (1 + sinPhi))

  for n in 1...nMax {
    for m in 0...n {
      let i = n * (n + 1) / 2 + m
      if n == m {
        let i1 = (n - 1) * n / 2 + m - 1
        pcup[i] = z * pcup[i1]
        dpcup[i] = z * dpcup[i1] + sinPhi * pcup[i1]
      } else if n == 1 && m == 0 {
        let i1 = (n - 1) * n / 2 + m
        pcup[i] = sinPhi * pcup[i1]
        dpcup[i] = sinPhi * dpcup[i1] - z * pcup[i1]
      } else if n > 1 && n != m {
        let i1 = (n - 2) * (n - 1) / 2 + m
        let i2 = (n - 1) * n / 2 + m
        if m > n - 2 {
          pcup[i] = sinPhi * pcup[i2]
          dpcup[i] = sinPhi * dpcup[i2] - z * pcup[i2]
        } else {
          let k = Double((n - 1) * (n - 1) - m * m) / Double((2 * n - 1) * (2 * n - 3))
          pcup[i] = sinPhi * pcup[i2] - k * pcup[i1]
          dpcup[i] = sinPhi * dpcup[i2] - z * pcup[i2] - k * dpcup[i1]
        }
      }
    }
  }

  var schmidt = [Double](repeating: 0, count: terms)
  schmidt[0] = 1
  for n in 1...nMax {
    let i = n * (n + 1) / 2
    let i1 = (n - 1) * n / 2
    schmidt[i] = schmidt[i1] * Double(2 * n - 1) / Double(n)
    for m in 1...n {
      let im = n * (n + 1) / 2 + m
      let prev = n * (n + 1) / 2 + m - 1
      let factor = Double((n - m + 1) * (m == 1 ? 2 : 1)) / Double(n + m)
      schmidt[im] = schmidt[prev] * sqrt(factor)
    }
  }
  for n in 1...nMax {
    for m in 0...n {
      let i = n * (n + 1) / 2 + m
      pcup[i] *= schmidt[i]
      dpcup[i] *= -schmidt[i]
    }
  }

  let cosLambda = cos(longitude * .pi / 180)
  let sinLambda = sin(longitude * .pi / 180)
  var cosM = [Double](repeating: 0, count: nMax + 1)
  var sinM = [Double](repeating: 0, count: nMax + 1)
  cosM[0] = 1
  sinM[0] = 0
  if nMax >= 1 {
    cosM[1] = cosLambda
    sinM[1] = sinLambda
  }
  if nMax >= 2 {
    for m in 2...nMax {
      cosM[m] = cosM[m - 1] * cosLambda - sinM[m - 1] * sinLambda
      sinM[m] = cosM[m - 1] * sinLambda + sinM[m - 1] * cosLambda
    }
  }

  var radiusPower = [Double](repeating: 0, count: nMax + 1)
  radiusPower[0] = (re / radius) * (re / radius)
  if nMax >= 1 {
    for n in 1...nMax {
      radiusPower[n] = radiusPower[n - 1] * (re / radius)
    }
  }

  var bx = 0.0
  var by = 0.0
  var bz = 0.0
  for n in 1...nMax {
    for m in 0...n {
      let i = n * (n + 1) / 2 + m
      let bracket = gg[i] * cosM[m] + hh[i] * sinM[m]
      bz -= radiusPower[n] * bracket * Double(n + 1) * pcup[i]
      by += radiusPower[n] * (gg[i] * sinM[m] - hh[i] * cosM[m]) * Double(m) * pcup[i]
      bx -= radiusPower[n] * bracket * dpcup[i]
    }
  }
  let cosPhi = cos(phig * .pi / 180)
  if abs(cosPhi) > 1e-10 {
    by /= cosPhi
  } else {
    by = 0
    var norm1 = 1.0
    var pcupS = [1.0]
    let sinGeocentric = sin(phig * .pi / 180)
    for n in 1...nMax {
      let i = n * (n + 1) / 2 + 1
      let norm2 = norm1 * Double(2 * n - 1) / Double(n)
      let norm3 = norm2 * sqrt(Double(2 * n) / Double(n + 1))
      norm1 = norm2
      if n == 1 {
        pcupS.append(pcupS[n - 1])
      } else {
        let k = Double((n - 1) * (n - 1) - 1) / Double((2 * n - 1) * (2 * n - 3))
        pcupS.append(sinGeocentric * pcupS[n - 1] - k * pcupS[n - 2])
      }
      by += radiusPower[n] * (gg[i] * sinM[1] - hh[i] * cosM[1]) * pcupS[n] * norm3
    }
  }
  let psi = (phig - latitude) * .pi / 180
  let north = bx * cos(psi) - bz * sin(psi)
  return atan2(by, north) * 180 / .pi
}

func decimalYear(for date: Date, calendar input: Calendar? = nil) -> Double {
  var calendar = input ?? Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? calendar.timeZone
  let year = calendar.component(.year, from: date)
  let start = calendar.date(from: DateComponents(year: year, month: 1, day: 1, hour: 0)) ?? date
  let next = calendar.date(from: DateComponents(year: year + 1, month: 1, day: 1, hour: 0)) ?? date
  let span = next.timeIntervalSince(start)
  let fraction = span > 0 ? date.timeIntervalSince(start) / span : 0
  return Double(year) + fraction
}
