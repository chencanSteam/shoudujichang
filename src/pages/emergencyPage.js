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

const EMERGENCY_OPERATION_CONTACTS = [
  {
    department: '出租车运营',
    contact: '李明',
    role: '出租车调度席',
    phone: '010-6454-**** / 内线 6201',
    channel: 'T3 到达层出租车保障群',
    duty: '负责出租车蓄车、补位窗口和楼前发车节拍联动。',
  },
  {
    department: '机场巴士',
    contact: '周岚',
    role: '巴士运行调度',
    phone: '010-6454-**** / 内线 6202',
    channel: '机场巴士应急调度群',
    duty: '负责巴士站台轮转、临时加密班次和摆渡车衔接。',
  },
  {
    department: '网约车保障',
    contact: '王晨',
    role: '网约车接驳协调',
    phone: '010-6454-**** / 内线 6203',
    channel: 'P2 网约车保障群',
    duty: '负责网约车上客区排队、P2 引流和平台侧运力响应。',
  },
  {
    department: '地铁联络',
    contact: '陈昊',
    role: '轨道交通联络员',
    phone: '010-6454-**** / 内线 6204',
    channel: '轨道交通协同群',
    duty: '负责地铁客流承接、末班车信息同步和站厅限流联动。',
  },
  {
    department: '公交接驳',
    contact: '赵宁',
    role: '公交运力协调',
    phone: '010-6454-**** / 内线 6205',
    channel: '公交接驳保障群',
    duty: '负责公交临时加车、站点排队秩序和外围疏散协同。',
  },
  {
    department: '综合交通枢纽',
    contact: '刘洋',
    role: '现场值班负责人',
    phone: '010-6454-**** / 内线 6200',
    channel: '公共区交通联动总群',
    duty: '负责跨部门升级、资源统筹和应急推演口径确认。',
  },
];

const EMERGENCY_PLAN_STORAGE_KEY = 'capital-airport-emergency-plans-v2';
const EMERGENCY_MATERIAL_TYPES = ['引导牌', '隔离围栏', '对讲机', '急救包', '移动照明', '广播设备'];
const EMERGENCY_STEP_INTERVAL_MS = 4200;

export function renderEmergencyPage({ data, route, state, navigate }) {
  ensureEmergencyPlanState(state, data);
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
  const activePlan = getNormalizedActivePlan(state, data, scenario);
  const scenarioView = applyEmergencyPlan(scenario, activePlan);
  const displayProgress = Math.min(progress, scenarioView.steps.length - 1);
  const planDraft = getEmergencyPlanDraft(state, data, scenario);

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
                <div><span>事件类型</span><strong>${scenarioView.eventType}</strong></div>
                <div><span>影响时长</span><strong>${scenarioView.duration}</strong></div>
                <div><span>客流等级</span><strong>${scenarioView.passengerLevel}</strong></div>
                <div><span>天气条件</span><strong>${scenarioView.weather}</strong></div>
                <div><span>运力策略</span><strong>${scenarioView.supportStrategy}</strong></div>
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
              <div class="timeline-list js-emergency-timeline">
                ${scenarioView.steps
                  .map(
                    (step, index) => `
                      <article class="timeline-item ${index <= displayProgress ? 'is-active' : ''}" data-step-index="${index}">
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
                当前阶段：<strong class="js-stage-label">${scenarioView.steps[displayProgress].label}</strong>
              </div>
            </div>
            <div class="progress-strip">
              <span class="progress-strip__label">推演进度</span>
              <div class="progress-strip__bar">
                <span style="width: ${((displayProgress + 1) / scenarioView.steps.length) * 100}%"></span>
              </div>
            </div>
            <div class="js-emergency-map-scene">
              ${renderMapScene({
                mapAssets: data.mapAssets,
                alerts: [sourceAlert],
                videos: linkedVideos,
                mode: 'emergency',
                focusRegionId: scenario.regionId,
                activeAlertId: sourceAlert.id,
                emergencyScenario: scenarioView,
                emergencyPlan: activePlan,
                emergencyProgress: displayProgress,
              })}
            </div>
            <div class="map-caption">
              <div>
                <span class="panel-kicker">当前目标</span>
                <strong class="js-stage-title">${scenarioView.steps[displayProgress].label}</strong>
                <p class="js-stage-detail">${scenarioView.steps[displayProgress].detail}</p>
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
                ${renderEmergencyMetrics(scenarioView, displayProgress)}
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
              <div class="stage-feed js-stage-feed">
                ${scenarioView.actions
                  .map(
                    (item, index) => `
                      <article class="stage-feed__item ${index <= displayProgress ? 'is-active' : ''}">
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

          <section class="panel panel--footer emergency-plan-editor reveal" style="animation-delay: 210ms;">
            <div class="js-emergency-plan-editor">
              ${renderEmergencyPlanEditor({
                data,
                state,
                scenario,
                planDraft,
                activePlan,
              })}
            </div>
          </section>

          <section class="panel panel--footer emergency-contacts emergency-contacts--compact reveal" style="animation-delay: 220ms;">
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">运营联络</span>
                <h3>应急保障部门值班通讯录</h3>
              </div>
              <span class="contact-standby">24h 值守</span>
            </div>
            <div class="emergency-contact-grid">
              ${renderEmergencyContacts()}
            </div>
          </section>
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
  let scenarioView = applyEmergencyPlan(scenario, getNormalizedActivePlan(state, data, scenario));
  state.emergency.progress = Math.min(state.emergency.progress, scenarioView.steps.length - 1);
  const linkedVideos = data.videos.filter((video) => sourceAlert.relatedResourceIds.includes(video.id));

  const flowChart = mountChart(
    container.querySelector('#emergency-flow-chart'),
    createFlowOption(scenarioView, state.emergency.progress),
  );
  const readinessChart = mountChart(
    container.querySelector('#emergency-ready-chart'),
    createReadinessOption(scenarioView, state.emergency.progress),
  );

  let playTimer = null;

  const getProgress = () => Math.min(state.emergency.progress, scenarioView.steps.length - 1);

  const renderMap = (progress) => {
    const host = container.querySelector('.js-emergency-map-scene');
    if (!host) {
      return;
    }

    host.innerHTML = renderMapScene({
      mapAssets: data.mapAssets,
      alerts: [sourceAlert],
      videos: linkedVideos,
      mode: 'emergency',
      focusRegionId: scenario.regionId,
      activeAlertId: sourceAlert.id,
      emergencyScenario: scenarioView,
      emergencyPlan: getNormalizedActivePlan(state, data, scenario),
      emergencyProgress: progress,
    });
  };

  const renderEditor = () => {
    const editor = container.querySelector('.js-emergency-plan-editor');
    if (!editor) {
      return;
    }

    editor.innerHTML = renderEmergencyPlanEditor({
      data,
      state,
      scenario,
      planDraft: getEmergencyPlanDraft(state, data, scenario),
      activePlan: getNormalizedActivePlan(state, data, scenario),
    });
    bindEditorEvents();
  };

  const syncPage = () => {
    scenarioView = applyEmergencyPlan(scenario, getNormalizedActivePlan(state, data, scenario));
    state.emergency.progress = getProgress();
    const progress = getProgress();
    const currentStep = scenarioView.steps[progress];
    container.querySelector('.js-stage-label').textContent = currentStep.label;
    container.querySelector('.js-stage-title').textContent = currentStep.label;
    container.querySelector('.js-stage-detail').textContent = currentStep.detail;
    container.querySelector('.js-emergency-metrics').innerHTML = renderEmergencyMetrics(scenarioView, progress);
    container.querySelector('.progress-strip__bar span').style.width = `${((progress + 1) / scenarioView.steps.length) * 100}%`;
    container.querySelector('[data-play-emergency]').textContent = state.emergency.playing ? '推演中' : '开始推演';

    container.querySelector('.js-emergency-timeline').innerHTML = renderTimelineItems(scenarioView, progress);
    container.querySelector('.js-stage-feed').innerHTML = renderStageFeedItems(scenarioView, progress);
    bindTimelineEvents();

    renderMap(progress);
    updateChart(flowChart, createFlowOption(scenarioView, progress));
    updateChart(readinessChart, createReadinessOption(scenarioView, progress));
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
      if (state.emergency.progress >= scenarioView.steps.length - 1) {
        stopPlayback();
        return;
      }

      state.emergency.progress += 1;
      syncPage();
    }, EMERGENCY_STEP_INTERVAL_MS);
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

  function bindTimelineEvents() {
    container.querySelectorAll('.timeline-item').forEach((item) => {
      item.addEventListener('click', () => {
        stopPlayback();
        state.emergency.progress = Number(item.dataset.stepIndex);
        syncPage();
      });
    });
  }

  function writeDraft(nextDraft) {
    state.emergency.planDrafts[scenario.id] = normalizeEmergencyPlan(nextDraft, data, scenario);
  }

  function updateDraft(patch) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    writeDraft({
      ...current,
      ...patch,
    });
  }

  function updateStepDraft(index, field, value) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    const steps = current.steps.map((step, stepIndex) =>
      stepIndex === index
        ? {
            ...step,
            [field]: value,
          }
        : step,
    );
    updateDraft({ steps });
  }

  function updateTaskDraft(stepIndex, taskType, taskId, field, value) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    const listKey = taskListKey(taskType);
    const steps = current.steps.map((step, index) => {
      if (index !== stepIndex) {
        return step;
      }

      return {
        ...step,
        [listKey]: step[listKey].map((task) =>
          task.id === taskId
            ? {
                ...task,
                [field]: field === 'count' ? normalizePlanNumber(value, task.count) : sanitizePlanText(value, task[field]),
              }
            : task,
        ),
      };
    });
    updateDraft({ steps });
  }

  function addPlanStep() {
    const current = getEmergencyPlanDraft(state, data, scenario);
    const nextIndex = current.steps.length;
    updateDraft({
      steps: [
        ...current.steps,
        createEmergencyPlanStep(data, scenario, nextIndex, {
          label: `第${nextIndex + 1}步`,
          detail: '补充该阶段处置动作与资源调度要求。',
        }),
      ],
    });
    state.emergency.progress = Math.min(state.emergency.progress, current.steps.length);
  }

  function removePlanStep(stepIndex) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    if (current.steps.length <= 1) {
      return;
    }

    updateDraft({
      steps: current.steps.filter((_, index) => index !== stepIndex),
    });
    state.emergency.progress = Math.min(state.emergency.progress, current.steps.length - 2);
  }

  function addTask(stepIndex, taskType) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    const listKey = taskListKey(taskType);
    const steps = current.steps.map((step, index) =>
      index === stepIndex
        ? {
            ...step,
            [listKey]: [...step[listKey], createPlanTask(taskType, data, scenario, stepIndex, step[listKey].length)],
          }
        : step,
    );
    updateDraft({ steps });
  }

  function removeTask(stepIndex, taskType, taskId) {
    const current = getEmergencyPlanDraft(state, data, scenario);
    const listKey = taskListKey(taskType);
    const steps = current.steps.map((step, index) =>
      index === stepIndex
        ? {
            ...step,
            [listKey]: step[listKey].filter((task) => task.id !== taskId),
          }
        : step,
    );
    updateDraft({ steps });
  }

  function savePlan() {
    const draft = normalizeEmergencyPlan(getEmergencyPlanDraft(state, data, scenario), data, scenario);
    const savedPlan = {
      ...draft,
      id: `emergency-plan-${Date.now()}`,
      scenarioId: scenario.id,
      createdAt: formatLocalPlanTime(),
    };

    state.emergency.savedPlans = [
      savedPlan,
      ...state.emergency.savedPlans.filter((item) => item.id !== savedPlan.id),
    ].slice(0, 12);
    state.emergency.activePlanByScenario[scenario.id] = savedPlan;
    state.emergency.planDrafts[scenario.id] = savedPlan;
    state.emergency.progress = 0;
    state.emergency.playing = false;
    persistEmergencyPlans(state);
    syncPage();
    renderEditor();
  }

  function applyDraftPlan() {
    const draft = normalizeEmergencyPlan(getEmergencyPlanDraft(state, data, scenario), data, scenario);
    const appliedPlan = {
      ...draft,
      id: draft.id ?? `emergency-draft-${scenario.id}`,
      scenarioId: scenario.id,
      createdAt: draft.createdAt ?? '未保存草稿',
    };
    state.emergency.activePlanByScenario[scenario.id] = appliedPlan;
    state.emergency.planDrafts[scenario.id] = appliedPlan;
    state.emergency.progress = 0;
    state.emergency.playing = false;
    persistEmergencyPlans(state);
    syncPage();
    renderEditor();
  }

  function resetPlan() {
    delete state.emergency.activePlanByScenario[scenario.id];
    state.emergency.planDrafts[scenario.id] = createEmergencyPlanDraft(data, scenario);
    state.emergency.progress = 0;
    state.emergency.playing = false;
    persistEmergencyPlans(state);
    syncPage();
    renderEditor();
  }

  function loadSavedPlan(planId) {
    const plan = state.emergency.savedPlans.find((item) => item.id === planId);
    if (!plan) {
      return;
    }

    const normalized = normalizeEmergencyPlan(plan, data, scenario);
    state.emergency.planDrafts[scenario.id] = normalized;
    state.emergency.activePlanByScenario[scenario.id] = normalized;
    state.emergency.progress = 0;
    state.emergency.playing = false;
    persistEmergencyPlans(state);
    syncPage();
    renderEditor();
  }

  function bindEditorEvents() {
    const editor = container.querySelector('.js-emergency-plan-editor');
    if (!editor) {
      return;
    }
    if (editor.dataset.editorBound === 'true') {
      return;
    }
    editor.dataset.editorBound = 'true';

    editor.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target) {
        return;
      }

      if (target.matches('[data-toggle-plan-editor]')) {
        state.emergency.planEditorOpen = !state.emergency.planEditorOpen;
        renderEditor();
        return;
      }
      if (target.matches('[data-save-emergency-plan]')) {
        savePlan();
        return;
      }
      if (target.matches('[data-apply-emergency-plan]')) {
        applyDraftPlan();
        return;
      }
      if (target.matches('[data-reset-emergency-plan]')) {
        resetPlan();
        return;
      }
      if (target.matches('[data-add-plan-step]')) {
        addPlanStep();
        renderEditor();
        return;
      }
      if (target.matches('[data-remove-plan-step]')) {
        removePlanStep(Number(target.dataset.removePlanStep));
        renderEditor();
        return;
      }
      if (target.matches('[data-add-plan-task]')) {
        addTask(Number(target.dataset.stepIndex), target.dataset.addPlanTask);
        renderEditor();
        return;
      }
      if (target.matches('[data-remove-plan-task]')) {
        removeTask(Number(target.dataset.stepIndex), target.dataset.taskType, target.dataset.taskId);
        renderEditor();
        return;
      }
      if (target.matches('[data-load-emergency-plan]')) {
        loadSavedPlan(target.dataset.loadEmergencyPlan);
      }
    });

    editor.addEventListener('change', (event) => {
      const input = event.target;
      if (input.matches('[data-plan-text]')) {
        updateDraft({ [input.dataset.planText]: sanitizePlanText(input.value, input.defaultValue) });
        renderEditor();
        return;
      }
      if (input.matches('[data-plan-step-field]')) {
        updateStepDraft(
          Number(input.dataset.stepIndex),
          input.dataset.planStepField,
          sanitizePlanText(input.value, input.defaultValue),
        );
        renderEditor();
        return;
      }
      if (input.matches('[data-plan-task-field]')) {
        updateTaskDraft(
          Number(input.dataset.stepIndex),
          input.dataset.taskType,
          input.dataset.taskId,
          input.dataset.planTaskField,
          input.value,
        );
        renderEditor();
      }
    });
  }

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
  bindEditorEvents();
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

function ensureEmergencyPlanState(state, data) {
  state.emergency ??= {};
  state.emergency.planEditorOpen ??= false;
  state.emergency.activePlanByScenario ??= {};
  state.emergency.savedPlans ??= [];
  state.emergency.planDrafts ??= {};

  if (state.emergency.plansLoaded) {
    return;
  }

  const stored = loadStoredEmergencyPlans();
  state.emergency.savedPlans = Array.isArray(stored.savedPlans) ? stored.savedPlans : state.emergency.savedPlans;
  state.emergency.activePlanByScenario = {
    ...state.emergency.activePlanByScenario,
    ...(stored.activePlanByScenario ?? {}),
  };
  state.emergency.planDrafts = {
    ...state.emergency.planDrafts,
    ...(stored.planDrafts ?? {}),
  };

  data.emergencyScenarios.forEach((item) => {
    const scenario = normalizeScenario(item);
    state.emergency.planDrafts[scenario.id] ??= createEmergencyPlanDraft(data, scenario);
  });

  state.emergency.plansLoaded = true;
}

function loadStoredEmergencyPlans() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(EMERGENCY_PLAN_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function persistEmergencyPlans(state) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      EMERGENCY_PLAN_STORAGE_KEY,
      JSON.stringify({
        savedPlans: state.emergency.savedPlans,
        activePlanByScenario: state.emergency.activePlanByScenario,
        planDrafts: state.emergency.planDrafts,
      }),
    );
  } catch {
    // localStorage may be unavailable in private mode; current session state still works.
  }
}

function getActiveEmergencyPlan(state, scenarioId) {
  return state.emergency.activePlanByScenario?.[scenarioId] ?? null;
}

function getNormalizedActivePlan(state, data, scenario) {
  const activePlan = getActiveEmergencyPlan(state, scenario.id);
  if (!activePlan) {
    return null;
  }

  const normalized = normalizeEmergencyPlan(activePlan, data, scenario);
  state.emergency.activePlanByScenario[scenario.id] = normalized;
  return normalized;
}

function getEmergencyPlanDraft(state, data, scenario) {
  const draft = state.emergency.planDrafts?.[scenario.id] ?? createEmergencyPlanDraft(data, scenario);
  const normalized = normalizeEmergencyPlan(draft, data, scenario);
  state.emergency.planDrafts[scenario.id] = normalized;
  return normalized;
}

function createEmergencyPlanDraft(data, scenario) {
  const defaultVehicleOrigin = scenario.id === 'bad-weather' ? 'bus-hub' : 'taxi-pool';
  const targetRegion = scenario.regionId ?? data.mapAssets.regions[0]?.id ?? 't3-terminal';
  const vehicleOrigin =
    hasRegion(data, defaultVehicleOrigin) && defaultVehicleOrigin !== targetRegion
      ? defaultVehicleOrigin
      : 'command-center';

  return {
    id: `default-${scenario.id}`,
    scenarioId: scenario.id,
    name: `${scenario.name}应急预案`,
    steps: scenario.steps.map((step, index) =>
      createEmergencyPlanStep(data, scenario, index, {
        ...step,
        vehicleOrigin,
      }),
    ),
  };
}

function createEmergencyPlanStep(data, scenario, index, source = {}) {
  const targetRegion = scenario.regionId ?? data.mapAssets.regions[0]?.id ?? 't3-terminal';
  const vehicleOrigin = source.vehicleOrigin ?? (scenario.id === 'bad-weather' ? 'bus-hub' : 'taxi-pool');
  const safeVehicleOrigin =
    hasRegion(data, vehicleOrigin) && vehicleOrigin !== targetRegion ? vehicleOrigin : 'command-center';
  const shouldIncludeMaterial = index > 0 && index < Math.max(2, scenario.steps.length - 1);

  return {
    id: source.id ?? `step-${scenario.id}-${index}`,
    label: sanitizePlanText(source.label, `第${index + 1}步`),
    detail: sanitizePlanText(source.detail, '补充该阶段处置动作与资源调度要求。'),
    personnelTasks: [
      createPlanTask('personnel', data, scenario, index, 0, {
        id: `personnel-${scenario.id}-${index}-0`,
        role: index === 0 ? '值班指挥员' : '现场引导员',
        count: index === 0 ? 4 : 8 + index * 2,
        fromRegionId: 'command-center',
        toRegionId: targetRegion,
      }),
    ],
    materialTasks: shouldIncludeMaterial
      ? [
          createPlanTask('material', data, scenario, index, 0, {
            id: `material-${scenario.id}-${index}-0`,
            type: index === 1 ? '隔离围栏' : '引导牌',
            count: index === 1 ? 16 : 24,
            fromRegionId: 'command-center',
            toRegionId: targetRegion,
          }),
        ]
      : [],
    vehicleTasks: [
      createPlanTask('vehicle', data, scenario, index, 0, {
        id: `vehicle-${scenario.id}-${index}-0`,
        type: scenario.id === 'bad-weather' ? '应急巴士' : '保障车辆',
        count: index === 0 ? 2 : 4 + index,
        fromRegionId: safeVehicleOrigin,
        toRegionId: targetRegion,
      }),
    ],
  };
}

function createPlanTask(taskType, data, scenario, stepIndex, taskIndex, override = {}) {
  const targetRegion = scenario.regionId ?? data.mapAssets.regions[0]?.id ?? 't3-terminal';
  const base = {
    id: override.id ?? `${taskType}-${Date.now()}-${stepIndex}-${taskIndex}`,
    count: normalizePlanNumber(override.count, 1),
    fromRegionId: override.fromRegionId ?? 'command-center',
    toRegionId: override.toRegionId ?? targetRegion,
  };

  if (taskType === 'personnel') {
    return {
      ...base,
      role: sanitizePlanText(override.role, '现场引导员'),
    };
  }

  if (taskType === 'material') {
    return {
      ...base,
      type: normalizeMaterialType(override.type),
    };
  }

  return {
    ...base,
    type: sanitizePlanText(override.type, '保障车辆'),
  };
}

function normalizeEmergencyPlan(plan, data, scenario) {
  const fallback = createEmergencyPlanDraft(data, scenario);
  const regionIds = data.mapAssets.regions.map((region) => region.id);
  const safeRegion = (regionId, fallbackRegionId) =>
    regionIds.includes(regionId) ? regionId : fallbackRegionId;

  const merged = {
    ...fallback,
    ...(plan ?? {}),
  };

  return {
    ...merged,
    scenarioId: scenario.id,
    name: sanitizePlanText(merged.name, fallback.name),
    steps: normalizePlanSteps(merged.steps, fallback.steps, data, scenario, safeRegion),
  };
}

function normalizePlanSteps(steps, fallbackSteps, data, scenario, safeRegion) {
  const sourceSteps = Array.isArray(steps) && steps.length ? steps : fallbackSteps;

  return sourceSteps.map((step, index) => {
    const fallback = fallbackSteps[index] ?? createEmergencyPlanStep(data, scenario, index);

    return {
      id: sanitizePlanText(step?.id, fallback.id),
      label: sanitizePlanText(step?.label, fallback.label),
      detail: sanitizePlanText(step?.detail, fallback.detail),
      personnelTasks: normalizeTaskList('personnel', step?.personnelTasks, fallback.personnelTasks, safeRegion),
      materialTasks: normalizeTaskList('material', step?.materialTasks, fallback.materialTasks, safeRegion),
      vehicleTasks: normalizeTaskList('vehicle', step?.vehicleTasks, fallback.vehicleTasks, safeRegion),
    };
  });
}

function normalizeTaskList(taskType, tasks, fallbackTasks, safeRegion) {
  const sourceTasks = Array.isArray(tasks) ? tasks : fallbackTasks;

  return sourceTasks.map((task, index) => {
    const fallback = fallbackTasks[index] ?? fallbackTasks[0] ?? {};
    const base = {
      id: sanitizePlanText(task?.id, fallback.id ?? `${taskType}-${index}`),
      count: normalizePlanNumber(task?.count, fallback.count ?? 1),
      fromRegionId: safeRegion(task?.fromRegionId, fallback.fromRegionId ?? 'command-center'),
      toRegionId: safeRegion(task?.toRegionId, fallback.toRegionId ?? 't3-terminal'),
    };

    if (taskType === 'personnel') {
      return {
        ...base,
        role: sanitizePlanText(task?.role, fallback.role ?? '现场引导员'),
      };
    }

    if (taskType === 'material') {
      return {
        ...base,
        type: normalizeMaterialType(task?.type ?? fallback.type),
      };
    }

    return {
      ...base,
      type: sanitizePlanText(task?.type, fallback.type ?? '保障车辆'),
    };
  });
}

function applyEmergencyPlan(scenario, plan) {
  if (!plan) {
    return scenario;
  }

  const steps = plan.steps?.length ? plan.steps : scenario.steps;
  return {
    ...scenario,
    steps,
    actions: steps.map((step) => step.detail),
    supportStrategy: summarizePlanResources(plan),
  };
}

function summarizePlanResources(plan) {
  const totals = plan.steps.reduce(
    (result, step) => ({
      personnel: result.personnel + sumTaskCount(step.personnelTasks),
      vehicles: result.vehicles + sumTaskCount(step.vehicleTasks),
      materials: result.materials + sumTaskCount(step.materialTasks),
    }),
    { personnel: 0, vehicles: 0, materials: 0 },
  );

  return `人员 ${totals.personnel}人 + 车辆 ${totals.vehicles}辆 + 物资 ${totals.materials}套`;
}

function sumTaskCount(tasks = []) {
  return tasks.reduce((total, task) => total + (Number(task.count) || 0), 0);
}

function hasRegion(data, regionId) {
  return data.mapAssets.regions.some((region) => region.id === regionId);
}

function taskListKey(taskType) {
  return {
    personnel: 'personnelTasks',
    material: 'materialTasks',
    vehicle: 'vehicleTasks',
  }[taskType];
}

function normalizeMaterialType(value) {
  return EMERGENCY_MATERIAL_TYPES.includes(value) ? value : EMERGENCY_MATERIAL_TYPES[0];
}

function renderTimelineItems(scenario, progress) {
  return scenario.steps
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
    .join('');
}

function renderStageFeedItems(scenario, progress) {
  return scenario.actions
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
    .join('');
}

function renderEmergencyPlanEditor({ data, state, scenario, planDraft, activePlan }) {
  const isOpen = state.emergency.planEditorOpen;
  const savedPlans = state.emergency.savedPlans.filter((plan) => plan.scenarioId === scenario.id);

  return `
    <div class="emergency-plan-editor__head">
      <div>
        <span class="panel-kicker">预案编辑</span>
        <h3>${activePlan ? escapeHtml(activePlan.name) : '默认应急推演配置'}</h3>
      </div>
      <div class="emergency-plan-editor__actions">
        <span class="script-chip">${savedPlans.length} 个本地预案</span>
        <button class="action-button action-button--ghost" type="button" data-toggle-plan-editor>
          ${isOpen ? '收起编辑' : '编辑预案'}
        </button>
      </div>
    </div>
    ${
      isOpen
        ? `
          <div class="emergency-plan-editor__body">
            <div class="emergency-plan-form emergency-plan-form--name">
              ${renderTextField('预案名称', 'name', planDraft.name)}
            </div>

            <div class="emergency-step-form">
              ${planDraft.steps.map((step, index) => renderPlanStepEditor(step, index, data.mapAssets.regions, planDraft.steps.length)).join('')}
            </div>

            <div class="emergency-plan-toolbar">
              <button class="action-button action-button--ghost" type="button" data-add-plan-step>新增步骤</button>
              <button class="action-button" type="button" data-apply-emergency-plan>应用演练</button>
              <button class="action-button action-button--ghost" type="button" data-save-emergency-plan>保存预案</button>
              <button class="action-button action-button--ghost" type="button" data-reset-emergency-plan>恢复默认</button>
            </div>

            <div class="emergency-saved-plan-strip">
              ${
                savedPlans.length
                  ? savedPlans
                      .map(
                        (plan) => `
                          <button class="saved-plan-pill" type="button" data-load-emergency-plan="${escapeAttribute(plan.id)}">
                            <strong>${escapeHtml(plan.name)}</strong>
                            <span>${escapeHtml(plan.createdAt ?? '本地保存')}</span>
                          </button>
                        `,
                      )
                      .join('')
                  : '<span class="saved-plan-empty">当前场景还没有保存的本地预案。</span>'
              }
            </div>
          </div>
        `
        : ''
    }
  `;
}

function renderPlanStepEditor(step, stepIndex, regions, stepCount) {
  const stepName = `第${stepIndex + 1}步`;

  return `
    <details class="emergency-step-panel" ${stepIndex === 0 ? 'open' : ''}>
      <summary>
        <span>${stepName}</span>
        <strong>${escapeHtml(step.label)}</strong>
        <small>${taskCountSummary(step)}</small>
      </summary>
      <div class="emergency-step-panel__body">
        <div class="emergency-step-copy">
          <label class="emergency-form-field">
            <span>阶段标题</span>
            <input
              type="text"
              value="${escapeAttribute(step.label)}"
              data-plan-step-field="label"
              data-step-index="${stepIndex}"
            />
          </label>
          <label class="emergency-form-field">
            <span>阶段说明</span>
            <textarea
              rows="2"
              data-plan-step-field="detail"
              data-step-index="${stepIndex}"
            >${escapeHtml(step.detail)}</textarea>
          </label>
          <button
            class="mini-link"
            type="button"
            data-remove-plan-step="${stepIndex}"
            ${stepCount <= 1 ? 'disabled' : ''}
          >
            删除步骤
          </button>
        </div>

        <div class="emergency-task-board">
          ${renderTaskGroup('personnel', '人员任务', step.personnelTasks, stepIndex, regions)}
          ${renderTaskGroup('material', '物资任务', step.materialTasks, stepIndex, regions)}
          ${renderTaskGroup('vehicle', '车辆任务', step.vehicleTasks, stepIndex, regions)}
        </div>
      </div>
    </details>
  `;
}

function renderTaskGroup(taskType, title, tasks, stepIndex, regions) {
  return `
    <section class="emergency-task-group emergency-task-group--${taskType}">
      <div class="emergency-task-group__head">
        <span>${title}</span>
        <button class="mini-link" type="button" data-add-plan-task="${taskType}" data-step-index="${stepIndex}">
          新增
        </button>
      </div>
      <div class="emergency-task-list">
        ${
          tasks.length
            ? tasks.map((task) => renderTaskRow(taskType, task, stepIndex, regions)).join('')
            : '<div class="task-empty">本步骤暂无任务。</div>'
        }
      </div>
    </section>
  `;
}

function renderTaskRow(taskType, task, stepIndex, regions) {
  const typeLabel = taskType === 'personnel' ? '人员角色' : taskType === 'material' ? '物资类型' : '车辆类型';

  return `
    <article class="emergency-task-row">
      ${renderTaskTypeField(taskType, typeLabel, task, stepIndex)}
      ${renderTaskCountField(taskType, task, stepIndex)}
      ${renderTaskRegionSelect(taskType, task, stepIndex, 'fromRegionId', regions)}
      ${renderTaskRegionSelect(taskType, task, stepIndex, 'toRegionId', regions)}
      <button
        class="mini-link"
        type="button"
        data-remove-plan-task
        data-task-type="${taskType}"
        data-task-id="${escapeAttribute(task.id)}"
        data-step-index="${stepIndex}"
      >
        删除
      </button>
    </article>
  `;
}

function renderTaskTypeField(taskType, label, task, stepIndex) {
  if (taskType === 'material') {
    return `
      <label class="emergency-form-field">
        <span>${label}</span>
        <select
          data-plan-task-field="type"
          data-task-type="${taskType}"
          data-task-id="${escapeAttribute(task.id)}"
          data-step-index="${stepIndex}"
        >
          ${EMERGENCY_MATERIAL_TYPES.map(
            (type) => `<option value="${type}" ${type === task.type ? 'selected' : ''}>${type}</option>`,
          ).join('')}
        </select>
      </label>
    `;
  }

  const field = taskType === 'personnel' ? 'role' : 'type';
  return `
    <label class="emergency-form-field">
      <span>${label}</span>
      <input
        type="text"
        value="${escapeAttribute(task[field])}"
        data-plan-task-field="${field}"
        data-task-type="${taskType}"
        data-task-id="${escapeAttribute(task.id)}"
        data-step-index="${stepIndex}"
      />
    </label>
  `;
}

function renderTaskCountField(taskType, task, stepIndex) {
  const unit = taskType === 'personnel' ? '人' : taskType === 'vehicle' ? '辆' : '套';
  return `
    <label class="emergency-form-field">
      <span>数量</span>
      <div class="emergency-number-field">
        <input
          type="number"
          min="0"
          step="1"
          value="${Number(task.count) || 0}"
          data-plan-task-field="count"
          data-task-type="${taskType}"
          data-task-id="${escapeAttribute(task.id)}"
          data-step-index="${stepIndex}"
        />
        <b>${unit}</b>
      </div>
    </label>
  `;
}

function renderTaskRegionSelect(taskType, task, stepIndex, field, regions) {
  const label = field === 'fromRegionId' ? '起点' : '终点';
  return `
    <label class="emergency-form-field">
      <span>${label}</span>
      <select
        data-plan-task-field="${field}"
        data-task-type="${taskType}"
        data-task-id="${escapeAttribute(task.id)}"
        data-step-index="${stepIndex}"
      >
        ${regions
          .map(
            (region) => `
              <option value="${region.id}" ${region.id === task[field] ? 'selected' : ''}>${region.name}</option>
            `,
          )
          .join('')}
      </select>
    </label>
  `;
}

function taskCountSummary(step) {
  return `人员 ${step.personnelTasks.length} / 物资 ${step.materialTasks.length} / 车辆 ${step.vehicleTasks.length}`;
}

function renderTextField(label, key, value) {
  return `
    <label class="emergency-form-field">
      <span>${label}</span>
      <input type="text" value="${escapeAttribute(value)}" data-plan-text="${key}" />
    </label>
  `;
}

function sanitizePlanText(value, fallback = '') {
  const text = String(value ?? '')
    .replaceAll('<', '＜')
    .replaceAll('>', '＞')
    .trim();

  return (text || String(fallback)).slice(0, 140);
}

function normalizePlanNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.min(999, Math.round(number)));
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatLocalPlanTime() {
  return new Date().toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function renderEmergencyContacts() {
  return EMERGENCY_OPERATION_CONTACTS.map(
    (item) => `
      <article class="contact-card">
        <div class="contact-card__head">
          <span class="contact-card__department">${item.department}</span>
          <span class="contact-card__role">${item.role}</span>
        </div>
        <strong>${item.contact}</strong>
        <div class="contact-card__line">
          <span>值班电话</span>
          <b>${item.phone}</b>
        </div>
        <div class="contact-card__line">
          <span>联络渠道</span>
          <b>${item.channel}</b>
        </div>
      </article>
    `,
  ).join('');
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
