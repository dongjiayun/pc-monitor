<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart } from '@antv/g2'
import type { NetworkInfoData } from '@/env.d'

const props = defineProps<{
  data?: NetworkInfoData
  rxHistory: number[]
  txHistory: number[]
  timestamps: string[]
  formatSpeed: (bps: number) => string
  formatBytes: (bytes: number) => string
}>()

const chartRef = ref<HTMLDivElement>()
let chart: Chart | null = null
let lineMark: any = null
let areaMark: any = null
const chartInit = ref(false)

const rxLabel = computed(() => props.formatSpeed(props.data?.rxSec ?? 0))
const txLabel = computed(() => props.formatSpeed(props.data?.txSec ?? 0))

const rxTotalLabel = computed(() => {
  const b = props.data?.rxTotal ?? 0
  return props.formatBytes(b)
})
const txTotalLabel = computed(() => {
  const b = props.data?.txTotal ?? 0
  return props.formatBytes(b)
})
const rxSessionLabel = computed(() => {
  const b = props.data?.rxBytes ?? 0
  return props.formatBytes(b)
})
const txSessionLabel = computed(() => {
  const b = props.data?.txBytes ?? 0
  return props.formatBytes(b)
})

function toTabular(rx: number[], tx: number[], times: string[]): { time: string; type: string; value: number }[] {
  const result: { time: string; type: string; value: number }[] = []
  for (let i = 0; i < times.length; i++) {
    const t = times[i] || ''
    if (i < rx.length) result.push({ time: t, type: '下载', value: rx[i] })
    if (i < tx.length) result.push({ time: t, type: '上传', value: tx[i] })
  }
  return result
}

function initChart() {
  if (!chartRef.value) return
  chart = new Chart({ container: chartRef.value, autoFit: true, padding: 0 })
  chart.axis(false)
  chart.legend(false)

  const data = toTabular(props.rxHistory, props.txHistory, props.timestamps)

  areaMark = chart
    .area()
    .data(data)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('color', 'type')
    .encode('shape', 'smooth')
    .scale('color', { range: ['#1d9bf0', '#a855f7'] })
    .style('fillOpacity', 0.08)
    .style('lineWidth', 0)

  lineMark = chart
    .line()
    .data(data)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('color', 'type')
    .encode('shape', 'smooth')
    .scale('color', { range: ['#1d9bf0', '#a855f7'] })
    .style('lineWidth', 1)

  chart.render().then(() => {
    chartInit.value = true
  })
}

function updateChart(rx: number[], tx: number[], xData: string[]) {
  if (!lineMark || !areaMark) return
  const data = toTabular(rx, tx, xData)
  lineMark.changeData(data)
  areaMark.changeData(data)
}

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  chart?.destroy()
  chart = null
  lineMark = null
  areaMark = null
})

watch(() => [props.rxHistory, props.txHistory], ([rx, tx]) => {
  updateChart(rx, tx, props.timestamps)
}, { flush: 'post' })

watch(() => props.timestamps, (xData) => {
  updateChart(props.rxHistory, props.txHistory, xData)
}, { flush: 'post' })
</script>

<template>
  <div class="monitor-card network fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon network">🌐</div>
        <span>网络</span>
      </div>
      <div v-if="data" style="font-size:9px;color:var(--text-tertiary);max-width:140px;text-align:right;line-height:1.3;word-break:break-all">{{ data.iface }}</div>
    </div>

    <!-- 实时速度 -->
    <div class="network-speed-group">
      <div class="network-speed">
        <div class="network-speed__label">下载</div>
        <div class="network-speed__value download">{{ rxLabel }}</div>
      </div>
      <div class="network-speed">
        <div class="network-speed__label">上传</div>
        <div class="network-speed__value upload">{{ txLabel }}</div>
      </div>
    </div>

    <!-- 趋势图 -->
    <div class="chart-container" ref="chartRef">
      <div v-if="!chartInit" class="chart-placeholder"></div>
      <div class="chart-label">网络流量</div>
    </div>

    <!-- 流量统计 -->
    <div class="card-details" style="grid-template-columns:1fr 1fr;margin-top:4px">
      <div class="detail-item">
        <span class="detail-label">已下载(本次)</span>
        <span class="detail-value" style="color:#1d9bf0">{{ rxSessionLabel }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">已上传(本次)</span>
        <span class="detail-value" style="color:#a855f7">{{ txSessionLabel }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">已下载(总计)</span>
        <span class="detail-value">{{ rxTotalLabel }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">已上传(总计)</span>
        <span class="detail-value">{{ txTotalLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-placeholder { width: 100%; height: 100%; }
</style>
