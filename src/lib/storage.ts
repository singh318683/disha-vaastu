import type { Property } from "./types.ts";

const STORAGE_KEY = "disha.properties.v1";
const ACTIVE_KEY = "disha.activePropertyId";

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number";
}

export function isProperty(value: unknown): value is Property {
  if (!value || typeof value !== "object") return false;
  const property = value as Partial<Property>;
  return (
    typeof property.id === "string" &&
    typeof property.name === "string" &&
    typeof property.createdAt === "number" &&
    Array.isArray(property.rooms) &&
    Array.isArray(property.placements)
  );
}

export function loadProperties(): Property[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProperty).map((property) => ({
      ...property,
      placements: property.placements ?? [],
      rooms: property.rooms ?? [],
      updatedAt: property.updatedAt ?? property.createdAt,
    }));
  } catch {
    return [];
  }
}

export function loadActiveId(properties: Property[]): string | null {
  const stored = localStorage.getItem(ACTIVE_KEY);
  if (stored && properties.some((property) => property.id === stored)) return stored;
  return properties[0]?.id ?? null;
}

export function saveProperties(properties: Property[], activeId: string | null): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function propertyHasPlanPoint(property: Property): boolean {
  return Boolean(property.plan && isPoint(property.plan.center));
}
