<script setup lang="ts">
import type { GpuInfoData } from '@/env.d'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart } from '@antv/g2'
import { f2 } from '@/utils/format'

const props = defineProps<{
  data?: GpuInfoData
  history: number[]
  tempHistory: number[]
  timestamps: string[]
}>()

const primary = computed(() => props.data?.controllers?.[0])
const display = computed(() => props.data?.display)

const chartRef = ref<HTMLDivElement>()
const tempChartRef = ref<HTMLDivElement>()
let chart: Chart | null = null
let tempChart: Chart | null = null
let lineMark: any = null
let areaMark: any = null
let tempLineMark: any = null
let tempAreaMark: any = null
const chartInit = ref(false)
const tempChartInit = ref(false)

function toTabular(values: number[], times: string[]) {
  return values.map((v, i) => ({ time: times[i] || '', value: v }))
}

function initChart(
  container: HTMLElement,
  data: number[],
  xData: string[],
  color: string,
  setInit: (v: boolean) => void
) {
  const c = new Chart({ container, autoFit: true, padding: 0 })
  c.axis(false)
  c.legend(false)

  const tab = toTabular(data, xData)

  const am = c
    .area()
    .data(tab)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('shape', 'smooth')
    .style('fill', color + '26')
    .style('lineWidth', 0)

  const lm = c
    .line()
    .data(tab)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('shape', 'smooth')
    .style('stroke', color)
    .style('lineWidth', 1)

  c.render().then(() => setInit(true))

  return { chart: c, lineMark: lm, areaMark: am }
}

onMounted(() => {
  const r1 = initChart(chartRef.value!, props.history, props.timestamps, '#bf5af2', (v) => chartInit.value = v)
  chart = r1.chart
  lineMark = r1.lineMark
  areaMark = r1.areaMark

  const r2 = initChart(tempChartRef.value!, props.tempHistory, props.timestamps, '#ff6b6b', (v) => tempChartInit.value = v)
  tempChart = r2.chart
  tempLineMark = r2.lineMark
  tempAreaMark = r2.areaMark
})

onUnmounted(() => {
  chart?.destroy()
  tempChart?.destroy()
})

function updateChart(lm: any, am: any, data: number[], xData: string[]) {
  if (!lm || !am) return
  const tab = toTabular(data, xData)
  lm.changeData(tab)
  am.changeData(tab)
}

watch(() => props.history, (data) => {
  updateChart(lineMark, areaMark, data, props.timestamps)
}, { flush: 'post' })

watch(() => props.tempHistory, (data) => {
  updateChart(tempLineMark, tempAreaMark, data, props.timestamps)
}, { flush: 'post' })

watch(() => props.timestamps, (xData) => {
  updateChart(lineMark, areaMark, props.history, xData)
  updateChart(tempLineMark, tempAreaMark, props.tempHistory, xData)
}, { flush: 'post' })

function formatBytes(bytes: number): string {
  if (!bytes) return '0 GB'
  const gb = bytes / 1073741824
  return gb.toFixed(1) + ' GB'
}

function formatMemBar(used: number, total: number): number {
  if (!total) return 0
  return Math.min(100, Math.round(used / total * 100))
}
</script>

<template>
  <div class="monitor-card gpu fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon gpu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
            <circle cx="18" cy="10" r="1" fill="currentColor"/>
          </svg>
        </div>
        <span>GPU</span>
      </div>
      <div class="card-value gpu">
        <span style="font-size:10px;font-weight:500;color:var(--text-tertiary);display:block;text-align:right;letter-spacing:-0.2px">
          {{ (primary?.model || 'GPU') }}
        </span>
        {{ f2(primary?.utilizationGpu) }}<small style="font-size:12px;font-weight:400">%</small>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-bar__fill gpu" :style="{ width: ((primary?.utilizationGpu ?? 0) / 100 * 100) + '%' }"></div>
    </div>

    <!-- 负载趋势图 -->
    <div class="chart-container" ref="chartRef">
      <div v-if="!chartInit" class="chart-placeholder"></div>
      <div class="chart-label">负载趋势</div>
    </div>

    <!-- 温度趋势图 -->
    <div class="chart-container" ref="tempChartRef">
      <div v-if="!tempChartInit" class="chart-placeholder"></div>
      <div class="chart-label">温度趋势</div>
    </div>

    <!-- GPU Stats Grid -->
    <div class="gpu-stats">
      <!-- Temperature -->
      <div class="gpu-stat-box">
        <div class="stat-label">温度</div>
        <div class="stat-value temp">{{ primary?.temperature !== undefined ? f2(primary.temperature) + '°C' : 'N/A' }}</div>
        <div v-if="primary?.temperature" class="stat-bar">
          <div class="stat-bar-fill temp" :style="{ width: Math.min(100, primary.temperature / 1.2) + '%' }"></div>
        </div>
      </div>

      <!-- Fan Speed -->
      <div class="gpu-stat-box">
        <div class="stat-label">风扇</div>
        <div class="stat-value">{{ primary?.fanSpeed !== undefined ? Math.round(primary.fanSpeed) + ' RPM' : 'N/A' }}</div>
        <div v-if="primary?.fanSpeed !== undefined" class="stat-bar">
          <div class="stat-bar-fill" :style="{ width: Math.min(100, primary.fanSpeed / 30) + '%' }"></div>
        </div>
      </div>

      <!-- Power Draw -->
      <div class="gpu-stat-box">
        <div class="stat-label">功耗</div>
        <div class="stat-value">{{ primary?.powerDraw ? f2(primary.powerDraw) + ' W' : 'N/A' }}</div>
        <div v-if="primary?.powerDraw" class="stat-bar">
          <div class="stat-bar-fill power" :style="{ width: Math.min(100, primary.powerDraw * 2) + '%' }"></div>
        </div>
      </div>

      <!-- Memory Usage -->
      <div class="gpu-stat-box">
        <div class="stat-label">显存</div>
        <div class="stat-value">{{ primary?.memoryTotal ? formatBytes(primary.memoryUsed) + ' / ' + formatBytes(primary.memoryTotal) : 'N/A' }}</div>
        <div v-if="primary?.memoryTotal" class="stat-bar">
          <div class="stat-bar-fill mem" :style="{ width: formatMemBar(primary.memoryUsed, primary.memoryTotal) + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Details -->
    <div class="card-details" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-top:8px">
      <div class="detail-item">
        <span class="detail-label">分辨率</span>
        <span class="detail-value">{{ display?.width }}×{{ display?.height }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">刷新率</span>
        <span class="detail-value">{{ display?.refreshRate }}Hz</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">显存利用率</span>
        <span class="detail-value">{{ primary ? formatMemBar(primary.memoryUsed, primary.memoryTotal) + '%' : '-' }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">GPU利用率</span>
        <span class="detail-value">{{ primary ? f2(primary.utilizationGpu) + '%' : '-' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-placeholder { width: 100%; height: 100%; }

.gpu-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}

.gpu-stat-box {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 10px;
  border: 0.5px solid rgba(255, 255, 255, 0.04);
}

.stat-label {
  font-size: 9px;
  color: var(--text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-value.temp {
  color: #ff6b6b;
}

.stat-bar {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--gradient-purple);
  transition: width 0.3s ease;
}

.stat-bar-fill.temp {
  background: linear-gradient(90deg, #ff6b6b, #ff4757);
}

.stat-bar-fill.power {
  background: linear-gradient(90deg, #ffa502, #ff6348);
}

.stat-bar-fill.mem {
  background: linear-gradient(90deg, #2ed573, #7bed9f);
}
</style>
