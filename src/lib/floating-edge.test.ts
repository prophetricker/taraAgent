import { describe, expect, it } from "vitest";

import {
  getFloatingConnection,
  getFloatingEdgeGeometry
} from "./floating-edge";

describe("getFloatingConnection", () => {
  it("connects rectangles from their boundary instead of their centers", () => {
    const connection = getFloatingConnection(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 300, y: 25, width: 100, height: 100 }
    );

    expect(connection.source.x).toBeCloseTo(100);
    expect(connection.source.y).toBeGreaterThan(50);
    expect(connection.target.x).toBeCloseTo(300);
    expect(connection.source).not.toEqual({ x: 50, y: 50 });
    expect(connection.target).not.toEqual({ x: 350, y: 75 });
  });

  it("uses the top or bottom boundary for mostly vertical links", () => {
    const connection = getFloatingConnection(
      { x: 100, y: 100, width: 120, height: 80 },
      { x: 125, y: 360, width: 120, height: 80 }
    );

    expect(connection.source.y).toBeCloseTo(180);
    expect(connection.target.y).toBeCloseTo(360);
  });

  it("routes blocked links around the obstructing node", () => {
    const geometry = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 280, y: 20, width: 120, height: 96 },
      {
        obstacles: [{ x: 155, y: 22, width: 90, height: 96 }]
      }
    );

    expect(geometry.path.startsWith("M ")).toBe(true);
    expect(geometry.route).toBe("obstacle");
    expect(getPathCommandSequence(geometry.path)).toEqual(["M", "C", "C", "C"]);
    expect(geometry.path).toContain(" C ");
    expect(geometry.labelX).toBeGreaterThan(80);
    expectPathToAvoidRect(geometry.path, {
      x: 155,
      y: 22,
      width: 90,
      height: 96
    });
  });

  it("keeps blocked links smooth instead of sharp zigzags", () => {
    const geometry = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 420, y: 40, width: 120, height: 92 },
      {
        obstacles: [{ x: 170, y: -20, width: 120, height: 160 }]
      }
    );

    expect(geometry.route).toBe("obstacle");
    expect(getPathCommandSequence(geometry.path)).toEqual(["M", "C", "C", "C"]);
    expect(
      Math.abs(geometry.controlPoint1.y - geometry.controlPoint2.y)
    ).toBeGreaterThan(12);
  });

  it("starts and ends from the natural centerline boundary points", () => {
    const geometry = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 260, y: 90, width: 140, height: 100 }
    );
    const points = getPathPoints(geometry.path);

    expect(points[0].x).toBeCloseTo(100);
    expect(points[0].y).toBeCloseTo(57.86, 1);
    expect(points.at(-1)?.x).toBeCloseTo(260);
    expect(points.at(-1)?.y).toBeCloseTo(115, 1);
  });

  it("uses a continuous hand-drawn rhythm for close diagonal links", () => {
    const geometry = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 180, y: 76, width: 120, height: 88 }
    );
    const points = getPathPoints(geometry.path);
    const start = points[0];
    const end = points.at(-1)!;

    expect(geometry.route).toBe("direct");
    expect(getPathCommandSequence(geometry.path)).toEqual(["M", "C", "C", "C"]);
    expect(Math.abs(geometry.controlPoint1.y - geometry.controlPoint2.y)).toBeLessThan(70);
    expect(start.x).toBeCloseTo(100);
    expect(end.x).toBeCloseTo(180);
  });

  it("keeps the same three-part rhythm for unobstructed long links", () => {
    const direct = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 520, y: 220, width: 120, height: 88 }
    );
    const routed = getFloatingEdgeGeometry(
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 520, y: 220, width: 120, height: 88 },
      {
        obstacles: [{ x: 250, y: 95, width: 150, height: 120 }]
      }
    );

    expect(direct.route).toBe("direct");
    expect(getPathCommandSequence(direct.path)).toEqual(["M", "C", "C", "C"]);
    expect(routed.route).toBe("obstacle");
    expect(getPathCommandSequence(routed.path)).toEqual(["M", "C", "C", "C"]);
    expect(routed.path).not.toBe(direct.path);
  });

  it("keeps clearly vertical unobstructed links visually straight", () => {
    const geometry = getFloatingEdgeGeometry(
      { x: 100, y: 0, width: 120, height: 80 },
      { x: 100, y: 620, width: 120, height: 88 }
    );

    const points = getPathPoints(geometry.path);
    const xSpread = Math.max(...points.map((point) => point.x)) -
      Math.min(...points.map((point) => point.x));

    expect(geometry.route).toBe("direct");
    expect(getPathCommandSequence(geometry.path)).toEqual(["M", "C", "C", "C"]);
    expect(xSpread).toBeLessThan(4);
  });
});

function getPathCommandSequence(path: string) {
  return path.match(/[MLC]/g);
}

function getPathPoints(path: string) {
  const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "M" || token === "L") {
      points.push({
        x: Number(tokens[index + 1]),
        y: Number(tokens[index + 2])
      });
      index += 2;
    }

    if (token === "C") {
      points.push({
        x: Number(tokens[index + 1]),
        y: Number(tokens[index + 2])
      });
      points.push({
        x: Number(tokens[index + 3]),
        y: Number(tokens[index + 4])
      });
      points.push({
        x: Number(tokens[index + 5]),
        y: Number(tokens[index + 6])
      });
      index += 6;
    }
  }

  return points;
}

function expectPathToAvoidRect(
  path: string,
  rect: { x: number; y: number; width: number; height: number }
) {
  const points = samplePath(path);

  for (const point of points) {
    expect(point.x < rect.x || point.x > rect.x + rect.width || point.y < rect.y || point.y > rect.y + rect.height).toBe(true);
  }
}

function samplePath(path: string) {
  const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  const samples: Array<{ x: number; y: number }> = [];
  let current: { x: number; y: number } | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "M" || token === "L") {
      current = {
        x: Number(tokens[index + 1]),
        y: Number(tokens[index + 2])
      };
      samples.push(current);
      index += 2;
    }

    if (token === "C" && current) {
      const control1 = {
        x: Number(tokens[index + 1]),
        y: Number(tokens[index + 2])
      };
      const control2 = {
        x: Number(tokens[index + 3]),
        y: Number(tokens[index + 4])
      };
      const end = {
        x: Number(tokens[index + 5]),
        y: Number(tokens[index + 6])
      };

      for (let step = 1; step <= 16; step += 1) {
        samples.push(getCubicPoint(current, control1, control2, end, step / 16));
      }

      current = end;
      index += 6;
    }
  }

  return samples;
}

function getCubicPoint(
  start: { x: number; y: number },
  control1: { x: number; y: number },
  control2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;

  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * control1.x +
      3 * mt * t * t * control2.x +
      t * t * t * end.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * control1.y +
      3 * mt * t * t * control2.y +
      t * t * t * end.y
  };
}
