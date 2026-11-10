import Foundation

struct QuizVerdict: Equatable {
  var heading: Double
  var slotId: String
  var slotName: String
  var rating: String
  var tier: ScoreTier
  var meaning: String
  var remedies: [String]
  var direction: String
  var directionLabel: String
  var facingLabel: String
  var placementLine: String
  var slotLine: String
  var bestNote: String
  var toward: String?
}

func directionLabel(_ id: String, locale: AppLocale, strings: StringTable) -> String {
  let key = "dir.\(id)"
  let value = strings.t(key, locale)
  return value == key ? id : value
}

func facingLabel(_ side: String, locale: AppLocale, strings: StringTable) -> String {
  let key = "facing.\(side)"
  let value = strings.t(key, locale)
  return value == key ? side : value
}

func verdictForHeading(
  check: VaastuCheck,
  heading: Double,
  locale: AppLocale,
  strings: StringTable
) -> QuizVerdict {
  let normalized = normalizeDegrees(heading)
  let slotId = slotFromHeading(normalized, granularity: check.granularity)
  let zone = check.zones.first { $0.id == slotId }
  let direction = directionFromHeading(normalized)
  let directionName = directionLabel(direction, locale: locale, strings: strings)
  let slotName = zone?.name.text(locale) ?? slotId
  let rating = zone?.rating ?? "neutral"
  var facing = slotName
  var placement = ""
  var slotLine = slotName
  var bestNote = check.bestNote.text(locale)
  var toward: String?

  if check.granularity == 32, let side = padaSide(slotId) {
    facing = facingLabel(side, locale: locale, strings: strings)
    placement = facing
    if let noun = check.resultNoun?.text(locale), !noun.isEmpty {
      slotLine = locale == .hi
        ? "आपका \(noun) \(slotId) · \(slotName) में है"
        : "Your \(noun) is in \(slotId) · \(slotName)"
    } else {
      slotLine = "\(slotId) · \(slotName)"
    }
    if let note = check.facingNotes?[side] {
      bestNote = note.text(locale)
    }
    if direction == "NE" || direction == "SE" || direction == "SW" || direction == "NW" {
      toward = locale == .hi
        ? "\(directionName) की तरफ़।"
        : "Toward the \(directionName.lowercased())."
    }
  } else if locale == .hi {
    placement = check.reference == "facing-out" ? "\(slotName) की ओर मुख" : "\(slotName) की ओर"
    facing = placement
    slotLine = slotName
  } else if check.reference == "facing-out" {
    placement = "Facing \(slotName.lowercased())"
    facing = placement
    slotLine = slotName
  } else {
    placement = "Toward the \(slotName.lowercased())"
    facing = placement
    slotLine = slotName
  }

  return QuizVerdict(
    heading: normalized,
    slotId: slotId,
    slotName: slotName,
    rating: rating,
    tier: tier(forRating: rating),
    meaning: zone?.meaning.text(locale) ?? "",
    remedies: zone?.remedies.map { $0.text(locale) } ?? [],
    direction: direction,
    directionLabel: directionName,
    facingLabel: facing,
    placementLine: placement,
    slotLine: slotLine,
    bestNote: bestNote,
    toward: toward
  )
}
