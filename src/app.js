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
      const stage = root.querySelector('.page-stage');
      if (stage) {
        stage.className = `page-stage page-stage--${route.page}`;
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
    },
    demo: {
      playing: false,
      stepIndex: 0,
      cue: '演示待命，可手动点控或启动自动串场。',
      log: [
        {
          time: '14:35:00',
          text: '导演台已接入，支持监测大厅、应急推演、交通仿真三页联动。',
        },
      ],
      timers: [],
    },
    runtime: {
      now: new Date('2026-04-21T14:35:00+08:00'),
      dataTick: 0,
      clockTimer: null,
    },
  };
}

function renderShell(route, state) {
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
            ['overview', '监测大厅总览页'],
            ['emergency', '应急仿真页'],
            ['traffic', '公共区交通仿真页'],
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
              ${state.ui.directorCollapsed ? '展开导演台' : '收起导演台'}
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
        ${state.ui.headerCollapsed ? '展开顶部导航' : '隐藏顶部导航'}
      </button>
      <button
        class="director-toggle director-toggle--floating"
        type="button"
        data-toggle-director
        aria-pressed="${state.ui.directorCollapsed}"
      >
        ${state.ui.directorCollapsed ? '展开导演台' : '隐藏导演台'}
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
    slot.innerHTML = '';
    shell?.classList.remove('is-script-open');
    return;
  }

  slot.innerHTML = renderScriptLayer(data, route, state);
  shell?.classList.toggle('is-script-open', state.ui.scriptPanelOpen);

  slot.querySelector('[data-toggle-script]')?.addEventListener('click', () => {
    state.ui.scriptPanelOpen = !state.ui.scriptPanelOpen;
    updateScriptLayer(root, data, route, state);
  });
}

function renderScriptLayer(data, route, state) {
  const script = buildOverviewScript(data, route, state);

  return `
    <div class="overview-script-layer ${state.ui.scriptPanelOpen ? 'is-open' : ''}">
      <button
        class="script-toggle script-toggle--floating ${state.ui.scriptPanelOpen ? 'is-active' : ''}"
        type="button"
        data-toggle-script
        aria-pressed="${state.ui.scriptPanelOpen}"
      >
        ${state.ui.scriptPanelOpen ? '收起演示脚本' : '打开演示脚本'}
      </button>
      <section class="overview-script-panel">
        <div class="overview-script-panel__header">
          <div>
            <span class="panel-kicker">演示脚本</span>
            <strong>${script.title}</strong>
          </div>
          <span class="script-chip">${script.stepLabel}</span>
        </div>
        <div class="overview-script-panel__grid">
          <article class="script-block">
            <span>当前讲解要点</span>
            <strong>${script.currentTopic}</strong>
            <p>${script.currentNarration}</p>
          </article>
          <article class="script-block">
            <span>当前焦点对象</span>
            <strong>${script.focusTitle}</strong>
            <p>${script.focusDetail}</p>
          </article>
          <article class="script-block">
            <span>推荐讲解顺序</span>
            <ol class="script-sequence">
              ${script.sequence.map((item) => `<li>${item}</li>`).join('')}
            </ol>
          </article>
          <article class="script-block">
            <span>建议下一步</span>
            <strong>${script.nextActionTitle}</strong>
            <p>${script.nextActionDetail}</p>
          </article>
        </div>
      </section>
    </div>
  `;
}

function buildOverviewScript(data, route, state) {
  const alert = data.alerts.find((item) => item.id === state.selection.alertId) ?? data.alerts[0];
  const video = data.videos.find((item) => item.id === state.selection.videoId) ?? data.videos[0];
  const region =
    data.mapAssets.regions.find((item) => item.id === state.selection.regionId) ??
    data.mapAssets.regions[0];
  const terminalId = route.params.get('terminal');
  const floorId = route.params.get('floor');
  const terminal = data.terminalDetails?.terminals?.find((item) => item.id === terminalId) ?? null;
  const floor =
    terminal?.floors.find((item) => item.id === floorId) ??
    terminal?.floors.find((item) => item.id === terminal?.defaultFloor) ??
    null;

  const scripts = [
    {
      stepLabel: '步骤 01 / 监测大厅切入',
      title: '从一张图进入当前场景',
      currentTopic: '先交代全局态势，再把镜头落到当前异常区域。',
      currentNarration:
        '优先讲清一张图总览能力、预警位置、视频资源和重点区域，让听众先建立整体认知。',
      nextActionTitle: '下一步建议进入应急推演',
      nextActionDetail: '带着当前预警与联动资源进入应急页，展示从发现问题到处置推演的闭环。',
    },
    {
      stepLabel: '步骤 02 / 应急推演衔接',
      title: '从发现问题转到处置能力',
      currentTopic: '解释为什么要从总览页继续钻取到应急场景。',
      currentNarration:
        '这里重点强调系统不只是做监测，而是能把预警、视频、资源和处置动作串成一条执行链路。',
      nextActionTitle: '下一步建议验证交通优化',
      nextActionDetail: '从处置推演继续落到公共区交通组织，看方案是否真正缓解楼前和停车压力。',
    },
    {
      stepLabel: '步骤 03 / 交通优化验证',
      title: '展示优化结果如何回流总览',
      currentTopic: '说明交通方案优化后，如何反馈到总览态势和资源调度中。',
      currentNarration:
        '重点讲清方案对楼前上客带、停车区和接驳运力的影响，并将结果反馈回总览页。',
      nextActionTitle: '下一步建议回到总览闭环',
      nextActionDetail: '回到监测大厅，展示问题发现、推演处置和交通优化形成的完整闭环。',
    },
  ];

  const currentScript = scripts[Math.min(state.demo.stepIndex, scripts.length - 1)];
  const focusTitle = floor ? `${terminal.name} ${floor.name}` : region.name;
  const focusDetail = floor
    ? `${floor.subtitle} 当前关联预警为“${alert.title}”，联动视频为“${video.name}”。`
    : `${region.description} 当前关联预警为“${alert.title}”，联动视频为“${video.name}”。`;

  return {
    ...currentScript,
    focusTitle,
    focusDetail,
    sequence: [
      '先用总览页讲清当前运行态势和异常焦点。',
      '再说明当前焦点关联的视频、资源动作和建议处置。',
      '最后根据汇报节奏选择进入应急推演或交通仿真页。',
    ],
  };
}

function renderDirectorSteps(stepIndex) {
  return ['发现异常', '进入应急推演', '验证交通优化', '回到总览闭环']
    .map(
      (label, index) => `
        <span class="director-step ${index <= stepIndex ? 'is-active' : ''}">
          ${String(index + 1).padStart(2, '0')} ${label}
        </span>
      `,
    )
    .join('');
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
    updateDemoCue(state, '切换到交通仿真页，对比基线方案与优化调度方案。');
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
    return '事件推演模式';
  }

  if (page === 'traffic') {
    return '交通优化模式';
  }

  return '总览模式';
}
