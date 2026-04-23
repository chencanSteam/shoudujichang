function prism(shape) {
  const { x, y, width, height, depth, skew } = shape;

  return {
    top: [
      [x, y],
      [x + width, y],
      [x + width + skew, y - depth],
      [x + skew, y - depth],
    ],
    front: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    side: [
      [x + width, y],
      [x + width + skew, y - depth],
      [x + width + skew, y + height - depth],
      [x + width, y + height],
    ],
  };
}

function pointsToString(points) {
  return points.map((point) => point.join(',')).join(' ');
}

function roadTone(level) {
  return {
    high: 'road--high',
    medium: 'road--medium',
    low: 'road--low',
  }[level] ?? 'road--medium';
}

const OVERVIEW_TRANSPORT_LAYERS = [
  {
    id: 'airportBus',
    label: '机场巴士',
    tone: 'bus',
    streams: [
      { roadId: 'airport-loop', count: 2, speed: 1.3, radius: 5.6, offset: 0.15 },
      { roadId: 'dispatch-link', count: 2, speed: 1.2, radius: 5.2, offset: 0.55 },
    ],
  },
  {
    id: 'taxi',
    label: '出租车',
    tone: 'taxi',
    streams: [
      { roadId: 'arrival-lane', count: 3, speed: 1.6, radius: 4.8, offset: 0.12 },
      { roadId: 'dispatch-link', count: 2, speed: 1.45, radius: 4.2, offset: 0.48 },
    ],
  },
  {
    id: 'rideHailing',
    label: '网约车',
    tone: 'ride',
    streams: [
      { roadId: 'arrival-lane', count: 3, speed: 1.5, radius: 4.6, offset: 0.26 },
      { roadId: 'parking-link', count: 2, speed: 1.35, radius: 4.2, offset: 0.64 },
    ],
  },
  {
    id: 'privateCar',
    label: '私家车',
    tone: 'private',
    streams: [
      { roadId: 'departure-lane', count: 4, speed: 1.9, radius: 4.2, offset: 0.08 },
      { roadId: 'airport-loop', count: 3, speed: 1.8, radius: 4, offset: 0.36 },
      { roadId: 'arrival-lane', count: 2, speed: 1.55, radius: 4, offset: 0.72 },
    ],
  },
];

export function renderMapScene({
  mapAssets,
  alerts = [],
  videos = [],
  mode = 'overview',
  focusRegionId,
  activeAlertId,
  activeVideoId,
  emergencyScenario,
  emergencyProgress = 0,
  trafficScenario,
  transportLayers = null,
}) {
  const roadLevels = new Map(
    (trafficScenario?.roadLoads ?? []).map((item) => [item.roadId, item.level]),
  );
  const transportLayerState = normalizeTransportLayers(transportLayers);
  const focusRegion = mapAssets.regions.find((region) => region.id === focusRegionId) ?? null;
  const focusView = focusRegion
    ? buildFocusViewBox(focusRegion, mapAssets.viewport)
    : {
        viewBox: `0 0 ${mapAssets.viewport.width} ${mapAssets.viewport.height}`,
        spotlight: { x: 50, y: 50, rx: 24, ry: 15 },
      };

  return `
    <div
      class="scene-frame ${focusRegion ? 'is-region-focused' : ''}"
      style="--spotlight-x:${focusView.spotlight.x}%; --spotlight-y:${focusView.spotlight.y}%; --spotlight-rx:${focusView.spotlight.rx}%; --spotlight-ry:${focusView.spotlight.ry}%"
    >
      <div class="scene-hud">
        <span class="scene-hud__tag">${sceneTag(mode)}</span>
        <span class="scene-hud__legend">统一底座 / GIS 叠加 / 状态仿真</span>
      </div>
      ${
        mode === 'overview'
          ? `
            <div class="scene-overlay-controls">
              <span class="scene-overlay-controls__label">交通图层</span>
              <div class="layer-strip scene-layer-strip">
                ${OVERVIEW_TRANSPORT_LAYERS.map(
                  (layer) => `
                    <button
                      class="layer-pill ${transportLayerState[layer.id] ? 'is-active' : ''}"
                      type="button"
                      data-transport-layer="${layer.id}"
                      aria-pressed="${transportLayerState[layer.id]}"
                    >
                      <span class="layer-pill__dot layer-pill__dot--${layer.tone}"></span>
                      ${layer.label}
                    </button>
                  `,
                ).join('')}
              </div>
            </div>
          `
          : ''
      }
      <div class="scene-focus-mask"></div>
      <svg
        class="airport-scene airport-scene--${mode}"
        viewBox="${focusView.viewBox}"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="首都机场数字孪生抽象机场总图"
      >
        <defs>
          <linearGradient id="groundGlow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(37, 115, 255, 0.3)" />
            <stop offset="100%" stop-color="rgba(27, 222, 255, 0.06)" />
          </linearGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
            <feMerge>
              <feMergeNode in="blur"></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
        </defs>

        <rect class="scene-bg" x="0" y="0" width="${mapAssets.viewport.width}" height="${mapAssets.viewport.height}"></rect>
        <ellipse class="scene-halo" cx="548" cy="408" rx="438" ry="192"></ellipse>
        <ellipse class="scene-halo scene-halo--secondary" cx="550" cy="520" rx="520" ry="138"></ellipse>

        ${mapAssets.roads
          .map(
            (road) => `
              <g class="road-layer ${roadTone(roadLevels.get(road.id))}">
                <path class="road-layer__shadow" d="${road.path}"></path>
                <path class="road-layer__base" d="${road.path}"></path>
                <path class="road-layer__flow" d="${road.path}"></path>
                <text class="road-layer__label" x="${roadLabelX(road.id)}" y="${roadLabelY(road.id)}">${road.name}</text>
              </g>
            `,
          )
          .join('')}

        ${mapAssets.regions
          .map((region) => {
            const { top, front, side } = prism(region.shape);
            const isFocused = region.id === focusRegionId;

            return `
              <g class="scene-region scene-region--${region.tone} ${isFocused ? 'is-focused' : ''}" data-region-id="${region.id}">
                <polygon class="scene-region__top" points="${pointsToString(top)}"></polygon>
                <polygon class="scene-region__front" points="${pointsToString(front)}"></polygon>
                <polygon class="scene-region__side" points="${pointsToString(side)}"></polygon>
                <text class="scene-region__label" x="${region.label.x}" y="${region.label.y}">${region.name}</text>
              </g>
            `;
          })
          .join('')}

        ${trafficScenario ? renderTrafficFacilities(trafficScenario) : ''}
        ${trafficScenario ? renderTrafficNodes(trafficScenario) : ''}
        ${trafficScenario ? renderTrafficVehicles(trafficScenario, mapAssets) : ''}
        ${mode === 'overview' ? renderOverviewTransportVehicles(mapAssets, transportLayerState) : ''}

        ${videos
          .map(
            (video) => `
              <g
                class="scene-point scene-point--video ${video.id === activeVideoId ? 'is-active' : ''}"
                data-video-id="${video.id}"
                transform="translate(${video.position.x} ${video.position.y})"
              >
                <circle class="scene-point__ring" r="18"></circle>
                <circle class="scene-point__core" r="7"></circle>
                <path class="scene-point__icon" d="M -7 -5 H 5 L 9 -2 V 2 L 5 5 H -7 Z"></path>
              </g>
            `,
          )
          .join('')}

        ${alerts
          .map((alert) => {
            const region = mapAssets.regions.find((item) => item.id === alert.regionId);
            if (!region) {
              return '';
            }

            return `
              <g
                class="scene-point scene-point--alert scene-point--${alert.level} ${alert.id === activeAlertId ? 'is-active' : ''}"
                data-alert-id="${alert.id}"
                transform="translate(${region.label.x + 84} ${region.label.y - 8})"
              >
                <circle class="scene-point__ring" r="18"></circle>
                <circle class="scene-point__core" r="7"></circle>
                <path class="scene-point__icon" d="M 0 -9 L 8 6 H -8 Z"></path>
              </g>
            `;
          })
          .join('')}

        ${
          emergencyScenario
            ? emergencyScenario.routes
                .map(
                  (route) => `
                    <g
                      class="scene-route ${route.stepIndex <= emergencyProgress ? 'is-active' : ''}"
                      data-step-index="${route.stepIndex}"
                    >
                      <path class="scene-route__path" d="${route.path}"></path>
                      <text class="scene-route__label" x="${routeTextX(route.id)}" y="${routeTextY(route.id)}">${route.label}</text>
                    </g>
                  `,
                )
                .join('')
            : ''
        }
      </svg>
    </div>
  `;
}

function renderTrafficNodes(trafficScenario) {
  return (trafficScenario.trafficNodes ?? [])
    .map(
      (node) => `
        <g class="scene-node scene-node--${node.type}" transform="translate(${node.x} ${node.y})">
          <circle r="11"></circle>
          <text x="18" y="-2">${node.label}</text>
          <text class="scene-node__status" x="18" y="14">${node.status}</text>
        </g>
      `,
    )
    .join('');
}

function renderTrafficFacilities(trafficScenario) {
  return (trafficScenario.facilityPoints ?? [])
    .map(
      (point) => `
        <g class="scene-facility scene-facility--${point.state ?? 'idle'}" transform="translate(${point.x} ${point.y})">
          <rect x="-9" y="-9" width="18" height="18" rx="4"></rect>
          <text x="16" y="4">${point.label}</text>
          ${point.status ? `<text class="scene-facility__status" x="16" y="18">${point.status}</text>` : ''}
        </g>
      `,
    )
    .join('');
}

function renderTrafficVehicles(trafficScenario, mapAssets) {
  return (trafficScenario.vehicleStreams ?? [])
    .flatMap((stream) => {
      const road = mapAssets.roads.find((item) => item.id === stream.roadId);
      if (!road) {
        return [];
      }

      return Array.from({ length: stream.count }).map(
        (_, index) => `
          <circle class="scene-vehicle scene-vehicle--${stream.tone ?? 'accent'}" r="${index % 2 === 0 ? 4 : 3.2}">
            <animateMotion
              dur="${Math.max(2.6, 6.5 - (stream.speed ?? 1) * 1.35)}s"
              begin="${index * 0.7}s"
              repeatCount="indefinite"
              path="${road.path}"
            />
          </circle>
        `,
      );
    })
    .join('');
}

function normalizeTransportLayers(transportLayers) {
  return {
    airportBus: transportLayers?.airportBus ?? true,
    taxi: transportLayers?.taxi ?? true,
    rideHailing: transportLayers?.rideHailing ?? true,
    privateCar: transportLayers?.privateCar ?? true,
  };
}

function renderOverviewTransportVehicles(mapAssets, transportLayerState) {
  return OVERVIEW_TRANSPORT_LAYERS.flatMap((layer) => {
    if (!transportLayerState[layer.id]) {
      return [];
    }

    return layer.streams.flatMap((stream) => {
      const road = mapAssets.roads.find((item) => item.id === stream.roadId);
      if (!road) {
        return [];
      }

      return Array.from({ length: stream.count }).map(
        (_, index) => `
          <circle class="scene-vehicle scene-vehicle--overview scene-vehicle--${layer.tone}" r="${stream.radius}">
            <animateMotion
              dur="${Math.max(2.8, 7.8 - stream.speed * 1.55)}s"
              begin="${(stream.offset + index * 0.68).toFixed(2)}s"
              repeatCount="indefinite"
              path="${road.path}"
            />
          </circle>
        `,
      );
    });
  }).join('');
}

function buildFocusViewBox(region, viewport) {
  const { x, y, width, height, depth, skew } = region.shape;
  const zoom = 1.14;
  const focusWidth = viewport.width / zoom;
  const focusHeight = viewport.height / zoom;
  const centerX = x + width / 2 + skew / 2;
  const centerY = y + height / 2 - depth / 3;
  const minX = clamp(centerX - focusWidth / 2, 0, viewport.width - focusWidth);
  const minY = clamp(centerY - focusHeight / 2, 0, viewport.height - focusHeight);

  return {
    viewBox: `${minX.toFixed(2)} ${minY.toFixed(2)} ${focusWidth.toFixed(2)} ${focusHeight.toFixed(2)}`,
    spotlight: {
      x: Number(((centerX / viewport.width) * 100).toFixed(2)),
      y: Number(((centerY / viewport.height) * 100).toFixed(2)),
      rx: 24,
      ry: 15,
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sceneTag(mode) {
  const tags = {
    overview: '监测大厅一张图',
    emergency: '应急事件推演',
    traffic: '公共区交通仿真',
  };

  return tags[mode] ?? '机场数字孪生';
}

function roadLabelX(id) {
  return {
    'airport-loop': 858,
    'departure-lane': 774,
    'arrival-lane': 820,
    'parking-link': 834,
    'dispatch-link': 620,
  }[id] ?? 520;
}

function roadLabelY(id) {
  return {
    'airport-loop': 588,
    'departure-lane': 356,
    'arrival-lane': 440,
    'parking-link': 432,
    'dispatch-link': 560,
  }[id] ?? 540;
}

function routeTextX(id) {
  return {
    'route-a': 332,
    'route-b': 734,
    'route-c': 530,
    'route-d': 842,
    'route-e': 502,
    'route-f': 376,
    'route-g': 706,
  }[id] ?? 520;
}

function routeTextY(id) {
  return {
    'route-a': 456,
    'route-b': 478,
    'route-c': 396,
    'route-d': 410,
    'route-e': 574,
    'route-f': 346,
    'route-g': 418,
  }[id] ?? 420;
}
