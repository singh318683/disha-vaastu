import Combine
import CoreLocation
import UIKit

final class CompassModel: NSObject, ObservableObject, CLLocationManagerDelegate {
  @Published var displayHeading: Double = 0
  @Published var hasHeading = false
  @Published var live = false
  @Published var trueNorth = false
  @Published var approximate = false
  @Published var accuracy: Double?
  @Published var magnetic: Double?
  @Published var declination: Double?
  @Published var authorization: CLAuthorizationStatus = .notDetermined
  @Published var manual = false

  var wmm: WMMCoefficients?
  var cachedLatitude: Double?
  var cachedLongitude: Double?
  var cachedDeclination: Double?
  var onLocation: ((Double, Double, Double) -> Void)?

  private let manager = CLLocationManager()
  private var smooth: CircularSmooth?
  private var lastSmoothTime: TimeInterval?
  private var samples: [HeadingSample] = []
  private var lastLive: Double?
  private var started = false
  private var didRequestSystem = false

  override init() {
    super.init()
    manager.delegate = self
    manager.headingFilter = 1
    manager.headingOrientation = .portrait
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
    manager.distanceFilter = 500
    authorization = manager.authorizationStatus
  }

  var isAuthorized: Bool {
    authorization == .authorizedWhenInUse || authorization == .authorizedAlways
  }

  var isDenied: Bool {
    authorization == .denied || authorization == .restricted
  }

  func start() {
    if !started {
      started = true
      manager.startUpdatingHeading()
    }
    authorization = manager.authorizationStatus
    if isAuthorized {
      manager.startUpdatingLocation()
    }
  }

  func stop() {
    manager.stopUpdatingHeading()
    manager.stopUpdatingLocation()
    started = false
  }

  /// The system prompt is shown at most once. A later denial is handled in Settings.
  func requestWhenInUseOnce() {
    guard !didRequestSystem else { return }
    didRequestSystem = true
    let status = manager.authorizationStatus
    authorization = status
    if status == .notDetermined {
      manager.requestWhenInUseAuthorization()
    } else if status == .authorizedWhenInUse || status == .authorizedAlways {
      manager.startUpdatingLocation()
    }
  }

  func followLive() {
    manual = false
    samples = []
    smooth = nil
    lastSmoothTime = nil
    if let lastLive {
      displayHeading = lastLive
      hasHeading = true
    }
  }

  func setManual(_ heading: Double) {
    manual = true
    let value = normalizeDegrees(heading)
    displayHeading = value
    hasHeading = true
    trueNorth = false
    approximate = false
    let now = Date().timeIntervalSinceReferenceDate
    samples = [HeadingSample(time: now, heading: value)]
  }

  func lockedReading(now: TimeInterval = Date().timeIntervalSinceReferenceDate) -> (heading: Double, trueNorth: Bool) {
    let mean = averageRecentHeading(samples: samples, now: now) ?? displayHeading
    return (normalizeDegrees(mean), trueNorth && !manual)
  }

  func tick() {
    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    DispatchQueue.main.async {
      self.authorization = status
      if self.started, status == .authorizedWhenInUse || status == .authorizedAlways {
        manager.startUpdatingLocation()
      }
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last, let wmm else { return }
    let latitude = location.coordinate.latitude
    let longitude = location.coordinate.longitude
    let declination = magneticDeclination(
      latitude: latitude,
      longitude: longitude,
      decimalYear: decimalYear(for: Date()),
      model: wmm
    )
    DispatchQueue.main.async {
      self.cachedLatitude = latitude
      self.cachedLongitude = longitude
      self.cachedDeclination = declination
      self.onLocation?(latitude, longitude, declination)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
    let trueHeading = newHeading.trueHeading
    let magneticHeading = newHeading.magneticHeading
    let accuracy = newHeading.headingAccuracy
    let now = Date().timeIntervalSinceReferenceDate
    DispatchQueue.main.async {
      let authorized = self.authorization == .authorizedWhenInUse || self.authorization == .authorizedAlways
      let resolved = resolvedHeading(
        trueHeading: trueHeading,
        magneticHeading: magneticHeading,
        locationAuthorized: authorized,
        declinationEast: self.cachedDeclination
      )
      self.accuracy = accuracy
      self.magnetic = magneticHeading >= 0 ? normalizeDegrees(magneticHeading) : nil
      guard let resolved else { return }
      self.lastLive = resolved.degrees
      self.live = true
      guard !self.manual else { return }
      let dt = self.lastSmoothTime.map { (now - $0) * 1000 } ?? 0
      let smoothed = smoothHeading(state: self.smooth, heading: resolved.degrees, dtMs: dt)
      self.smooth = smoothed.state
      self.lastSmoothTime = now
      self.displayHeading = smoothed.heading
      self.hasHeading = true
      self.trueNorth = resolved.trueNorth
      self.approximate = resolved.approximate
      self.declination = resolved.declination
      self.samples.append(HeadingSample(time: now, heading: resolved.degrees))
      self.samples.removeAll { now - $0.time >= 2 }
    }
  }
}
