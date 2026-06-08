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
  emergencyPlan,
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
  const baseImageHref = mapAssets.baseImage ?? '/assets/airport-model-bg.png';
  const usePhotoCanvas = mode === 'overview' && Boolean(baseImageHref);
  const photoViewHeight = Math.round(mapAssets.viewport.height * 0.87);
  const focusView = usePhotoCanvas
    ? {
        viewBox: `0 0 ${mapAssets.viewport.width} ${photoViewHeight}`,
        spotlight: { x: 50, y: 50, rx: 24, ry: 15 },
      }
    : focusRegion
    ? buildFocusViewBox(focusRegion, mapAssets.viewport)
    : {
        viewBox: `0 0 ${mapAssets.viewport.width} ${mapAssets.viewport.height}`,
        spotlight: { x: 50, y: 50, rx: 24, ry: 15 },
      };
  const isEmergencyExercise = mode === 'emergency' && Boolean(emergencyPlan);
  const activeEmergencyStep = isEmergencyExercise
    ? emergencyPlan.steps?.[emergencyProgress] ?? emergencyPlan.steps?.[0]
    : null;

  return `
    <div
      class="scene-frame scene-frame--photo-base ${focusRegion ? 'is-region-focused' : ''} ${isEmergencyExercise ? 'scene-frame--reference-exercise' : ''}"
      style="--spotlight-x:${focusView.spotlight.x}%; --spotlight-y:${focusView.spotlight.y}%; --spotlight-rx:${focusView.spotlight.rx}%; --spotlight-ry:${focusView.spotlight.ry}%"
    >
      <div class="scene-hud">
        <span class="scene-hud__tag">${sceneTag(mode)}</span>
        <span class="scene-hud__legend">统一底座 / GIS 叠加 / 状态仿真</span>
      </div>
      ${isEmergencyExercise ? renderEmergencyExerciseHud(emergencyPlan, activeEmergencyStep, emergencyProgress) : ''}
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
        preserveAspectRatio="xMidYMid slice"
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
        <image
          class="scene-bg-image"
          href="${baseImageHref}"
          x="0"
          y="0"
          width="${mapAssets.viewport.width}"
          height="${mapAssets.viewport.height}"
          preserveAspectRatio="xMidYMid slice"
        ></image>
        <rect class="scene-base-shade" x="0" y="0" width="${mapAssets.viewport.width}" height="${mapAssets.viewport.height}"></rect>
        ${isEmergencyExercise ? renderAerialExerciseTexture(mapAssets.viewport) : ''}
        <ellipse class="scene-halo" cx="548" cy="408" rx="438" ry="192"></ellipse>
        <ellipse class="scene-halo scene-halo--secondary" cx="550" cy="520" rx="520" ry="138"></ellipse>
        <g class="scene-semantic-layer">
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
              const isFocused = region.id === focusRegionId;
              const photoArea = region.photoArea ?? null;

              if (photoArea) {
                return `
                  <g class="scene-region scene-region--photo scene-region--${region.tone} ${isFocused ? 'is-focused' : ''}" data-region-id="${region.id}">
                    <polygon class="scene-region__photo-hit" points="${pointsToString(photoArea)}"></polygon>
                    <text class="scene-region__label" x="${region.label.x}" y="${region.label.y}">${region.name}</text>
                  </g>
                `;
              }

              const { top, front, side } = prism(region.shape);

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
        </g>

        ${trafficScenario ? renderTrafficFacilities(trafficScenario) : ''}
        ${mode === 'overview' ? renderOverviewDevices(overviewDevices, activeDeviceId) : ''}
        ${mode === 'overview' ? renderWaitingHallHotspot() : ''}
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
          emergencyPlan
            ? renderEmergencyPlanLayer(mapAssets, focusRegion, emergencyPlan, emergencyProgress)
            : emergencyScenario
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

function renderWaitingHallHotspot() {
  return `
    <g class="scene-building-link scene-building-link--waiting-hall" data-open-indoor-map="waiting-hall" role="button" tabindex="0" aria-label="查看候机厅室内图">
      <polygon class="scene-building-link__area" points="492,332 648,332 672,354 654,374 474,370 456,348"></polygon>
      <text class="scene-building-link__label" x="565" y="326">候机厅</text>
    </g>
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

function renderEmergencyExerciseHud(plan, step, progress) {
  const stepIndex = progress + 1;
  const totalSteps = plan.steps?.length ?? 1;
  const rows = [
    ...(step?.personnelTasks ?? []).map((task) => emergencyHudTaskRow('人员', task.role, task.count, '人')),
    ...(step?.vehicleTasks ?? []).map((task) => emergencyHudTaskRow('车辆', task.type, task.count, '辆')),
    ...(step?.materialTasks ?? []).map((task) => emergencyHudTaskRow('物资', task.type, task.count, '套')),
  ].slice(0, 6);

  return `
    <div class="scene-reference-title">
      <span>应急仿真演练</span>
      <strong>${escapeHtml(step?.label ?? plan.name ?? '预案执行')}</strong>
    </div>
    <div class="scene-reference-panel">
      <div class="scene-reference-panel__head">
        <span>STEP ${String(stepIndex).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}</span>
        <strong>${escapeHtml(plan.name ?? '本地预案')}</strong>
      </div>
      <p>${escapeHtml(step?.detail ?? '当前步骤任务正在执行。')}</p>
      <div class="scene-reference-panel__list">
        ${
          rows.length
            ? rows.join('')
            : '<span class="scene-reference-empty">当前步骤暂无资源任务。</span>'
        }
      </div>
    </div>
  `;
}

function emergencyHudTaskRow(type, name, count, unit) {
  return `
    <span class="scene-reference-row">
      <b>${escapeHtml(type)}</b>
      <em>${escapeHtml(name ?? '任务')}</em>
      <strong>${Number(count) || 0}${unit}</strong>
    </span>
  `;
}

function renderAerialExerciseTexture(viewport) {
  return `
    <g class="scene-aerial-texture" aria-hidden="true">
      <rect x="0" y="0" width="${viewport.width}" height="${viewport.height}"></rect>
      <path class="scene-aerial-texture__forest" d="M 0 98 C 138 42 236 78 318 34 C 442 -32 586 88 706 46 C 842 0 958 34 1100 10 V 0 H 0 Z"></path>
      <path class="scene-aerial-texture__forest scene-aerial-texture__forest--right" d="M 788 118 C 878 92 968 126 1100 84 V 640 H 794 C 740 520 736 302 788 118 Z"></path>
      <path class="scene-aerial-texture__field" d="M 60 420 C 162 356 260 382 360 344 C 480 298 592 332 722 282 C 828 242 944 266 1100 224 V 640 H 0 V 492 C 22 466 38 438 60 420 Z"></path>
      <path class="scene-aerial-texture__service-road" d="M 30 536 C 202 480 340 458 520 408 C 684 362 814 292 1058 246"></path>
      <path class="scene-aerial-texture__service-road scene-aerial-texture__service-road--secondary" d="M 118 126 C 252 214 382 242 520 316 C 642 382 780 456 1026 508"></path>
    </g>
  `;
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
          <g class="scene-vehicle scene-vehicle--moving scene-vehicle--${stream.tone ?? 'accent'}">
            <animateMotion
              dur="${slowVehicleDuration(stream.speed, 18, 3.2)}s"
              begin="${index * 2.1}s"
              repeatCount="indefinite"
              path="${roadMotionPath(road)}"
              rotate="auto"
            />
            ${renderVehicleIcon(stream.tone ?? 'accent', index % 2 === 0 ? 0.74 : 0.68)}
          </g>
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
          <g class="scene-vehicle scene-vehicle--moving scene-vehicle--overview scene-vehicle--${layer.tone}">
            <animateMotion
              dur="${slowVehicleDuration(stream.speed, 20, 3.6)}s"
              begin="${(stream.offset * 8 + index * 2.4).toFixed(2)}s"
              repeatCount="indefinite"
              path="${roadMotionPath(road)}"
              rotate="auto"
            />
            ${renderVehicleIcon(layer.tone, Math.max(0.68, stream.radius / 6.8))}
          </g>
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
              ${renderPersonnelIcon()}
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
                <g class="scene-vehicle scene-vehicle--moving scene-vehicle--overview scene-vehicle--patrol">
                  <animateMotion
                    dur="${slowVehicleDuration(stream.speed, 22, 3.8)}s"
                    begin="${(stream.offset * 8 + index * 2.8).toFixed(2)}s"
                    repeatCount="indefinite"
                    path="${roadMotionPath(road)}"
                    rotate="auto"
                  />
                  ${renderVehicleIcon('patrol', Math.max(0.7, stream.radius / 6.8))}
                </g>
              `,
            );
          })
          .join('')
      : '';

  return `${personnelMarkup}${vehicleMarkup}`;
}

function roadMotionPath(road) {
  return road.photoPath ?? road.path;
}

function slowVehicleDuration(speed = 1, base = 18, factor = 3.2) {
  return Math.max(12, base - speed * factor).toFixed(1);
}

function renderVehicleIcon(tone, scale = 1) {
  const normalizedTone = {
    bus: 'bus',
    taxi: 'taxi',
    ride: 'ride',
    private: 'private',
    patrol: 'patrol',
    hot: 'hot',
    warm: 'taxi',
    cool: 'ride',
    accent: 'private',
  }[tone] ?? 'private';

  const icons = {
    bus: `
      <g class="scene-vehicle-icon scene-vehicle-icon--bus" transform="scale(${scale})">
        <image class="scene-vehicle-icon__image" href="/image/巴士.png" x="-18" y="-18" width="36" height="36"></image>
      </g>
    `,
    taxi: `
      <g class="scene-vehicle-icon scene-vehicle-icon--taxi" transform="scale(${scale})">
        <image class="scene-vehicle-icon__image" href="/image/出租车.png" x="-17" y="-17" width="34" height="34"></image>
      </g>
    `,
    ride: `
      <g class="scene-vehicle-icon scene-vehicle-icon--ride" transform="scale(${scale})">
        <path class="scene-vehicle-icon__body" d="M -12 4 L -9 -3 L -3 -7 H 5 L 10 -3 L 13 4 Z"></path>
        <path class="scene-vehicle-icon__pin" d="M 0 -15 C 4 -15 7 -12 7 -8 C 7 -3 0 2 0 2 C 0 2 -7 -3 -7 -8 C -7 -12 -4 -15 0 -15 Z"></path>
        <circle class="scene-vehicle-icon__pin-core" cx="0" cy="-8" r="2"></circle>
        <circle class="scene-vehicle-icon__wheel" cx="-7" cy="5" r="2"></circle>
        <circle class="scene-vehicle-icon__wheel" cx="8" cy="5" r="2"></circle>
      </g>
    `,
    private: `
      <g class="scene-vehicle-icon scene-vehicle-icon--private" transform="scale(${scale})">
        <image class="scene-vehicle-icon__image" href="/image/私家车.png" x="-17" y="-17" width="34" height="34"></image>
      </g>
    `,
    patrol: `
      <g class="scene-vehicle-icon scene-vehicle-icon--patrol" transform="scale(${scale})">
        <rect class="scene-vehicle-icon__body" x="-12" y="-6" width="24" height="12" rx="4"></rect>
        <rect class="scene-vehicle-icon__window" x="-6" y="-4" width="10" height="4" rx="1"></rect>
        <circle class="scene-vehicle-icon__beacon" cx="8" cy="-8" r="2.4"></circle>
        <circle class="scene-vehicle-icon__wheel" cx="-7" cy="6" r="2"></circle>
        <circle class="scene-vehicle-icon__wheel" cx="8" cy="6" r="2"></circle>
      </g>
    `,
    hot: `
      <g class="scene-vehicle-icon scene-vehicle-icon--hot" transform="scale(${scale})">
        <path class="scene-vehicle-icon__body" d="M -12 4 L -8 -4 L -2 -8 H 5 L 11 -2 L 13 4 Z"></path>
        <path class="scene-vehicle-icon__window" d="M -5 -4 L -2 -7 H 4 L 8 -4 Z"></path>
        <circle class="scene-vehicle-icon__wheel" cx="-7" cy="5" r="2"></circle>
        <circle class="scene-vehicle-icon__wheel" cx="8" cy="5" r="2"></circle>
      </g>
    `,
  };

  return icons[normalizedTone];
}

function renderPersonnelIcon() {
  return `
    <g class="scene-person-icon">
      <image class="scene-person-icon__image" href="/image/巡检人员.png" x="-11" y="-11" width="22" height="22"></image>
    </g>
  `;
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

function renderEmergencyPlanLayer(mapAssets, focusRegion, emergencyPlan, progress) {
  const focusPoint = focusRegion?.label ?? { x: 540, y: 420 };
  const triggerPoint = { x: focusPoint.x + 90, y: focusPoint.y - 16 };
  const activeStep = emergencyPlan.steps?.[progress] ?? emergencyPlan.steps?.[0];
  const phase = progress % 4;
  const phaseMeta = emergencyPhaseMeta(phase, activeStep);

  if (!activeStep) {
    return '';
  }

  const personnelMarkup = renderEmergencyPlanTasks({
    mapAssets,
    tasks: activeStep.personnelTasks ?? [],
    taskType: 'personnel',
    progress,
  });
  const materialMarkup = renderEmergencyPlanTasks({
    mapAssets,
    tasks: activeStep.materialTasks ?? [],
    taskType: 'material',
    progress,
  });
  const vehicleMarkup = renderEmergencyPlanTasks({
    mapAssets,
    tasks: activeStep.vehicleTasks ?? [],
    taskType: 'vehicle',
    progress,
  });

  return `
    <g class="scene-exercise scene-emergency-plan scene-emergency-plan--phase-${phase}">
      ${renderEmergencyPhaseEffect(focusPoint, triggerPoint, phase, activeStep)}
      <g class="scene-event is-active" transform="translate(${triggerPoint.x} ${triggerPoint.y})">
        <circle class="scene-event__ring" r="20"></circle>
        <circle class="scene-event__core" r="8"></circle>
        <text class="scene-event__label" x="24" y="4">${phaseMeta.eventLabel}</text>
      </g>

      ${personnelMarkup.start}
      ${materialMarkup.start}
      ${vehicleMarkup.start}
      ${personnelMarkup.routes}
      ${materialMarkup.routes}
      ${vehicleMarkup.routes}

      <g class="scene-status-banner" transform="translate(${focusPoint.x - 72} ${focusPoint.y - 58})">
        <rect width="178" height="30" rx="15"></rect>
        <text x="89" y="20">${phaseMeta.status}</text>
      </g>
      <g class="scene-result-card" transform="translate(${focusPoint.x + 72} ${focusPoint.y + 42})">
        <rect width="212" height="72" rx="18"></rect>
        <text x="18" y="24">${phaseMeta.cardTitle}</text>
        <text class="scene-result-card__detail" x="18" y="48">${escapeSvgText(phaseMeta.cardDetail)}</text>
      </g>
    </g>
  `;
}

function emergencyPhaseMeta(phase, step) {
  const summary = summarizeEmergencyStep(step);
  return [
    {
      eventLabel: '事件识别',
      status: '风险扫描 / 锁定中',
      cardTitle: '事件点锁定',
      cardDetail: step?.label ?? '预案触发',
    },
    {
      eventLabel: '资源集结',
      status: '资源编组 / 待发',
      cardTitle: '资源编组',
      cardDetail: summary,
    },
    {
      eventLabel: '路线执行',
      status: '路线推进 / 执行中',
      cardTitle: '多路推进',
      cardDetail: summary,
    },
    {
      eventLabel: '到位处置',
      status: '到位确认 / 闭环中',
      cardTitle: '处置回显',
      cardDetail: summary,
    },
  ][phase] ?? {
    eventLabel: '预案触发',
    status: '当前步骤 / 演练中',
    cardTitle: '本步任务',
    cardDetail: summary,
  };
}

function renderEmergencyPhaseEffect(focusPoint, triggerPoint, phase, step) {
  if (phase === 0) {
    return `
      <g class="scene-phase-effect scene-phase-effect--scan">
        <path d="M ${triggerPoint.x} ${triggerPoint.y} L ${focusPoint.x + 156} ${focusPoint.y - 88} L ${focusPoint.x + 86} ${focusPoint.y + 96} Z"></path>
        <circle cx="${triggerPoint.x}" cy="${triggerPoint.y}" r="32"></circle>
        <circle cx="${triggerPoint.x}" cy="${triggerPoint.y}" r="54"></circle>
        <circle cx="${focusPoint.x}" cy="${focusPoint.y}" r="26"></circle>
        <text x="${triggerPoint.x + 34}" y="${triggerPoint.y - 22}">风险识别</text>
      </g>
    `;
  }

  if (phase === 1) {
    return `
      <g class="scene-phase-effect scene-phase-effect--staging" transform="translate(${focusPoint.x - 126} ${focusPoint.y - 94})">
        <rect width="142" height="78" rx="10"></rect>
        <text x="14" y="22">资源集结</text>
        <line x1="14" y1="36" x2="118" y2="36"></line>
        <line x1="14" y1="52" x2="96" y2="52"></line>
        <line x1="14" y1="68" x2="112" y2="68"></line>
        <circle cx="124" cy="36" r="4"></circle>
        <circle cx="104" cy="52" r="4"></circle>
        <circle cx="120" cy="68" r="4"></circle>
      </g>
    `;
  }

  if (phase === 2) {
    return `
      <g class="scene-phase-effect scene-phase-effect--execution" transform="translate(${focusPoint.x - 14} ${focusPoint.y - 16})">
        <circle r="38"></circle>
        <path d="M -54 0 H 58"></path>
        <path d="M 36 -14 L 58 0 L 36 14"></path>
        <text x="-42" y="-48">路线推进</text>
      </g>
    `;
  }

  return `
    <g class="scene-phase-effect scene-phase-effect--closure" transform="translate(${focusPoint.x - 84} ${focusPoint.y - 102})">
      <rect width="168" height="92" rx="14"></rect>
      <path d="M 30 48 L 66 70 L 130 28"></path>
      <text x="28" y="26">到位处置</text>
      <text x="28" y="82">${escapeSvgText(summarizeEmergencyStep(step))}</text>
    </g>
  `;
}

function renderEmergencyPlanTasks({ mapAssets, tasks, taskType }) {
  const start = tasks
    .map((task, index) => {
      const point = offsetPoint(resolveRegionPoint(mapAssets, task.fromRegionId), index, taskType);
      const label = taskLabel(task, taskType);
      const timing = taskMotionTiming(taskType, index);

      if (taskType === 'vehicle') {
        return `
          <g class="scene-role scene-role--vehicle scene-plan-origin scene-plan-origin--vehicle" style="--task-delay: ${timing.delay}s" transform="translate(${point.x} ${point.y})">
            <rect class="scene-role__vehicle" x="-9" y="-6" width="18" height="12" rx="4"></rect>
            <text class="scene-role__label" x="18" y="4">${label}</text>
          </g>
        `;
      }

      if (taskType === 'material') {
        return `
          <g class="scene-material scene-plan-origin scene-plan-origin--material" style="--task-delay: ${timing.delay}s" transform="translate(${point.x} ${point.y})">
            <rect x="-10" y="-10" width="20" height="20" rx="5"></rect>
            <text x="18" y="4">${label}</text>
          </g>
        `;
      }

      return `
        <g class="scene-role scene-role--personnel scene-plan-origin scene-plan-origin--personnel" style="--task-delay: ${timing.delay}s" transform="translate(${point.x} ${point.y})">
          <circle class="scene-role__core" r="8"></circle>
          <text class="scene-role__label" x="18" y="4">${label}</text>
        </g>
      `;
    })
    .join('');

  const routes = tasks
    .map((task, index) => {
      const route = buildRegionRoutePath(
        mapAssets,
        { fromRegionId: task.fromRegionId, toRegionId: task.toRegionId },
        routeOffset(index, taskType),
      );
      const end = offsetPoint(resolveRegionPoint(mapAssets, task.toRegionId), index, taskType);
      const label = taskLabel(task, taskType);
      const timing = taskMotionTiming(taskType, index);
      const runner = taskRunnerMarkup(taskType, route, timing);
      const target = taskTargetMarkup(taskType, end, label);
      const arrival = taskArrivalMarkup(taskType, end, timing);

      return `
        <g
          class="scene-route scene-route--exercise scene-route--${taskType} scene-plan-route is-active"
          style="--task-delay: ${timing.delay}s; --route-dur: ${timing.duration}s"
        >
          <path class="scene-route__path scene-plan-route__corridor" d="${route}"></path>
          <path class="scene-route__path scene-plan-route__draw" pathLength="1" d="${route}"></path>
          <path class="scene-route__path scene-plan-route__flow" d="${route}"></path>
        </g>
        ${target}
        ${arrival}
        <text class="scene-route__label scene-plan-route__label" x="${end.x + 18}" y="${end.y + 34}">${shortenExerciseLabel(label)}</text>
        ${runner}
      `;
    })
    .join('');

  return { start, routes };
}

function taskLabel(task, taskType) {
  const unit = taskType === 'personnel' ? '人' : taskType === 'vehicle' ? '辆' : '套';
  const name = taskType === 'personnel' ? task.role : task.type;
  return escapeSvgText(`${name ?? '任务'} ${task.count ?? 0}${unit}`);
}

function taskRunnerMarkup(taskType, route, timing) {
  if (taskType === 'vehicle') {
    return `
      <g class="scene-plan-runner scene-plan-runner--vehicle" style="--runner-begin: ${timing.runnerBegin}s">
        <animateMotion dur="${timing.duration}s" begin="${timing.runnerBegin}s" repeatCount="1" fill="freeze" path="${route}" />
        <rect class="scene-plan-runner__shadow" x="-10" y="4" width="20" height="5" rx="3"></rect>
        <rect class="scene-vehicle scene-vehicle--overview scene-vehicle--patrol" x="-8" y="-5" width="16" height="10" rx="4"></rect>
      </g>
    `;
  }

  if (taskType === 'material') {
    return `
      <g class="scene-plan-runner scene-plan-runner--material" style="--runner-begin: ${timing.runnerBegin}s">
        <animateMotion dur="${timing.duration}s" begin="${timing.runnerBegin}s" repeatCount="1" fill="freeze" path="${route}" />
        <rect class="scene-plan-runner__shadow" x="-7" y="5" width="14" height="4" rx="2"></rect>
        <rect class="scene-material-runner" x="-5" y="-5" width="10" height="10" rx="3"></rect>
      </g>
    `;
  }

  return `
    <g class="scene-plan-runner scene-plan-runner--personnel" style="--runner-begin: ${timing.runnerBegin}s">
      <animateMotion dur="${timing.duration}s" begin="${timing.runnerBegin}s" repeatCount="1" fill="freeze" path="${route}" />
      <ellipse class="scene-plan-runner__shadow" cx="0" cy="6" rx="6" ry="2.4"></ellipse>
      <circle class="scene-plan-person__head" cx="0" cy="-5" r="3.2"></circle>
      <path class="scene-plan-person__body" d="M -4 3 L 0 -1 L 4 3 L 3 7 H -3 Z"></path>
    </g>
  `;
}

function taskTargetMarkup(taskType, point, label) {
  const x = point.x + 8;
  const y = point.y - 18;
  const tone = taskType === 'personnel' ? 'cyan' : taskType === 'vehicle' ? 'green' : 'orange';

  return `
    <g class="scene-plan-target scene-plan-target--${tone}" transform="translate(${x} ${y})">
      <path d="M 0 -14 L 7 -4 V 5 L 0 10 L -7 5 V -4 Z"></path>
      <line x1="7" y1="-4" x2="18" y2="-10"></line>
      <text x="22" y="-8">${shortenExerciseLabel(label)}</text>
    </g>
  `;
}

function taskArrivalMarkup(taskType, point, timing) {
  const x = point.x + 8;
  const y = point.y - 10;

  if (taskType === 'vehicle') {
    return `
      <g class="scene-plan-arrival scene-plan-arrival--vehicle" style="--arrival-delay: ${timing.arrivalDelay}s" transform="translate(${x} ${y})">
        <line x1="-9" y1="0" x2="9" y2="0"></line>
        <circle cx="11" cy="0" r="2.4"></circle>
      </g>
    `;
  }

  if (taskType === 'material') {
    return `
      <g class="scene-plan-arrival scene-plan-arrival--material" style="--arrival-delay: ${timing.arrivalDelay}s" transform="translate(${x} ${y})">
        <rect x="-5" y="-5" width="10" height="10" rx="2"></rect>
      </g>
    `;
  }

  return `
    <g class="scene-plan-arrival scene-plan-arrival--personnel" style="--arrival-delay: ${timing.arrivalDelay}s" transform="translate(${x} ${y})">
      <circle class="scene-plan-arrival__ring" r="9"></circle>
      <circle class="scene-plan-arrival__core" r="3.4"></circle>
    </g>
  `;
}

function taskMotionTiming(taskType, index) {
  const duration = {
    vehicle: 3.2,
    personnel: 3.5,
    material: 3.8,
  }[taskType] ?? 3.5;
  const delay = Number((index * 0.32).toFixed(2));
  const runnerBegin = Number((delay + 0.48).toFixed(2));
  const arrivalDelay = Number((runnerBegin + duration - 0.25).toFixed(2));

  return {
    delay,
    duration,
    runnerBegin,
    arrivalDelay,
  };
}

function summarizeEmergencyStep(step) {
  const personnel = step.personnelTasks?.length ?? 0;
  const material = step.materialTasks?.length ?? 0;
  const vehicle = step.vehicleTasks?.length ?? 0;
  return `人员${personnel}组 / 物资${material}组 / 车辆${vehicle}组`;
}

function offsetPoint(point, index, taskType) {
  const baseOffset = {
    personnel: { x: -12, y: 16 },
    material: { x: 10, y: 34 },
    vehicle: { x: 18, y: 18 },
  }[taskType] ?? { x: 0, y: 0 };

  return {
    x: point.x + baseOffset.x + index * 12,
    y: point.y + baseOffset.y + index * 10,
  };
}

function routeOffset(index, taskType) {
  const base = {
    personnel: -28,
    material: 4,
    vehicle: 34,
  }[taskType] ?? 0;

  return base + index * 16;
}

function buildRegionRoutePath(mapAssets, route, offset = 0) {
  const start = resolveRegionPoint(mapAssets, route?.fromRegionId);
  const end = resolveRegionPoint(mapAssets, route?.toRegionId);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const curve = Math.max(64, Math.abs(end.x - start.x) * 0.18 + Math.abs(end.y - start.y) * 0.12);

  return `M ${start.x} ${start.y} C ${midX - curve} ${midY + offset - curve}, ${midX + curve} ${midY + offset + curve}, ${end.x} ${end.y}`;
}

function resolveRegionPoint(mapAssets, regionId) {
  const region = mapAssets.regions.find((item) => item.id === regionId) ?? mapAssets.regions[0];
  return region?.label ?? { x: 540, y: 420 };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeSvgText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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
