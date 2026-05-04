export type FloatingNodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloatingPoint = {
  x: number;
  y: number;
};

export type FloatingEdgeGeometry = {
  path: string;
  labelX: number;
  labelY: number;
  controlPoint1: FloatingPoint;
  controlPoint2: FloatingPoint;
  route: "direct" | "obstacle";
};

export type FloatingEdgeOptions = {
  obstacles?: FloatingNodeRect[];
  obstaclePadding?: number;
};

type ThreePartRoute = {
  path: string;
  lineEnd: FloatingPoint;
  curveEnd: FloatingPoint;
  controlPoint1: FloatingPoint;
  controlPoint2: FloatingPoint;
  label: FloatingPoint;
  samples: FloatingPoint[];
  route: "direct" | "obstacle";
};

export function getFloatingConnection(
  source: FloatingNodeRect,
  target: FloatingNodeRect
) {
  const sourceCenter = getRectCenter(source);
  const targetCenter = getRectCenter(target);

  return {
    source: getBoundaryPoint(source, targetCenter),
    target: getBoundaryPoint(target, sourceCenter)
  };
}

export function getFloatingEdgeGeometry(
  source: FloatingNodeRect,
  target: FloatingNodeRect,
  options: FloatingEdgeOptions = {}
): FloatingEdgeGeometry {
  const sourceCenter = getRectCenter(source);
  const targetCenter = getRectCenter(target);
  const connection = getFloatingConnection(source, target);
  const direction = normalizePoint({
    x: connection.target.x - connection.source.x,
    y: connection.target.y - connection.source.y
  });
  const distance = getPointDistance(connection.source, connection.target);
  const obstacles = (options.obstacles ?? []).map((obstacle) =>
    expandRect(obstacle, options.obstaclePadding ?? 30)
  );
  const directRoute = buildRoute({
    start: connection.source,
    end: connection.target,
    direction,
    distance,
    offset: 0
  });

  if (!routeHitsObstacles(directRoute, obstacles)) {
    return toGeometry(directRoute);
  }

  const perpendicular = { x: -direction.y, y: direction.x };
  const candidates = [
    96,
    -96,
    144,
    -144,
    206,
    -206,
    276,
    -276
  ].map((offset) =>
    buildRoute({
      start: connection.source,
      end: connection.target,
      direction,
      distance,
      offset,
      perpendicular
    })
  );
  const routed =
    candidates
      .map((route) => ({
        route,
        score:
          (routeHitsObstacles(route, obstacles) ? 100000 : 0) +
          getAverageDistanceFromSegment(route.samples, sourceCenter, targetCenter) *
            1.8 +
          getPointDistance(route.lineEnd, route.curveEnd) * 0.12
      }))
      .sort((a, b) => a.score - b.score)[0]?.route ?? directRoute;

  return toGeometry({ ...routed, route: "obstacle" });
}

function buildRoute(input: {
  start: FloatingPoint;
  end: FloatingPoint;
  direction: FloatingPoint;
  distance: number;
  offset: number;
  perpendicular?: FloatingPoint;
}): ThreePartRoute {
  const firstLength = clamp(input.distance * 0.18, 34, 92);
  const finalLength = clamp(input.distance * 0.18, 34, 92);
  const curveTension = clamp(input.distance * 0.22, 42, 128);
  const perpendicular = input.perpendicular ?? { x: -input.direction.y, y: input.direction.x };
  const lineEnd = {
    x:
      input.start.x +
      input.direction.x * firstLength +
      perpendicular.x * input.offset,
    y:
      input.start.y +
      input.direction.y * firstLength +
      perpendicular.y * input.offset
  };
  const curveEnd = {
    x:
      input.end.x -
      input.direction.x * finalLength +
      perpendicular.x * input.offset,
    y:
      input.end.y -
      input.direction.y * finalLength +
      perpendicular.y * input.offset
  };
  const controlPoint1 = {
    x: lineEnd.x + input.direction.x * curveTension,
    y: lineEnd.y + input.direction.y * curveTension
  };
  const controlPoint2 = {
    x: curveEnd.x - input.direction.x * curveTension,
    y: curveEnd.y - input.direction.y * curveTension
  };
  const label = getCubicPoint(lineEnd, controlPoint1, controlPoint2, curveEnd, 0.5);
  const samples = sampleThreePartPath({
    start: input.start,
    lineEnd,
    controlPoint1,
    controlPoint2,
    curveEnd,
    end: input.end
  });

  return {
    path: [
      `M ${formatNumber(input.start.x)} ${formatNumber(input.start.y)}`,
      `L ${formatNumber(lineEnd.x)} ${formatNumber(lineEnd.y)}`,
      `C ${formatNumber(controlPoint1.x)} ${formatNumber(controlPoint1.y)} ${formatNumber(controlPoint2.x)} ${formatNumber(controlPoint2.y)} ${formatNumber(curveEnd.x)} ${formatNumber(curveEnd.y)}`,
      `L ${formatNumber(input.end.x)} ${formatNumber(input.end.y)}`
    ].join(" "),
    lineEnd,
    curveEnd,
    controlPoint1,
    controlPoint2,
    label,
    samples,
    route: input.offset === 0 ? "direct" : "obstacle"
  };
}

function toGeometry(route: ThreePartRoute): FloatingEdgeGeometry {
  return {
    path: route.path,
    labelX: route.label.x,
    labelY: route.label.y,
    controlPoint1: route.controlPoint1,
    controlPoint2: route.controlPoint2,
    route: route.route
  };
}

function routeHitsObstacles(route: ThreePartRoute, obstacles: FloatingNodeRect[]) {
  return obstacles.some((obstacle) =>
    route.samples.some((point) => pointInRect(point, obstacle))
  );
}

function sampleThreePartPath(input: {
  start: FloatingPoint;
  lineEnd: FloatingPoint;
  controlPoint1: FloatingPoint;
  controlPoint2: FloatingPoint;
  curveEnd: FloatingPoint;
  end: FloatingPoint;
}) {
  const samples: FloatingPoint[] = [];

  for (let index = 0; index <= 12; index += 1) {
    samples.push(lerpPoint(input.start, input.lineEnd, index / 12));
  }

  for (let index = 1; index <= 24; index += 1) {
    samples.push(
      getCubicPoint(
        input.lineEnd,
        input.controlPoint1,
        input.controlPoint2,
        input.curveEnd,
        index / 24
      )
    );
  }

  for (let index = 1; index <= 12; index += 1) {
    samples.push(lerpPoint(input.curveEnd, input.end, index / 12));
  }

  return samples;
}

function getBoundaryPoint(rect: FloatingNodeRect, toward: FloatingPoint) {
  const center = getRectCenter(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const xScale = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfWidth / dx);
  const yScale =
    dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfHeight / dy);
  const scale = Math.min(xScale, yScale);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function getRectCenter(rect: FloatingNodeRect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function getAverageDistanceFromSegment(
  points: FloatingPoint[],
  start: FloatingPoint,
  end: FloatingPoint
) {
  return (
    points.reduce(
      (total, point) => total + distancePointToSegment(point, start, end),
      0
    ) / Math.max(points.length, 1)
  );
}

function distancePointToSegment(
  point: FloatingPoint,
  start: FloatingPoint,
  end: FloatingPoint
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return getPointDistance(point, start);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1
  );

  return getPointDistance(point, {
    x: start.x + t * dx,
    y: start.y + t * dy
  });
}

function lerpPoint(start: FloatingPoint, end: FloatingPoint, t: number) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

function getCubicPoint(
  start: FloatingPoint,
  control1: FloatingPoint,
  control2: FloatingPoint,
  end: FloatingPoint,
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x:
      mt2 * mt * start.x +
      3 * mt2 * t * control1.x +
      3 * mt * t2 * control2.x +
      t2 * t * end.x,
    y:
      mt2 * mt * start.y +
      3 * mt2 * t * control1.y +
      3 * mt * t2 * control2.y +
      t2 * t * end.y
  };
}

function expandRect(rect: FloatingNodeRect, padding: number) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
}

function pointInRect(point: FloatingPoint, rect: FloatingNodeRect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function normalizePoint(point: FloatingPoint) {
  const length = Math.hypot(point.x, point.y);

  if (length === 0) {
    return { x: 1, y: 0 };
  }

  return {
    x: point.x / length,
    y: point.y / length
  };
}

function getPointDistance(a: FloatingPoint, b: FloatingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatNumber(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
