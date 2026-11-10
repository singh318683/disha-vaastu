import SwiftUI

struct HomeView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    Group {
      if let content = model.content {
        HomePager(content: content)
      } else {
        Text(model.loadError ?? "Could not load the checks.")
          .foregroundStyle(Royal.cream)
          .padding()
      }
    }
    .onAppear { model.compass.stop() }
    .accessibilityIdentifier("home")
  }
}

private struct HomePager: View {
  @EnvironmentObject private var model: AppModel
  var content: ContentBundle
  @State private var page: String?

  private var groups: [CheckGroup] {
    checkGroups(content.catalog.checks)
  }

  var body: some View {
    let locale = model.locale
    let saved = savedById(model.results)
    VStack(spacing: 8) {
      HStack {
        Wordmark()
        Spacer()
        LanguageToggle()
      }
      HStack(alignment: .center, spacing: 10) {
        Text(content.t("whatCheck", locale))
          .font(displayFont(size: 28, locale: locale))
          .foregroundStyle(Royal.cream)
          .lineLimit(1)
          .minimumScaleFactor(0.65)
          .frame(maxWidth: .infinity, alignment: .leading)
        Button {
          model.route = .summary
        } label: {
          ScoreRing(score: model.score?.score, diameter: 54, locale: locale)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("home-score")
      }
      Text(content.t("standPoint", locale))
        .font(bodyFont(size: 13, locale: locale))
        .foregroundStyle(Royal.muted)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity, alignment: .leading)

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 6) {
          ForEach(groups) { group in
            let selected = (page ?? groups.first?.id) == group.id
            Button {
              withAnimation(.easeOut(duration: 0.2)) { page = group.id }
            } label: {
              Text(group.group.text(locale))
                .font(bodyFont(size: 13, locale: locale, bold: selected))
                .foregroundStyle(selected ? Royal.ink : Royal.cream)
                .lineLimit(1)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(selected ? Royal.gold : Royal.card))
            }
            .buttonStyle(.plain)
          }
        }
      }

      GeometryReader { geo in
        ScrollView(.horizontal) {
          LazyHStack(spacing: 0) {
            ForEach(groups) { group in
              CategoryPage(group: group, saved: saved, content: content)
                .frame(width: geo.size.width, height: geo.size.height)
                .id(group.id)
            }
          }
          .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $page)
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize, axes: .vertical)
      }

      HStack(spacing: 6) {
        ForEach(groups) { group in
          let selected = (page ?? groups.first?.id) == group.id
          Capsule()
            .fill(selected ? Royal.gold : Royal.gold.opacity(0.28))
            .frame(width: selected ? 16 : 6, height: 6)
        }
      }
      .accessibilityIdentifier("page-dots")
    }
    .padding(.horizontal, 16)
    .padding(.top, 8)
    .padding(.bottom, 8)
    .onAppear {
      if page == nil { page = groups.first?.id }
    }
  }
}

private func savedById(_ results: [StoredResult]) -> [String: StoredResult] {
  var map: [String: StoredResult] = [:]
  for result in results {
    map[result.checkId] = result
  }
  return map
}

private struct CategoryPage: View {
  @EnvironmentObject private var model: AppModel
  var group: CheckGroup
  var saved: [String: StoredResult]
  var content: ContentBundle

  var body: some View {
    FittingTiles(checks: group.checks, saved: saved, content: content)
      .padding(.horizontal, 2)
  }
}

private struct FittingTiles: View {
  @EnvironmentObject private var model: AppModel
  var checks: [VaastuCheck]
  var saved: [String: StoredResult]
  var content: ContentBundle

  var body: some View {
    GeometryReader { geo in
      let columns = 2
      let rows = max(1, Int(ceil(Double(checks.count) / Double(columns))))
      let gap: CGFloat = 8
      let raw = (geo.size.height - gap * CGFloat(max(0, rows - 1))) / CGFloat(rows)
      let tileHeight = min(max(raw, 1), 156)
      let stackHeight = tileHeight * CGFloat(rows) + gap * CGFloat(max(0, rows - 1))
      VStack(spacing: gap) {
        ForEach(0..<rows, id: \.self) { row in
          HStack(spacing: gap) {
            ForEach(0..<columns, id: \.self) { column in
              let index = row * columns + column
              if index < checks.count {
                CheckTile(check: checks[index], saved: saved[checks[index].id], content: content)
                  .frame(height: tileHeight)
              } else {
                Color.clear.frame(height: tileHeight)
              }
            }
          }
        }
        if stackHeight < geo.size.height {
          Spacer(minLength: 0)
        }
      }
    }
  }
}

private struct CheckTile: View {
  @EnvironmentObject private var model: AppModel
  var check: VaastuCheck
  var saved: StoredResult?
  var content: ContentBundle

  var body: some View {
    let locale = model.locale
    let verdict = saved.map {
      verdictForHeading(check: check, heading: $0.heading, locale: locale, strings: content.strings)
    }
    Button {
      model.openCheck(check.id)
    } label: {
      VStack(alignment: .leading, spacing: 4) {
        HStack(alignment: .top) {
          Image(systemName: symbolName(for: check.icon))
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(verdict.map { ratingColor($0.rating) } ?? Royal.gold)
            .frame(width: 32, height: 32)
            .background(
              RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Royal.navy)
            )
          Spacer(minLength: 4)
          if saved != nil {
            Image(systemName: "checkmark")
              .font(.system(size: 10, weight: .bold))
              .foregroundStyle(Royal.ink)
              .frame(width: 16, height: 16)
              .background(Circle().fill(Royal.gold))
              .accessibilityLabel(content.t("done", locale))
          }
        }
        Text(check.title.text(locale))
          .font(displayFont(size: 16, locale: locale))
          .foregroundStyle(Royal.cream)
          .lineLimit(2)
          .minimumScaleFactor(0.65)
          .multilineTextAlignment(.leading)
        Text(check.blurb.text(locale))
          .font(bodyFont(size: 11, locale: locale))
          .foregroundStyle(Royal.muted)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
          .multilineTextAlignment(.leading)
        Spacer(minLength: 0)
      }
      .padding(10)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Royal.card)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(Royal.cardEdge, lineWidth: 1)
      )
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("tile-\(check.id)")
  }
}
