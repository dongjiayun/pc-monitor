<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue'
import { Chart } from '@antv/g2'
import type { CpuLoadData } from '@/env.d'
import { f2, f } from '@/utils/format'

const props = defineProps<{
  data?: CpuLoadData
  history: number[]
  tempHistory: number[]
  timestamps: string[]
  cpuBrand?: string
  cpuCores?: number
  cpuPhysicalCores?: number
  cpuSpeed?: string
}>()

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

const avgTemp = computed(() => props.data?.tempMain ?? 0)
const currentFreq = computed(() => props.data?.speedAvg ?? 0)

const isIntelHybrid = computed(() => {
  const brand = (props.cpuBrand || '').toLowerCase()
  return brand.includes('intel') && (props.cpuCores ?? 0) > (props.cpuPhysicalCores ?? 0) * 1.5
})

const coreGroups = computed(() => {
  const allCores = props.data?.cores ?? []
  if (allCores.length === 0) return []
  const total = props.cpuCores ?? allCores.length
  const physical = props.cpuPhysicalCores ?? Math.round(total / 2)
  if (isIntelHybrid.value) {
    const pCoreThreads = physical * 2
    const eCoreCount = total - pCoreThreads
    return [
      { label: `P-核 (${physical}C/${pCoreThreads}T)`, cores: allCores.slice(0, pCoreThreads).map((load, i) => ({ core: i, load, type: 'p' as const })) },
      { label: `E-核 (${eCoreCount}C)`, cores: allCores.slice(pCoreThreads).map((load, i) => ({ core: pCoreThreads + i, load, type: 'e' as const })) },
    ].filter(g => g.cores.length > 0)
  }
  const pCores = allCores.slice(0, physical)
  const htCores = allCores.slice(physical)
  return [
    { label: `物理核心 (${physical}C)`, cores: pCores.map((load, i) => ({ core: i, load, type: 'p' as const })) },
    { label: `逻辑线程 (${total - physical}T)`, cores: htCores.map((load, i) => ({ core: physical + i, load, type: 'ht' as const })) },
  ].filter(g => g.cores.length > 0)
})

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

  c.render().then(() => {
    setInit(true)
  })

  return { chart: c, lineMark: lm, areaMark: am }
}

onMounted(() => {
  const r1 = initChart(chartRef.value!, props.history, props.timestamps, '#6366f1', (v) => chartInit.value = v)
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

function updateChart(
  lm: any,
  am: any,
  data: number[],
  xData: string[]
) {
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
</script>

<template>
  <div class="monitor-card cpu fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon cpu">⚡</div>
        <div>
          CPU
          <div style="font-size:9px;color:var(--text-tertiary);font-weight:400;margin-top:0">
            {{ cpuBrand?.split('@')[0]?.trim() || '' }}
          </div>
        </div>
      </div>
      <div class="card-value cpu">
        {{ data?.currentLoad !== undefined ? f2(data.currentLoad) : '-' }}<small style="font-size:12px;font-weight:400">%</small>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-bar__fill cpu" :style="{ width: ((data?.currentLoad ?? 0) / 100 * 100) + '%' }"></div>
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

    <!-- 核心负载 -->
    <div v-if="coreGroups.length > 0" class="core-section">
      <div class="core-section-title">核心负载</div>
      <div v-for="(group, gi) in coreGroups" :key="gi" class="core-group">
        <div :class="['core-group-label', group.cores[0]?.type === 'p' ? 'p' : group.cores[0]?.type === 'ht' ? 'e' : 'e']">{{ group.label }}</div>
        <div :class="['core-grid', 'cols-' + Math.min(group.cores.length, 8)]">
          <div v-for="core in group.cores" :key="core.core" class="core-bar-v">
            <div class="core-bar-v-bg">
              <div class="core-bar-v-fill" :class="core.type" :style="{ height: core.load + '%' }"></div>
            </div>
            <div class="core-bar-v-pct">{{ f2(core.load) }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="core-section">
      <div class="core-section-title">核心</div>
      <div style="font-size:9px;color:var(--text-tertiary)">暂无核心数据</div>
    </div>

    <!-- 细节 -->
    <div class="card-details">
      <div class="detail-item"><span class="detail-label">平均负载</span><span class="detail-value">{{ data?.avgLoad !== undefined ? f2(data.avgLoad) : '-' }}</span></div>
      <div class="detail-item"><span class="detail-label">CPU频率</span><span class="detail-value">{{ currentFreq ? f(currentFreq) + ' GHz' : '-' }}</span></div>
      <div class="detail-item"><span class="detail-label">CPU温度</span><span class="detail-value">{{ avgTemp ? f2(avgTemp) + '°C' : '-' }}</span></div>
      <div class="detail-item"><span class="detail-label">CPU功耗</span><span class="detail-value">{{ data?.powerDraw ? f2(data.powerDraw) + ' W' : '-' }}</span></div>
      <div class="detail-item"><span class="detail-label">风扇转速</span><span class="detail-value">{{ data?.fanSpeed ? Math.round(data.fanSpeed) + ' RPM' : '-' }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.chart-placeholder { width: 100%; height: 100%; }
</style>
