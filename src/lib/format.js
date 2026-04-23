const SHANGHAI_LOCALE = 'zh-CN';
const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

export function formatClock(date) {
  return new Intl.DateTimeFormat(SHANGHAI_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: SHANGHAI_TIMEZONE,
  }).format(date);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat(SHANGHAI_LOCALE, {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone: SHANGHAI_TIMEZONE,
  }).format(date);
}

export function formatMetricValue(value, digits = 0) {
  return Number(value).toLocaleString(SHANGHAI_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pulseValue(base, tick, amplitude = 1, digits = 0) {
  const wave = [0, 0.32, 0.55, 0.15, -0.2, -0.38, -0.12];
  const nextValue = Number(base) + wave[tick % wave.length] * amplitude;
  return Number(nextValue.toFixed(digits));
}

export function shiftSeries(series, tick, amplitude = 1) {
  return series.map((value, index) => {
    const modulation = Math.sin((tick + index) * 0.75) * amplitude;
    return Number((value + modulation).toFixed(1));
  });
}

export function interpolateMetric(start, end, progress, maxProgress, digits = 0) {
  if (!maxProgress) {
    return Number(end.toFixed(digits));
  }

  const ratio = progress / maxProgress;
  const value = start + (end - start) * ratio;
  return Number(value.toFixed(digits));
}

export function getAlertTone(level) {
  const tones = {
    high: 'danger',
    medium: 'warning',
    low: 'info',
  };

  return tones[level] ?? 'info';
}
