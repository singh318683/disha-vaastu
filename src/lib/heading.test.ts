import { describe, expect, it } from "vitest";
import {
  applyScreenAngle,
  callDevicePermission,
  circularMean,
  extractOrientation,
  headingFromOrientation,
  headingFromQuaternion,
  isIosBrowser,
  needsDirectGesture,
  phoneIsLevel,
  smoothHeading,
  tiltCompensatedHeading,
} from "./heading.ts";
import { normalizeDegrees } from "./angles.ts";

const HALF = Math.SQRT1_2;

describe("headingFromOrientation", () => {
  it("uses iOS webkitCompassHeading, including due north (0°)", () => {
    expect(headingFromOrientation({ webkitCompassHeading: 0, alpha: 222 })).toEqual({
      magnetic: 0,
      source: "ios",
    });
    expect(headingFromOrientation({ webkitCompassHeading: 90, webkitCompassAccuracy: 12 })).toEqual({
      magnetic: 90,
      source: "ios",
      accuracy: 12,
    });
    expect(headingFromOrientation({ webkitCompassHeading: 360.4, webkitCompassAccuracy: 0 })?.magnetic).toBeCloseTo(
      0.4,
      5,
    );
  });

  it("ignores the iOS -1 sentinel and does not fall through to a non-absolute alpha", () => {
    expect(
      headingFromOrientation({
        type: "deviceorientation",
        absolute: false,
        alpha: 90,
        webkitCompassHeading: -1,
        webkitCompassAccuracy: -1,
      }),
    ).toBeNull();
    expect(headingFromOrientation({ webkitCompassHeading: Number.NaN, alpha: 10 })).toBeNull();
    expect(headingFromOrientation({ webkitCompassHeading: null, alpha: 10, absolute: false })).toBeNull();
  });

  it("prefers webkitCompassHeading over absolute alpha when both are present", () => {
    expect(
      headingFromOrientation({
        type: "deviceorientationabsolute",
        absolute: true,
        alpha: 90,
        webkitCompassHeading: 20,
      }),
    ).toEqual({ magnetic: 20, source: "ios" });
  });

  it("treats Android absolute alpha as clockwise, so east is 90° from north", () => {
    const north = headingFromOrientation({ type: "deviceorientationabsolute", alpha: 0 });
    const east = headingFromOrientation({ type: "deviceorientationabsolute", alpha: 90 });
    expect(north).toEqual({ magnetic: 0, source: "absolute" });
    expect(east).toEqual({ magnetic: 90, source: "absolute" });
    expect(normalizeDegrees(east!.magnetic - north!.magnetic)).toBe(90);
    expect(headingFromOrientation({ absolute: true, alpha: 180 })).toEqual({
      magnetic: 180,
      source: "absolute",
    });
    expect(headingFromOrientation({ type: "deviceorientationabsolute", alpha: 270 })?.magnetic).toBe(270);
    expect(headingFromOrientation({ type: "deviceorientationabsolute", alpha: 360 })?.magnetic).toBe(0);
    expect(headingFromOrientation({ type: "deviceorientationabsolute", alpha: 359 })?.magnetic).toBe(359);
  });

  it("adjusts Android headings for screen rotation at 0, 90, 180, and 270", () => {
    for (const angle of [0, 90, 180, 270]) {
      const fix = headingFromOrientation({ type: "deviceorientationabsolute", alpha: 90, beta: 0, gamma: 0 }, { screenAngle: angle });
      expect(fix?.magnetic).toBe(normalizeDegrees(90 - angle));
    }
    // iOS heading is not rotated again by the screen angle.
    expect(
      headingFromOrientation({ webkitCompassHeading: 90, alpha: 0 }, { screenAngle: 90 })?.magnetic,
    ).toBe(90);
  });

  it("keeps a tilted Android phone on the same compass point", () => {
    expect(tiltCompensatedHeading(0, 35, 0)).toBeCloseTo(0, 4);
    expect(tiltCompensatedHeading(90, 35, 0)).toBeCloseTo(90, 4);
    expect(tiltCompensatedHeading(180, 28, 0)).toBeCloseTo(180, 4);
    expect(tiltCompensatedHeading(270, 40, 0)).toBeCloseTo(270, 4);
    const tilted = headingFromOrientation({
      type: "deviceorientationabsolute",
      alpha: 90,
      beta: 35,
      gamma: 0,
    });
    expect(tilted?.magnetic).toBeCloseTo(90, 4);
  });

  it("ignores a relative alpha, which is not referenced to north", () => {
    expect(headingFromOrientation({ type: "deviceorientation", absolute: false, alpha: 90 })).toBeNull();
    expect(headingFromOrientation({ type: "deviceorientation", alpha: 15 })).toBeNull();
    expect(headingFromOrientation({ type: "deviceorientationabsolute", alpha: null })).toBeNull();
    expect(headingFromOrientation({ absolute: true, alpha: Number.NaN })).toBeNull();
  });

  it("still returns tilt when the compass heading is missing", () => {
    expect(extractOrientation({ beta: 12, gamma: -4, alpha: 30 })).toEqual({
      heading: null,
      beta: 12,
      gamma: -4,
    });
    expect(extractOrientation({ beta: Number.NaN, gamma: 3, webkitCompassHeading: 10 })).toEqual({
      heading: { magnetic: 10, source: "ios" },
      beta: null,
      gamma: 3,
    });
  });
});

describe("headingFromQuaternion", () => {
  it("reads north when the phone is flat with its top pointing north", () => {
    expect(headingFromQuaternion([0, 0, 0, 1])).toBe(0);
  });

  it("reads the cardinal directions for a phone lying flat", () => {
    // -90° around up: top of the phone points east.
    expect(headingFromQuaternion([0, 0, -HALF, HALF])).toBeCloseTo(90, 5);
    // +90° around up: top points west.
    expect(headingFromQuaternion([0, 0, HALF, HALF])).toBeCloseTo(270, 5);
    // 180° around up: top points south.
    expect(headingFromQuaternion([0, 0, -1, 0])).toBeCloseTo(180, 5);
  });

  it("keeps north when the phone is tilted but the top edge still points north", () => {
    const tilt = Math.PI / 8;
    const q = [Math.sin(tilt), 0, 0, Math.cos(tilt)];
    expect(headingFromQuaternion(q)).toBeCloseTo(0, 5);
  });

  it("uses the back of an upright phone as the facing direction", () => {
    // Portrait, screen toward the user, top toward the sky, facing north.
    expect(headingFromQuaternion([HALF, 0, 0, HALF])).toBeCloseTo(0, 5);
    // Same pose, turned to face east.
    expect(headingFromQuaternion([0.5, -0.5, -0.5, 0.5])).toBeCloseTo(90, 5);
  });

  it("rejects quaternions that are not a full finite sample", () => {
    expect(headingFromQuaternion(null)).toBeNull();
    expect(headingFromQuaternion([])).toBeNull();
    expect(headingFromQuaternion([1, 2, 3])).toBeNull();
    expect(headingFromQuaternion([Number.NaN, 0, 0, 1])).toBeNull();
  });
});

describe("circular smoothing", () => {
  it("steps across 359° to 1° without spinning through south", () => {
    let state = smoothHeading(null, 359, 0);
    state = smoothHeading(state.state, 1, 50);
    state = smoothHeading(state.state, 2, 50);
    expect(state.heading < 20 || state.heading > 340).toBe(true);
    expect(circularMean([359, 0, 1, 2])).toBeCloseTo(0.5, 0);
    const across = circularMean([350, 10])!;
    expect(Math.min(across, 360 - across)).toBeLessThan(1);
  });

  it("treats a hand-held phone as level and an upright phone as not", () => {
    expect(phoneIsLevel(null, null)).toBe(true);
    expect(phoneIsLevel(12, 8)).toBe(true);
    expect(phoneIsLevel(25, 10)).toBe(true);
    expect(phoneIsLevel(70, 5)).toBe(false);
    expect(applyScreenAngle(90, 90)).toBe(0);
  });
});

describe("iOS permission request", () => {
  it("calls requestPermission synchronously, as a method, before the promise resolves", () => {
    let called = false;
    const target = {
      requestPermission() {
        called = true;
        expect(this).toBe(target);
        return Promise.resolve("granted");
      },
    };
    const pending = callDevicePermission(target);
    expect(called).toBe(true);
    return expect(pending).resolves.toBe("granted");
  });

  it("maps a denial or a throw to denied, and treats a missing API as granted", async () => {
    await expect(callDevicePermission({ requestPermission: () => Promise.resolve("denied") })).resolves.toBe("denied");
    await expect(
      callDevicePermission({
        requestPermission: () => Promise.reject(new Error("not allowed")),
      }),
    ).resolves.toBe("denied");
    await expect(
      callDevicePermission({
        requestPermission() {
          throw new Error("no gesture");
        },
      }),
    ).resolves.toBe("denied");
    await expect(callDevicePermission(undefined)).resolves.toBe("granted");
    await expect(callDevicePermission({})).resolves.toBe("granted");
  });

  it("recognizes iPhone, iPod, and iPadOS, and leaves Android Chrome alone", () => {
    expect(isIosBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(true);
    expect(isIosBrowser("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)")).toBe(true);
    expect(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5)).toBe(true);
    expect(
      isIosBrowser(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
        "Linux armv8l",
        5,
      ),
    ).toBe(false);
    expect(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 0)).toBe(false);
  });

  it("detects when a direct user gesture is required", () => {
    const ios = { requestPermission: () => Promise.resolve("granted") };
    expect(needsDirectGesture(ios, {})).toBe(true);
    expect(needsDirectGesture({}, ios)).toBe(true);
    expect(needsDirectGesture({}, {})).toBe(false);
    expect(needsDirectGesture(undefined, undefined)).toBe(false);
  });
});
