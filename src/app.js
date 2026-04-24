import { loadMockData } from './lib/data.js';
import { disposeCharts } from './lib/charts.js';
import { ensureRoute, navigate, onRouteChange, parseHash } from './lib/router.js';
import { formatClock, formatDate } from './lib/format.js';
import { renderOverviewPage } from './pages/overviewPage.js';
import { renderEmergencyPage } from './pages/emergencyPage.js';
import { renderTrafficPage } from './pages/trafficPage.js';

const PAGE_REGISTRY = {
  overview: renderOverviewPage,
  emergency: renderEmergencyPage,
  traffic: renderTrafficPage,
};

const DIRECTOR_STEPS = ['发现异常', '进入应急推演', '进入交通仿真', '回到监测大厅'];

const OVERVIEW_EXERCISE_STEPS = [
  {
    label: '事件触发',
    narration: '系统在监测大厅识别到重点区域异常，形成可联动的演练事件。',
  },
  {
    label: '角色响应',
    narration: '巡检人员和巡检车辆接警响应，进入现场处置准备状态。',
  },
  {
    label: '路径执行',
    narration: '巡检角色按预设路径赶赴目标区域，执行到场和接近动作。',
  },
  {
    label: '状态变化',
    narration: '现场状态从异常转为处置中，重点区域进入持续联动监测。',
  },
  {
    label: '结果回显',
    narration: '演练结果回显响应时长、到位状态和处置闭环，用于后续推演复盘。',
  },
];

export async function createApp(root) {
  const data = await loadMockData();
  const state = createState(data);
  let cleanup = () => {};
  let activeRoute = null;

  ensureRoute();

  const render = ({ forceShell = false } = {}) => {
    const route = parseHash();

    if (route.page !== 'overview') {
      state.ui.scriptPanelOpen = false;
      stopOverviewExercise(state, { reset: true });
    }

    const needsShellRender =
      forceShell ||
      !root.querySelector('.app-shell') ||
      !activeRoute ||
      activeRoute.page !== route.page;

    cleanup();
    disposeCharts();

    const renderer = PAGE_REGISTRY[route.page] ?? PAGE_REGISTRY.overview;
    const page = renderer({
      data,
      route,
      state,
      navigate,
      rerender: render,
    });

    if (needsShellRender) {
      root.innerHTML = renderShell(route, state);
      bindGlobalChrome(root, data, state, render);
    } else {
      const stageNode = root.querySelector('.page-stage');
      if (stageNode) {
        stageNode.className = `page-stage page-stage--${route.page}`;
      }
    }

    const stage = root.querySelector('.page-stage');
    if (stage) {
      stage.innerHTML = page.html;
      cleanup = page.setup?.(stage) ?? (() => {});
    } else {
      cleanup = () => {};
    }

    activeRoute = route;
    updateChromeStatus(root, data, state);
    updateClock(root, state);
    updateScriptLayer(root, data, route, state);
  };

  render();
  onRouteChange(() => render());

  state.runtime.clockTimer = window.setInterval(() => {
    state.runtime.now = new Date(state.runtime.now.getTime() + 1000);
    updateClock(root, state);
  }, 1000);
}

function createState(data) {
  return {
    data,
    selection: {
      alertId: data.alerts[0]?.id ?? null,
      videoId: data.videos[0]?.id ?? null,
      regionId: data.mapAssets.regions[0]?.id ?? null,
      deviceId: null,
      emergencyScenarioId: data.emergencyScenarios[0]?.id ?? null,
      trafficScenarioId: data.trafficScenarios[0]?.id ?? null,
    },
    emergency: {
      progress: 0,
      playing: false,
    },
    traffic: {
      progress: 0,
      playing: false,
      viewMode: 'realtime',
      planListOpen: false,
      savedPlans: [],
      feedback: '',
      controlsByScenario: {},
    },
    ui: {
      headerCollapsed: true,
      directorCollapsed: true,
      scriptPanelOpen: false,
      mapSearchOpen: false,
      searchResultContext: null,
      overviewTransportLayers: {
        airportBus: true,
        taxi: true,
        rideHailing: true,
        privateCar: true,
        patrolPersonnel: true,
        patrolVehicle: true,
      },
    },
    demo: {
      playing: false,
      stepIndex: 0,
      cue: '演示待命，可手动点控或启动自动串场。',
      log: [
        {
          time: '14:35:00',
          text: '导演台已接入，支持监测大厅、应急仿真、交通仿真三页联动。',
        },
      ],
      timers: [],
    },
    overviewExercise: {
      playing: false,
      stepIndex: 0,
      timer: null,
      roleConfig: {
        personnelCount: 2,
        personnelStatus: '1 组出发',
        vehicleCount: 1,
        vehicleStatus: '路线已下发',
      },
      pathConfig: {
        personnelPath: '监测大厅 -> 目标区域',
        vehiclePath: '外环主路 -> 到达接驳口',
      },
    },
    runtime: {
      now: new Date('2026-04-21T14:35:00+08:00'),
      dataTick: 0,
      clockTimer: null,
    },
  };
}

function renderShell(route, state) {
  const headerToggleLabel = state.ui.headerCollapsed ? '展开顶部导航' : '隐藏顶部导航';
  const directorInlineLabel = state.ui.directorCollapsed ? '展开导演台' : '收起导演台';
  const directorFloatingLabel = state.ui.directorCollapsed ? '展开导演台' : '隐藏导演台';

  return `
    <div class="app-shell ${state.ui.headerCollapsed ? 'is-chrome-collapsed' : ''} ${state.ui.directorCollapsed ? 'is-director-collapsed' : ''}">
      <header class="topbar">
        <div class="topbar__brand">
          <button class="brand-mark" type="button" data-nav-page="overview">
            <span class="brand-mark__dot"></span>
            机场运行数字孪生中枢
          </button>
          <div class="brand-meta">
            <strong>首都机场数字孪生演示原型</strong>
            <span>${getRouteLabel(route.page)} / 抽象自绘 2.5D 机场场景</span>
          </div>
        </div>
        <nav class="topbar__nav" aria-label="页面导航">
          ${[
            ['overview', '监测大厅'],
            ['emergency', '应急仿真'],
            ['traffic', '公共区交通仿真'],
          ]
            .map(
              ([page, label]) => `
                <button
                  class="nav-tab ${route.page === page ? 'is-active' : ''}"
                  data-nav-page="${page}"
                  type="button"
                >
                  ${label}
                </button>
              `,
            )
            .join('')}
        </nav>
        <div class="topbar__status">
          <div class="status-chip">
            <span class="status-chip__label">系统状态</span>
            <strong class="js-system-status"></strong>
          </div>
          <div class="status-chip">
            <span class="status-chip__label">天气</span>
            <strong class="js-weather-status"></strong>
          </div>
          <div class="status-clock">
            <span class="status-chip__label js-date"></span>
            <strong class="js-clock"></strong>
          </div>
          <button class="chrome-toggle chrome-toggle--inline" type="button" data-toggle-header aria-pressed="${state.ui.headerCollapsed}">
            ${state.ui.headerCollapsed ? '展开顶部' : '收起顶部'}
          </button>
        </div>
      </header>

      <aside class="demo-director">
        <div class="demo-director__header">
          <div>
            <span class="panel-kicker">演示导演台</span>
            <strong class="js-director-mode">${state.demo.playing ? '自动演示进行中' : '手动讲解模式'}</strong>
          </div>
          <div class="demo-director__actions">
            <button class="action-button action-button--ghost" type="button" data-toggle-demo>
              ${state.demo.playing ? '停止自动演示' : '开始自动演示'}
            </button>
            <button class="director-toggle director-toggle--inline" type="button" data-toggle-director aria-pressed="${state.ui.directorCollapsed}">
              ${directorInlineLabel}
            </button>
          </div>
        </div>
        <p class="demo-director__cue js-demo-cue">${state.demo.cue}</p>
        <div class="demo-director__steps js-demo-steps"></div>
        <div class="demo-director__log js-demo-log"></div>
      </aside>

      <button
        class="chrome-toggle chrome-toggle--floating"
        type="button"
        data-toggle-header
        aria-pressed="${state.ui.headerCollapsed}"
      >
        ${headerToggleLabel}
      </button>

      <button
        class="director-toggle director-toggle--floating"
        type="button"
        data-toggle-director
        aria-pressed="${state.ui.directorCollapsed}"
      >
        ${directorFloatingLabel}
      </button>

      <div class="js-script-layer-slot"></div>
      <main class="page-stage page-stage--${route.page}"></main>
    </div>
  `;
}

function bindGlobalChrome(root, data, state, render) {
  root.querySelectorAll('[data-nav-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextPage = button.dataset.navPage;
      if (!nextPage || nextPage === parseHash().page) {
        return;
      }

      stopDemo(state, false);
      state.ui.scriptPanelOpen = false;

      if (nextPage === 'emergency') {
        navigate('emergency', {
          scenario: state.selection.emergencyScenarioId,
          alert: state.selection.alertId,
        });
        return;
      }

      if (nextPage === 'traffic') {
        navigate('traffic', {
          scenario: state.selection.trafficScenarioId,
          region: state.selection.regionId,
        });
        return;
      }

      navigate('overview', {
        alert: state.selection.alertId,
        video: state.selection.videoId,
        region: state.selection.regionId,
      });
    });
  });

  root.querySelectorAll('[data-toggle-header]').forEach((button) => {
    button.addEventListener('click', () => {
      state.ui.headerCollapsed = !state.ui.headerCollapsed;
      const shell = root.querySelector('.app-shell');
      shell?.classList.toggle('is-chrome-collapsed', state.ui.headerCollapsed);
      root.querySelectorAll('[data-toggle-header]').forEach((node) => {
        node.setAttribute('aria-pressed', String(state.ui.headerCollapsed));
        node.textContent = state.ui.headerCollapsed ? '展开顶部导航' : '隐藏顶部导航';
      });
    });
  });

  root.querySelectorAll('[data-toggle-director]').forEach((button) => {
    button.addEventListener('click', () => {
      state.ui.directorCollapsed = !state.ui.directorCollapsed;
      const shell = root.querySelector('.app-shell');
      shell?.classList.toggle('is-director-collapsed', state.ui.directorCollapsed);
      root.querySelectorAll('[data-toggle-director]').forEach((node) => {
        node.setAttribute('aria-pressed', String(state.ui.directorCollapsed));
        node.textContent = state.ui.directorCollapsed
          ? '展开导演台'
          : node.classList.contains('director-toggle--inline')
            ? '收起导演台'
            : '隐藏导演台';
      });
      updateScriptLayer(root, data, parseHash(), state);
    });
  });

  root.querySelectorAll('[data-toggle-demo]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.demo.playing) {
        stopDemo(state, false);
        pushDemoLog(state, '自动演示已手动停止。');
        render({ forceShell: true });
        return;
      }

      startDemo(state, render);
    });
  });
}

function updateChromeStatus(root, data, state) {
  const systemNode = root.querySelector('.js-system-status');
  const weatherNode = root.querySelector('.js-weather-status');
  const modeNode = root.querySelector('.js-director-mode');
  const cueNode = root.querySelector('.js-demo-cue');
  const stepsNode = root.querySelector('.js-demo-steps');
  const logNode = root.querySelector('.js-demo-log');

  if (systemNode) {
    systemNode.replaceChildren(document.createTextNode(data.overview.systemStatus.label));
  }

  if (weatherNode) {
    weatherNode.replaceChildren(
      document.createTextNode(`${data.overview.weather.condition} ${data.overview.weather.temperature}°C`),
    );
  }

  if (modeNode) {
    modeNode.replaceChildren(
      document.createTextNode(state.demo.playing ? '自动演示进行中' : '手动讲解模式'),
    );
  }

  if (cueNode) {
    cueNode.replaceChildren(document.createTextNode(state.demo.cue));
  }

  if (stepsNode) {
    stepsNode.innerHTML = renderDirectorSteps(state.demo.stepIndex);
  }

  if (logNode) {
    logNode.innerHTML = renderDirectorLog(state.demo.log);
  }
}

function updateScriptLayer(root, data, route, state) {
  const slot = root.querySelector('.js-script-layer-slot');
  if (!slot) {
    return;
  }

  const shell = root.querySelector('.app-shell');
  if (route.page !== 'overview') {
    stopOverviewExercise(state, { reset: true });
    slot.innerHTML = '';
    shell?.classList.remove('is-script-open');
    return;
  }

  slot.innerHTML = renderScriptLayer(data, route, state);
  shell?.classList.toggle('is-script-open', state.ui.scriptPanelOpen);

  slot.querySelector('[data-toggle-script]')?.addEventListener('click', () => {
    state.ui.scriptPanelOpen = !state.ui.scriptPanelOpen;
    if (!state.ui.scriptPanelOpen) {
      stopOverviewExercise(state, { reset: true });
    }
    syncOverviewExercise(root, data, route, state);
  });

  slot.querySelector('[data-overview-exercise-play]')?.addEventListener('click', () => {
    startOverviewExercise(root, data, route, state);
  });

  slot.querySelector('[data-overview-exercise-pause]')?.addEventListener('click', () => {
    stopOverviewExercise(state);
    syncOverviewExercise(root, data, route, state);
  });

  slot.querySelector('[data-overview-exercise-reset]')?.addEventListener('click', () => {
    stopOverviewExercise(state, { reset: true });
    syncOverviewExercise(root, data, route, state);
  });

  slot.querySelector('[data-overview-exercise-close]')?.addEventListener('click', () => {
    state.ui.scriptPanelOpen = false;
    stopOverviewExercise(state, { reset: true });
    syncOverviewExercise(root, data, route, state);
  });

  slot.querySelectorAll('[data-exercise-role-number]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.exerciseRoleNumber;
      const nextValue = Math.max(0, Number(input.value) || 0);
      state.overviewExercise.roleConfig[key] = nextValue;
      syncOverviewExercise(root, data, route, state);
    });
  });

  slot.querySelectorAll('[data-exercise-role-text]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.exerciseRoleText;
      state.overviewExercise.roleConfig[key] =
        sanitizeExerciseInput(input.value.trim()) || input.defaultValue;
      syncOverviewExercise(root, data, route, state);
    });
  });

  slot.querySelectorAll('[data-exercise-path-text]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.exercisePathText;
      state.overviewExercise.pathConfig[key] =
        sanitizeExerciseInput(input.value.trim()) || input.defaultValue;
      syncOverviewExercise(root, data, route, state);
    });
  });
}

function renderScriptLayer(data, route, state) {
  const exercise = buildOverviewExercise(data, route, state);
  const roleConfig = state.overviewExercise.roleConfig;
  const pathConfig = state.overviewExercise.pathConfig;

  return `
    <div class="overview-script-layer ${state.ui.scriptPanelOpen ? 'is-open' : ''}">
      <button
        class="script-toggle script-toggle--floating ${state.ui.scriptPanelOpen ? 'is-active' : ''}"
        type="button"
        data-toggle-script
        aria-pressed="${state.ui.scriptPanelOpen}"
      >
        ${state.ui.scriptPanelOpen ? '关闭仿真演练' : '打开仿真演练'}
      </button>
      <section class="overview-script-panel">
        <div class="overview-script-panel__header">
          <div>
            <span class="panel-kicker">仿真演练</span>
            <strong>${exercise.title}</strong>
          </div>
          <span class="script-chip">${exercise.stepLabel}</span>
        </div>
        <div class="control-row overview-exercise-controls">
          <button class="action-button" type="button" data-overview-exercise-play>
            ${exercise.playButtonLabel}
          </button>
          <button class="action-button action-button--ghost" type="button" data-overview-exercise-pause>
            暂停
          </button>
          <button class="action-button action-button--ghost" type="button" data-overview-exercise-reset>
            重置
          </button>
          <button class="action-button action-button--ghost" type="button" data-overview-exercise-close>
            关闭
          </button>
        </div>
        <div class="exercise-step-strip">
          ${OVERVIEW_EXERCISE_STEPS.map(
            (step, index) => `
              <span class="exercise-step ${index <= state.overviewExercise.stepIndex ? 'is-active' : ''}">
                ${String(index + 1).padStart(2, '0')} ${step.label}
              </span>
            `,
          ).join('')}
        </div>
        <div class="overview-script-panel__grid">
          <article class="script-block">
            <span>事件触发</span>
            <strong>${exercise.eventTitle}</strong>
            <p>${exercise.eventDetail}</p>
          </article>
          <article class="script-block">
            <span>角色响应</span>
            <strong>${exercise.roleTitle}</strong>
            <div class="exercise-edit-grid">
              <label class="exercise-edit-field">
                <span>巡检人员数量</span>
                <input type="number" min="0" step="1" value="${roleConfig.personnelCount}" data-exercise-role-number="personnelCount" />
              </label>
              <label class="exercise-edit-field">
                <span>巡检人员状态</span>
                <input type="text" value="${escapeAttribute(roleConfig.personnelStatus)}" data-exercise-role-text="personnelStatus" />
              </label>
              <label class="exercise-edit-field">
                <span>巡检车辆数量</span>
                <input type="number" min="0" step="1" value="${roleConfig.vehicleCount}" data-exercise-role-number="vehicleCount" />
              </label>
              <label class="exercise-edit-field">
                <span>巡检车辆状态</span>
                <input type="text" value="${escapeAttribute(roleConfig.vehicleStatus)}" data-exercise-role-text="vehicleStatus" />
              </label>
            </div>
            <div class="exercise-status-list">
              ${exercise.roles
                .map(
                  (item) =>
                    `<div class="exercise-status-line"><span>${item.label}</span><strong>${item.value}</strong></div>`,
                )
                .join('')}
            </div>
          </article>
          <article class="script-block">
            <span>路径执行</span>
            <strong>${exercise.pathTitle}</strong>
            <div class="exercise-edit-grid">
              <label class="exercise-edit-field exercise-edit-field--wide">
                <span>步巡路径</span>
                <input type="text" value="${escapeAttribute(pathConfig.personnelPath)}" data-exercise-path-text="personnelPath" />
              </label>
              <label class="exercise-edit-field exercise-edit-field--wide">
                <span>车巡路径</span>
                <input type="text" value="${escapeAttribute(pathConfig.vehiclePath)}" data-exercise-path-text="vehiclePath" />
              </label>
            </div>
            <div class="exercise-status-list">
              ${exercise.paths
                .map(
                  (item) =>
                    `<div class="exercise-status-line"><span>${item.label}</span><strong>${item.value}</strong></div>`,
                )
                .join('')}
            </div>
          </article>
          <article class="script-block">
            <span>结果回显</span>
            <strong>${exercise.resultTitle}</strong>
            <p>${exercise.resultDetail}</p>
          </article>
        </div>
      </section>
    </div>
  `;
}

function buildOverviewExercise(data, route, state) {
  const alert = data.alerts.find((item) => item.id === state.selection.alertId) ?? data.alerts[0];
  const region =
    data.mapAssets.regions.find((item) => item.id === state.selection.regionId) ??
    data.mapAssets.regions[0];
  const stepIndex = Math.min(state.overviewExercise.stepIndex, OVERVIEW_EXERCISE_STEPS.length - 1);
  const currentStep = OVERVIEW_EXERCISE_STEPS[stepIndex];
  const triggerArea = route.params.get('terminal') ? `${region.name} 楼内联动` : region.name;
  const roleConfig = state.overviewExercise.roleConfig;
  const pathConfig = state.overviewExercise.pathConfig;

  return {
    title: `${triggerArea} 角色联动演练`,
    stepLabel: `步骤 ${String(stepIndex + 1).padStart(2, '0')} / ${currentStep.label}`,
    playButtonLabel: state.overviewExercise.playing
      ? '演练进行中'
      : stepIndex > 0
        ? '继续演练'
        : '开始演练',
    eventTitle: alert.title,
    eventDetail: `${currentStep.narration} 触发区域为 ${triggerArea}，当前预警状态为 ${alert.status}。`,
    roleTitle: stepIndex >= 1 ? '角色已纳入响应链路' : '等待角色接警',
    roles: [
      {
        label: '巡检人员',
        value:
          stepIndex >= 1
            ? `${roleConfig.personnelCount} 名接警 / ${roleConfig.personnelStatus}`
            : '待命',
      },
      {
        label: '巡检车辆',
        value:
          stepIndex >= 1
            ? `${roleConfig.vehicleCount} 辆联动 / ${roleConfig.vehicleStatus}`
            : '待命',
      },
    ],
    pathTitle: stepIndex >= 2 ? '处置路径已执行' : '等待路径执行',
    paths: [
      {
        label: '步巡路径',
        value: stepIndex >= 2 ? pathConfig.personnelPath : '待生成',
      },
      {
        label: '车巡路径',
        value: stepIndex >= 2 ? pathConfig.vehiclePath : '待生成',
      },
    ],
    resultTitle: stepIndex >= 4 ? '演练闭环已形成' : '结果回显待完成',
    resultDetail:
      stepIndex >= 4
        ? `响应时长 2 分 40 秒，${roleConfig.personnelCount} 名巡检人员与 ${roleConfig.vehicleCount} 辆巡检车辆均已到位，区域状态切换为持续监测。`
        : '当前阶段结果仍在推演中，完成角色到位和状态切换后将生成闭环回显。',
  };
}

function syncOverviewExercise(root, data, route, state) {
  updateScriptLayer(root, data, route, state);
  window.dispatchEvent(new CustomEvent('overview-exercise-change'));
}

function stopOverviewExercise(state, { reset = false } = {}) {
  if (state.overviewExercise.timer) {
    window.clearInterval(state.overviewExercise.timer);
    state.overviewExercise.timer = null;
  }

  state.overviewExercise.playing = false;
  if (reset) {
    state.overviewExercise.stepIndex = 0;
  }
}

function startOverviewExercise(root, data, route, state) {
  stopOverviewExercise(state);
  state.ui.scriptPanelOpen = true;
  state.overviewExercise.playing = true;

  if (state.overviewExercise.stepIndex >= OVERVIEW_EXERCISE_STEPS.length - 1) {
    state.overviewExercise.stepIndex = 0;
  }

  syncOverviewExercise(root, data, route, state);

  state.overviewExercise.timer = window.setInterval(() => {
    if (state.overviewExercise.stepIndex >= OVERVIEW_EXERCISE_STEPS.length - 1) {
      stopOverviewExercise(state);
      syncOverviewExercise(root, data, route, state);
      return;
    }

    state.overviewExercise.stepIndex += 1;
    syncOverviewExercise(root, data, route, state);
  }, 1800);
}

function renderDirectorSteps(stepIndex) {
  return DIRECTOR_STEPS.map(
    (label, index) => `
      <span class="director-step ${index <= stepIndex ? 'is-active' : ''}">
        ${String(index + 1).padStart(2, '0')} ${label}
      </span>
    `,
  ).join('');
}

function renderDirectorLog(log) {
  return log
    .map(
      (entry) => `
        <div class="director-log-item">
          <span>${entry.time}</span>
          <strong>${entry.text}</strong>
        </div>
      `,
    )
    .join('');
}

function startDemo(state, render) {
  stopDemo(state, false);
  state.demo.playing = true;
  state.demo.stepIndex = 0;
  state.emergency.progress = 0;
  state.traffic.progress = 0;
  state.emergency.playing = false;
  state.traffic.playing = false;

  updateDemoCue(state, '正在从监测大厅切入，聚焦到达层高峰延误预警。');
  navigate('overview', {
    alert: 'alert-delay',
    video: 'video-arrival-1',
    region: 'arrival-curb',
  });
  render({ forceShell: true });

  scheduleDemo(state, 4200, () => {
    state.demo.stepIndex = 1;
    state.emergency.progress = 0;
    state.emergency.playing = true;
    updateDemoCue(state, '进入应急仿真页，自动推演“航班延误叠加高峰”场景。');
    navigate('emergency', {
      scenario: 'flight-delay',
      alert: 'alert-delay',
    });
  });

  scheduleDemo(state, 11200, () => {
    state.demo.stepIndex = 2;
    state.emergency.playing = false;
    state.traffic.progress = 0;
    state.traffic.playing = true;
    updateDemoCue(state, '切换到交通仿真页，观察公共区交通压力与调度变化。');
    navigate('traffic', {
      scenario: 'optimized-dispatch',
      region: 'parking-p2',
    });
  });

  scheduleDemo(state, 19000, () => {
    state.demo.stepIndex = 3;
    state.traffic.playing = false;
    updateDemoCue(state, '回到监测大厅，展示跨页联动与闭环处置结果。');
    navigate('overview', {
      alert: 'alert-weather',
      video: 'video-bus-1',
      region: 'bus-hub',
    });
  });

  scheduleDemo(state, 24500, () => {
    stopDemo(state, true);
    updateDemoCue(state, '自动演示完成，可以继续手动点控或再次播放。');
    render({ forceShell: true });
  });
}

function stopDemo(state, completed) {
  clearDemoTimers(state);
  state.demo.playing = false;
  state.emergency.playing = false;
  state.traffic.playing = false;

  if (!completed) {
    state.demo.cue = '自动演示已停止，当前保持手动讲解模式。';
  }
}

function scheduleDemo(state, delay, callback) {
  const timer = window.setTimeout(() => {
    if (!state.demo.playing) {
      return;
    }
    callback();
  }, delay);

  state.demo.timers.push(timer);
}

function clearDemoTimers(state) {
  state.demo.timers.forEach((timer) => window.clearTimeout(timer));
  state.demo.timers = [];
}

function updateDemoCue(state, text) {
  state.demo.cue = text;
  pushDemoLog(state, text);
}

function pushDemoLog(state, text) {
  state.demo.log = [
    {
      time: formatClock(state.runtime.now),
      text,
    },
    ...state.demo.log,
  ].slice(0, 4);
}

function updateClock(root, state) {
  const clockNode = root.querySelector('.js-clock');
  const dateNode = root.querySelector('.js-date');
  const cueNode = root.querySelector('.js-demo-cue');
  const modeNode = root.querySelector('.js-director-mode');
  const stepsNode = root.querySelector('.js-demo-steps');
  const logNode = root.querySelector('.js-demo-log');

  if (clockNode) {
    clockNode.replaceChildren(document.createTextNode(formatClock(state.runtime.now)));
  }

  if (dateNode) {
    dateNode.replaceChildren(document.createTextNode(formatDate(state.runtime.now)));
  }

  if (cueNode) {
    cueNode.replaceChildren(document.createTextNode(state.demo.cue));
  }

  if (modeNode) {
    modeNode.replaceChildren(
      document.createTextNode(state.demo.playing ? '自动演示进行中' : '手动讲解模式'),
    );
  }

  if (stepsNode) {
    stepsNode.innerHTML = renderDirectorSteps(state.demo.stepIndex);
  }

  if (logNode) {
    logNode.innerHTML = renderDirectorLog(state.demo.log);
  }
}

function getRouteLabel(page) {
  if (page === 'emergency') {
    return '应急仿真模式';
  }

  if (page === 'traffic') {
    return '交通仿真模式';
  }

  return '总览监测模式';
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sanitizeExerciseInput(value) {
  return String(value).replaceAll('<', '＜').replaceAll('>', '＞').trim();
}
