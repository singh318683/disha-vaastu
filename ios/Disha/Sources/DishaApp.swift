import SwiftUI
import UIKit

enum AppRoute: Equatable {
  case welcome
  case home
  case instruct(String)
  case compass(String)
  case verdict(String)
  case summary
}

struct ScoreToast: Equatable, Identifiable {
  var id = UUID()
  var delta: Int
}

final class AppModel: ObservableObject {
  @Published var route: AppRoute = .welcome
  @Published var locale: AppLocale
  @Published var results: [StoredResult]
  @Published var showLocationPrompt = false
  @Published var toast: ScoreToast?
  @Published var loadError: String?
  let compass = CompassModel()
  let content: ContentBundle?
  private let defaults: UserDefaults
  private var askedLocation: Bool

  init(defaults: UserDefaults = .standard, bundle: Bundle = .main) {
    self.defaults = defaults
    let stored = PersistedQuiz.load(defaults: defaults)
    locale = stored.locale
    results = stored.results
    askedLocation = stored.askedLocation
    var loaded: ContentBundle?
    do {
      loaded = try ContentLoader.load(bundle: bundle)
    } catch {
      loadError = error.localizedDescription
    }
    content = loaded
    compass.wmm = loaded?.wmm
    compass.cachedLatitude = stored.latitude
    compass.cachedLongitude = stored.longitude
    compass.cachedDeclination = stored.declination
    compass.onLocation = { [weak self] latitude, longitude, declination in
      self?.defaults.set(latitude, forKey: StoreKey.latitude)
      self?.defaults.set(longitude, forKey: StoreKey.longitude)
      self?.defaults.set(declination, forKey: StoreKey.declination)
    }
  }

  var score: HomeScoreResult? {
    guard let content else { return nil }
    return scoreResults(results, content: content)
  }

  func setLocale(_ next: AppLocale) {
    locale = next
    defaults.set(next.rawValue, forKey: StoreKey.locale)
  }

  func start() {
    route = .home
    if !askedLocation {
      showLocationPrompt = true
    }
  }

  func allowLocation() {
    markAsked()
    showLocationPrompt = false
    compass.requestWhenInUseOnce()
  }

  func skipLocation() {
    markAsked()
    showLocationPrompt = false
  }

  func locationPromptDismissed() {
    if !askedLocation {
      markAsked()
    }
  }

  func openCheck(_ id: String) {
    route = .instruct(id)
  }

  func lock(checkId: String) {
    let before = score?.score
    let reading = compass.lockedReading()
    compass.tick()
    let kept = results.first { $0.checkId == checkId }?.remedyDone ?? false
    let next = StoredResult(
      checkId: checkId,
      heading: reading.heading,
      trueNorth: reading.trueNorth,
      at: Date().timeIntervalSince1970,
      remedyDone: kept
    )
    results = upsertResult(results, next)
    persist()
    if let delta = scoreDelta(before: before, after: score?.score) {
      toast = ScoreToast(delta: delta)
    }
    route = .verdict(checkId)
  }

  func setRemedy(checkId: String, done: Bool) {
    guard let index = results.firstIndex(where: { $0.checkId == checkId }) else { return }
    let before = score?.score
    results[index].remedyDone = done
    persist()
    if let delta = scoreDelta(before: before, after: score?.score) {
      toast = ScoreToast(delta: delta)
    }
  }

  func clearResults() {
    results = []
    toast = nil
    persist()
  }

  func openSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
  }

  private func markAsked() {
    askedLocation = true
    defaults.set(true, forKey: StoreKey.askedLocation)
  }

  private func persist() {
    let stored = PersistedQuiz(
      locale: locale,
      results: results,
      askedLocation: askedLocation,
      latitude: compass.cachedLatitude,
      longitude: compass.cachedLongitude,
      declination: compass.cachedDeclination
    )
    stored.save(defaults: defaults)
  }
}

@main
struct DishaApp: App {
  @StateObject private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(model)
        .environmentObject(model.compass)
        .preferredColorScheme(.dark)
        .tint(Royal.gold)
    }
  }
}

struct RootView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    ZStack {
      RoyalField()
      switch model.route {
      case .welcome:
        WelcomeView()
      case .home:
        HomeView()
      case .instruct(let id):
        InstructView(checkId: id)
      case .compass(let id):
        CompassScreen(checkId: id)
      case .verdict(let id):
        VerdictView(checkId: id)
      case .summary:
        SummaryView()
      }
      if let toast = model.toast {
        VStack {
          Spacer()
          ToastBanner(delta: toast.delta)
            .padding(.bottom, 28)
        }
        .allowsHitTesting(false)
        .transition(.opacity)
        .task(id: toast.id) {
          try? await Task.sleep(nanoseconds: 2_200_000_000)
          if model.toast?.id == toast.id {
            model.toast = nil
          }
        }
      }
    }
    .animation(.easeOut(duration: 0.2), value: model.toast?.id)
    .sheet(isPresented: $model.showLocationPrompt, onDismiss: {
      model.locationPromptDismissed()
    }) {
      LocationPrompt()
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
  }
}

struct LocationPrompt: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Wordmark()
      Text(model.content?.t("locationTitle", model.locale) ?? "True north")
        .font(displayFont(size: 34, locale: model.locale))
        .foregroundStyle(Royal.cream)
      Text(model.content?.t("locationBody", model.locale) ?? "")
        .font(bodyFont(size: 17, locale: model.locale))
        .foregroundStyle(Royal.muted)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 8)
      GoldButton(title: model.content?.t("locationAllow", model.locale) ?? "Use true north", locale: model.locale) {
        model.allowLocation()
      }
      Button(model.content?.t("locationSkip", model.locale) ?? "Not now") {
        model.skipLocation()
      }
      .font(bodyFont(size: 16, locale: model.locale))
      .foregroundStyle(Royal.muted)
      .frame(maxWidth: .infinity)
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Royal.navy)
  }
}
