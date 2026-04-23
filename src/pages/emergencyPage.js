import { renderMapScene } from '../components/mapScene.js';
import {
  buildBarChartOption,
  buildLineChartOption,
  mountChart,
  updateChart,
} from '../lib/charts.js';
import { formatMetricValue, getAlertTone, interpolateMetric } from '../lib/format.js';

const EMERGENCY_ACTIONS = [
  '锁定到达到层东侧上客区，建立事件观察圈。',
  '调入出租车补位与摆渡车临时增发策略。',
  '打开双通道疏散线路，释放旅客分流能力。',
  '回看瓶颈恢复情况，输出下一阶段处置建议。',
];

export function renderEmergencyPage({ data, route, state, navigate }) {
  const scenario = resolveScenario(data, route, state);
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
                ${data.emergencyScenarios
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
                  <strong>${resolveRegionName(data, scenario.regionId)}</strong>
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
                ${EMERGENCY_ACTIONS.map(
                  (item, index) => `
                    <article class="stage-feed__item ${index <= progress ? 'is-active' : ''}">
                      <span>${String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>${item}</strong>
                      </div>
                    </article>
                  `,
                ).join('')}
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

function resolveScenario(data, route, state) {
  const scenarioId = route.params.get('scenario');
  return (
    data.emergencyScenarios.find((item) => item.id === scenarioId) ??
    data.emergencyScenarios.find((item) => item.id === state.selection.emergencyScenarioId) ??
    data.emergencyScenarios[0]
  );
}

function resolveRegionName(data, regionId) {
  return data.mapAssets.regions.find((item) => item.id === regionId)?.name ?? '重点区域';
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
