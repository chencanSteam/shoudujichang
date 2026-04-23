import { renderMapScene } from '../components/mapScene.js';
import { formatClock, formatDate, formatMetricValue, interpolateMetric } from '../lib/format.js';

const TRAFFIC_PHASES = [
  {
    title: '实时运行',
    detail: '保持当前交通组织方式，持续监看楼前道路、停车回流和接驳节点状态。',
    action: '系统正在以实时模式展示公共区交通运行态势。',
  },
  {
    title: '压力抬升',
    detail: '航班波峰与道路波动叠加，楼前接驳压力开始向停车与补位节点传导。',
    action: '识别主通道与接驳口压力源，准备进入调度分析。',
  },
  {
    title: '调度介入',
    detail: '出租车补位、摆渡调度和网约车分流开始生效，重点节点状态发生变化。',
    action: '根据参数组合联动调度资源，观察车流和节点反馈。',
  },
  {
    title: '拥堵缓释',
    detail: '停车回流与楼前道路效率逐步恢复，交通对象进入协同运行阶段。',
    action: '继续跟踪停车导引、道路放行与接驳节拍的缓释效果。',
  },
  {
    title: '结果稳定',
    detail: '场景进入稳定区间，可将当前参数组合保存为交通保障预案。',
    action: '可保存当前参数组合，作为后续预案参考。',
  },
];

export function renderTrafficPage({ data, route, state, navigate }) {
  const scenario = resolveScenario(data, route, state);
  const baseline =
    data.trafficScenarios.find((item) => item.id === 'baseline-dispatch') ?? data.trafficScenarios[0];
  const focusRegion =
    data.mapAssets.regions.find((item) => item.id === route.params.get('region')) ??
    data.mapAssets.regions.find((item) => item.id === scenario.regionId) ??
    data.mapAssets.regions[0];

  state.selection.trafficScenarioId = scenario.id;
  state.selection.regionId = focusRegion.id;
  ensureTrafficControls(state, scenario);

  return {
    html: `
      <section class="page page--traffic">
        <div class="traffic-shell traffic-shell--${state.traffic.viewMode ?? 'realtime'} js-traffic-shell">
          <aside class="panel traffic-side reveal js-traffic-side"></aside>
          <section class="panel panel--map traffic-stage-panel reveal js-traffic-stage" style="animation-delay: 70ms;"></section>
        </div>
      </section>
    `,
    setup: (container) =>
      setupTrafficPage({
        container,
        data,
        state,
        scenario,
        baseline,
        focusRegion,
        navigate,
      }),
  };
}

function setupTrafficPage({ container, data, state, scenario, baseline, focusRegion, navigate }) {
  let playTimer = null;
  state.traffic.inputDrafts ??= {};

  const shell = container.querySelector('.js-traffic-shell');
  const side = container.querySelector('.js-traffic-side');
  const stage = container.querySelector('.js-traffic-stage');

  const readControls = () => readTrafficControls(state, scenario);

  const computeDerived = () =>
    deriveTrafficState({
      scenario,
      baseline,
      controls: readControls(),
      progress: Math.min(state.traffic.progress, TRAFFIC_PHASES.length - 1),
      viewMode: state.traffic.viewMode ?? 'realtime',
    });

  const renderSide = () => {
    const controls = readControls();
    const derived = computeDerived();
    const viewMode = state.traffic.viewMode ?? 'realtime';

    shell.className = `traffic-shell traffic-shell--${viewMode} js-traffic-shell`;
    side.innerHTML =
      viewMode === 'realtime'
        ? renderRealtimeSidebar({ scenario, focusRegion, derived })
        : renderModelSidebar({
            scenario,
            focusRegion,
            controls,
            playing: state.traffic.playing,
            planListOpen: state.traffic.planListOpen,
            savedPlans: state.traffic.savedPlans,
            scenarios: data.trafficScenarios,
          });
    bindSideEvents();
  };

  const renderStage = () => {
    const derived = computeDerived();
    stage.innerHTML = renderTrafficStage({
      data,
      scenario,
      focusRegion,
      derived,
      progress: state.traffic.progress,
      viewMode: state.traffic.viewMode ?? 'realtime',
    });
    bindStageEvents();
  };

  const renderAll = () => {
    renderSide();
    renderStage();
  };

  const syncModelControls = () => {
    if ((state.traffic.viewMode ?? 'realtime') !== 'model') {
      return;
    }

    const controls = readControls();

    side.querySelectorAll('[data-control-select]').forEach((input) => {
      const key = input.dataset.controlSelect;
      input.value = String(controls[key]);
    });

    side.querySelectorAll('[data-control-number]').forEach((input) => {
      const key = input.dataset.controlNumber;
      const draftKey = `${scenario.id}:${key}`;
      const currentValue =
        Object.prototype.hasOwnProperty.call(state.traffic.inputDrafts, draftKey)
          ? state.traffic.inputDrafts[draftKey]
          : controls[key];
      input.value = String(currentValue);
      const output = side.querySelector(`[data-control-output="${key}"]`);
      if (output) {
        output.textContent = `${controls[key]}架次`;
      }
    });

    side.querySelectorAll('[data-control-slider]').forEach((input) => {
      const key = input.dataset.controlSlider;
      input.value = String(controls[key]);
      const output = side.querySelector(`[data-control-output="${key}"]`);
      if (!output) {
        return;
      }
      if (key === 'startHour' || key === 'endHour') {
        output.textContent = `${String(controls[key]).padStart(2, '0')}:00`;
      } else {
        output.textContent = `${controls[key]}%`;
      }
    });

    const timeRangeOutput = side.querySelector('[data-control-output="timeRange"]');
    if (timeRangeOutput) {
      timeRangeOutput.textContent = `${String(controls.startHour).padStart(2, '0')}:00 - ${String(
        controls.endHour,
      ).padStart(2, '0')}:00`;
    }

    const playButton = side.querySelector('[data-traffic-play]');
    if (playButton) {
      playButton.textContent = state.traffic.playing ? '仿真进行中' : '开始仿真';
    }
  };

  const stopPlayback = () => {
    state.traffic.playing = false;
    if (playTimer) {
      window.clearInterval(playTimer);
      playTimer = null;
    }
    syncModelControls();
  };

  const startPlayback = () => {
    stopPlayback();
    state.traffic.playing = true;
    syncModelControls();
    renderStage();

    playTimer = window.setInterval(() => {
      if (state.traffic.progress >= TRAFFIC_PHASES.length - 1) {
        stopPlayback();
        renderStage();
        return;
      }

      state.traffic.progress += 1;
      renderStage();
    }, 1600);
  };

  const savePlan = () => {
    const controls = readControls();
    const nextIndex = state.traffic.savedPlans.length + 1;
    const name = `交通预案 ${String(nextIndex).padStart(2, '0')}`;
    state.traffic.savedPlans = [
      {
        id: `traffic-plan-${Date.now()}`,
        name,
        createdAt: `${formatDate(state.runtime.now)} ${formatClock(state.runtime.now)}`,
        scenarioId: scenario.id,
        params: { ...controls },
      },
      ...state.traffic.savedPlans,
    ].slice(0, 8);
    state.traffic.planListOpen = true;
    renderSide();
  };

  const updateControl = (patch) => {
    writeTrafficControls(
      state,
      scenario,
      normalizeTrafficControls({
        ...readControls(),
        ...patch,
      }),
    );
    syncModelControls();
    renderStage();
  };

  const resetControls = () => {
    stopPlayback();
    state.traffic.progress = 0;
    writeTrafficControls(state, scenario, createTrafficControlState(scenario));
    syncModelControls();
    renderStage();
  };

  function bindSideEvents() {
    side.querySelector('[data-enter-model]')?.addEventListener('click', () => {
      stopPlayback();
      state.traffic.viewMode = 'model';
      state.traffic.planListOpen = false;
      renderAll();
    });

    side.querySelector('[data-traffic-play]')?.addEventListener('click', startPlayback);
    side.querySelector('[data-traffic-reset]')?.addEventListener('click', resetControls);
    side.querySelector('[data-save-plan]')?.addEventListener('click', savePlan);
    side.querySelector('[data-toggle-plan-list]')?.addEventListener('click', () => {
      state.traffic.planListOpen = !state.traffic.planListOpen;
      renderSide();
    });

    side.querySelectorAll('[data-control-select]').forEach((input) => {
      input.addEventListener('change', () => {
        updateControl({ [input.dataset.controlSelect]: input.value });
      });
    });

    side.querySelectorAll('[data-control-number]').forEach((input) => {
      const draftKey = `${scenario.id}:${input.dataset.controlNumber}`;
      const commitValue = () => {
        delete state.traffic.inputDrafts[draftKey];
        updateControl({ [input.dataset.controlNumber]: Number(input.value) });
      };

      input.addEventListener('input', () => {
        state.traffic.inputDrafts[draftKey] = input.value;
      });
      input.addEventListener('change', commitValue);
      input.addEventListener('blur', commitValue);
    });

    side.querySelectorAll('[data-control-slider]').forEach((input) => {
      input.addEventListener('input', () => {
        updateControl({ [input.dataset.controlSlider]: Number(input.value) });
      });
    });
  }

  function bindStageEvents() {
    stage.querySelector('[data-enter-model]')?.addEventListener('click', () => {
      stopPlayback();
      state.traffic.viewMode = 'model';
      state.traffic.planListOpen = false;
      renderAll();
    });

    stage.querySelector('[data-return-live]')?.addEventListener('click', () => {
      stopPlayback();
      state.traffic.viewMode = 'realtime';
      state.traffic.planListOpen = false;
      renderAll();
    });

    stage.querySelector('[data-back-overview]')?.addEventListener('click', () => {
      navigate('overview', {
        region: focusRegion.id,
        alert: data.alerts.find((item) => item.regionId === focusRegion.id)?.id ?? data.alerts[0]?.id,
      });
    });

    stage.querySelectorAll('[data-region-id]').forEach((node) => {
      node.addEventListener('click', () => {
        navigate('traffic', {
          scenario: scenario.id,
          region: node.dataset.regionId,
        });
      });
    });
  }

  renderAll();
  if (state.traffic.playing) {
    startPlayback();
  }

  return () => stopPlayback();
}

function renderRealtimeSidebar({ focusRegion, derived }) {
  return `
    <div class="traffic-side__header">
      <span class="panel-kicker">实时展示主页</span>
      <h2>公共区实时参数</h2>
      <p class="panel-copy">
        当前以实时展示为主，左侧只保留运行参数与焦点区域摘要，中间舞台负责承载完整交通场景。
      </p>
    </div>

    <div class="traffic-live-list">
      ${derived.realtime
        .map(
          (item) => `
            <article class="traffic-live-card">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
              <small>${item.detail}</small>
            </article>
          `,
        )
        .join('')}
    </div>

    <div class="traffic-side__focus">
      <span class="panel-kicker">当前焦点</span>
      <strong>${focusRegion.name}</strong>
      <p>${focusRegion.description}</p>
    </div>

    <div class="traffic-side__footer">
      <button class="action-button" type="button" data-enter-model>进入模型分析</button>
    </div>
  `;
}

function renderModelSidebar({ scenario, focusRegion, controls, playing, planListOpen, savedPlans, scenarios }) {
  return `
    <div class="traffic-side__header">
      <span class="panel-kicker">仿真模型态</span>
      <h2>仿真参数控制</h2>
      <p class="panel-copy">
        参数控制只保留影响交通组织的核心因子。调整后，舞台直接反馈道路、车辆、节点和设施状态变化。
      </p>
    </div>

    <div class="parameter-board parameter-board--traffic-model">
      ${renderTimeRangeField(controls.startHour, controls.endHour)}
      ${renderNumberField('航班数量', 'flightCount', controls.flightCount, '架次', 0, 900, 10)}
      ${renderSelectField('天气条件', 'weatherOption', scenario.weatherOptions, controls.weatherOption)}
      ${renderSelectField('业务模式', 'businessOption', scenario.businessOptions, controls.businessOption)}

      <div class="parameter-sliders parameter-sliders--traffic-model">
        ${renderSlider('出租车补位强度', 'taxiReserve', controls.taxiReserve, '%')}
        ${renderSlider('摆渡车调度强度', 'shuttleDispatch', controls.shuttleDispatch, '%')}
        ${renderSlider('网约车分流强度', 'rideFence', controls.rideFence, '%')}
        ${renderSlider('道路放行强度', 'roadRelease', controls.roadRelease, '%')}
        ${renderSlider('停车导引强度', 'parkingGuide', controls.parkingGuide, '%')}
      </div>
    </div>

    <div class="traffic-side__focus traffic-side__focus--model">
      <span class="panel-kicker">当前关注区域</span>
      <strong>${focusRegion.name}</strong>
      <p>${focusRegion.description}</p>
    </div>

    <div class="traffic-model-actions">
      <button class="action-button" type="button" data-traffic-play>${playing ? '仿真进行中' : '开始仿真'}</button>
      <button class="action-button action-button--ghost" type="button" data-traffic-reset>重置参数</button>
      <button class="action-button action-button--ghost" type="button" data-save-plan>保存为预案</button>
      <button class="action-button action-button--ghost" type="button" data-toggle-plan-list>${
        planListOpen ? '收起预案列表' : '查看预案'
      }</button>
    </div>

    ${
      planListOpen
        ? `
          <section class="traffic-plan-panel">
            <div class="panel-heading traffic-plan-panel__head">
              <div>
                <span class="panel-kicker">已保存预案</span>
                <h3>参数组合列表</h3>
              </div>
              <span class="script-chip">${savedPlans.length} 条</span>
            </div>
            <div class="traffic-plan-list">
              ${
                savedPlans.length
                  ? savedPlans.map((plan) => renderPlanCard(plan, scenarios)).join('')
                  : '<div class="traffic-plan-empty">当前还没有保存的预案，建议完成一轮调参后再保存。</div>'
              }
            </div>
          </section>
        `
        : ''
    }
  `;
}

function renderTrafficStage({ data, scenario, focusRegion, derived, progress, viewMode }) {
  return `
    <div class="traffic-stage-head">
      <div>
        <span class="panel-kicker">公共区交通仿真</span>
        <h2>${viewMode === 'realtime' ? '实时运行态势舞台' : '参数驱动仿真舞台'}</h2>
      </div>
      <div class="traffic-stage-actions">
        <div class="map-state">
          <span class="dot ${viewMode === 'realtime' ? 'dot--live' : 'dot--warning'}"></span>
          当前模式：<strong>${viewMode === 'realtime' ? '实时展示' : '模型分析'}</strong>
        </div>
        <button class="action-button action-button--ghost" type="button" data-back-overview>返回监测大厅</button>
        ${
          viewMode === 'realtime'
            ? '<button class="action-button action-button--ghost" type="button" data-enter-model>进入模型分析</button>'
            : '<button class="action-button action-button--ghost" type="button" data-return-live>返回实时展示</button>'
        }
      </div>
    </div>

    ${
      viewMode === 'model'
        ? `
          <div class="progress-strip traffic-progress-strip">
            <span class="progress-strip__label">推演进度</span>
            <div class="progress-strip__bar">
              <span style="width: ${(progress / (TRAFFIC_PHASES.length - 1)) * 100}%"></span>
            </div>
          </div>
        `
        : ''
    }

    <div class="traffic-stage-frame">
      ${renderMapScene({
        mapAssets: data.mapAssets,
        alerts: data.alerts.filter((item) => item.regionId === focusRegion.id),
        videos: data.videos,
        mode: 'traffic',
        focusRegionId: focusRegion.id,
        trafficScenario: derived.scene,
      })}
      <div class="traffic-stage-hud">
        <article>
          <span>当前交通场景</span>
          <strong>${scenario.name}</strong>
          <small>${scenario.dispatchRule}</small>
        </article>
        <article>
          <span>焦点区域</span>
          <strong>${focusRegion.name}</strong>
          <small>${derived.focusNote}</small>
        </article>
        <article>
          <span>即时结果感知</span>
          <strong>${derived.stageOutcome.title}</strong>
          <small>${derived.stageOutcome.detail}</small>
        </article>
      </div>
    </div>
  `;
}

function renderPlanCard(plan, scenarios) {
  const scenario = scenarios.find((item) => item.id === plan.scenarioId) ?? scenarios[0];

  return `
    <article class="traffic-plan-card">
      <div class="traffic-plan-card__head">
        <strong>${plan.name}</strong>
        <span>${plan.createdAt}</span>
      </div>
      <small>${scenario?.name ?? '交通预案'} · ${summarizePlanParams(plan.params, scenario)}</small>
    </article>
  `;
}

function summarizePlanParams(params, scenario) {
  if (!scenario) {
    return '参数组合已保存';
  }

  return [
    `${String(params.startHour).padStart(2, '0')}:00 - ${String(params.endHour).padStart(2, '0')}:00`,
    `航班 ${params.flightCount} 架次`,
    labelForOption(scenario.weatherOptions, params.weatherOption),
    `道路放行 ${params.roadRelease}%`,
  ]
    .filter(Boolean)
    .join(' / ');
}

function ensureTrafficControls(state, scenario) {
  state.traffic.controlsByScenario[scenario.id] ??= createTrafficControlState(scenario);
}

function readTrafficControls(state, scenario) {
  ensureTrafficControls(state, scenario);
  return state.traffic.controlsByScenario[scenario.id];
}

function writeTrafficControls(state, scenario, nextControls) {
  state.traffic.controlsByScenario[scenario.id] = nextControls;
}

function resolveScenario(data, route, state) {
  const scenarioId = route.params.get('scenario');
  return (
    data.trafficScenarios.find((item) => item.id === scenarioId) ??
    data.trafficScenarios.find((item) => item.id === state.selection.trafficScenarioId) ??
    data.trafficScenarios[0]
  );
}

function createTrafficControlState(scenario) {
  return normalizeTrafficControls({
    startHour: scenario.id === 'optimized-dispatch' ? 15 : 14,
    endHour: scenario.id === 'optimized-dispatch' ? 18 : 17,
    flightCount: scenario.id === 'optimized-dispatch' ? 520 : 460,
    weatherOption: scenario.weatherOptions[0]?.id ?? 'clear',
    businessOption: scenario.businessOptions[0]?.id ?? 'normal',
    taxiReserve: scenario.controlDefaults.taxiReserve,
    shuttleDispatch: scenario.controlDefaults.shuttleDispatch,
    rideFence: scenario.controlDefaults.rideFence,
    roadRelease: scenario.controlDefaults.roadRelease,
    parkingGuide: scenario.controlDefaults.parkingGuide,
  });
}

function normalizeTrafficControls(controls) {
  const startHour = Math.max(0, Math.min(23, Number(controls.startHour ?? 0)));
  const endHourRaw = Math.max(1, Math.min(24, Number(controls.endHour ?? 24)));
  const endHour = Math.max(startHour + 1, endHourRaw);

  return {
    ...controls,
    startHour,
    endHour: Math.min(24, endHour),
    flightCount: Math.max(0, Math.min(900, Number(controls.flightCount ?? 460))),
  };
}

function deriveTrafficState({ scenario, baseline, controls, progress, viewMode }) {
  const duration = Math.max(1, controls.endHour - controls.startHour);
  const peakPenalty =
    (controls.startHour <= 9 && controls.endHour >= 7) || (controls.startHour <= 18 && controls.endHour >= 16)
      ? 0.05
      : 0;
  const timeImpact = 0.92 + duration * 0.025 + peakPenalty;
  const flightPenalty =
    controls.flightCount >= 600 ? 0.08 : controls.flightCount >= 520 ? 0.04 : controls.flightCount <= 380 ? -0.02 : 0;
  const weatherPenalty =
    scenario.weatherOptions.find((item) => item.id === controls.weatherOption)?.penalty ?? 0;
  const businessBoost =
    scenario.businessOptions.find((item) => item.id === controls.businessOption)?.boost ?? 0;

  const controlGain =
    (controls.taxiReserve +
      controls.shuttleDispatch +
      controls.rideFence +
      controls.roadRelease +
      controls.parkingGuide) /
    500;
  const pressureFactor = timeImpact + flightPenalty + weatherPenalty - businessBoost;
  const responseFactor = controlGain - 0.5;

  const metrics = scenario.metrics.map((metric, index) => {
    const baseValue = baseline.metrics[index]?.value ?? metric.value;
    const digits = metric.unit === '' ? 2 : 0;
    let current = interpolateMetric(baseValue, metric.value, progress, TRAFFIC_PHASES.length - 1, digits);

    if (metric.label.includes('时间')) {
      current = current * (1 + pressureFactor * 0.18 - responseFactor * 0.28);
    } else if (metric.label.includes('效率')) {
      current = current * (1 + pressureFactor * 0.08 - responseFactor * 0.16);
    } else if (metric.label.includes('数量')) {
      current = current * (1 + pressureFactor * 0.16 - responseFactor * 0.12);
    } else if (metric.label.includes('拥堵')) {
      current = current * (1 + pressureFactor * 0.24 - responseFactor * 0.3);
    } else if (metric.label.includes('评分')) {
      current = current * (1 - pressureFactor * 0.1 + responseFactor * 0.24);
    }

    return {
      ...metric,
      value: Number(current.toFixed(digits)),
    };
  });

  const scene = {
    ...scenario,
    roadLoads: deriveRoadLoads(scenario, controls, progress),
    vehicleStreams: deriveVehicleStreams(scenario, controls, progress, viewMode),
    trafficNodes: deriveTrafficNodes(scenario, controls, progress),
    facilityPoints: deriveFacilityPoints(scenario, controls, progress),
    roadNotes: deriveRoadNotes(scenario, controls),
  };

  const realtime = deriveRealtimeMetrics({ metrics, controls, progress, scene });
  const phase = viewMode === 'realtime' ? TRAFFIC_PHASES[0] : TRAFFIC_PHASES[progress];
  const focusNode = scene.trafficNodes[0] ?? null;
  const improvedScore = Number((metrics[4]?.value ?? scenario.metrics[4]?.value ?? 0).toFixed(0));
  const baselineScore = baseline.metrics[4]?.value ?? improvedScore;

  return {
    metrics,
    realtime,
    phase,
    scene,
    focusNote: focusNode?.detail ?? '当前聚焦区域已进入交通仿真关注范围。',
    stageOutcome: {
      title:
        viewMode === 'realtime'
          ? '实时态势联动中'
          : improvedScore >= baselineScore
            ? '交通组织已优化'
            : '仍需继续优化',
      detail:
        viewMode === 'realtime'
          ? '舞台正在同步渲染道路、车流、停车与节点实时状态。'
          : `当前评分 ${formatMetricValue(improvedScore, 0)} 分，场景中已体现道路、车辆与节点状态变化。`,
    },
  };
}

function deriveRealtimeMetrics({ metrics, controls, progress, scene }) {
  const congestion = metrics.find((item) => item.label.includes('拥堵'));
  const stay = metrics.find((item) => item.label.includes('停留'));
  const count = metrics.find((item) => item.label.includes('车辆'));
  const efficiency = metrics.find((item) => item.label.includes('效率'));
  const focusNode = scene.trafficNodes[0];

  return [
    {
      label: '当前时间段',
      value: `${String(controls.startHour).padStart(2, '0')}:00 - ${String(controls.endHour).padStart(2, '0')}:00`,
      detail: '持续跟踪当前选定时段内的交通状态。',
    },
    {
      label: '当前道路速度',
      value: `${Math.max(18, Math.round(44 + controls.roadRelease * 0.2 - progress * 2.2))} km/h`,
      detail: congestion ? `拥堵指数 ${formatMetricValue(congestion.value, 2)}` : '主路保持动态更新。',
    },
    {
      label: '当前排队长度',
      value: `${Math.max(26, Math.round((stay?.value ?? 15) * 3.1))} 辆`,
      detail: '反映楼前短停与接驳口叠加排队情况。',
    },
    {
      label: '当前停车余量',
      value: `${Math.max(12, Math.round(100 - (efficiency?.value ?? 78)))}%`,
      detail: 'P1 / P2 综合剩余容量估算。',
    },
    {
      label: '当前在途接驳车辆',
      value: `${Math.max(18, Math.round((count?.value ?? 320) * 0.11))} 辆`,
      detail: `出租车补位 ${Math.round(controls.taxiReserve * 0.4)} / 摆渡 ${Math.round(
        controls.shuttleDispatch * 0.25,
      )}`,
    },
    {
      label: '当前焦点节点负荷',
      value: focusNode?.status ?? '稳定',
      detail: focusNode?.label ?? '场景节点已接入实时监看。',
    },
  ];
}

function deriveRoadLoads(scenario, controls, progress) {
  const relief = (controls.roadRelease + controls.parkingGuide + controls.rideFence) / 3 + progress * 4;
  return scenario.roadLoads.map((item) => ({
    ...item,
    level: normalizeLoad(item.level, relief),
  }));
}

function normalizeLoad(level, relief) {
  const value = { high: 3, medium: 2, low: 1 }[level] ?? 2;
  const adjusted = relief > 72 ? value - 1 : relief < 46 ? value + 1 : value;
  if (adjusted >= 3) {
    return 'high';
  }
  if (adjusted <= 1) {
    return 'low';
  }
  return 'medium';
}

function deriveVehicleStreams(scenario, controls, progress, viewMode) {
  const speedBoost = (controls.roadRelease + controls.shuttleDispatch) / 100;
  const densityDelta = controls.rideFence > 65 ? -1 : controls.rideFence < 40 ? 1 : 0;

  return scenario.vehicleStreams.map((item) => ({
    ...item,
    count: Math.max(1, item.count + densityDelta + (viewMode === 'model' ? 0 : 1)),
    speed: Number((item.speed + speedBoost * 0.45 + progress * 0.08).toFixed(2)),
  }));
}

function deriveTrafficNodes(scenario, controls, progress) {
  return scenario.trafficNodes.map((node) => {
    if (node.id === 'node-arrival') {
      return {
        ...node,
        status:
          controls.roadRelease > 72
            ? '分区放行'
            : controls.roadRelease < 45
              ? '高压运行'
              : progress >= 3
                ? '压力缓释'
                : node.status,
      };
    }

    if (node.id === 'node-taxi') {
      return {
        ...node,
        status:
          controls.taxiReserve > 72
            ? '前置补位'
            : controls.taxiReserve < 45
              ? '补位滞后'
              : progress >= 2
                ? '节拍稳定'
                : node.status,
      };
    }

    if (node.id === 'node-p2') {
      return {
        ...node,
        status:
          controls.parkingGuide > 72
            ? '分层导流'
            : controls.parkingGuide < 45
              ? '回流偏慢'
              : progress >= 3
                ? '回流恢复'
                : node.status,
      };
    }

    if (node.id === 'node-bus') {
      return {
        ...node,
        status:
          controls.shuttleDispatch > 72
            ? '站台重排'
            : controls.shuttleDispatch < 45
              ? '排班承压'
              : progress >= 2
                ? '组织有序'
                : node.status,
      };
    }

    return node;
  });
}

function deriveFacilityPoints(scenario, controls, progress) {
  return scenario.facilityPoints.map((point) => {
    if (point.id === 'facility-barrier') {
      return {
        ...point,
        state: controls.rideFence > 64 ? 'active' : controls.rideFence < 42 ? 'idle' : 'warm',
        status: controls.rideFence > 64 ? '分流启用' : controls.rideFence < 42 ? '待命' : '监看中',
      };
    }

    if (point.id === 'facility-bay') {
      return {
        ...point,
        state: controls.taxiReserve > 68 ? 'active' : 'warm',
        status: controls.taxiReserve > 68 ? '临时启用' : '弹性开放',
      };
    }

    if (point.id === 'facility-guide') {
      return {
        ...point,
        state: controls.parkingGuide > 66 ? 'active' : 'idle',
        status: controls.parkingGuide > 66 ? '导引增强' : '常规引导',
      };
    }

    if (point.id === 'facility-dispatch') {
      return {
        ...point,
        state: progress >= 2 ? 'active' : 'warm',
        status: progress >= 2 ? '联动调度' : '预备接入',
      };
    }

    return {
      ...point,
      state: 'idle',
      status: '在线',
    };
  });
}

function deriveRoadNotes(scenario, controls) {
  return scenario.roadNotes.map((item) => {
    if (item.roadId === 'arrival-lane') {
      return {
        ...item,
        kpi:
          controls.roadRelease > 70
            ? '平均通过 1.9 分钟'
            : controls.roadRelease < 45
              ? '平均通过 3.2 分钟'
              : item.kpi,
      };
    }
    if (item.roadId === 'parking-link') {
      return {
        ...item,
        kpi:
          controls.parkingGuide > 70
            ? '回流效率 84%'
            : controls.parkingGuide < 45
              ? '回流效率 66%'
              : item.kpi,
      };
    }
    if (item.roadId === 'dispatch-link') {
      return {
        ...item,
        kpi:
          controls.taxiReserve > 70
            ? '补位节拍 3 分钟'
            : controls.taxiReserve < 45
              ? '补位节拍 6 分钟'
              : item.kpi,
      };
    }
    return item;
  });
}

function renderTimeRangeField(startHour, endHour) {
  return `
    <section class="parameter-group parameter-group--time-range">
      <div class="traffic-slider__head">
        <span class="parameter-group__title">时间段</span>
        <strong data-control-output="timeRange">${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00</strong>
      </div>
      ${renderSlider('开始时间', 'startHour', startHour, '时')}
      ${renderSlider('结束时间', 'endHour', endHour, '时')}
    </section>
  `;
}

function renderSelectField(title, key, options, activeValue) {
  return `
    <label class="parameter-group parameter-field">
      <span class="parameter-group__title">${title}</span>
      <select class="parameter-field__control" data-control-select="${key}">
        ${options
          .map(
            (item) => `
              <option value="${item.id}" ${item.id === activeValue ? 'selected' : ''}>
                ${item.label}
              </option>
            `,
          )
          .join('')}
      </select>
    </label>
  `;
}

function renderNumberField(label, key, value, unit, min, max, step) {
  return `
    <label class="parameter-group parameter-field">
      <div class="traffic-slider__head">
        <span class="parameter-group__title">${label}</span>
        <strong data-control-output="${key}">${value}${unit}</strong>
      </div>
      <input
        class="parameter-field__control"
        type="number"
        min="${min}"
        max="${max}"
        step="${step}"
        value="${value}"
        data-control-number="${key}"
      />
    </label>
  `;
}

function renderSlider(label, key, value, unit) {
  const min = key === 'startHour' ? 0 : key === 'endHour' ? 1 : 20;
  const max = key === 'startHour' ? 23 : key === 'endHour' ? 24 : 100;

  return `
    <label class="traffic-slider">
      <div class="traffic-slider__head">
        <span>${label}</span>
        <strong data-control-output="${key}">${unit === '时' ? `${String(value).padStart(2, '0')}:00` : `${value}${unit}`}</strong>
      </div>
      <input type="range" min="${min}" max="${max}" step="1" value="${value}" data-control-slider="${key}" />
    </label>
  `;
}

function labelForOption(options, id) {
  return options.find((item) => item.id === id)?.label ?? '';
}
