declare module "geomagnetism" {
  export interface GeomagnetismPoint {
    x: number;
    y: number;
    z: number;
    h: number;
    f: number;
    incl: number;
    decl: number;
  }

  export interface GeomagnetismModel {
    epoch: number;
    start_date: Date;
    end_date: Date;
    name: string;
    point(geoPoint: number[]): GeomagnetismPoint;
  }

  export interface GeomagnetismOptions {
    allowOutOfBoundsModel?: boolean;
  }

  export function model(date?: Date, options?: GeomagnetismOptions): GeomagnetismModel;

  const geomagnetism: {
    model: typeof model;
  };
  export default geomagnetism;
}
