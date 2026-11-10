import UIKit

enum ReportExport {
  static func cardImage(content: ContentBundle, results: [StoredResult], locale: AppLocale, score: HomeScoreResult, preview: Bool) -> UIImage {
    let size = CGSize(width: 1080, height: 1440)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    return renderer.image { ctx in
      let canvas = ctx.cgContext
      UIColor(red: 0.047, green: 0.078, blue: 0.188, alpha: 1).setFill()
      canvas.fill(CGRect(origin: .zero, size: size))
      let gold = UIColor(red: 0.831, green: 0.694, blue: 0.353, alpha: 1)
      gold.setStroke()
      canvas.setLineWidth(3)
      canvas.stroke(CGRect(x: 48, y: 48, width: size.width - 96, height: size.height - 96))

      var y: CGFloat = 110
      y = draw("DISHA", font: uiFont(Face.displayBold, 28), color: gold, x: 90, y: y, width: 900, align: .center)
      y += 24
      let title = content.t("homeScore", locale)
      y = draw(title, font: uiFont(locale == .hi ? Face.hindiBold : Face.display, 64), color: .white, x: 90, y: y, width: 900, align: .center)
      y += 16
      let number = score.score.map(String.init) ?? "—"
      y = draw(number, font: uiFont(Face.display, 140), color: gold, x: 90, y: y, width: 900, align: .center)
      y += 8
      if let band = score.band {
        y = draw(band.title(content.strings, locale), font: uiFont(locale == .hi ? Face.hindi : Face.displayBold, 40), color: .white, x: 90, y: y, width: 900, align: .center)
      }
      y += 12
      y = draw(coverageLine(done: score.done, total: score.total, locale: locale), font: uiFont(locale == .hi ? Face.hindi : Face.display, 28), color: UIColor(white: 0.8, alpha: 1), x: 90, y: y, width: 900, align: .center)
      y += 36
      let counts = ratingCounts(results: results, content: content)
      let labels = [
        content.t("auspicious", locale),
        content.t("neutral", locale),
        content.t("inauspicious", locale),
      ]
      let values = [counts.auspicious, counts.neutral, counts.inauspicious]
      let column = (size.width - 180) / 3
      for index in 0..<3 {
        let origin = 90 + column * CGFloat(index)
        _ = draw("\(values[index])", font: uiFont(Face.display, 54), color: gold, x: origin, y: y, width: column, align: .center)
        _ = draw(labels[index], font: uiFont(locale == .hi ? Face.hindi : Face.display, 22), color: UIColor(white: 0.75, alpha: 1), x: origin, y: y + 62, width: column, align: .center)
      }
      y += 130
      for row in results.prefix(8) {
        guard let check = content.check(row.checkId) else { continue }
        let verdict = verdictForHeading(check: check, heading: row.heading, locale: locale, strings: content.strings)
        let line = "\(check.title.text(locale))  ·  \(verdict.placementLine)"
        y = draw(line, font: uiFont(locale == .hi ? Face.hindi : Face.display, 28), color: .white, x: 100, y: y, width: 880, align: .left)
        y += 10
        if y > size.height - 160 { break }
      }
      let mark = preview ? "Disha  ·  \(content.t("scorePreview", locale))" : "Disha"
      _ = draw(mark, font: uiFont(Face.displayBold, 22), color: gold, x: 90, y: size.height - 168, width: 900, align: .center)
      _ = draw(content.catalog.framing.text(locale), font: uiFont(locale == .hi ? Face.hindi : Face.display, 22), color: UIColor(white: 0.65, alpha: 1), x: 90, y: size.height - 120, width: 900, align: .center)
    }
  }

  static func pdf(content: ContentBundle, results: [StoredResult], score: HomeScoreResult) -> Data {
    let page = CGRect(x: 0, y: 0, width: 595, height: 842)
    let renderer = UIGraphicsPDFRenderer(bounds: page)
    return renderer.pdfData { context in
      var y: CGFloat = 0
      func newPage() {
        context.beginPage()
        UIColor(red: 0.047, green: 0.078, blue: 0.188, alpha: 1).setFill()
        context.cgContext.fill(page)
        y = 48
      }
      newPage()
      let gold = UIColor(red: 0.831, green: 0.694, blue: 0.353, alpha: 1)
      y = draw("Disha  ·  दिशा", font: uiFont(Face.displayBold, 22), color: gold, x: 40, y: y, width: 515, align: .left)
      y += 8
      let number = score.score.map { "\($0) / 100" } ?? "— / 100"
      y = draw(number, font: uiFont(Face.display, 48), color: gold, x: 40, y: y, width: 515, align: .left)
      if let band = score.band {
        let both = "\(band.title(content.strings, .en))  ·  \(band.title(content.strings, .hi))"
        y = draw(both, font: uiFont(Face.hindi, 18), color: .white, x: 40, y: y, width: 515, align: .left)
      }
      y += 4
      y = draw(coverageLine(done: score.done, total: score.total, locale: .en), font: uiFont(Face.display, 13), color: UIColor(white: 0.8, alpha: 1), x: 40, y: y, width: 515, align: .left)
      y = draw(coverageLine(done: score.done, total: score.total, locale: .hi), font: uiFont(Face.hindi, 13), color: UIColor(white: 0.8, alpha: 1), x: 40, y: y, width: 515, align: .left)
      y += 12
      y = draw(content.t("byArea", .en) + "  ·  " + content.t("byArea", .hi), font: uiFont(Face.hindiBold, 16), color: gold, x: 40, y: y, width: 515, align: .left)
      for category in score.categories {
        let value = category.score.map(String.init) ?? "—"
        let line = "\(category.group.en) / \(category.group.hi)    \(value)    \(category.done)/\(category.total)"
        y = ensure(y, room: 28, newPage: newPage)
        y = draw(line, font: uiFont(Face.hindi, 12), color: .white, x: 40, y: y, width: 515, align: .left)
        y += 4
      }
      if !score.boosts.isEmpty {
        y += 10
        y = ensure(y, room: 40, newPage: newPage)
        y = draw(content.t("boosts", .en) + "  ·  " + content.t("boosts", .hi), font: uiFont(Face.hindiBold, 16), color: gold, x: 40, y: y, width: 515, align: .left)
        for boost in score.boosts {
          y = ensure(y, room: 24, newPage: newPage)
          let line = "+\(boost.points)   \(boost.title.en) / \(boost.title.hi)"
          y = draw(line, font: uiFont(Face.hindi, 12), color: .white, x: 40, y: y, width: 515, align: .left)
          y += 4
        }
      }
      y += 14
      y = ensure(y, room: 36, newPage: newPage)
      y = draw(content.t("report", .en) + "  ·  " + content.t("report", .hi), font: uiFont(Face.hindiBold, 16), color: gold, x: 40, y: y, width: 515, align: .left)
      let ordered = content.catalog.checks.compactMap { check -> (VaastuCheck, StoredResult)? in
        guard let saved = results.first(where: { $0.checkId == check.id }) else { return nil }
        return (check, saved)
      }
      for (check, saved) in ordered {
        let english = verdictForHeading(check: check, heading: saved.heading, locale: .en, strings: content.strings)
        let hindi = verdictForHeading(check: check, heading: saved.heading, locale: .hi, strings: content.strings)
        y = ensure(y, room: 78, newPage: newPage)
        y = draw("\(check.title.en)  ·  \(check.title.hi)", font: uiFont(Face.hindiBold, 13), color: .white, x: 40, y: y, width: 515, align: .left)
        y = draw("\(english.placementLine)  ·  \(content.t(english.rating, .en))", font: uiFont(Face.display, 12), color: gold, x: 40, y: y, width: 515, align: .left)
        y = draw("\(hindi.placementLine)  ·  \(content.t(hindi.rating, .hi))", font: uiFont(Face.hindi, 12), color: gold, x: 40, y: y, width: 515, align: .left)
        y += 8
      }
      y = ensure(y, room: 70, newPage: newPage)
      y += 8
      y = draw(content.catalog.framing.en, font: uiFont(Face.display, 11), color: UIColor(white: 0.7, alpha: 1), x: 40, y: y, width: 515, align: .left)
      _ = draw(content.catalog.framing.hi, font: uiFont(Face.hindi, 11), color: UIColor(white: 0.7, alpha: 1), x: 40, y: y, width: 515, align: .left)
    }
  }

  private static func ensure(_ y: CGFloat, room: CGFloat, newPage: () -> Void) -> CGFloat {
    if y > 842 - 40 - room {
      newPage()
      return 48
    }
    return y
  }

  @discardableResult
  private static func draw(
    _ text: String,
    font: UIFont,
    color: UIColor,
    x: CGFloat,
    y: CGFloat,
    width: CGFloat,
    align: NSTextAlignment
  ) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.alignment = align
    style.lineBreakMode = .byWordWrapping
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: style,
    ]
    let string = NSAttributedString(string: text, attributes: attributes)
    let bounds = string.boundingRect(
      with: CGSize(width: width, height: 800),
      options: [.usesLineFragmentOrigin, .usesFontLeading],
      context: nil
    )
    let rect = CGRect(x: x, y: y, width: width, height: ceil(bounds.height))
    string.draw(in: rect)
    return y + ceil(bounds.height) + 2
  }
}

func uiFont(_ name: String, _ size: CGFloat) -> UIFont {
  UIFont(name: name, size: size) ?? UIFont.systemFont(ofSize: size)
}

struct RatingCounts: Equatable {
  var auspicious: Int
  var neutral: Int
  var inauspicious: Int
}

func ratingCounts(results: [StoredResult], content: ContentBundle) -> RatingCounts {
  var counts = RatingCounts(auspicious: 0, neutral: 0, inauspicious: 0)
  for result in results {
    guard let check = content.check(result.checkId) else { continue }
    let verdict = verdictForHeading(check: check, heading: result.heading, locale: .en, strings: content.strings)
    switch verdict.rating {
    case "auspicious": counts.auspicious += 1
    case "neutral": counts.neutral += 1
    default: counts.inauspicious += 1
    }
  }
  return counts
}

func writeReportFile(_ data: Data, name: String) -> URL? {
  let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
  do {
    try data.write(to: url, options: .atomic)
    return url
  } catch {
    return nil
  }
}
