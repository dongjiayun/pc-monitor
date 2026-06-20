<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart } from '@antv/g2'
import type { MemoryInfoData } from '@/env.d'
import { f2 } from '@/utils/format'

const props = defineProps<{
  data?: MemoryInfoData
  history: number[]
  timestamps: string[]
  formatBytes: (bytes: number) => string
}>()

const chartRef = ref<HTMLDivElement>()
let chart: Chart | null = null
let lineMark: any = null
let areaMark: any = null
let chartInited = false

const memUsed = computed(() => props.data ? f2(props.data.usagePercent) : '0')
const memTotal = computed(() => props.data ? props.formatBytes(props.data.total) : '-')
const memFree = computed(() => props.data ? props.formatBytes(props.data.free) : '-')
const layouts = computed(() => props.data?.layouts ?? [])

function toTabular(values: number[], times: string[]): { time: string; value: number }[] {
  return values.map((v, i) => ({ time: times[i] || '', value: v }))
}

function initChart() {
  if (!chartRef.value) return
  chart = new Chart({ container: chartRef.value, autoFit: true, padding: 0 })

  const data = toTabular(props.history, props.timestamps)

  chart.axis(false)
  chart.legend(false)

  areaMark = chart
    .area()
    .data(data)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('shape', 'smooth')
    .style('fill', 'rgba(0,186,124,0.15)')
    .style('lineWidth', 0)

  lineMark = chart
    .line()
    .data(data)
    .encode('x', 'time')
    .encode('y', 'value')
    .encode('shape', 'smooth')
    .style('stroke', '#00ba7c')
    .style('lineWidth', 1)

  chart.render().then(() => {
    chartInited = true
  })
}

function updateChart(data: number[], xData: string[]) {
  if (!lineMark || !areaMark) return
  const tabular = toTabular(data, xData)
  lineMark.changeData(tabular)
  areaMark.changeData(tabular)
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

watch(() => props.history, (data) => {
  updateChart(data, props.timestamps)
}, { flush: 'post' })

watch(() => props.timestamps, (xData) => {
  updateChart(props.history, xData)
}, { flush: 'post' })
</script>

<template>
  <div class="monitor-card memory fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon memory">🧠</div>
        <span>内存</span>
      </div>
      <div class="card-value memory">{{ memUsed }}<small style="font-size:12px;font-weight:400">%</small></div>
    </div>

    <div class="progress-bar">
      <div class="progress-bar__fill memory" :style="{ width: ((data?.usagePercent ?? 0) / 100 * 100) + '%' }"></div>
    </div>

    <div class="chart-container" ref="chartRef">
      <div v-if="!chartInited" class="chart-placeholder"></div>
      <div class="chart-label">内存使用</div>
    </div>

    <div class="card-details">
      <div class="detail-item"><span class="detail-label">已用</span><span class="detail-value">{{ data ? formatBytes(data.used) : '-' }}</span></div>
      <div class="detail-item"><span class="detail-label">可用</span><span class="detail-value">{{ memFree }}</span></div>
      <div class="detail-item"><span class="detail-label">总量</span><span class="detail-value">{{ memTotal }}</span></div>
      <div class="detail-item"><span class="detail-label">使用率</span><span class="detail-value">{{ memUsed }}%</span></div>
    </div>

    <div v-if="layouts.length > 0" class="core-section" style="margin-top:3px">
      <div class="core-section-title">内存</div>
      <div v-for="(l, i) in layouts" :key="i" class="memory-stick">
        <span class="memory-stick-idx">#{{ i+1 }}</span>
        <span v-if="l.manufacturer" class="memory-stick-brand">{{ l.manufacturer }}</span>
        <span class="memory-stick-size">{{ (l.size / 1073741824).toFixed(1) }}GB</span>
        <span v-if="l.clockSpeed" class="memory-stick-speed">{{ l.clockSpeed }}MHz</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-placeholder { width: 100%; height: 100%; }
</style>
