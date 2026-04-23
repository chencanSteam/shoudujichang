export function renderTerminalScene({ terminal, floor, activeZoneId, activeHotspotId }) {
  const activeFloor =
    floor ??
    terminal.floors.find((item) => item.id === terminal.defaultFloor) ??
    terminal.floors[0];

  return `
    <div class="terminal-scene">
      <div class="terminal-scene__header">
        <div>
          <span class="panel-kicker">楼内模型</span>
          <h3>${terminal.name}</h3>
          <p class="panel-copy">${activeFloor.subtitle}</p>
        </div>
        <button class="resource-chip" type="button" data-terminal-back>返回机场总图</button>
      </div>
      <div class="terminal-floor-tabs">
        ${terminal.floors
          .map(
            (item) => `
              <button
                class="resource-chip ${item.id === activeFloor.id ? 'is-active' : ''}"
                type="button"
                data-terminal-floor="${item.id}"
              >
                ${item.name}
              </button>
            `,
          )
          .join('')}
      </div>
      <div class="terminal-scene__body">
        <div class="terminal-scene__canvas">
          <svg class="terminal-floorplan" viewBox="0 0 720 460" role="img" aria-label="${terminal.name} ${activeFloor.name} 楼层模型">
            <defs>
              <linearGradient id="terminalBase" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="rgba(23, 74, 126, 0.98)" />
                <stop offset="100%" stop-color="rgba(8, 24, 42, 0.98)" />
              </linearGradient>
            </defs>
            <rect x="40" y="52" width="620" height="356" rx="34" class="terminal-floorplan__base"></rect>
            <rect x="56" y="68" width="588" height="324" rx="28" class="terminal-floorplan__core"></rect>
            ${activeFloor.zones
              .map(
                (zone) => `
                  <g
                    class="terminal-zone terminal-zone--${zone.tone} ${zone.id === activeZoneId ? 'is-active' : ''}"
                    tabindex="0"
                    role="button"
                    aria-label="${zone.label}"
                    data-terminal-zone-link="${zone.id}"
                  >
                    <rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="18"></rect>
                    <text x="${zone.x + 18}" y="${zone.y + 34}">${zone.label}</text>
                    <text class="terminal-zone__status" x="${zone.x + 18}" y="${zone.y + 64}">${zone.status}</text>
                  </g>
                `,
              )
              .join('')}
            ${activeFloor.hotspots
              .map(
                (hotspot) => `
                  <g
                    class="terminal-hotspot ${hotspot.id === activeHotspotId ? 'is-active' : ''}"
                    transform="translate(${hotspot.x} ${hotspot.y})"
                    tabindex="0"
                    role="button"
                    aria-label="${hotspot.label}"
                    data-terminal-hotspot-link="${hotspot.id}"
                    data-terminal-zone="${hotspot.zoneId}"
                    data-terminal-video="${hotspot.videoId ?? ''}"
                  >
                    <circle r="18"></circle>
                    <circle r="6"></circle>
                    <text x="24" y="6">${hotspot.label}</text>
                  </g>
                `,
              )
              .join('')}
          </svg>
        </div>
        <aside class="terminal-scene__sidebar">
          <div class="terminal-metrics">
            ${activeFloor.metrics
              .map(
                (metric) => `
                  <article class="terminal-metric">
                    <span>${metric.label}</span>
                    <strong>${metric.value}</strong>
                  </article>
                `,
              )
              .join('')}
          </div>
          <div class="terminal-callout">
            <span class="panel-kicker">楼层说明</span>
            <strong>${activeFloor.name}</strong>
            <p>${activeFloor.subtitle}</p>
          </div>
          <div class="terminal-legend">
            <span class="terminal-legend__item terminal-legend__item--hot">高负荷区域</span>
            <span class="terminal-legend__item terminal-legend__item--warn">排队上升</span>
            <span class="terminal-legend__item terminal-legend__item--active">运行中</span>
            <span class="terminal-legend__item terminal-legend__item--calm">平稳区域</span>
          </div>
        </aside>
      </div>
    </div>
  `;
}
