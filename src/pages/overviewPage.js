import { renderMapScene } from '../components/mapScene.js';
import { renderTerminalScene } from '../components/terminalScene.js';
import {
  buildBarChartOption,
  buildLineChartOption,
  mountChart,
  updateChart,
} from '../lib/charts.js';
import {
  formatMetricValue,
  getAlertTone,
  pulseValue,
  shiftSeries,
} from '../lib/format.js';

export function renderOverviewPage({ data, route, state, navigate }) {
  const airportAlert = resolveActiveAlert(data, route, state);
  const airportVideo = resolveActiveVideo(data, route, state, airportAlert);
  const focusRegion = resolveFocusRegion(data, route, state, airportAlert, airportVideo);
  const activeTerminal = resolveActiveTerminal(data, route);
  const activeFloor = resolveActiveFloor(activeTerminal, route);
  const terminalContext =
    activeTerminal && activeFloor ? resolveTerminalContext(activeFloor, route) : null;
  const sceneAlert = terminalContext?.activeAlert ?? airportAlert;
  const searchPool = activeTerminal && activeFloor ? buildTerminalSearchPool(activeFloor) : [];
  const searchPlaceholder = activeTerminal
    ? '搜索楼层分区、视频、资源或处置要点'
    : '搜索区域、视频或预警关键词';
  const sceneMarkup =
    activeTerminal && activeFloor
      ? renderTerminalScene({
          terminal: activeTerminal,
          floor: activeFloor,
          activeZoneId: terminalContext?.activeZone?.id ?? null,
          activeHotspotId: terminalContext?.activeHotspot?.id ?? null,
        })
      : renderMapScene({
          mapAssets: data.mapAssets,
          alerts: data.alerts,
          videos: data.videos,
          mode: 'overview',
          focusRegionId: focusRegion.id,
          activeAlertId: airportAlert.id,
          activeVideoId: airportVideo.id,
          transportLayers: state.ui.overviewTransportLayers,
        });

  state.selection.alertId = airportAlert.id;
  state.selection.videoId = airportVideo.id;
  state.selection.regionId = focusRegion.id;

  const kpis = buildKpis(data.overview.heroMetrics, state.runtime.dataTick);

  return {
    html: `
      <section class="page page--overview">
        <div class="page-grid page-grid--overview">
          <aside class="panel-stack panel-stack--overview panel-stack--overview-left">
            <section class="panel panel--hero reveal">
              <div class="panel-heading">
                <span class="panel-kicker">运行态势</span>
                <h2>机场公共区实时总览</h2>
              </div>
              <div class="metric-grid">
                ${kpis
                  .map(
                    (metric) => `
                      <article class="metric-tile">
                        <span>${metric.label}</span>
                        <strong class="js-kpi-value" data-kpi-id="${metric.id}">${metric.display}${metric.unit}</strong>
                        <small>${metric.delta}</small>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </section>

            <section class="panel reveal js-resource-linkage-panel" style="animation-delay: 70ms;">
              ${renderOverviewAssurancePanel({
                data,
                focusRegion,
                airportAlert,
                airportVideo,
                activeTerminal,
                activeFloor,
              })}
            </section>

            ${
              activeTerminal
                ? `
                  <section class="panel reveal js-terminal-focus-panel" style="animation-delay: 120ms;">
                    <div class="panel-heading">
                      <span class="panel-kicker">楼内焦点</span>
                      <h3>${activeTerminal.name} ${activeFloor.name}</h3>
                    </div>
                    <div class="js-terminal-focus-body">
                      <p class="panel-copy">${activeFloor.subtitle}</p>
                      <div class="focus-summary">
                        <span><strong>${sceneAlert.title}</strong></span>
                        <span class="tone tone--${getAlertTone(sceneAlert.level)}">${sceneAlert.status}</span>
                      </div>
                    </div>
                    <div class="panel-actions">
                      <button class="action-button" type="button" data-jump-emergency="${sceneAlert.scenarioId ?? airportAlert.scenarioId}" data-alert-id="${airportAlert.id}">
                        进入应急推演
                      </button>
                      <button class="action-button action-button--ghost" type="button" data-jump-traffic="${focusRegion.id}">
                        进入交通仿真
                      </button>
                    </div>
                  </section>
                `
                : ''
            }
          </aside>

          <section class="panel panel--map reveal" style="animation-delay: 60ms;">
            <div class="panel-heading panel-heading--map">
              <div>
                <span class="panel-kicker">${activeTerminal ? '楼内钻取' : '一张图总览'}</span>
                <h2>${activeTerminal ? `${activeTerminal.name} 楼内模型` : '监测大厅可视化决策展示'}</h2>
              </div>
              <div class="map-state">
                <span class="dot dot--live"></span>
                ${activeTerminal ? '楼层模型已加载' : '数据驱动同步中'}
              </div>
            </div>
            <div class="js-terminal-scene-slot">${sceneMarkup}</div>
          </section>

          <aside class="panel-stack panel-stack--overview panel-stack--overview-right js-overview-right-rail">
            ${
              activeTerminal && activeFloor
                ? renderBalancedTerminalRightRail(activeFloor, terminalContext)
                : renderBalancedAirportRightRail(data, airportAlert, focusRegion)
            }
          </aside>
        </div>
      </section>
    `,
    setup: (container) =>
      setupOverviewPage({
        container,
        data,
        state,
        airportAlert,
        airportVideo,
        focusRegion,
        activeTerminal,
        activeFloor,
        terminalContext,
        navigate,
      }),
  };
}

function renderResourceLinkagePanel({
  data,
  focusRegion,
  airportAlert,
  airportVideo,
  activeTerminal,
  activeFloor,
  terminalContext,
}) {
  const heading = activeTerminal ? `${activeFloor.name} 资源联动` : '当前事件关联资源';
  const linkage = buildResourceLinkageItems({
    data,
    focusRegion,
    airportAlert,
    airportVideo,
    activeTerminal,
    activeFloor,
    terminalContext,
  });

  return `
    <div class="panel-heading">
      <span class="panel-kicker">资源联动</span>
      <h3>${heading}</h3>
    </div>
    <div class="linkage-list">
      ${linkage.items
        .map(
          (item) => `
            <article class="linkage-card">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
              <small>${item.detail}</small>
            </article>
          `,
        )
        .join('')}
    </div>
    <div class="linkage-tags">
      ${linkage.tags
        .map((tag) => `<span class="resource-chip ${tag.active ? 'is-active' : ''}">${tag.label}</span>`)
        .join('')}
    </div>
  `;
}

function buildResourceLinkageItems({
  data,
  focusRegion,
  airportAlert,
  airportVideo,
  activeTerminal,
  activeFloor,
  terminalContext,
}) {
  if (activeTerminal && activeFloor && terminalContext) {
    const zoneResources = activeFloor.resources.filter(
      (resource) => resource.zoneId === terminalContext.activeZone?.id,
    );
    const primaryResource = zoneResources[0] ?? activeFloor.resources[0];

    return {
      items: [
        {
          label: '联动视频',
          value: terminalContext.activeVideo?.name ?? '楼层联动视频',
          detail: terminalContext.activeVideo?.streamPreview ?? activeFloor.subtitle,
        },
        {
          label: '联动分区',
          value: terminalContext.activeZone?.label ?? activeFloor.name,
          detail: terminalContext.activeZone?.detail ?? terminalContext.activeZone?.status ?? '当前楼层资源联动中',
        },
        {
          label: '建议动作',
          value: primaryResource?.title ?? '资源待调度',
          detail: primaryResource?.detail ?? '可根据当前场景切换资源动作与联动方案。',
        },
      ],
      tags: [
        { label: activeFloor.name, active: true },
        { label: terminalContext.activeAlert?.status ?? '持续监测', active: true },
        { label: primaryResource?.typeLabel ?? '楼层资源', active: false },
      ],
    };
  }

  const linkedVideos = airportAlert.relatedResourceIds
    .map((id) => data.videos.find((item) => item.id === id))
    .filter(Boolean);

  return {
    items: [
      {
        label: '关联视频',
        value: linkedVideos.map((item) => item.name).join(' / ') || airportVideo.name,
        detail: linkedVideos[0]?.streamPreview ?? airportVideo.streamPreview,
      },
      {
        label: '关联区域',
        value: focusRegion.name,
        detail: focusRegion.description,
      },
      {
        label: '建议动作',
        value: airportAlert.suggestion ?? '联动监测大厅资源处置',
        detail: `当前状态：${airportAlert.status}`,
      },
    ],
    tags: [
      { label: airportAlert.status, active: true },
      { label: airportAlert.title, active: false },
      { label: airportVideo.name, active: false },
    ],
  };
}

function renderOverviewAssurancePanel({
  data,
  focusRegion,
  airportAlert,
  airportVideo,
  activeTerminal,
  activeFloor,
}) {
  const overviewSummary = buildOverviewAssuranceItems({
    data,
    focusRegion,
    airportAlert,
    airportVideo,
    activeTerminal,
    activeFloor,
  });

  return `
    <div class="panel-heading">
      <span class="panel-kicker">全局保障态势</span>
      <h3>${overviewSummary.heading}</h3>
    </div>
    <div class="linkage-list">
      ${overviewSummary.items
        .map(
          (item) => `
            <article class="linkage-card">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildOverviewAssuranceItems({
  data,
  focusRegion,
  airportAlert,
  airportVideo,
  activeTerminal,
  activeFloor,
}) {
  const arrivalMetric = data.overview.heroMetrics.find((item) => item.id === 'arrival-passengers');
  const roadMetric = data.overview.heroMetrics.find((item) => item.id === 'road-index');
  const parkingMetric = data.overview.heroMetrics.find((item) => item.id === 'parking-usage');
  const rideMetric = data.overview.heroMetrics.find((item) => item.id === 'ride-demand');
  const activeAlerts = data.alerts.filter((item) => item.status === '处置中');
  const focusedLabel = activeTerminal
    ? `${activeTerminal.name} ${activeFloor?.name ?? ''}`.trim()
    : focusRegion.name;
  const parkingRemaining = parkingMetric ? Math.max(0, 100 - parkingMetric.base) : 0;

  return {
    heading: activeTerminal ? `今日运行与保障总览 / ${focusedLabel}` : '今日运行与保障总览',
    items: [
      {
        label: '到港旅客预测',
        value: arrivalMetric
          ? `${formatMetricValue(arrivalMetric.base, arrivalMetric.digits)}${arrivalMetric.unit}`
          : '--',
        detail: '结合航班计划与楼前接驳压力，滚动评估当前到港保障需求。',
      },
      {
        label: '楼前道路指数',
        value: roadMetric ? formatMetricValue(roadMetric.base, roadMetric.digits) : '--',
        detail: '用于衡量航站楼前道路拥堵程度和临边落客压力。',
      },
      {
        label: '停车资源余量',
        value: `${formatMetricValue(parkingRemaining, 0)}%`,
        detail: '依据当前停车场饱和度倒算可用余量，辅助判断临时分流空间。',
      },
      {
        label: '网约车候客压力',
        value: rideMetric ? `${formatMetricValue(rideMetric.base, rideMetric.digits)}${rideMetric.unit}` : '--',
        detail: '联动候客密度与上客效率，快速判断接驳承压水平。',
      },
      {
        label: '处置中预警',
        value: `${activeAlerts.length} 条`,
        detail: `重点关注：${focusedLabel}，最新关联事件为“${airportAlert.title}”。`,
      },
      {
        label: '当前联动视频',
        value: airportVideo.name,
        detail: airportVideo.streamPreview,
      },
    ],
    tags: [
      { label: data.overview.systemStatus?.label ?? '运行正常', active: true },
      { label: `重点区域：${focusedLabel}`, active: false },
      { label: `预警总数：${data.alerts.length}`, active: false },
    ],
  };
}

function renderAreaLoadPanel(data, focusRegion) {
  const regionOrder = ['arrival-curb', 'taxi-pool', 'ride-hailing', 'parking-p2', 'bus-hub'];

  return `
    <section class="panel reveal" style="animation-delay: 180ms;">
      <div class="panel-heading">
        <span class="panel-kicker">重点区域</span>
        <h3>区域负荷总览</h3>
      </div>
      <div class="status-list">
        ${data.overview.areaLoad
          .map((item, index) => {
            const regionId = regionOrder[index] ?? focusRegion.id;
            const region = data.mapAssets.regions.find((entry) => entry.id === regionId);
            const isActive = regionId === focusRegion.id;

            return `
              <button
                class="status-card ${isActive ? 'is-active' : ''}"
                type="button"
                data-region-id="${regionId}"
              >
                <div class="status-card__row">
                  <span>${item.name}</span>
                  <strong>${item.value}%</strong>
                </div>
              </button>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderTerminalZoneLoadPanel(activeFloor, terminalContext) {
  return `
    <section class="panel reveal" style="animation-delay: 180ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层分区</span>
        <h3>${activeFloor.name} 重点分区负荷</h3>
      </div>
      <div class="status-list">
        ${activeFloor.zones
          .map((zone) => {
            const linkedAlertCount = activeFloor.alerts.filter((item) => item.zoneId === zone.id).length;
            const isActive = zone.id === terminalContext.activeZone?.id;

            return `
              <button
                class="status-card ${isActive ? 'is-active' : ''}"
                type="button"
                data-terminal-zone-link="${zone.id}"
              >
                <div class="status-card__row">
                  <span>${zone.label}</span>
                  <strong>${zone.status}</strong>
                </div>
                <small>关联事件 ${linkedAlertCount} 条，${zone.detail}</small>
              </button>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderAirportRightRail(data, activeAlert, activeVideo, searchPool, searchPlaceholder) {
  return `
    <section class="panel reveal" style="animation-delay: 100ms;">
      <div class="panel-heading">
        <span class="panel-kicker">预警中心</span>
        <h3>活动预警</h3>
      </div>
      <div class="alert-list">
        ${data.alerts
          .map(
            (alert) => `
              <button
                class="alert-item ${alert.id === activeAlert.id ? 'is-active' : ''}"
                type="button"
                data-select-alert="${alert.id}"
                data-select-alert-scope="airport"
              >
                <span class="tone tone--${getAlertTone(alert.level)}">${alert.time}</span>
                <strong>${alert.title}</strong>
                <small>${alert.summary}</small>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 140ms;">
      <div class="panel-heading">
        <span class="panel-kicker">视频资源</span>
        <h3>${activeVideo.name}</h3>
      </div>
      <div class="video-preview">
        <div class="video-preview__noise"></div>
        <div class="video-preview__hud">
          <span>实时画面</span>
          <strong>${activeVideo.streamPreview}</strong>
        </div>
      </div>
      <div class="video-list">
        ${data.videos
          .map(
            (video) => `
              <button
                class="resource-chip ${video.id === activeVideo.id ? 'is-active' : ''}"
                type="button"
                data-select-video="${video.id}"
                data-select-video-scope="airport"
              >
                ${video.name}
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 180ms;">
      <div class="panel-heading">
        <span class="panel-kicker">资源综合查询</span>
        <h3>按区域 / 视频 / 预警检索</h3>
      </div>
      <label class="search-box">
        <input class="search-box__input" type="search" placeholder="${searchPlaceholder}" />
      </label>
      <div class="search-results js-search-results">
        ${renderSearchResults(searchPool, '')}
      </div>
    </section>
  `;
}

function renderTerminalRightRail(activeFloor, terminalContext, searchPool, searchPlaceholder) {
  const activeAlert = terminalContext.activeAlert;
  const activeVideo = terminalContext.activeVideo;

  return `
    <section class="panel reveal" style="animation-delay: 100ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层联动</span>
        <h3>${activeFloor.name} 事件与处置</h3>
      </div>
      <div class="alert-list">
        ${activeFloor.alerts
          .map(
            (alert) => `
              <button
                class="alert-item ${alert.id === activeAlert?.id ? 'is-active' : ''}"
                type="button"
                data-select-alert="${alert.id}"
                data-select-alert-scope="terminal"
              >
                <span class="tone tone--${getAlertTone(alert.level)}">${alert.time}</span>
                <strong>${alert.title}</strong>
                <small>${alert.summary}</small>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 140ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层视频</span>
        <h3>${activeVideo?.name ?? '楼层视频联动'}</h3>
      </div>
      <div class="video-preview video-preview--terminal">
        <div class="video-preview__noise"></div>
        <div class="video-preview__hud">
          <span>联动画面</span>
          <strong>${activeVideo?.streamPreview ?? activeFloor.subtitle}</strong>
        </div>
      </div>
      <div class="video-preview__meta">
        <span>${terminalContext.activeZone?.label ?? '未选分区'}</span>
        <strong>${activeAlert?.status ?? '持续监测中'}</strong>
      </div>
      <div class="video-list">
        ${activeFloor.videos
          .map(
            (video) => `
              <button
                class="resource-chip ${video.id === activeVideo?.id ? 'is-active' : ''}"
                type="button"
                data-select-video="${video.id}"
                data-select-video-scope="terminal"
              >
                ${video.name}
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 180ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层资源</span>
        <h3>分区 / 视频 / 资源联动检索</h3>
      </div>
      <div class="terminal-resource-list">
        ${activeFloor.resources
          .map(
            (resource) => `
              <button
                class="terminal-resource-card ${resource.zoneId === terminalContext.activeZone?.id ? 'is-active' : ''}"
                type="button"
                data-search-type="resource"
                data-search-id="${resource.id}"
              >
                <span>${resource.typeLabel}</span>
                <strong>${resource.title}</strong>
                <small>${resource.detail}</small>
              </button>
            `,
          )
          .join('')}
      </div>
      <label class="search-box">
        <input class="search-box__input" type="search" placeholder="${searchPlaceholder}" />
      </label>
      <div class="search-results js-search-results">
        ${renderSearchResults(searchPool, '')}
      </div>
    </section>
  `;
}

function renderBalancedAirportRightRail(data, activeAlert, focusRegion) {
  return `
    <section class="panel reveal" style="animation-delay: 100ms;">
      <div class="panel-heading">
        <span class="panel-kicker">预警中心</span>
        <h3>活动预警</h3>
      </div>
      <div class="alert-list">
        ${data.alerts
          .map(
            (alert) => `
              <button
                class="alert-item ${alert.id === activeAlert.id ? 'is-active' : ''}"
                type="button"
                data-select-alert="${alert.id}"
                data-select-alert-scope="airport"
              >
                <span class="tone tone--${getAlertTone(alert.level)}">${alert.time}</span>
                <strong>${alert.title}</strong>
                <small>${alert.summary}</small>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 140ms;">
      <div class="panel-heading">
        <span class="panel-kicker">重点关注</span>
        <h3>${focusRegion.name}</h3>
      </div>
      <div class="focus-summary">
        <span><strong>${activeAlert.title}</strong></span>
        <span class="tone tone--${getAlertTone(activeAlert.level)}">${activeAlert.status}</span>
      </div>
      <div class="panel-actions">
        <button
          class="action-button"
          type="button"
          data-jump-emergency="${activeAlert.scenarioId}"
          data-alert-id="${activeAlert.id}"
        >
          进入应急推演
        </button>
        <button class="action-button action-button--ghost" type="button" data-jump-traffic="${focusRegion.id}">
          进入交通仿真
        </button>
      </div>
    </section>

    ${renderAreaLoadPanel(data, focusRegion)}
  `;
}

function renderBalancedTerminalRightRail(activeFloor, terminalContext) {
  const activeAlert = terminalContext.activeAlert;
  const activeVideo = terminalContext.activeVideo;

  return `
    <section class="panel reveal" style="animation-delay: 100ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层联动</span>
        <h3>${activeFloor.name} 事件与处置</h3>
      </div>
      <div class="alert-list">
        ${activeFloor.alerts
          .map(
            (alert) => `
              <button
                class="alert-item ${alert.id === activeAlert?.id ? 'is-active' : ''}"
                type="button"
                data-select-alert="${alert.id}"
                data-select-alert-scope="terminal"
              >
                <span class="tone tone--${getAlertTone(alert.level)}">${alert.time}</span>
                <strong>${alert.title}</strong>
                <small>${alert.summary}</small>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel reveal" style="animation-delay: 140ms;">
      <div class="panel-heading">
        <span class="panel-kicker">楼层视频</span>
        <h3>${activeVideo?.name ?? '楼层视频联动'}</h3>
      </div>
      <div class="video-preview video-preview--terminal">
        <div class="video-preview__noise"></div>
        <div class="video-preview__hud">
          <span>联动画面</span>
          <strong>${activeVideo?.streamPreview ?? activeFloor.subtitle}</strong>
        </div>
      </div>
      <div class="video-preview__meta">
        <span>${terminalContext.activeZone?.label ?? '未选分区'}</span>
        <strong>${activeAlert?.status ?? '持续监测中'}</strong>
      </div>
      <div class="video-list">
        ${activeFloor.videos
          .map(
            (video) => `
              <button
                class="resource-chip ${video.id === activeVideo?.id ? 'is-active' : ''}"
                type="button"
                data-select-video="${video.id}"
                data-select-video-scope="terminal"
              >
                ${video.name}
              </button>
            `,
          )
          .join('')}
      </div>
    </section>

    ${renderTerminalZoneLoadPanel(activeFloor, terminalContext)}
  `;
}

function setupOverviewPage({
  container,
  data,
  state,
  airportAlert,
  airportVideo,
  focusRegion,
  activeTerminal,
  activeFloor,
  terminalContext,
  navigate,
}) {
  const rightRail = container.querySelector('.js-overview-right-rail');
  const resourceLinkagePanel = container.querySelector('.js-resource-linkage-panel');
  const sceneSlot = container.querySelector('.js-terminal-scene-slot');
  const footerPanel = container.querySelector('.panel--footer');
  const overviewPage = container.querySelector('.page--overview');
  const overviewGrid = container.querySelector('.page-grid--overview');
  const searchPool =
    activeTerminal && activeFloor ? buildTerminalSearchPool(activeFloor) : buildSearchPool(data);
  const searchPanel = container.querySelector('.search-box__input')?.closest('.panel');

  footerPanel?.remove();
  searchPanel?.remove();
  overviewPage?.classList.add('page--overview-compact');
  overviewGrid?.classList.add('page-grid--overview-compact');

  const trendChart = null;
  const areaChart = null;

  resourceLinkagePanel?.replaceChildren();
  resourceLinkagePanel?.insertAdjacentHTML(
    'afterbegin',
    renderOverviewAssurancePanel({
      data,
      focusRegion,
      airportAlert,
      airportVideo,
      activeTerminal,
      activeFloor,
      terminalContext,
    }),
  );

  if (activeTerminal && activeFloor && rightRail) {
    setupTerminalOverviewInteractions({
      container,
      rightRail,
      resourceLinkagePanel,
      data,
      airportAlert,
      airportVideo,
      focusRegion,
      activeTerminal,
      activeFloor,
      initialContext: terminalContext,
      searchPool,
      navigate,
    });

    const refreshTimer = window.setInterval(() => {
      state.runtime.dataTick += 1;
      updateKpis(container, data.overview.heroMetrics, state.runtime.dataTick);
      updateChart(trendChart, createTrendOption(data.overview, state.runtime.dataTick));
      updateChart(areaChart, createAreaOption(data.overview.areaLoad, state.runtime.dataTick));
    }, 6500);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }

  const searchResults = container.querySelector('.js-search-results');
  const searchInput = container.querySelector('.search-box__input');
  const renderAirportScene = () => {
    if (!sceneSlot) {
      return;
    }

    sceneSlot.innerHTML = renderMapScene({
      mapAssets: data.mapAssets,
      alerts: data.alerts,
      videos: data.videos,
      mode: 'overview',
      focusRegionId: focusRegion.id,
      activeAlertId: airportAlert.id,
      activeVideoId: airportVideo.id,
      transportLayers: state.ui.overviewTransportLayers,
    });

    bindSceneLinks(sceneSlot, data, navigate, {
      airportAlert,
      airportVideo,
      focusRegion,
      activeTerminal,
      activeFloor,
      terminalContext,
    });

    sceneSlot.querySelectorAll('[data-transport-layer]').forEach((button) => {
      button.addEventListener('click', () => {
        const layerId = button.dataset.transportLayer;
        if (!layerId) {
          return;
        }

        state.ui.overviewTransportLayers[layerId] = !state.ui.overviewTransportLayers[layerId];
        renderAirportScene();
      });
    });
  };

  container.querySelectorAll('[data-select-alert]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.selectAlertScope === 'terminal' && activeTerminal && activeFloor) {
        const alert = activeFloor.alerts.find((item) => item.id === button.dataset.selectAlert);
        if (!alert) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              floorAlert: alert.id,
              floorVideo: alert.relatedVideoIds?.[0] ?? terminalContext?.activeVideo?.id,
              zone: alert.zoneId,
              hotspot: undefined,
            },
          }),
        );
        return;
      }

      const alert = data.alerts.find((item) => item.id === button.dataset.selectAlert);
      if (!alert) {
        return;
      }

      navigate('overview', {
        alert: alert.id,
        video: alert.relatedResourceIds[0],
        region: alert.regionId,
      });
    });
  });

  container.querySelectorAll('[data-select-video]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.selectVideoScope === 'terminal' && activeTerminal && activeFloor) {
        const video = activeFloor.videos.find((item) => item.id === button.dataset.selectVideo);
        if (!video) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              floorVideo: video.id,
              zone: video.zoneId,
              hotspot: video.hotspotId,
            },
          }),
        );
        return;
      }

      const video = data.videos.find((item) => item.id === button.dataset.selectVideo);
      if (!video) {
        return;
      }

      navigate('overview', {
        alert: airportAlert.id,
        video: video.id,
        region: video.regionId,
      });
    });
  });

  container.querySelectorAll('[data-jump-emergency]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('emergency', {
        scenario: button.dataset.jumpEmergency,
        alert: button.dataset.alertId,
      });
    });
  });

  container.querySelectorAll('[data-jump-traffic]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('traffic', {
        scenario: 'optimized-dispatch',
        region: button.dataset.jumpTraffic,
      });
    });
  });

  container.querySelectorAll('[data-story-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.storyTarget;

      if (target === 'emergency') {
        navigate('emergency', {
          scenario: button.dataset.storyScenario,
          alert: button.dataset.alertId,
        });
        return;
      }

      if (target === 'traffic') {
        navigate('traffic', {
          scenario: 'optimized-dispatch',
          region: button.dataset.storyRegion,
        });
        return;
      }

      navigate('overview', {
        alert: airportAlert.id,
        video: airportVideo.id,
        region: focusRegion.id,
      });
    });
  });

  container.querySelectorAll('[data-overview-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.overviewAction;

      if (action === 'next-alert') {
        const currentIndex = data.alerts.findIndex((item) => item.id === airportAlert.id);
        const nextAlert = data.alerts[(currentIndex + 1) % data.alerts.length];
        navigate('overview', {
          alert: nextAlert.id,
          video: nextAlert.relatedResourceIds[0],
          region: nextAlert.regionId,
        });
        return;
      }

      if (action === 'next-floor-alert' && activeTerminal && activeFloor) {
        const alerts = activeFloor.alerts;
        const currentIndex = alerts.findIndex((item) => item.id === terminalContext?.activeAlert?.id);
        const nextAlert = alerts[(currentIndex + 1 + alerts.length) % alerts.length];
        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              floorAlert: nextAlert.id,
              floorVideo: nextAlert.relatedVideoIds?.[0] ?? terminalContext?.activeVideo?.id,
              zone: nextAlert.zoneId,
              hotspot: undefined,
            },
          }),
        );
        return;
      }

      if (action === 'focus-video') {
        navigate('overview', {
          alert: airportAlert.id,
          video: airportVideo.id,
          region: airportVideo.regionId,
        });
        return;
      }

      if (action === 'back-airport') {
        navigate('overview', {
          alert: airportAlert.id,
          video: airportVideo.id,
          region: focusRegion.id,
        });
        return;
      }

      if (action === 'go-emergency') {
        navigate('emergency', {
          scenario: terminalContext?.activeAlert?.scenarioId ?? airportAlert.scenarioId,
          alert: airportAlert.id,
        });
      }
    });
  });

  bindSceneLinks(container, data, navigate, {
    airportAlert,
    airportVideo,
    focusRegion,
    activeTerminal,
    activeFloor,
    terminalContext,
  });
  renderAirportScene();

  container.querySelectorAll('[data-terminal-floor]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!activeTerminal) {
        return;
      }

      navigate(
        'overview',
        buildTerminalRouteParams({
          airportAlert,
          airportVideo,
          focusRegion,
          activeTerminal,
          activeFloor,
          terminalContext,
          overrides: {
            floor: button.dataset.terminalFloor,
            floorAlert: undefined,
            floorVideo: undefined,
            zone: undefined,
            hotspot: undefined,
          },
        }),
      );
    });
  });

  container.querySelector('[data-terminal-back]')?.addEventListener('click', () => {
    navigate('overview', {
      alert: airportAlert.id,
      video: airportVideo.id,
      region: focusRegion.id,
    });
  });

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', () => {
      searchResults.innerHTML = renderSearchResults(searchPool, searchInput.value);
      bindSearchResults(searchResults, data, navigate, {
        airportAlert,
        airportVideo,
        focusRegion,
        activeTerminal,
        activeFloor,
        terminalContext,
      });
    });

    bindSearchResults(searchResults, data, navigate, {
      airportAlert,
      airportVideo,
      focusRegion,
      activeTerminal,
      activeFloor,
      terminalContext,
    });
  }

  const refreshTimer = window.setInterval(() => {
    state.runtime.dataTick += 1;
    updateKpis(container, data.overview.heroMetrics, state.runtime.dataTick);
    updateChart(trendChart, createTrendOption(data.overview, state.runtime.dataTick));
    updateChart(areaChart, createAreaOption(data.overview.areaLoad, state.runtime.dataTick));
  }, 6500);

  return () => {
    window.clearInterval(refreshTimer);
  };
}

function setupTerminalOverviewInteractions({
  container,
  rightRail,
  data,
  airportAlert,
  airportVideo,
  focusRegion,
  activeTerminal,
  activeFloor,
  initialContext,
  searchPool,
  navigate,
}) {
  let terminalSelection = createTerminalSelectionState(initialContext);
  let terminalSearchQuery = '';

  const getContext = () => resolveTerminalContextFromSelection(activeFloor, terminalSelection);

  const renderTerminalModules = () => {
    const context = getContext();
    rightRail.innerHTML = renderBalancedTerminalRightRail(activeFloor, context);

    const searchInput = rightRail.querySelector('.search-box__input');
    const searchResults = rightRail.querySelector('.js-search-results');

    if (searchInput) {
      searchInput.value = terminalSearchQuery;
      searchInput.addEventListener('input', () => {
        terminalSearchQuery = searchInput.value;
        if (searchResults) {
          searchResults.innerHTML = renderSearchResults(searchPool, terminalSearchQuery);
          bindTerminalSearchResults(searchResults, activeFloor, updateTerminalSelection);
        }
      });
    }

    if (searchResults) {
      searchResults.innerHTML = renderSearchResults(searchPool, terminalSearchQuery);
      bindTerminalSearchResults(searchResults, activeFloor, updateTerminalSelection);
    }

    bindTerminalRightRail(rightRail, activeFloor, updateTerminalSelection);
    syncTerminalSceneSelection(container, context);
  };

  const updateTerminalSelection = (patch) => {
    terminalSelection = normalizeTerminalSelection(activeFloor, {
      ...terminalSelection,
      ...patch,
    });
    renderTerminalModules();
  };

  container.querySelectorAll('[data-jump-emergency]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('emergency', {
        scenario: getContext().activeAlert?.scenarioId ?? button.dataset.jumpEmergency,
        alert: button.dataset.alertId,
      });
    });
  });

  container.querySelectorAll('[data-jump-traffic]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('traffic', {
        scenario: 'optimized-dispatch',
        region: button.dataset.jumpTraffic,
      });
    });
  });

  container.querySelectorAll('[data-story-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.storyTarget;

      if (target === 'emergency') {
        navigate('emergency', {
          scenario: getContext().activeAlert?.scenarioId ?? button.dataset.storyScenario,
          alert: button.dataset.alertId,
        });
        return;
      }

      if (target === 'traffic') {
        navigate('traffic', {
          scenario: 'optimized-dispatch',
          region: button.dataset.storyRegion,
        });
        return;
      }

      navigate('overview', {
        alert: airportAlert.id,
        video: airportVideo.id,
        region: focusRegion.id,
      });
    });
  });

  container.querySelectorAll('[data-overview-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.overviewAction;

      if (action === 'next-floor-alert') {
        const alerts = activeFloor.alerts;
        const currentIndex = alerts.findIndex((item) => item.id === terminalSelection.activeAlertId);
        const nextAlert = alerts[(currentIndex + 1 + alerts.length) % alerts.length];
        updateTerminalSelection({
          activeAlertId: nextAlert.id,
          activeVideoId: nextAlert.relatedVideoIds?.[0] ?? terminalSelection.activeVideoId,
          activeZoneId: nextAlert.zoneId,
          activeHotspotId: null,
        });
        return;
      }

      if (action === 'back-airport') {
        navigate('overview', {
          alert: airportAlert.id,
          video: airportVideo.id,
          region: focusRegion.id,
        });
        return;
      }

      if (action === 'go-emergency') {
        navigate('emergency', {
          scenario: getContext().activeAlert?.scenarioId ?? airportAlert.scenarioId,
          alert: airportAlert.id,
        });
      }
    });
  });

  container.querySelectorAll('[data-terminal-floor]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate(
        'overview',
        buildTerminalRouteParams({
          airportAlert,
          airportVideo,
          focusRegion,
          activeTerminal,
          activeFloor,
          terminalContext: getContext(),
          overrides: {
            floor: button.dataset.terminalFloor,
            floorAlert: undefined,
            floorVideo: undefined,
            zone: undefined,
            hotspot: undefined,
          },
        }),
      );
    });
  });

  container.querySelector('[data-terminal-back]')?.addEventListener('click', () => {
    navigate('overview', {
      alert: airportAlert.id,
      video: airportVideo.id,
      region: focusRegion.id,
    });
  });

  container.querySelectorAll('[data-terminal-zone-link]').forEach((node) => {
    node.addEventListener('click', () => {
      const zoneId = node.dataset.terminalZoneLink;
      const linkedAlert =
        activeFloor.alerts.find((item) => item.zoneId === zoneId) ?? getContext().activeAlert;
      const linkedVideo =
        activeFloor.videos.find((item) => item.zoneId === zoneId) ?? getContext().activeVideo;

      updateTerminalSelection({
        activeZoneId: zoneId,
        activeAlertId: linkedAlert?.id ?? terminalSelection.activeAlertId,
        activeVideoId: linkedVideo?.id ?? terminalSelection.activeVideoId,
        activeHotspotId: linkedVideo?.hotspotId ?? null,
      });
    });
  });

  container.querySelectorAll('[data-terminal-hotspot-link]').forEach((node) => {
    node.addEventListener('click', () => {
      updateTerminalSelection({
        activeHotspotId: node.dataset.terminalHotspotLink,
        activeZoneId: node.dataset.terminalZone,
        activeVideoId: node.dataset.terminalVideo || terminalSelection.activeVideoId,
      });
    });
  });

  renderTerminalModules();
}

setupTerminalOverviewInteractions = function setupTerminalOverviewInteractions({
  container,
  rightRail,
  resourceLinkagePanel,
  data,
  airportAlert,
  airportVideo,
  focusRegion,
  activeTerminal,
  activeFloor,
  initialContext,
  searchPool,
  navigate,
}) {
  let currentFloor = activeFloor;
  let terminalSelection = createTerminalSelectionState(initialContext);
  let terminalSearchQuery = '';
  const focusPanel = container.querySelector('.js-terminal-focus-panel');
  const focusTitle = focusPanel?.querySelector('.panel-heading h3') ?? null;
  const focusBody = focusPanel?.querySelector('.js-terminal-focus-body') ?? null;
  const sceneSlot = container.querySelector('.js-terminal-scene-slot');

  const getContext = () => resolveTerminalContextFromSelection(currentFloor, terminalSelection);
  const getSearchPool = () => buildTerminalSearchPool(currentFloor);

  const updateTerminalSelection = (patch) => {
    terminalSelection = normalizeTerminalSelection(currentFloor, {
      ...terminalSelection,
      ...patch,
    });
    renderTerminalModules();
  };

  const setFloorLocally = (floorId) => {
    const nextFloor =
      activeTerminal.floors.find((item) => item.id === floorId) ??
      activeTerminal.floors.find((item) => item.id === activeTerminal.defaultFloor) ??
      activeTerminal.floors[0];

    if (!nextFloor || nextFloor.id === currentFloor.id) {
      return;
    }

    currentFloor = nextFloor;
    terminalSelection = createTerminalSelectionState(resolveTerminalContextFromSelection(nextFloor, {}));
    terminalSearchQuery = '';
    renderTerminalModules();
  };

  const renderTerminalModules = () => {
    const context = getContext();
    const floorSearchPool = getSearchPool();

    if (focusTitle) {
      focusTitle.textContent = `${activeTerminal.name} ${currentFloor.name}`;
    }

    if (focusBody) {
      focusBody.innerHTML = renderTerminalFocusBody(currentFloor, context);
    }

    if (sceneSlot) {
      sceneSlot.innerHTML = renderTerminalScene({
        terminal: activeTerminal,
        floor: currentFloor,
        activeZoneId: context.activeZone?.id ?? null,
        activeHotspotId: context.activeHotspot?.id ?? null,
      });
    }

    if (resourceLinkagePanel) {
      resourceLinkagePanel.innerHTML = renderOverviewAssurancePanel({
        data,
        focusRegion,
        airportAlert,
        airportVideo,
        activeTerminal,
        activeFloor: currentFloor,
        terminalContext: context,
      });
    }

    rightRail.innerHTML = renderBalancedTerminalRightRail(currentFloor, context);

    const searchInput = rightRail.querySelector('.search-box__input');
    const searchResults = rightRail.querySelector('.js-search-results');

    if (searchInput) {
      searchInput.value = terminalSearchQuery;
      searchInput.addEventListener('input', () => {
        terminalSearchQuery = searchInput.value;
        if (searchResults) {
          searchResults.innerHTML = renderSearchResults(floorSearchPool, terminalSearchQuery);
          bindTerminalSearchResults(searchResults, currentFloor, updateTerminalSelection);
        }
      });
    }

    if (searchResults) {
      searchResults.innerHTML = renderSearchResults(floorSearchPool, terminalSearchQuery);
      bindTerminalSearchResults(searchResults, currentFloor, updateTerminalSelection);
    }

    bindTerminalRightRail(rightRail, currentFloor, updateTerminalSelection);
    bindTerminalScene(sceneSlot, currentFloor, updateTerminalSelection, setFloorLocally, navigate, {
      airportAlert,
      airportVideo,
      focusRegion,
    });
    syncTerminalSceneSelection(container, context);
  };

  container.querySelectorAll('[data-jump-emergency]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('emergency', {
        scenario: getContext().activeAlert?.scenarioId ?? button.dataset.jumpEmergency,
        alert: button.dataset.alertId,
      });
    });
  });

  container.querySelectorAll('[data-jump-traffic]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate('traffic', {
        scenario: 'optimized-dispatch',
        region: button.dataset.jumpTraffic,
      });
    });
  });

  container.querySelectorAll('[data-story-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.storyTarget;

      if (target === 'emergency') {
        navigate('emergency', {
          scenario: getContext().activeAlert?.scenarioId ?? button.dataset.storyScenario,
          alert: button.dataset.alertId,
        });
        return;
      }

      if (target === 'traffic') {
        navigate('traffic', {
          scenario: 'optimized-dispatch',
          region: button.dataset.storyRegion,
        });
        return;
      }

      navigate('overview', {
        alert: airportAlert.id,
        video: airportVideo.id,
        region: focusRegion.id,
      });
    });
  });

  container.querySelectorAll('[data-overview-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.overviewAction;

      if (action === 'next-floor-alert') {
        const alerts = currentFloor.alerts;
        const currentIndex = alerts.findIndex((item) => item.id === terminalSelection.activeAlertId);
        const nextAlert = alerts[(currentIndex + 1 + alerts.length) % alerts.length];
        updateTerminalSelection({
          activeAlertId: nextAlert.id,
          activeVideoId: nextAlert.relatedVideoIds?.[0] ?? terminalSelection.activeVideoId,
          activeZoneId: nextAlert.zoneId,
          activeHotspotId: null,
        });
        return;
      }

      if (action === 'back-airport') {
        navigate('overview', {
          alert: airportAlert.id,
          video: airportVideo.id,
          region: focusRegion.id,
        });
        return;
      }

      if (action === 'go-emergency') {
        navigate('emergency', {
          scenario: getContext().activeAlert?.scenarioId ?? airportAlert.scenarioId,
          alert: airportAlert.id,
        });
      }
    });
  });

  renderTerminalModules();
};

function bindTerminalRightRail(container, activeFloor, updateTerminalSelection) {
  container.querySelectorAll('[data-select-alert-scope="terminal"]').forEach((button) => {
    button.addEventListener('click', () => {
      const alert = activeFloor.alerts.find((item) => item.id === button.dataset.selectAlert);
      if (!alert) {
        return;
      }

      updateTerminalSelection({
        activeAlertId: alert.id,
        activeVideoId: alert.relatedVideoIds?.[0] ?? null,
        activeZoneId: alert.zoneId,
        activeHotspotId: null,
      });
    });
  });

  container.querySelectorAll('[data-select-video-scope="terminal"]').forEach((button) => {
    button.addEventListener('click', () => {
      const video = activeFloor.videos.find((item) => item.id === button.dataset.selectVideo);
      if (!video) {
        return;
      }

      updateTerminalSelection({
        activeVideoId: video.id,
        activeZoneId: video.zoneId,
        activeHotspotId: video.hotspotId,
      });
    });
  });

  container.querySelectorAll('.terminal-resource-card').forEach((button) => {
    button.addEventListener('click', () => {
      const resource = activeFloor.resources.find((item) => item.id === button.dataset.searchId);
      if (!resource) {
        return;
      }

      updateTerminalSelection({
        activeZoneId: resource.zoneId,
        activeHotspotId: resource.hotspotId ?? null,
      });
    });
  });
}

function bindTerminalSearchResults(container, activeFloor, updateTerminalSelection) {
  container.querySelectorAll('[data-search-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.searchType;
      const id = button.dataset.searchId;

      if (type === 'floor-alert') {
        const alert = activeFloor.alerts.find((item) => item.id === id);
        if (!alert) {
          return;
        }

        updateTerminalSelection({
          activeAlertId: alert.id,
          activeVideoId: alert.relatedVideoIds?.[0] ?? null,
          activeZoneId: alert.zoneId,
          activeHotspotId: null,
        });
        return;
      }

      if (type === 'floor-video') {
        const video = activeFloor.videos.find((item) => item.id === id);
        if (!video) {
          return;
        }

        updateTerminalSelection({
          activeVideoId: video.id,
          activeZoneId: video.zoneId,
          activeHotspotId: video.hotspotId,
        });
        return;
      }

      if (type === 'zone') {
        updateTerminalSelection({
          activeZoneId: id,
          activeHotspotId: null,
        });
        return;
      }

      if (type === 'hotspot') {
        const hotspot = activeFloor.hotspots.find((item) => item.id === id);
        if (!hotspot) {
          return;
        }

        updateTerminalSelection({
          activeHotspotId: hotspot.id,
          activeZoneId: hotspot.zoneId,
          activeVideoId: hotspot.videoId ?? null,
        });
        return;
      }

      if (type === 'resource') {
        const resource = activeFloor.resources.find((item) => item.id === id);
        if (!resource) {
          return;
        }

        updateTerminalSelection({
          activeZoneId: resource.zoneId,
          activeHotspotId: resource.hotspotId ?? null,
        });
      }
    });
  });
}

function syncTerminalSceneSelection(container, terminalContext) {
  container.querySelectorAll('[data-terminal-zone-link]').forEach((node) => {
    node.classList.toggle('is-active', node.dataset.terminalZoneLink === terminalContext.activeZone?.id);
  });

  container.querySelectorAll('[data-terminal-hotspot-link]').forEach((node) => {
    node.classList.toggle(
      'is-active',
      node.dataset.terminalHotspotLink === terminalContext.activeHotspot?.id,
    );
  });
}

function bindTerminalScene(
  container,
  activeFloor,
  updateTerminalSelection,
  setFloorLocally,
  navigate,
  airportContext,
) {
  if (!container) {
    return;
  }

  container.querySelectorAll('[data-terminal-floor]').forEach((button) => {
    button.addEventListener('click', () => {
      setFloorLocally(button.dataset.terminalFloor);
    });
  });

  container.querySelector('[data-terminal-back]')?.addEventListener('click', () => {
    navigate('overview', {
      alert: airportContext.airportAlert.id,
      video: airportContext.airportVideo.id,
      region: airportContext.focusRegion.id,
    });
  });

  container.querySelectorAll('[data-terminal-zone-link]').forEach((node) => {
    node.addEventListener('click', () => {
      const zoneId = node.dataset.terminalZoneLink;
      const linkedAlert =
        activeFloor.alerts.find((item) => item.zoneId === zoneId) ??
        resolveTerminalContextFromSelection(activeFloor, {}).activeAlert;
      const linkedVideo =
        activeFloor.videos.find((item) => item.zoneId === zoneId) ??
        resolveTerminalContextFromSelection(activeFloor, {}).activeVideo;

      updateTerminalSelection({
        activeZoneId: zoneId,
        activeAlertId: linkedAlert?.id ?? null,
        activeVideoId: linkedVideo?.id ?? null,
        activeHotspotId: linkedVideo?.hotspotId ?? null,
      });
    });
  });

  container.querySelectorAll('[data-terminal-hotspot-link]').forEach((node) => {
    node.addEventListener('click', () => {
      updateTerminalSelection({
        activeHotspotId: node.dataset.terminalHotspotLink,
        activeZoneId: node.dataset.terminalZone,
        activeVideoId: node.dataset.terminalVideo || null,
      });
    });
  });
}

function renderTerminalFocusBody(activeFloor, terminalContext) {
  return `
    <p class="panel-copy">${activeFloor.subtitle}</p>
    <div class="focus-summary">
      <span><strong>${terminalContext.activeAlert?.title ?? '楼层联动中'}</strong></span>
      <span class="tone tone--${getAlertTone(terminalContext.activeAlert?.level ?? 'low')}">${terminalContext.activeAlert?.status ?? '持续监测'}</span>
    </div>
  `;
}

function renderTerminalMapCaption(activeFloor, terminalContext) {
  return `
    <div>
      <span class="panel-kicker">当前楼层</span>
      <strong>${activeFloor.name}</strong>
      <p>${activeFloor.subtitle}</p>
    </div>
    <div>
      <span class="panel-kicker">联动分区</span>
      <strong>${terminalContext.activeZone?.label ?? '未选分区'}</strong>
      <p>${terminalContext.activeZone?.detail ?? terminalContext.activeZone?.status ?? '点击楼内分区或联动列表即可定位。'}</p>
    </div>
    <div>
      <span class="panel-kicker">联动视频</span>
      <strong>${terminalContext.activeVideo?.name ?? '未选视频'}</strong>
      <p>${terminalContext.activeVideo?.streamPreview ?? terminalContext.activeAlert?.summary ?? '楼层联动数据已同步。'}</p>
    </div>
  `;
}

function bindSceneLinks(container, data, navigate, context) {
  const { airportAlert, airportVideo, focusRegion, activeTerminal, activeFloor, terminalContext } =
    context;

  container.querySelectorAll('[data-alert-id]').forEach((node) => {
    node.addEventListener('click', () => {
      const alert = data.alerts.find((item) => item.id === node.dataset.alertId);
      if (!alert) {
        return;
      }

      navigate('emergency', {
        scenario: alert.scenarioId,
        alert: alert.id,
      });
    });
  });

  container.querySelectorAll('[data-video-id]').forEach((node) => {
    node.addEventListener('click', () => {
      const video = data.videos.find((item) => item.id === node.dataset.videoId);
      if (!video) {
        return;
      }

      navigate('overview', {
        alert: data.alerts.find((item) => item.regionId === video.regionId)?.id ?? data.alerts[0].id,
        video: video.id,
        region: video.regionId,
      });
    });
  });

  container.querySelectorAll('[data-region-id]').forEach((node) => {
    node.addEventListener('click', () => {
      const regionId = node.dataset.regionId;
      const region = data.mapAssets.regions.find((item) => item.id === regionId);
      const regionAlert = data.alerts.find((item) => item.regionId === regionId) ?? data.alerts[0];
      const regionVideo = data.videos.find((item) => item.regionId === regionId) ?? data.videos[0];

      if (region?.type === 'terminal') {
        navigate('overview', {
          alert: regionAlert.id,
          video: regionVideo.id,
          region: regionId,
          terminal: regionId,
          floor: 'f3',
        });
        return;
      }

      navigate('overview', {
        alert: regionAlert.id,
        video: regionVideo.id,
        region: regionId,
      });
    });
  });

  container.querySelectorAll('[data-terminal-zone-link]').forEach((node) => {
    node.addEventListener('click', () => {
      if (!activeTerminal || !activeFloor) {
        return;
      }

      const zoneId = node.dataset.terminalZoneLink;
      const linkedAlert =
        activeFloor.alerts.find((item) => item.zoneId === zoneId) ?? terminalContext?.activeAlert;
      const linkedVideo =
        activeFloor.videos.find((item) => item.zoneId === zoneId) ?? terminalContext?.activeVideo;

      navigate(
        'overview',
        buildTerminalRouteParams({
          airportAlert,
          airportVideo,
          focusRegion,
          activeTerminal,
          activeFloor,
          terminalContext,
          overrides: {
            floorAlert: linkedAlert?.id,
            floorVideo: linkedVideo?.id,
            zone: zoneId,
            hotspot: linkedVideo?.hotspotId,
          },
        }),
      );
    });
  });

  container.querySelectorAll('[data-terminal-hotspot-link]').forEach((node) => {
    node.addEventListener('click', () => {
      if (!activeTerminal || !activeFloor) {
        return;
      }

      navigate(
        'overview',
        buildTerminalRouteParams({
          airportAlert,
          airportVideo,
          focusRegion,
          activeTerminal,
          activeFloor,
          terminalContext,
          overrides: {
            hotspot: node.dataset.terminalHotspotLink,
            zone: node.dataset.terminalZone,
            floorVideo: node.dataset.terminalVideo,
          },
        }),
      );
    });
  });
}

function bindSearchResults(container, data, navigate, context) {
  const { airportAlert, airportVideo, focusRegion, activeTerminal, activeFloor, terminalContext } =
    context;

  container.querySelectorAll('[data-search-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.searchType;
      const id = button.dataset.searchId;

      if (type === 'alert') {
        const alert = data.alerts.find((item) => item.id === id);
        if (!alert) {
          return;
        }

        navigate('overview', {
          alert: alert.id,
          video: alert.relatedResourceIds[0],
          region: alert.regionId,
        });
        return;
      }

      if (type === 'video') {
        const video = data.videos.find((item) => item.id === id);
        if (!video) {
          return;
        }

        navigate('overview', {
          alert: airportAlert.id,
          video: video.id,
          region: video.regionId,
        });
        return;
      }

      if (type === 'region') {
        navigate('overview', {
          alert: airportAlert.id,
          region: id,
        });
        return;
      }

      if (!activeTerminal || !activeFloor) {
        return;
      }

      if (type === 'floor-alert') {
        const alert = activeFloor.alerts.find((item) => item.id === id);
        if (!alert) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              floorAlert: alert.id,
              floorVideo: alert.relatedVideoIds?.[0],
              zone: alert.zoneId,
              hotspot: undefined,
            },
          }),
        );
        return;
      }

      if (type === 'floor-video') {
        const video = activeFloor.videos.find((item) => item.id === id);
        if (!video) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              floorVideo: video.id,
              zone: video.zoneId,
              hotspot: video.hotspotId,
            },
          }),
        );
        return;
      }

      if (type === 'zone') {
        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              zone: id,
              hotspot: undefined,
            },
          }),
        );
        return;
      }

      if (type === 'hotspot') {
        const hotspot = activeFloor.hotspots.find((item) => item.id === id);
        if (!hotspot) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              hotspot: hotspot.id,
              zone: hotspot.zoneId,
              floorVideo: hotspot.videoId,
            },
          }),
        );
        return;
      }

      if (type === 'resource') {
        const resource = activeFloor.resources.find((item) => item.id === id);
        if (!resource) {
          return;
        }

        navigate(
          'overview',
          buildTerminalRouteParams({
            airportAlert,
            airportVideo,
            focusRegion,
            activeTerminal,
            activeFloor,
            terminalContext,
            overrides: {
              zone: resource.zoneId,
              hotspot: resource.hotspotId,
            },
          }),
        );
      }
    });
  });
}

function createTrendOption(overview, tick) {
  return buildLineChartOption({
    categories: overview.trendTimeline,
    colors: ['#70d1ff', '#f4b259'],
    series: [
      {
        name: '到港旅客',
        data: shiftSeries(overview.passengerTrend, tick, 120),
      },
      {
        name: '道路热度',
        data: shiftSeries(
          overview.roadTrend.map((value) => value * 3600),
          tick,
          90,
        ),
      },
    ],
  });
}

function createAreaOption(areaLoad, tick) {
  return buildBarChartOption({
    categories: areaLoad.map((item) => item.name),
    colors: ['#24d8f7'],
    series: [
      {
        name: '负荷值',
        data: areaLoad.map((item, index) =>
          Number((item.value + Math.sin((tick + index) * 0.7) * 2.4).toFixed(1)),
        ),
      },
    ],
  });
}

function updateKpis(container, metrics, tick) {
  const nextValues = buildKpis(metrics, tick);

  nextValues.forEach((metric) => {
    const target = container.querySelector(`[data-kpi-id="${metric.id}"]`);
    if (target) {
      target.textContent = `${metric.display}${metric.unit}`;
    }
  });
}

function buildKpis(metrics, tick) {
  return metrics.map((metric) => ({
    ...metric,
    display: formatMetricValue(
      pulseValue(metric.base, tick, metric.amplitude, metric.digits),
      metric.digits,
    ),
  }));
}

function resolveActiveAlert(data, route, state) {
  const requestedAlert = route.params.get('alert');
  return (
    data.alerts.find((item) => item.id === requestedAlert) ??
    data.alerts.find((item) => item.id === state.selection.alertId) ??
    data.alerts[0]
  );
}

function resolveActiveVideo(data, route, state, alert) {
  const requestedVideo = route.params.get('video');
  return (
    data.videos.find((item) => item.id === requestedVideo) ??
    data.videos.find((item) => item.id === state.selection.videoId) ??
    data.videos.find((item) => item.id === alert.relatedResourceIds[0]) ??
    data.videos[0]
  );
}

function resolveFocusRegion(data, route, state, alert, video) {
  const requestedRegion = route.params.get('region');
  return (
    data.mapAssets.regions.find((item) => item.id === requestedRegion) ??
    data.mapAssets.regions.find((item) => item.id === state.selection.regionId) ??
    data.mapAssets.regions.find((item) => item.id === alert.regionId) ??
    data.mapAssets.regions.find((item) => item.id === video.regionId) ??
    data.mapAssets.regions[0]
  );
}

function resolveActiveTerminal(data, route) {
  const requestedTerminal = route.params.get('terminal');
  if (!requestedTerminal) {
    return null;
  }

  return data.terminalDetails?.terminals?.find((item) => item.id === requestedTerminal) ?? null;
}

function resolveActiveFloor(activeTerminal, route) {
  if (!activeTerminal) {
    return null;
  }

  const requestedFloor = route.params.get('floor');
  return (
    activeTerminal.floors.find((item) => item.id === requestedFloor) ??
    activeTerminal.floors.find((item) => item.id === activeTerminal.defaultFloor) ??
    activeTerminal.floors[0] ??
    null
  );
}

function resolveTerminalContext(activeFloor, route) {
  const requestedAlert = route.params.get('floorAlert');
  const requestedVideo = route.params.get('floorVideo');
  const requestedZone = route.params.get('zone');
  const requestedHotspot = route.params.get('hotspot');

  const activeAlert =
    activeFloor.alerts.find((item) => item.id === requestedAlert) ?? activeFloor.alerts[0] ?? null;
  const activeVideo =
    activeFloor.videos.find((item) => item.id === requestedVideo) ??
    activeFloor.videos.find((item) => item.id === activeAlert?.relatedVideoIds?.[0]) ??
    activeFloor.videos[0] ??
    null;
  const activeHotspot =
    activeFloor.hotspots.find((item) => item.id === requestedHotspot) ??
    activeFloor.hotspots.find((item) => item.id === activeVideo?.hotspotId) ??
    activeFloor.hotspots[0] ??
    null;
  const activeZone =
    activeFloor.zones.find((item) => item.id === requestedZone) ??
    activeFloor.zones.find((item) => item.id === activeAlert?.zoneId) ??
    activeFloor.zones.find((item) => item.id === activeVideo?.zoneId) ??
    activeFloor.zones.find((item) => item.id === activeHotspot?.zoneId) ??
    activeFloor.zones[0] ??
    null;

  return {
    activeAlert,
    activeVideo,
    activeHotspot,
    activeZone,
  };
}

function createTerminalSelectionState(terminalContext) {
  return {
    activeAlertId: terminalContext?.activeAlert?.id ?? null,
    activeVideoId: terminalContext?.activeVideo?.id ?? null,
    activeHotspotId: terminalContext?.activeHotspot?.id ?? null,
    activeZoneId: terminalContext?.activeZone?.id ?? null,
  };
}

function normalizeTerminalSelection(activeFloor, selection) {
  const resolved = resolveTerminalContextFromSelection(activeFloor, selection);

  return {
    activeAlertId: resolved.activeAlert?.id ?? null,
    activeVideoId: resolved.activeVideo?.id ?? null,
    activeHotspotId: resolved.activeHotspot?.id ?? null,
    activeZoneId: resolved.activeZone?.id ?? null,
  };
}

function resolveTerminalContextFromSelection(activeFloor, selection) {
  const activeAlert =
    activeFloor.alerts.find((item) => item.id === selection.activeAlertId) ?? activeFloor.alerts[0] ?? null;
  const activeVideo =
    activeFloor.videos.find((item) => item.id === selection.activeVideoId) ??
    activeFloor.videos.find((item) => item.id === activeAlert?.relatedVideoIds?.[0]) ??
    activeFloor.videos[0] ??
    null;
  const activeHotspot =
    activeFloor.hotspots.find((item) => item.id === selection.activeHotspotId) ??
    activeFloor.hotspots.find((item) => item.id === activeVideo?.hotspotId) ??
    activeFloor.hotspots.find((item) => item.zoneId === selection.activeZoneId) ??
    activeFloor.hotspots[0] ??
    null;
  const activeZone =
    activeFloor.zones.find((item) => item.id === selection.activeZoneId) ??
    activeFloor.zones.find((item) => item.id === activeAlert?.zoneId) ??
    activeFloor.zones.find((item) => item.id === activeVideo?.zoneId) ??
    activeFloor.zones.find((item) => item.id === activeHotspot?.zoneId) ??
    activeFloor.zones[0] ??
    null;

  return {
    activeAlert,
    activeVideo,
    activeHotspot,
    activeZone,
  };
}

function buildSearchPool(data) {
  return [
    ...data.mapAssets.regions.map((region) => ({
      type: 'region',
      id: region.id,
      title: region.name,
      subtitle: region.description,
    })),
    ...data.videos.map((video) => ({
      type: 'video',
      id: video.id,
      title: video.name,
      subtitle: video.streamPreview,
    })),
    ...data.alerts.map((alert) => ({
      type: 'alert',
      id: alert.id,
      title: alert.title,
      subtitle: alert.summary,
    })),
  ];
}

function buildTerminalSearchPool(activeFloor) {
  return [
    ...activeFloor.zones.map((zone) => ({
      type: 'zone',
      id: zone.id,
      title: zone.label,
      subtitle: zone.detail ?? zone.status,
    })),
    ...activeFloor.hotspots.map((hotspot) => ({
      type: 'hotspot',
      id: hotspot.id,
      title: hotspot.label,
      subtitle: hotspot.detail,
    })),
    ...activeFloor.videos.map((video) => ({
      type: 'floor-video',
      id: video.id,
      title: video.name,
      subtitle: video.streamPreview,
    })),
    ...activeFloor.alerts.map((alert) => ({
      type: 'floor-alert',
      id: alert.id,
      title: alert.title,
      subtitle: alert.summary,
    })),
    ...activeFloor.resources.map((resource) => ({
      type: 'resource',
      id: resource.id,
      title: resource.title,
      subtitle: resource.detail,
    })),
  ];
}

function buildTerminalRouteParams({
  airportAlert,
  airportVideo,
  focusRegion,
  activeTerminal,
  activeFloor,
  terminalContext,
  overrides = {},
}) {
  return {
    alert: airportAlert.id,
    video: airportVideo.id,
    region: focusRegion.id,
    terminal: activeTerminal?.id,
    floor: activeFloor?.id,
    floorAlert: terminalContext?.activeAlert?.id,
    floorVideo: terminalContext?.activeVideo?.id,
    zone: terminalContext?.activeZone?.id,
    hotspot: terminalContext?.activeHotspot?.id,
    ...overrides,
  };
}

function renderSearchResults(pool, query) {
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? pool.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))
    : pool.slice(0, 6);

  if (!results.length) {
    return `<div class="search-empty">未找到匹配项，请尝试区域名、视频名、资源名或预警关键词。</div>`;
  }

  return results
    .slice(0, 6)
    .map(
      (item) => `
        <button
          class="search-result"
          type="button"
          data-search-type="${item.type}"
          data-search-id="${item.id}"
        >
          <strong>${item.title}</strong>
          <small>${item.subtitle}</small>
        </button>
      `,
    )
    .join('');
}


