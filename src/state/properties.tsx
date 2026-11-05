import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { uid } from "@/lib/id.ts";
import { recomputePlan } from "@/lib/mutate.ts";
import { buildSampleProperty } from "@/lib/sample.ts";
import { loadActiveId, loadProperties, saveProperties } from "@/lib/storage.ts";
import type { FloorPlan, Placement, Property, TaggedRoom } from "@/lib/types.ts";

interface PropertiesValue {
  properties: Property[];
  activeId: string | null;
  active: Property | null;
  storageError: string | null;
  setActiveId: (id: string) => void;
  createProperty: (name: string) => Property;
  updateProperty: (id: string, recipe: (property: Property) => Property) => void;
  deleteProperty: (id: string) => void;
  addRoom: (id: string, room: TaggedRoom) => void;
  removeRoom: (id: string, roomId: string) => void;
  addPlacement: (id: string, placement: Placement) => void;
  removePlacement: (id: string, placementId: string) => void;
  setPlan: (id: string, plan: FloorPlan | undefined) => void;
  loadSample: (intoId?: string) => Property;
  stampLocation: (
    id: string,
    fix: { lat: number; lon: number; declination: number; model?: string; label?: string },
  ) => void;
}

const PropertiesContext = createContext<PropertiesValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(() => loadProperties());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId(loadProperties()));
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      saveProperties(properties, activeId);
      setStorageError(null);
    } catch {
      setStorageError("This device could not store more data. Remove a floor plan or a home and try again.");
    }
  }, [activeId, properties]);

  const updateProperty = useCallback((id: string, recipe: (property: Property) => Property) => {
    setProperties((current) =>
      current.map((property) => {
        if (property.id !== id) return property;
        return recomputePlan({ ...recipe(property), updatedAt: Date.now() });
      }),
    );
  }, []);

  const createProperty = useCallback((name: string) => {
    const property: Property = {
      id: uid(),
      name: name.trim() || "My home",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rooms: [],
      placements: [],
    };
    setProperties((current) => [property, ...current]);
    setActiveId(property.id);
    return property;
  }, []);

  const deleteProperty = useCallback((id: string) => {
    setProperties((current) => {
      const next = current.filter((property) => property.id !== id);
      setActiveId((active) => (active === id ? (next[0]?.id ?? null) : active));
      return next;
    });
  }, []);

  const value = useMemo<PropertiesValue>(
    () => ({
      properties,
      activeId,
      active: properties.find((property) => property.id === activeId) ?? null,
      storageError,
      setActiveId,
      createProperty,
      updateProperty,
      deleteProperty,
      addRoom: (id, room) => updateProperty(id, (property) => ({ ...property, rooms: [...property.rooms, room] })),
      removeRoom: (id, roomId) =>
        updateProperty(id, (property) => ({
          ...property,
          rooms: property.rooms.filter((room) => room.id !== roomId),
        })),
      addPlacement: (id, placement) =>
        updateProperty(id, (property) => ({ ...property, placements: [...property.placements, placement] })),
      removePlacement: (id, placementId) =>
        updateProperty(id, (property) => ({
          ...property,
          placements: property.placements.filter((placement) => placement.id !== placementId),
        })),
      setPlan: (id, plan) => updateProperty(id, (property) => ({ ...property, plan })),
      loadSample: (intoId?: string) => {
        const sample = buildSampleProperty();
        if (!intoId) {
          setProperties((current) => [sample, ...current]);
          setActiveId(sample.id);
          return sample;
        }
        setProperties((current) =>
          current.map((property) =>
            property.id === intoId
              ? {
                  ...sample,
                  id: property.id,
                  name: property.name,
                  createdAt: property.createdAt,
                  updatedAt: Date.now(),
                }
              : property,
          ),
        );
        setActiveId(intoId);
        return sample;
      },
      stampLocation: (id, fix) =>
        updateProperty(id, (property) => ({
          ...property,
          latitude: fix.lat,
          longitude: fix.lon,
          declination: fix.declination,
          declinationModel: fix.model,
          placeLabel: fix.label ?? property.placeLabel,
        })),
    }),
    [activeId, createProperty, deleteProperty, properties, storageError, updateProperty],
  );

  return <PropertiesContext.Provider value={value}>{children}</PropertiesContext.Provider>;
}

export function useProperties(): PropertiesValue {
  const value = useContext(PropertiesContext);
  if (!value) throw new Error("useProperties must be used inside PropertiesProvider");
  return value;
}
