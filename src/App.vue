<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useMonitor } from './composables/useMonitor'
import { useSettingsStore } from './stores/settings'
import CpuMonitor from './components/CpuMonitor.vue'
import GpuMonitor from './components/GpuMonitor.vue'
import MemoryMonitor from './components/MemoryMonitor.vue'
import DiskMonitor from './components/DiskMonitor.vue'
import NetworkMonitor from './components/NetworkMonitor.vue'
import VoltageMonitor from './components/VoltageMonitor.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const {
  systemInfo,
  monitorData,
  history,
  isConnected,
  error,
  formatBytes,
  formatSpeed
} = useMonitor()

const settingsStore = useSettingsStore()
const settingsRef = ref<InstanceType<typeof SettingsPanel>>()

function openSettings() {
  settingsRef.value?.open()
}

// Listen for "open-settings" from tray menu
onMounted(() => {
  window.electronAPI?.onOpenSettings(() => {
    openSettings()
  })
})

onUnmounted(() => {
  window.electronAPI?.removeSettingsListener()
})

// Dynamic opacity - make the glass layer more/less transparent
const appStyle = computed(() => ({
  opacity: 0.3 + settingsStore.settings.windowOpacity * 0.7
}))
</script>

<template>
  <div class="app-container" :style="appStyle">
  <!-- Title Bar (drag region only, no buttons) -->
  <div class="title-bar"></div>

  <!-- Loading State -->
  <div v-if="!monitorData && !error" class="loading">
    <div class="loading-spinner"></div>
    <div class="loading-text">正在初始化系统监控...</div>
  </div>

  <!-- Error State -->
  <div v-else-if="error" class="error-container">
    <div class="error-icon">⚠</div>
    <div class="error-text">{{ error }}</div>
  </div>

  <!-- Main Content -->
  <div v-else class="main-content">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-bar__item">
        <span :class="['status-dot', { disconnected: !isConnected }]"></span>
        {{ isConnected ? '监控运行中' : '连接中...' }}
      </div>
      <div class="status-bar__item">
        <span v-if="systemInfo">{{ systemInfo.os }}</span>
      </div>
      <div class="status-bar__item">
        <span v-if="systemInfo">已运行 {{ systemInfo.systemUptime }}</span>
      </div>
      <div class="status-bar__item" v-if="monitorData?.totalPower">
        <span style="color:var(--orange)">{{ monitorData.totalPower }} W</span>
      </div>
    </div>

    <!-- System Info -->
    <div v-if="systemInfo && settingsStore.settings.showSystemInfo" class="system-info-row">
      <span><span class="label">主机</span><span class="value">{{ systemInfo.hostname }}</span></span>
      <span><span class="label">CPU</span><span class="value">{{ systemInfo.cpuBrand }}</span></span>
      <span><span class="label">核心</span><span class="value">{{ systemInfo.cpuPhysicalCores }}P / {{ systemInfo.cpuCores }}T</span></span>
      <span><span class="label">架构</span><span class="value">{{ systemInfo.arch }}</span></span>
      <span><span class="label">系统</span><span class="value">{{ systemInfo.kernel }}</span></span>
    </div>

    <!-- Dashboard Grid -->
    <div class="dashboard">
      <CpuMonitor
        v-if="settingsStore.settings.showCpu"
        :data="monitorData?.cpu"
        :history="history.cpu"
        :temp-history="history.cpuTemp"
        :timestamps="history.timestamps"
        :cpu-brand="systemInfo?.cpuBrand"
        :cpu-cores="systemInfo?.cpuCores"
        :cpu-physical-cores="systemInfo?.cpuPhysicalCores"
        :cpu-speed="systemInfo?.cpuSpeed"
      />
      <GpuMonitor
        v-if="settingsStore.settings.showGpu"
        :data="monitorData?.gpu"
        :history="history.gpu"
        :temp-history="history.gpuTemp"
        :timestamps="history.timestamps"
      />
      <MemoryMonitor
        v-if="settingsStore.settings.showMemory"
        :data="monitorData?.memory"
        :history="history.memory"
        :timestamps="history.timestamps"
        :format-bytes="formatBytes"
      />
      <DiskMonitor
        v-if="settingsStore.settings.showDisk"
        :disks="monitorData?.disks ?? []"
        :format-bytes="formatBytes"
        :format-speed="formatSpeed"
      />
      <NetworkMonitor
        v-if="settingsStore.settings.showNetwork"
        :data="monitorData?.network"
        :rx-history="history.networkRx"
        :tx-history="history.networkTx"
        :timestamps="history.timestamps"
        :format-speed="formatSpeed"
        :format-bytes="formatBytes"
      />
      <VoltageMonitor
        v-if="settingsStore.settings.showVoltage"
        :data="monitorData?.voltage"
      />
    </div>
  </div>

  <!-- Settings Panel -->
  <SettingsPanel ref="settingsRef" />
</div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
