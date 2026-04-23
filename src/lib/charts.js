import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { init, use, graphic } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const chartPool = new Set();
let resizeBound = false;

export function mountChart(element, option) {
  const chart = init(element);
  chart.setOption(option);
  chartPool.add(chart);
  bindResize();
  return chart;
}

export function updateChart(chart, option) {
  if (!chart || chart.isDisposed()) {
    return;
  }

  chart.setOption(option, true);
}

export function disposeCharts() {
  chartPool.forEach((chart) => {
    if (!chart.isDisposed()) {
      chart.dispose();
    }
  });
  chartPool.clear();
}

function bindResize() {
  if (resizeBound) {
    return;
  }

  resizeBound = true;
  window.addEventListener('resize', () => {
    chartPool.forEach((chart) => {
      if (!chart.isDisposed()) {
        chart.resize();
      }
    });
  });
}

export function buildLineChartOption({ categories, series, colors }) {
  return {
    animationDuration: 600,
    grid: {
      top: 28,
      left: 18,
      right: 12,
      bottom: 22,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 20, 44, 0.92)',
      borderColor: 'rgba(112, 209, 255, 0.32)',
      textStyle: {
        color: '#dff7ff',
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisLine: { lineStyle: { color: 'rgba(142, 198, 255, 0.18)' } },
      axisLabel: { color: 'rgba(203, 235, 255, 0.58)', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(142, 198, 255, 0.08)' } },
      axisLabel: { color: 'rgba(203, 235, 255, 0.54)', fontSize: 11 },
    },
    series: series.map((item, index) => ({
      type: 'line',
      name: item.name,
      data: item.data,
      symbol: 'circle',
      symbolSize: 6,
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 2,
        color: colors[index],
      },
      itemStyle: {
        color: colors[index],
      },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${colors[index]}66` },
          { offset: 1, color: `${colors[index]}00` },
        ]),
      },
    })),
  };
}

export function buildBarChartOption({ categories, series, colors, stacked = false }) {
  return {
    animationDuration: 600,
    grid: {
      top: 24,
      left: 16,
      right: 12,
      bottom: 22,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10, 20, 44, 0.92)',
      borderColor: 'rgba(112, 209, 255, 0.32)',
      textStyle: {
        color: '#dff7ff',
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(142, 198, 255, 0.18)' } },
      axisLabel: { color: 'rgba(203, 235, 255, 0.58)', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(142, 198, 255, 0.08)' } },
      axisLabel: { color: 'rgba(203, 235, 255, 0.54)', fontSize: 11 },
    },
    series: series.map((item, index) => ({
      type: 'bar',
      name: item.name,
      data: item.data,
      stack: stacked ? 'total' : undefined,
      barMaxWidth: 18,
      itemStyle: {
        color: colors[index],
        borderRadius: [8, 8, 2, 2],
      },
    })),
  };
}
