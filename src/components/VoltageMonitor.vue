<script setup lang="ts">
import type { VoltageInfoData } from '@/env.d'

defineProps<{
  data?: VoltageInfoData
}>()
</script>

<template>
  <div class="monitor-card voltage fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon voltage">🔋</div>
        <span>电源</span>
      </div>
      <div v-if="data?.battery?.hasBattery" class="card-value voltage">
        {{ data.battery.percent }}<small style="font-size:12px;font-weight:400">%</small>
      </div>
    </div>

    <div v-if="data?.battery?.hasBattery" class="progress-bar">
      <div class="progress-bar__fill disk" :style="{ transform: 'scaleX(' + ((data?.battery?.percent ?? 0) / 100) + ')' }"></div>
    </div>

    <!-- Battery -->
    <div class="card-section-label">电池</div>
    <div class="card-details">
      <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">{{ data?.battery?.hasBattery ? (data?.battery?.isCharging ? '充电中' : '使用电池') : '无' }}</span></div>
      <div v-if="data?.battery?.hasBattery" class="detail-item"><span class="detail-label">电量</span><span class="detail-value">{{ data?.battery?.percent ?? 0 }}%</span></div>
      <div v-if="data?.battery?.hasBattery" class="detail-item"><span class="detail-label">电压</span><span class="detail-value">{{ data?.battery?.voltage?.toFixed(1) }}V</span></div>
    </div>

    <!-- Motherboard Rail Voltages -->
    <div v-if="data?.moboVcore != null" class="card-section-label">主板电压</div>
    <div v-if="data?.moboVcore != null" class="card-details">
      <div class="detail-item"><span class="detail-label">Vcore</span><span class="detail-value">{{ data.moboVcore.toFixed(3) }}V</span></div>
      <div v-if="data.moboVcoreSoc != null" class="detail-item"><span class="detail-label">SoC</span><span class="detail-value">{{ data.moboVcoreSoc.toFixed(3) }}V</span></div>
      <div v-if="data.mobo12V != null" class="detail-item"><span class="detail-label">+12V</span><span class="detail-value">{{ data.mobo12V.toFixed(2) }}V</span></div>
      <div v-if="data.mobo5V != null" class="detail-item"><span class="detail-label">+5V</span><span class="detail-value">{{ data.mobo5V.toFixed(2) }}V</span></div>
      <div v-if="data.mobo3V != null" class="detail-item"><span class="detail-label">+3.3V</span><span class="detail-value">{{ data.mobo3V.toFixed(3) }}V</span></div>
    </div>

    <!-- Motherboard Temperatures -->
    <div v-if="data?.moboCpuSocketTemp != null || data?.moboChipsetTemp != null || data?.moboVrmTemp != null" class="card-section-label">主板温度</div>
    <div v-if="data?.moboCpuSocketTemp != null || data?.moboChipsetTemp != null || data?.moboVrmTemp != null" class="card-details">
      <div v-if="data.moboSystemTemp != null" class="detail-item"><span class="detail-label">机箱</span><span class="detail-value">{{ data.moboSystemTemp }}°C</span></div>
      <div v-if="data.moboCpuSocketTemp != null" class="detail-item"><span class="detail-label">CPU插座</span><span class="detail-value">{{ data.moboCpuSocketTemp }}°C</span></div>
      <div v-if="data.moboChipsetTemp != null" class="detail-item"><span class="detail-label">芯片组</span><span class="detail-value">{{ data.moboChipsetTemp }}°C</span></div>
      <div v-if="data.moboVrmTemp != null" class="detail-item"><span class="detail-label">VRM</span><span class="detail-value">{{ data.moboVrmTemp }}°C</span></div>
    </div>

    <!-- Motherboard Fans -->
    <div v-if="data?.moboCpuFan != null || data?.moboSystemFan != null" class="card-section-label">风扇</div>
    <div v-if="data?.moboCpuFan != null || data?.moboSystemFan != null" class="card-details">
      <div v-if="data.moboCpuFan != null" class="detail-item"><span class="detail-label">CPU风扇</span><span class="detail-value">{{ data.moboCpuFan }} RPM</span></div>
      <div v-if="data.moboSystemFan != null && data.moboSystemFan > 0" class="detail-item"><span class="detail-label">系统风扇</span><span class="detail-value">{{ data.moboSystemFan }} RPM</span></div>
    </div>
  </div>
</template>
