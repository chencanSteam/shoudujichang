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
  {
    id: 'patrolPersonnel',
    label: '巡检人员',
    tone: 'patrol-personnel',
  },
  {
    id: 'patrolVehicle',
    label: '巡检车辆',
    tone: 'patrol-vehicle',
    streams: [
      { roadId: 'airport-loop', count: 2, speed: 1.45, radius: 4.8, offset: 0.22 },
      { roadId: 'arrival-lane', count: 1, speed: 1.35, radius: 4.6, offset: 0.58 },
    ],
  },
];

export function renderMapScene({
  mapAssets,
  alerts = [],
  videos = [],
  overviewDevices = [],
  mode = 'overview',
  focusRegionId,
  activeAlertId,
  activeVideoId,
  activeDeviceId,
  activeDevice,
  searchResultOverlay,
  emergencyScenario,
  emergencyProgress = 0,
  trafficScenario,
  transportLayers = null,
  overviewExercise = null,
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
        ${renderSimulatedGisLayer(mapAssets)}

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
        ${mode === 'overview' ? renderOverviewDevices(overviewDevices, activeDeviceId) : ''}
        ${trafficScenario ? renderTrafficNodes(trafficScenario) : ''}
        ${trafficScenario ? renderTrafficVehicles(trafficScenario, mapAssets) : ''}
        ${mode === 'overview' ? renderOverviewTransportVehicles(mapAssets, transportLayerState) : ''}
        ${mode === 'overview' ? renderOverviewPatrolUnits(mapAssets, transportLayerState) : ''}
        ${mode === 'overview' ? renderOverviewExerciseLayer(mapAssets, focusRegion, overviewExercise) : ''}

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
      ${mode === 'overview' ? renderOverviewDevicePopup(activeDevice, mapAssets) : ''}
      ${mode === 'overview' ? renderSearchResultPopup(searchResultOverlay, mapAssets) : ''}
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

function renderOverviewDevices(overviewDevices, activeDeviceId) {
  return (overviewDevices ?? [])
    .map(
      (device) => `
        <g
          class="scene-facility scene-facility--${device.state ?? 'idle'} ${device.id === activeDeviceId ? 'is-active' : ''}"
          data-device-id="${device.id}"
          transform="translate(${device.position.x} ${device.position.y})"
        >
          <rect x="-9" y="-9" width="18" height="18" rx="4"></rect>
          <text x="16" y="4">${device.label}</text>
          <text class="scene-facility__status" x="16" y="18">${device.status}</text>
        </g>
      `,
    )
    .join('');
}

function renderOverviewDevicePopup(activeDevice, mapAssets) {
  if (!activeDevice) {
    return '';
  }

  const left = ((activeDevice.position.x / mapAssets.viewport.width) * 100).toFixed(2);
  const top = ((activeDevice.position.y / mapAssets.viewport.height) * 100).toFixed(2);

  return `
    <div class="scene-device-popup" style="left:${left}%; top:${top}%;">
      <span class="scene-device-popup__kicker">设备状态</span>
      <strong>${activeDevice.label}</strong>
      <p>${activeDevice.code}</p>
      <div class="scene-device-popup__meta">
        <span>状态</span>
        <strong>${activeDevice.status}</strong>
      </div>
    </div>
  `;
}

function renderSearchResultPopup(searchResultOverlay, mapAssets) {
  if (!searchResultOverlay) {
    return '';
  }

  const left = ((searchResultOverlay.position.x / mapAssets.viewport.width) * 100).toFixed(2);
  const top = ((searchResultOverlay.position.y / mapAssets.viewport.height) * 100).toFixed(2);

  return `
    <div class="scene-search-popup" style="left:${left}%; top:${top}%;">
      <span class="scene-search-popup__kicker">${searchResultOverlay.kicker}</span>
      <strong>${searchResultOverlay.title}</strong>
      <p>${searchResultOverlay.subtitle}</p>
      <div class="scene-search-popup__meta">
        <span>${searchResultOverlay.metaLabel}</span>
        <strong>${searchResultOverlay.metaValue}</strong>
      </div>
    </div>
  `;
}

function normalizeTransportLayers(transportLayers) {
  return {
    airportBus: transportLayers?.airportBus ?? true,
    taxi: transportLayers?.taxi ?? true,
    rideHailing: transportLayers?.rideHailing ?? true,
    privateCar: transportLayers?.privateCar ?? true,
    patrolPersonnel: transportLayers?.patrolPersonnel ?? true,
    patrolVehicle: transportLayers?.patrolVehicle ?? true,
  };
}

function renderOverviewTransportVehicles(mapAssets, transportLayerState) {
  return OVERVIEW_TRANSPORT_LAYERS.flatMap((layer) => {
    if (
      layer.id === 'patrolPersonnel' ||
      layer.id === 'patrolVehicle' ||
      !transportLayerState[layer.id]
    ) {
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

function renderOverviewPatrolUnits(mapAssets, transportLayerState) {
  const patrolPersonnelPoints = [
    { id: 'patrol-a', label: 'T3 东侧巡检', x: 522, y: 398 },
    { id: 'patrol-b', label: '到达层巡检', x: 608, y: 446 },
    { id: 'patrol-c', label: 'P2 巡检岗', x: 846, y: 404 },
  ];

  const personnelMarkup = transportLayerState.patrolPersonnel
    ? patrolPersonnelPoints
        .map(
          (point) => `
            <g class="scene-patrol scene-patrol--personnel" transform="translate(${point.x} ${point.y})">
              <circle class="scene-patrol__ring" r="12"></circle>
              <circle class="scene-patrol__core" r="4.5"></circle>
              <text class="scene-patrol__label" x="16" y="4">${point.label}</text>
            </g>
          `,
        )
        .join('')
    : '';

  const patrolVehicleLayer = OVERVIEW_TRANSPORT_LAYERS.find((layer) => layer.id === 'patrolVehicle');
  const vehicleMarkup =
    transportLayerState.patrolVehicle && patrolVehicleLayer
      ? patrolVehicleLayer.streams
          .flatMap((stream) => {
            const road = mapAssets.roads.find((item) => item.id === stream.roadId);
            if (!road) {
              return [];
            }

            return Array.from({ length: stream.count }).map(
              (_, index) => `
                <circle class="scene-vehicle scene-vehicle--overview scene-vehicle--patrol" r="${stream.radius}">
                  <animateMotion
                    dur="${Math.max(3, 8 - stream.speed * 1.4)}s"
                    begin="${(stream.offset + index * 0.9).toFixed(2)}s"
                    repeatCount="indefinite"
                    path="${road.path}"
                  />
                </circle>
              `,
            );
          })
          .join('')
      : '';

  return `${personnelMarkup}${vehicleMarkup}`;
}

function renderSimulatedGisLayer(mapAssets) {
  const { width, height } = mapAssets.viewport;
  const gridStep = 100;
  const verticalLines = [];
  const horizontalLines = [];
  const xLabels = [];
  const yLabels = [];

  for (let x = gridStep; x < width; x += gridStep) {
    verticalLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"></line>`);
    xLabels.push(`<text x="${x + 6}" y="24">X${String(x).padStart(4, '0')}</text>`);
  }

  for (let y = gridStep; y < height; y += gridStep) {
    horizontalLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"></line>`);
    yLabels.push(`<text x="14" y="${y - 6}">Y${String(y).padStart(4, '0')}</text>`);
  }

  const regionBounds = mapAssets.regions
    .map((region) => {
      const { x, y, width: regionWidth, height: regionHeight, depth, skew } = region.shape;
      const boundX = x - 16;
      const boundY = y - depth - 16;
      const boundWidth = regionWidth + skew + 32;
      const boundHeight = regionHeight + depth + 32;

      return `
        <g class="scene-gis__feature" transform="translate(${boundX} ${boundY})">
          <rect width="${boundWidth}" height="${boundHeight}" rx="18"></rect>
          <text x="14" y="18">${region.id}</text>
        </g>
      `;
    })
    .join('');

  return `
    <g class="scene-gis" aria-hidden="true">
      <rect class="scene-gis__frame" x="10" y="10" width="${width - 20}" height="${height - 20}" rx="26"></rect>
      <g class="scene-gis__grid">
        ${verticalLines.join('')}
        ${horizontalLines.join('')}
      </g>
      <g class="scene-gis__coords scene-gis__coords--x">
        ${xLabels.join('')}
      </g>
      <g class="scene-gis__coords scene-gis__coords--y">
        ${yLabels.join('')}
      </g>
      <g class="scene-gis__features">
        ${regionBounds}
      </g>
      <g class="scene-gis__north" transform="translate(${width - 72} 70)">
        <circle r="22"></circle>
        <path d="M 0 -14 L 8 8 L 0 4 L -8 8 Z"></path>
        <text x="0" y="34">N</text>
      </g>
      <g class="scene-gis__corner-labels">
        <text x="36" y="${height - 26}">GIS OVERLAY / VECTOR REFERENCE</text>
        <text x="${width - 208}" y="${height - 26}">CAPITAL AIRPORT PUBLIC ZONE</text>
      </g>
    </g>
  `;
}

function renderOverviewExerciseLayer(mapAssets, focusRegion, overviewExercise) {
  if (!overviewExercise) {
    return '';
  }

  const commandCenter = mapAssets.regions.find((item) => item.id === 'command-center');
  const focusPoint = focusRegion?.label ?? { x: 540, y: 420 };
  const commandPoint = commandCenter?.label ?? { x: 582, y: 110 };
  const vehicleOrigin = { x: 168, y: 328 };
  const responsePoint = { x: focusPoint.x - 26, y: focusPoint.y + 14 };
  const vehiclePoint = { x: focusPoint.x + 22, y: focusPoint.y + 30 };
  const triggerPoint = { x: focusPoint.x + 92, y: focusPoint.y - 12 };
  const stepIndex = overviewExercise.stepIndex ?? 0;
  const roleConfig = overviewExercise.roleConfig ?? {};
  const pathConfig = overviewExercise.pathConfig ?? {};
  const personnelLabel = `${roleConfig.personnelCount ?? 0} 名巡检人员`;
  const vehicleLabel = `${roleConfig.vehicleCount ?? 0} 辆巡检车辆`;
  const personnelPathLabel = shortenExerciseLabel(pathConfig.personnelPath ?? '步巡路径待生成');
  const vehiclePathLabel = shortenExerciseLabel(pathConfig.vehiclePath ?? '车巡路径待生成');

  const personnelPath = `M ${commandPoint.x} ${commandPoint.y} C ${commandPoint.x - 18} ${commandPoint.y + 120}, ${responsePoint.x - 48} ${responsePoint.y - 82}, ${responsePoint.x} ${responsePoint.y}`;
  const vehiclePath = `M ${vehicleOrigin.x} ${vehicleOrigin.y} C ${vehicleOrigin.x + 140} ${vehicleOrigin.y + 56}, ${vehiclePoint.x - 96} ${vehiclePoint.y + 14}, ${vehiclePoint.x} ${vehiclePoint.y}`;

  return `
    <g class="scene-exercise">
      <g class="scene-event ${stepIndex >= 0 ? 'is-active' : ''}" transform="translate(${triggerPoint.x} ${triggerPoint.y})">
        <circle class="scene-event__ring" r="20"></circle>
        <circle class="scene-event__core" r="8"></circle>
        <text class="scene-event__label" x="24" y="4">事件触发</text>
      </g>

      ${
        stepIndex >= 1
          ? `
            <g class="scene-role scene-role--personnel" transform="translate(${commandPoint.x} ${commandPoint.y + 18})">
              <circle class="scene-role__core" r="8"></circle>
              <text class="scene-role__label" x="18" y="4">${personnelLabel}</text>
            </g>
            <g class="scene-role scene-role--vehicle" transform="translate(${vehicleOrigin.x} ${vehicleOrigin.y})">
              <rect class="scene-role__vehicle" x="-9" y="-6" width="18" height="12" rx="4"></rect>
              <text class="scene-role__label" x="18" y="4">${vehicleLabel}</text>
            </g>
          `
          : ''
      }

      ${
        stepIndex >= 2
          ? `
            <g class="scene-route scene-route--exercise is-active">
              <path class="scene-route__path" d="${personnelPath}"></path>
            </g>
            <g class="scene-route scene-route--exercise is-active">
              <path class="scene-route__path" d="${vehiclePath}"></path>
            </g>
            <text class="scene-route__label" x="${responsePoint.x - 78}" y="${responsePoint.y - 18}">${personnelPathLabel}</text>
            <text class="scene-route__label" x="${vehiclePoint.x - 36}" y="${vehiclePoint.y + 34}">${vehiclePathLabel}</text>
            <circle class="scene-vehicle scene-vehicle--overview scene-vehicle--patrol" r="5.2">
              <animateMotion dur="3.8s" repeatCount="indefinite" path="${vehiclePath}" />
            </circle>
            <circle class="scene-patrol__core" r="4.6">
              <animateMotion dur="4.4s" repeatCount="indefinite" path="${personnelPath}" />
            </circle>
          `
          : ''
      }

      ${
        stepIndex >= 3
          ? `
            <g class="scene-status-banner" transform="translate(${focusPoint.x - 48} ${focusPoint.y - 54})">
              <rect width="146" height="30" rx="15"></rect>
              <text x="73" y="20">状态变化 / 处置中</text>
            </g>
          `
          : ''
      }

      ${
        stepIndex >= 4
          ? `
            <g class="scene-result-card" transform="translate(${focusPoint.x + 78} ${focusPoint.y + 40})">
              <rect width="190" height="68" rx="18"></rect>
              <text x="18" y="24">结果回显</text>
              <text class="scene-result-card__detail" x="18" y="46">${personnelLabel} / ${vehicleLabel}</text>
            </g>
          `
          : ''
      }
    </g>
  `;
}

function shortenExerciseLabel(label) {
  const text = String(label ?? '').trim();
  if (text.length <= 18) {
    return text;
  }

  return `${text.slice(0, 18)}…`;
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
