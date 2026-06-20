<script setup lang="ts">
import type { DiskInfoData } from '@/env.d'
import { f2 } from '@/utils/format'

defineProps<{
  disks: DiskInfoData[]
  formatBytes: (bytes: number) => string
  formatSpeed: (bps: number) => string
}>()

function badgeClass(disk: DiskInfoData): string {
  return disk.isSSD ? 'ssd' : 'hdd'
}

function badgeLabel(disk: DiskInfoData): string {
  return disk.interfaceType?.includes('NVMe') ? 'NVMe' : disk.isSSD ? 'SSD' : 'HDD'
}
</script>

<template>
  <div class="monitor-card disk fade-in">
    <div class="card-header">
      <div class="card-title">
        <div class="card-icon disk">📀</div>
        <div>
          硬盘
          <div style="font-size:9px;color:var(--text-tertiary);font-weight:400;margin-top:0">
            {{ disks.length > 0 ? disks.filter(d => d.isSSD).length + ' SSD / ' + disks.filter(d => !d.isSSD).length + ' HDD' : '-' }}
          </div>
        </div>
      </div>
      <div class="card-value disk">
        {{ disks.length > 0 ? f2(disks.reduce((s, d) => s + d.usePercent, 0) / disks.length) : 0 }}<small style="font-size:12px;font-weight:400">%</small>
      </div>
    </div>

    <div class="disk-list">
      <div v-for="(disk, idx) in disks" :key="idx" class="disk-subcard">
        <div class="disk-subcard-top">
          <div class="disk-subcard-left">
            <div class="disk-subcard-icon" :class="badgeClass(disk)">
              {{ disk.isSSD ? '⚡' : '💿' }}
            </div>
            <div>
              <div class="disk-subcard-name">{{ disk.mount }}</div>
              <div class="disk-subcard-model">{{ disk.diskName || '逻辑分区' }}</div>
            </div>
          </div>
          <div class="disk-subcard-badges">
            <span class="disk-badge type-badge" :class="badgeClass(disk)">{{ badgeLabel(disk) }}</span>
            <span v-if="disk.healthStatus" class="disk-badge health-badge" :class="disk.healthStatus.toLowerCase()">{{ disk.healthStatus }}</span>
          </div>
        </div>
        <div class="disk-usage-row">
          <div class="disk-usage-bar">
            <div class="disk-usage-fill" :style="{ width: disk.usePercent + '%', background: 'var(--gradient-orange)' }"></div>
          </div>
          <span class="disk-usage-text">{{ formatBytes(disk.used) }} / {{ formatBytes(disk.size) }}</span>
        </div>
        <div class="disk-speed-row">
          <span class="disk-speed-read">读 {{ formatSpeed(disk.ioReadSpeed) }}</span>
          <span class="disk-speed-write">写 {{ formatSpeed(disk.ioWriteSpeed) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>