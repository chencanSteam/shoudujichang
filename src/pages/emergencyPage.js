import { renderMapScene } from '../components/mapScene.js';
import {
  buildBarChartOption,
  buildLineChartOption,
  mountChart,
  updateChart,
} from '../lib/charts.js';
import { formatMetricValue, getAlertTone, interpolateMetric } from '../lib/format.js';

const EMERGENCY_SCENARIO_CONTENT = {
  'flight-delay': {
    name: '大面积航班延误',
    eventType: '延误叠加到港高峰',
    duration: '90 分钟',
    passengerLevel: '高',
    weather: '晴间多云 / 能见度良好',
    supportStrategy: '出租车补位 + 摆渡车增发 + 网约车引流',
    steps: [
      { label: '事件触发', detail: '航班延误与到港峰值叠加，楼前压力快速抬升。' },
      { label: '资源联动', detail: '出租车蓄车区与摆渡车辆同步补位，打开临时接驳带。' },
      { label: '疏散执行', detail: '到达层旅客按双通道分流，优先引导至轨道与摆渡通道。' },
      { label: '效果回看', detail: '瓶颈点恢复到可控区间，输出下一阶段调度建议。' },
    ],
    routes: [
      { id: 'route-a', stepIndex: 1, path: 'M 525 344 C 440 390 348 444 248 488', label: '出租车补位' },
      { id: 'route-b', stepIndex: 2, path: 'M 620 348 C 705 404 756 448 790 510', label: '摆渡接驳' },
      { id: 'route-c', stepIndex: 2, path: 'M 510 316 C 530 380 526 432 514 494', label: '旅客疏散' },
    ],
    metrics: [
      { label: '运力匹配度', start: 56, end: 88, unit: '%' },
      { label: '预计疏散时长', start: 46, end: 28, unit: '分钟' },
      { label: '应急缺口', start: 17, end: 4, unit: '车次' },
      { label: '区域稳定度', start: 52, end: 83, unit: '%' },
    ],
    flowSeries: [21, 35, 56, 71],
    readinessSeries: [48, 63, 79, 92],
    bottlenecks: ['到达层东侧上客区', '出租车临时补位窗口', 'P2 临停回流节点'],
    recommendations: [
      '提前开启摆渡车临时站台，优先消化无预约接驳旅客。',
      '将出租车补位窗口前置 10 分钟，减少楼前回压。',
      '在到达层出入口增加人工引导与广播频次。',
    ],
    actions: [
      '锁定到达层东侧上客区，建立事件观察圈。',
      '调入出租车补位与摆渡车临时增发策略。',
      '打开双通道疏散线路，释放旅客分流能力。',
      '回看瓶颈恢复情况，输出下一阶段处置建议。',
    ],
  },
  'bad-weather': {
    name: '恶劣天气处置',
    eventType: '侧风天气影响摆渡效率',
    duration: '60 分钟',
    passengerLevel: '中高',
    weather: '阵风 / 侧风 6 级',
    supportStrategy: '巴士加密 + 站台轮转 + 关键区域广播引导',
    steps: [
      { label: '天气预警', detail: '侧风预警进入持续观察，摆渡线路发车间隔延长。' },
      { label: '站台重排', detail: '巴士站台按顺序重新编排，释放中部站位压力。' },
      { label: '运力增发', detail: '压缩临时摆渡车发车间隔，优先保障旅客回流。' },
      { label: '恢复常态', detail: '风力下降后逐步恢复标准节拍与常态配置。' },
    ],
    routes: [
      { id: 'route-d', stepIndex: 1, path: 'M 784 482 C 826 442 860 400 878 342', label: '站台调度' },
      { id: 'route-e', stepIndex: 2, path: 'M 780 510 C 672 582 444 590 286 526', label: '应急摆渡' },
    ],
    metrics: [
      { label: '运力匹配度', start: 62, end: 82, unit: '%' },
      { label: '预计疏散时长', start: 38, end: 26, unit: '分钟' },
      { label: '应急缺口', start: 12, end: 3, unit: '车次' },
      { label: '区域稳定度', start: 61, end: 80, unit: '%' },
    ],
    flowSeries: [18, 32, 43, 57],
    readinessSeries: [50, 68, 80, 89],
    bottlenecks: ['巴士站台排班窗口', 'P2 出口回旋通道', '风控广播触达效率'],
    recommendations: [
      '优先保障摆渡车回场效率，避免空驶占道。',
      '加强 P2 至巴士集散区导向，减少旅客反复询问。',
      '对临停入口做限时放行，平衡楼前道路压力。',
    ],
    actions: [
      '启动天气联动预警，锁定风控影响区域。',
      '重排巴士站台与发车序列，释放关键站位。',
      '压缩摆渡车发车间隔，优先消化积压客流。',
      '风力回落后复位常态排班，完成阶段复盘。',
    ],
  },
  'crowd-surge': {
    name: '大客流聚集',
    eventType: '到达厅短时客流突增',
    duration: '75 分钟',
    passengerLevel: '高',
    weather: '晴朗',
    supportStrategy: '双通道疏散 + 视频巡检 + 分层广播',
    steps: [
      { label: '客流预警', detail: '到达厅出口客流短时超过阈值，聚集风险快速抬升。' },
      { label: '路径打开', detail: '开放双通道疏散与临时围栏，建立缓冲带。' },
      { label: '交通补位', detail: '出租车与网约车同时补位，释放到达层集散压力。' },
      { label: '恢复稳定', detail: '客流峰值回落，持续回看重点分区负荷变化。' },
    ],
    routes: [
      { id: 'route-f', stepIndex: 1, path: 'M 514 276 C 464 322 404 352 336 382', label: '客流引导' },
      { id: 'route-g', stepIndex: 2, path: 'M 548 274 C 592 340 662 396 742 462', label: '运力接驳' },
    ],
    metrics: [
      { label: '运力匹配度', start: 54, end: 84, unit: '%' },
      { label: '预计疏散时长', start: 42, end: 24, unit: '分钟' },
      { label: '应急缺口', start: 14, end: 2, unit: '车次' },
      { label: '区域稳定度', start: 49, end: 85, unit: '%' },
    ],
    flowSeries: [24, 41, 58, 76],
    readinessSeries: [45, 64, 81, 93],
    bottlenecks: ['到达厅门前缓冲带', '网约车旅客集结点', '出租车发车节拍'],
    recommendations: [
      '增加到达厅出入口广播频次，提前切分旅客流线。',
      '将 P2 临停区切换为引流模式，承接部分接驳需求。',
      '在楼前设置人工疏导口令，避免旅客驻足聚集。',
    ],
    actions: [
      '锁定到达厅出口与门前缓冲带，启动聚集观察。',
      '打开双通道疏散与临时围栏，建立分流路径。',
      '同步补位出租车与网约车资源，释放集散压力。',
      '回看重点分区负荷变化，形成下一轮调度建议。',
    ],
  },
};

export function renderEmergencyPage({ data, route, state, navigate }) {
  const scenarios = data.emergencyScenarios.map((item) => normalizeScenario(item));
  const scenario = resolveScenario(scenarios, route, state);
  const sourceAlert =
    data.alerts.find((item) => item.id === route.params.get('alert')) ??
    data.alerts.find((item) => item.id === scenario.sourceAlertId) ??
    data.alerts.find((item) => item.scenarioId === scenario.id) ??
    data.alerts[0];

  state.selection.emergencyScenarioId = scenario.id;
  state.selection.alertId = sourceAlert.id;
  state.selection.regionId = scenario.regionId;

  const progress = Math.min(state.emergency.progress, scenario.steps.length - 1);
  const linkedVideos = data.videos.filter((video) => sourceAlert.relatedResourceIds.includes(video.id));
  const regionName = resolveRegionName(data, scenario.regionId);

  return {
    html: `
      <section class="page page--emergency">
        <div class="page-grid page-grid--three-column">
          <aside class="panel-stack">
            <section class="panel panel--hero reveal">
              <div class="panel-heading">
                <span class="panel-kicker">场景模板</span>
                <h2>${scenario.name}</h2>
              </div>
              <div class="scenario-switcher">
                ${scenarios
                  .map(
                    (item) => `
                      <button
                        class="resource-chip ${item.id === scenario.id ? 'is-active' : ''}"
                        type="button"
                        data-scenario-id="${item.id}"
                      >
                        ${item.name}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="property-list">
                <div><span>事件类型</span><strong>${scenario.eventType}</strong></div>
                <div><span>影响时长</span><strong>${scenario.duration}</strong></div>
                <div><span>客流等级</span><strong>${scenario.passengerLevel}</strong></div>
                <div><span>天气条件</span><strong>${scenario.weather}</strong></div>
                <div><span>运力策略</span><strong>${scenario.supportStrategy}</strong></div>
              </div>
            </section>

            <section class="panel reveal" style="animation-delay: 70ms;">
              <div class="panel-heading">
                <span class="panel-kicker">触发来源</span>
                <h3>${sourceAlert.title}</h3>
              </div>
              <p class="panel-copy">${sourceAlert.summary}</p>
              <div class="focus-summary">
                <span class="tone tone--${getAlertTone(sourceAlert.level)}">${sourceAlert.status}</span>
                <span>${sourceAlert.time}</span>
              </div>
              <div class="mini-metrics">
                <article class="metric-line">
                  <span>影响区域</span>
                  <strong>${regionName}</strong>
                </article>
                <article class="metric-line">
                  <span>联动视频</span>
                  <strong>${linkedVideos.length} 路</strong>
                </article>
              </div>
            </section>

            <section class="panel reveal" style="animation-delay: 110ms;">
              <div class="panel-heading">
                <span class="panel-kicker">推演控制</span>
                <h3>进度启停与跳步</h3>
              </div>
              <div class="control-row">
                <button class="action-button" type="button" data-play-emergency>${state.emergency.playing ? '推演中' : '开始推演'}</button>
                <button class="action-button action-button--ghost" type="button" data-pause-emergency>暂停</button>
                <button class="action-button action-button--ghost" type="button" data-reset-emergency>回放</button>
              </div>
              <div class="timeline-list">
                ${scenario.steps
                  .map(
                    (step, index) => `
                      <article class="timeline-item ${index <= progress ? 'is-active' : ''}" data-step-index="${index}">
                        <span>${String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>${step.label}</strong>
                          <small>${step.detail}</small>
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </section>
          </aside>

          <section class="panel panel--map reveal" style="animation-delay: 60ms;">
            <div class="panel-heading panel-heading--map">
              <div>
                <span class="panel-kicker">场景推演</span>
                <h2>事件区域、路径与资源联动</h2>
              </div>
              <div class="map-state">
                <span class="dot dot--warning"></span>
                当前阶段：<strong class="js-stage-label">${scenario.steps[progress].label}</strong>
              </div>
            </div>
            <div class="progress-strip">
              <span class="progress-strip__label">推演进度</span>
              <div class="progress-strip__bar">
                <span style="width: ${((progress + 1) / scenario.steps.length) * 100}%"></span>
              </div>
            </div>
            ${renderMapScene({
              mapAssets: data.mapAssets,
              alerts: [sourceAlert],
              videos: linkedVideos,
              mode: 'emergency',
              focusRegionId: scenario.regionId,
              activeAlertId: sourceAlert.id,
              emergencyScenario: scenario,
              emergencyProgress: progress,
            })}
            <div class="map-caption">
              <div>
                <span class="panel-kicker">当前目标</span>
                <strong class="js-stage-title">${scenario.steps[progress].label}</strong>
                <p class="js-stage-detail">${scenario.steps[progress].detail}</p>
              </div>
              <div>
                <span class="panel-kicker">风险瓶颈</span>
                <strong>${scenario.bottlenecks[0]}</strong>
                <p>${scenario.recommendations[0]}</p>
              </div>
              <div>
                <span class="panel-kicker">返回总览</span>
                <button class="mini-link" type="button" data-back-overview>返回监测大厅</button>
              </div>
            </div>
          </section>

          <aside class="panel-stack">
            <section class="panel reveal" style="animation-delay: 100ms;">
              <div class="panel-heading">
                <span class="panel-kicker">结果指标</span>
                <h3>应急处置评估</h3>
              </div>
              <div class="metric-column js-emergency-metrics">
                ${renderEmergencyMetrics(scenario, progress)}
              </div>
            </section>

            <section class="panel reveal" style="animation-delay: 140ms;">
              <div class="panel-heading">
                <span class="panel-kicker">过程曲线</span>
                <h3>疏散效率演进</h3>
              </div>
              <div class="chart-host" id="emergency-flow-chart"></div>
            </section>

            <section class="panel reveal" style="animation-delay: 180ms;">
              <div class="panel-heading">
                <span class="panel-kicker">动作回显</span>
                <h3>当前处置动作</h3>
              </div>
              <div class="chart-host chart-host--compact" id="emergency-ready-chart"></div>
              <div class="stage-feed">
                ${scenario.actions
                  .map(
                    (item, index) => `
                      <article class="stage-feed__item ${index <= progress ? 'is-active' : ''}">
                        <span>${String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>${item}</strong>
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
              <div class="recommendation-list">
                ${scenario.recommendations
                  .map((item) => `<div class="recommendation-item">${item}</div>`)
                  .join('')}
              </div>
            </section>
          </aside>
        </div>
      </section>
    `,
    setup: (container) =>
      setupEmergencyPage({
        container,
        data,
        state,
        scenario,
        sourceAlert,
        navigate,
      }),
  };
}

function setupEmergencyPage({ container, data, state, scenario, sourceAlert, navigate }) {
  const maxProgress = scenario.steps.length - 1;
  state.emergency.progress = Math.min(state.emergency.progress, maxProgress);

  const flowChart = mountChart(
    container.querySelector('#emergency-flow-chart'),
    createFlowOption(scenario, state.emergency.progress),
  );
  const readinessChart = mountChart(
    container.querySelector('#emergency-ready-chart'),
    createReadinessOption(scenario, state.emergency.progress),
  );

  let playTimer = null;

  const syncPage = () => {
    const progress = state.emergency.progress;
    container.querySelector('.js-stage-label').textContent = scenario.steps[progress].label;
    container.querySelector('.js-stage-title').textContent = scenario.steps[progress].label;
    container.querySelector('.js-stage-detail').textContent = scenario.steps[progress].detail;
    container.querySelector('.js-emergency-metrics').innerHTML = renderEmergencyMetrics(scenario, progress);
    container.querySelector('.progress-strip__bar span').style.width = `${((progress + 1) / scenario.steps.length) * 100}%`;
    container.querySelector('[data-play-emergency]').textContent = state.emergency.playing ? '推演中' : '开始推演';

    container.querySelectorAll('.timeline-item').forEach((item) => {
      const stepIndex = Number(item.dataset.stepIndex);
      item.classList.toggle('is-active', stepIndex <= progress);
    });

    container.querySelectorAll('.scene-route').forEach((item) => {
      const stepIndex = Number(item.dataset.stepIndex);
      item.classList.toggle('is-active', stepIndex <= progress);
    });

    container.querySelectorAll('.stage-feed__item').forEach((item, index) => {
      item.classList.toggle('is-active', index <= progress);
    });

    updateChart(flowChart, createFlowOption(scenario, progress));
    updateChart(readinessChart, createReadinessOption(scenario, progress));
  };

  const stopPlayback = () => {
    state.emergency.playing = false;
    if (playTimer) {
      window.clearInterval(playTimer);
      playTimer = null;
    }
    syncPage();
  };

  const startPlayback = () => {
    stopPlayback();
    state.emergency.playing = true;
    syncPage();

    playTimer = window.setInterval(() => {
      if (state.emergency.progress >= maxProgress) {
        stopPlayback();
        return;
      }

      state.emergency.progress += 1;
      syncPage();
    }, 1600);
  };

  container.querySelectorAll('[data-scenario-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.emergency.progress = 0;
      state.emergency.playing = false;
      navigate('emergency', {
        scenario: button.dataset.scenarioId,
        alert: data.alerts.find((item) => item.scenarioId === button.dataset.scenarioId)?.id ?? sourceAlert.id,
      });
    });
  });

  container.querySelectorAll('.timeline-item').forEach((item) => {
    item.addEventListener('click', () => {
      stopPlayback();
      state.emergency.progress = Number(item.dataset.stepIndex);
      syncPage();
    });
  });

  container.querySelector('[data-play-emergency]')?.addEventListener('click', startPlayback);
  container.querySelector('[data-pause-emergency]')?.addEventListener('click', stopPlayback);
  container.querySelector('[data-reset-emergency]')?.addEventListener('click', () => {
    stopPlayback();
    state.emergency.progress = 0;
    syncPage();
  });
  container.querySelector('[data-back-overview]')?.addEventListener('click', () => {
    navigate('overview', {
      alert: sourceAlert.id,
      video: sourceAlert.relatedResourceIds[0],
      region: scenario.regionId,
    });
  });

  syncPage();
  if (state.emergency.playing) {
    startPlayback();
  }

  return () => stopPlayback();
}

function resolveScenario(scenarios, route, state) {
  const scenarioId = route.params.get('scenario');
  return (
    scenarios.find((item) => item.id === scenarioId) ??
    scenarios.find((item) => item.id === state.selection.emergencyScenarioId) ??
    scenarios[0]
  );
}

function resolveRegionName(data, regionId) {
  return data.mapAssets.regions.find((item) => item.id === regionId)?.name ?? '重点区域';
}

function normalizeScenario(scenario) {
  const fallback = EMERGENCY_SCENARIO_CONTENT[scenario.id];
  if (!fallback) {
    return {
      ...scenario,
      actions: scenario.actions ?? scenario.steps.map((step) => step.detail),
    };
  }

  return {
    ...scenario,
    ...fallback,
  };
}

function renderEmergencyMetrics(scenario, progress) {
  const maxProgress = scenario.steps.length - 1;

  return scenario.metrics
    .map((metric) => {
      const value = interpolateMetric(
        metric.start,
        metric.end,
        progress,
        maxProgress,
        metric.unit === '' ? 2 : 0,
      );
      return `
        <article class="metric-line">
          <span>${metric.label}</span>
          <strong>${formatMetricValue(value, metric.unit === '' ? 2 : 0)}${metric.unit}</strong>
        </article>
      `;
    })
    .join('');
}

function createFlowOption(scenario, progress) {
  const amplified = scenario.flowSeries.map((value, index) =>
    index <= progress ? value : Number((value * 0.72).toFixed(1)),
  );

  return buildLineChartOption({
    categories: scenario.steps.map((item) => item.label),
    colors: ['#70d1ff'],
    series: [
      {
        name: '疏散效率',
        data: amplified,
      },
    ],
  });
}

function createReadinessOption(scenario, progress) {
  const readySeries = scenario.readinessSeries.map((value, index) =>
    index <= progress ? value : Number((value * 0.7).toFixed(1)),
  );

  return buildBarChartOption({
    categories: scenario.steps.map((item) => item.label),
    colors: ['#f4b259'],
    series: [
      {
        name: '准备度',
        data: readySeries,
      },
    ],
  });
}
