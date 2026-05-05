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
  firstEnd: FloatingPoint;
  secondEnd: FloatingPoint;
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
  const obstacles = (options.obstacles ?? []).map((obstacle) =>
    expandRect(obstacle, options.obstaclePadding ?? 30)
  );
  const naturalConnection = getFloatingConnection(source, target);
  const naturalRoute = buildDirectRoute(naturalConnection);

  if (obstacles.length === 0 || !routeHitsObstacles(naturalRoute, obstacles)) {
    return toGeometry(naturalRoute);
  }

  const routed = chooseBestRoute(source, target, obstacles);

  return toGeometry(routed);
}

function buildRoute(input: {
  start: FloatingPoint;
  end: FloatingPoint;
  direction: FloatingPoint;
  distance: number;
  offset: number;
  perpendicular?: FloatingPoint;
}): ThreePartRoute {
  const perpendicular = input.perpendicular ?? { x: -input.direction.y, y: input.direction.x };
  const firstLength = clamp(input.distance * 0.22, 46, 128);
  const finalLength = clamp(input.distance * 0.22, 46, 128);
  const firstOffset = input.offset === 0 ? 0 : input.offset * 0.55;
  const secondOffset = input.offset;
  const firstEnd = {
    x:
      input.start.x +
      input.direction.x * firstLength +
      perpendicular.x * firstOffset,
    y:
      input.start.y +
      input.direction.y * firstLength +
      perpendicular.y * firstOffset
  };
  const secondEnd = {
    x:
      input.end.x -
      input.direction.x * finalLength +
      perpendicular.x * secondOffset,
    y:
      input.end.y -
      input.direction.y * finalLength +
      perpendicular.y * secondOffset
  };
  const entryTangent = getLaneChangeTangent({
    direction: input.direction,
    perpendicular,
    offset: input.offset,
    distance: firstLength,
    phase: "entry"
  });
  const cruiseTangent = input.direction;
  const exitTangent = getLaneChangeTangent({
    direction: input.direction,
    perpendicular,
    offset: input.offset,
    distance: finalLength,
    phase: "exit"
  });
  const firstTension = clamp(firstLength * 0.42, 24, 78);
  const middleTension = clamp(input.distance * 0.22, 56, 156);
  const finalTension = clamp(finalLength * 0.42, 24, 78);
  const firstControl1 = {
    x: input.start.x + input.direction.x * firstTension,
    y: input.start.y + input.direction.y * firstTension
  };
  const firstControl2 = {
    x: firstEnd.x - entryTangent.x * firstTension,
    y: firstEnd.y - entryTangent.y * firstTension
  };
  const controlPoint1 = {
    x: firstEnd.x + entryTangent.x * middleTension,
    y: firstEnd.y + entryTangent.y * middleTension
  };
  const controlPoint2 = {
    x: secondEnd.x - cruiseTangent.x * middleTension,
    y: secondEnd.y - cruiseTangent.y * middleTension
  };
  const finalControl1 = {
    x: secondEnd.x + cruiseTangent.x * finalTension,
    y: secondEnd.y + cruiseTangent.y * finalTension
  };
  const finalControl2 = {
    x: input.end.x - exitTangent.x * finalTension,
    y: input.end.y - exitTangent.y * finalTension
  };
  const label = getCubicPoint(firstEnd, controlPoint1, controlPoint2, secondEnd, 0.5);
  const samples = sampleThreePartPath({
    start: input.start,
    firstControl1,
    firstControl2,
    firstEnd,
    controlPoint1,
    controlPoint2,
    secondEnd,
    finalControl1,
    finalControl2,
    end: input.end
  });

  return {
    path: [
      `M ${formatNumber(input.start.x)} ${formatNumber(input.start.y)}`,
      `C ${formatNumber(firstControl1.x)} ${formatNumber(firstControl1.y)} ${formatNumber(firstControl2.x)} ${formatNumber(firstControl2.y)} ${formatNumber(firstEnd.x)} ${formatNumber(firstEnd.y)}`,
      `C ${formatNumber(controlPoint1.x)} ${formatNumber(controlPoint1.y)} ${formatNumber(controlPoint2.x)} ${formatNumber(controlPoint2.y)} ${formatNumber(secondEnd.x)} ${formatNumber(secondEnd.y)}`,
      `C ${formatNumber(finalControl1.x)} ${formatNumber(finalControl1.y)} ${formatNumber(finalControl2.x)} ${formatNumber(finalControl2.y)} ${formatNumber(input.end.x)} ${formatNumber(input.end.y)}`
    ].join(" "),
    firstEnd,
    secondEnd,
    controlPoint1,
    controlPoint2,
    label,
    samples,
    route: input.offset === 0 ? "direct" : "obstacle"
  };
}

function chooseBestRoute(
  source: FloatingNodeRect,
  target: FloatingNodeRect,
  obstacles: FloatingNodeRect[]
) {
  const naturalConnection = getFloatingConnection(source, target);
  const connectionCandidates = getFloatingConnectionCandidates(source, target);
  let bestRoute: ThreePartRoute | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const connection of connectionCandidates) {
    const direction = normalizePoint({
      x: connection.target.x - connection.source.x,
      y: connection.target.y - connection.source.y
    });
    const distance = getPointDistance(connection.source, connection.target);
    const directRoute = buildRoute({
      start: connection.source,
      end: connection.target,
      direction,
      distance,
      offset: 0
    });
    const routeCandidates = routeHitsObstacles(directRoute, obstacles)
      ? [
          directRoute,
          ...createOffsetRoutes({
            start: connection.source,
            end: connection.target,
            direction,
            distance
          })
        ]
      : [directRoute];

    for (const route of routeCandidates) {
      const routeScore =
        getRouteScore(route, obstacles) +
        getConnectionPenalty(connection, naturalConnection) * 0.22 +
        distance * 0.14;

      if (routeScore < bestScore) {
        bestScore = routeScore;
        bestRoute = route;
      }
    }
  }

  return bestRoute ?? buildRoute({
    start: naturalConnection.source,
    end: naturalConnection.target,
    direction: normalizePoint({
      x: naturalConnection.target.x - naturalConnection.source.x,
      y: naturalConnection.target.y - naturalConnection.source.y
    }),
    distance: getPointDistance(naturalConnection.source, naturalConnection.target),
    offset: 0
  });
}

function getFloatingConnectionCandidates(
  source: FloatingNodeRect,
  target: FloatingNodeRect
) {
  const sourceCandidates = getBoundaryCandidates(source, target);
  const targetCandidates = getBoundaryCandidates(target, source);
  const naturalConnection = getFloatingConnection(source, target);
  const candidates: Array<{
    source: FloatingPoint;
    target: FloatingPoint;
  }> = [];

  for (const sourceCandidate of sourceCandidates) {
    for (const targetCandidate of targetCandidates) {
      candidates.push({
        source: sourceCandidate,
        target: targetCandidate
      });
    }
  }

  candidates.push(naturalConnection);

  return dedupeConnections(candidates);
}

function getBoundaryCandidates(
  rect: FloatingNodeRect,
  toward: FloatingNodeRect
) {
  const naturalPoint = getBoundaryPoint(rect, getRectCenter(toward));

  return dedupePoints([naturalPoint, ...getPerimeterSamplePoints(rect)]);
}

function buildDirectRoute(input: { source: FloatingPoint; target: FloatingPoint }) {
  const direction = normalizePoint({
    x: input.target.x - input.source.x,
    y: input.target.y - input.source.y
  });
  const distance = getPointDistance(input.source, input.target);

  return buildRoute({
    start: input.source,
    end: input.target,
    direction,
    distance,
    offset: 0
  });
}

function createOffsetRoutes(input: {
  start: FloatingPoint;
  end: FloatingPoint;
  direction: FloatingPoint;
  distance: number;
}) {
  const perpendicular = { x: -input.direction.y, y: input.direction.x };

  return [96, -96, 144, -144, 206, -206, 276, -276].map((offset) =>
    buildRoute({
      start: input.start,
      end: input.end,
      direction: input.direction,
      distance: input.distance,
      offset,
      perpendicular
    })
  );
}

function getRouteScore(route: ThreePartRoute, obstacles: FloatingNodeRect[]) {
  return (
    (routeHitsObstacles(route, obstacles) ? 100000 : 0) +
    (route.route === "obstacle" ? 600 : 0) +
    getPolylineLength(route.samples) * 0.6 +
    getPointDistance(route.firstEnd, route.secondEnd) * 0.08
  );
}

function getConnectionPenalty(
  connection: { source: FloatingPoint; target: FloatingPoint },
  naturalConnection: { source: FloatingPoint; target: FloatingPoint }
) {
  return (
    getPointDistance(connection.source, naturalConnection.source) +
    getPointDistance(connection.target, naturalConnection.target)
  );
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
  firstControl1: FloatingPoint;
  firstControl2: FloatingPoint;
  firstEnd: FloatingPoint;
  controlPoint1: FloatingPoint;
  controlPoint2: FloatingPoint;
  secondEnd: FloatingPoint;
  finalControl1: FloatingPoint;
  finalControl2: FloatingPoint;
  end: FloatingPoint;
}) {
  const samples: FloatingPoint[] = [];

  for (let index = 0; index <= 14; index += 1) {
    samples.push(
      getCubicPoint(
        input.start,
        input.firstControl1,
        input.firstControl2,
        input.firstEnd,
        index / 14
      )
    );
  }

  for (let index = 1; index <= 22; index += 1) {
    samples.push(
      getCubicPoint(
        input.firstEnd,
        input.controlPoint1,
        input.controlPoint2,
        input.secondEnd,
        index / 22
      )
    );
  }

  for (let index = 1; index <= 14; index += 1) {
    samples.push(
      getCubicPoint(
        input.secondEnd,
        input.finalControl1,
        input.finalControl2,
        input.end,
        index / 14
      )
    );
  }

  return samples;
}

function getLaneChangeTangent(input: {
  direction: FloatingPoint;
  perpendicular: FloatingPoint;
  offset: number;
  distance: number;
  phase: "entry" | "exit";
}) {
  if (input.offset === 0) {
    return input.direction;
  }

  const lateralStrength = clamp(
    Math.abs(input.offset) / Math.max(input.distance, 1),
    0.25,
    0.95
  );
  const sign = Math.sign(input.offset);
  const lateralDirection = input.phase === "entry" ? sign : -sign;

  return normalizePoint({
    x: input.direction.x + input.perpendicular.x * lateralDirection * lateralStrength,
    y: input.direction.y + input.perpendicular.y * lateralDirection * lateralStrength
  });
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

function getPolylineLength(points: FloatingPoint[]) {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += getPointDistance(points[index - 1]!, points[index]!);
  }

  return total;
}

function getPerimeterSamplePoints(rect: FloatingNodeRect) {
  const offsets = [0.2, 0.35, 0.5, 0.65, 0.8];
  const points: FloatingPoint[] = [];

  for (const offset of offsets) {
    points.push(
      { x: rect.x + rect.width * offset, y: rect.y },
      { x: rect.x + rect.width * offset, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height * offset },
      { x: rect.x + rect.width, y: rect.y + rect.height * offset }
    );
  }

  return points;
}

function dedupeConnections(
  connections: Array<{ source: FloatingPoint; target: FloatingPoint }>
) {
  const seen = new Set<string>();

  return connections.filter((connection) => {
    const key = `${formatNumber(connection.source.x)},${formatNumber(connection.source.y)}|${formatNumber(connection.target.x)},${formatNumber(connection.target.y)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupePoints(points: FloatingPoint[]) {
  const seen = new Set<string>();

  return points.filter((point) => {
    const key = `${formatNumber(point.x)},${formatNumber(point.y)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatNumber(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
