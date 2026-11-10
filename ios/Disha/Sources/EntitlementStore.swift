import Foundation
import StoreKit

// TODO(iap-hold): Finish the Home Report only after the unlock is persisted, and
// replay Transaction.unfinished at launch. Unverified updates are skipped and
// not finished. The updates listener starts from RootView.task, not before UI.
// isPremium is re-derived from verified currentEntitlements; the report grant
// is a local cache and will not restore onto a fresh install.
/// StoreKit 2 entitlements.
///
/// Monthly and yearly are auto-renewing subscriptions in the group "Disha Premium".
/// Lifetime is a non-consumable. Home Report is a consumable: one purchase unlocks
/// the full checks, remedies, score, and PDF for the home id stored with the
/// transaction (`appAccountToken`). Consumables leave `currentEntitlements` once
/// finished, so the grant is kept on this iPhone. Restore Purchases brings back
/// the subscription and the lifetime unlock, not a finished Home Report.
@MainActor
final class EntitlementStore: ObservableObject {
  @Published private(set) var products: [Product] = []
  @Published private(set) var isPremium = false
  @Published private(set) var reportHomeIDs: Set<String> = []
  @Published private(set) var isLoading = false
  @Published var purchasingID: String?
  @Published var lastError: String?

  private let defaults: UserDefaults
  private var updates: Task<Void, Never>?

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    if let data = defaults.data(forKey: StoreKey.reportHomes),
       let ids = try? JSONDecoder().decode([String].self, from: data) {
      reportHomeIDs = Set(ids)
    }
  }

  func start() {
    guard updates == nil else { return }
    updates = Task { [weak self] in
      await self?.observeTransactions()
    }
    Task { await refresh() }
  }

  func product(_ id: String) -> Product? {
    products.first { $0.id == id }
  }

  func ownsReport(_ homeID: String) -> Bool {
    reportHomeIDs.contains(homeID)
  }

  func refresh() async {
    isLoading = true
    defer { isLoading = false }
    do {
      let ids = [StoreConfig.monthly, StoreConfig.yearly, StoreConfig.lifetime, StoreConfig.homeReport]
      products = try await Product.products(for: ids)
      lastError = nil
    } catch {
      lastError = error.localizedDescription
    }
    await refreshEntitlements()
  }

  func purchase(_ product: Product, homeID: String) async -> Bool {
    purchasingID = product.id
    defer { purchasingID = nil }
    do {
      var options: Set<Product.PurchaseOption> = []
      if StoreConfig.isHomeReport(product.id), let token = UUID(uuidString: homeID) {
        options.insert(.appAccountToken(token))
      }
      let result = try await product.purchase(options: options)
      switch result {
      case .success(let verification):
        let transaction = try verified(verification)
        await apply(transaction, fallbackHome: homeID)
        await transaction.finish()
        return true
      case .userCancelled, .pending:
        return false
      @unknown default:
        return false
      }
    } catch {
      lastError = error.localizedDescription
      return false
    }
  }

  func restore() async {
    do {
      try await AppStore.sync()
      await refreshEntitlements()
      lastError = nil
    } catch {
      lastError = error.localizedDescription
    }
  }

  private func observeTransactions() async {
    for await update in Transaction.updates {
      guard let transaction = try? verified(update) else { continue }
      await apply(transaction, fallbackHome: nil)
      await transaction.finish()
    }
  }

  private func refreshEntitlements() async {
    var premium = false
    for await result in Transaction.currentEntitlements {
      guard let transaction = try? verified(result) else { continue }
      if isActivePremium(transaction) { premium = true }
      if StoreConfig.isHomeReport(transaction.productID), let token = transaction.appAccountToken {
        rememberReport(token.uuidString)
      }
    }
    isPremium = premium
  }

  private func apply(_ transaction: Transaction, fallbackHome: String?) async {
    if StoreConfig.isHomeReport(transaction.productID) {
      let home = transaction.appAccountToken?.uuidString ?? fallbackHome
      if let home { rememberReport(home) }
    }
    if StoreConfig.grantsPremium(transaction.productID) {
      await refreshEntitlements()
    }
  }

  private func isActivePremium(_ transaction: Transaction) -> Bool {
    guard StoreConfig.grantsPremium(transaction.productID) else { return false }
    if transaction.revocationDate != nil { return false }
    if let expiration = transaction.expirationDate, expiration < Date() { return false }
    return true
  }

  private func rememberReport(_ homeID: String) {
    let next = mergeReportGrant(reportHomeIDs, homeID: homeID)
    guard next != reportHomeIDs else { return }
    reportHomeIDs = next
    if let data = try? JSONEncoder().encode(Array(next).sorted()) {
      defaults.set(data, forKey: StoreKey.reportHomes)
    }
  }

  private func verified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .unverified:
      throw StoreError.unverified
    case .verified(let value):
      return value
    }
  }
}

enum StoreError: Error {
  case unverified
}
