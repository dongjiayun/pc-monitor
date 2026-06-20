<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { ref } from 'vue'

const store = useSettingsStore()
const visible = ref(false)

function open() { visible.value = true }
function close() { visible.value = false }

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <Transition name="settings">
      <div v-if="visible" class="settings-overlay" @click.self="close">
        <div class="settings-panel">
          <div class="settings-header">
            <div class="settings-title">
              <div class="settings-icon">⚙</div>
              设置
            </div>
            <button class="settings-close" @click="close">✕</button>
          </div>

          <div class="settings-body">
            <div class="settings-section">
              <div class="settings-section-title">监控卡片</div>

              <label class="settings-item">
                <span>CPU 监控</span>
                <input type="checkbox" v-model="store.settings.showCpu" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>GPU 监控</span>
                <input type="checkbox" v-model="store.settings.showGpu" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>内存监控</span>
                <input type="checkbox" v-model="store.settings.showMemory" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>硬盘监控</span>
                <input type="checkbox" v-model="store.settings.showDisk" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>网络监控</span>
                <input type="checkbox" v-model="store.settings.showNetwork" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>电压监控</span>
                <input type="checkbox" v-model="store.settings.showVoltage" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <label class="settings-item">
                <span>系统信息栏</span>
                <input type="checkbox" v-model="store.settings.showSystemInfo" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">窗口设置</div>

              <label class="settings-item">
                <span>开机自动启动</span>
                <input type="checkbox" v-model="store.settings.autoStart" />
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>

              <div class="settings-item settings-slider-item">
                <span>窗口透明度</span>
                <div class="slider-group">
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.01"
                    v-model.number="store.settings.windowOpacity"
                    class="slider"
                  />
                  <span class="slider-value">{{ Math.round(store.settings.windowOpacity * 100) }}%</span>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">快捷键</div>
              <div class="settings-shortcut">
                <span>隐藏/显示窗口</span>
                <kbd style="margin-left: auto; color: var(--text-tertiary);">即将支持</kbd>
              </div>
            </div>
          </div>

          <div class="settings-footer">
            <button class="settings-btn secondary" @click="store.reset()">重置默认</button>
            <button class="settings-btn primary" @click="close">完成</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.settings-panel {
  background: rgba(20, 20, 22, 0.75);
  backdrop-filter: blur(50px) saturate(1.4);
  -webkit-backdrop-filter: blur(50px) saturate(1.4);
  border: 0.5px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: inset 0 0.5px 0 0 rgba(255, 255, 255, 0.08),
              0 20px 40px rgba(0, 0, 0, 0.5);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(239, 243, 244, 0.08);
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-icon {
  font-size: 18px;
}

.settings-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 8px;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.settings-close:hover {
  background: rgba(239, 243, 244, 0.08);
  color: var(--text-primary);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.settings-section {
  padding: 12px 18px;
}

.settings-section + .settings-section {
  border-top: 1px solid rgba(239, 243, 244, 0.06);
}

.settings-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.settings-item input[type="checkbox"] {
  display: none;
}

.toggle-track {
  width: 40px;
  height: 22px;
  background: rgba(239, 243, 244, 0.12);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  cursor: pointer;
}

input:checked + .toggle-track {
  background: var(--blue);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}

input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
}

.settings-slider-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(239, 243, 244, 0.12);
  border-radius: 2px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--blue);
  cursor: pointer;
}

.slider-value {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
}

.settings-shortcut {
  display: flex;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.settings-footer {
  display: flex;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid rgba(239, 243, 244, 0.08);
  justify-content: flex-end;
}

.settings-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.settings-btn.primary {
  background: var(--blue);
  color: white;
}

.settings-btn.primary:hover {
  background: #1a8cd8;
}

.settings-btn.secondary {
  background: rgba(239, 243, 244, 0.06);
  color: var(--text-secondary);
}

.settings-btn.secondary:hover {
  background: rgba(239, 243, 244, 0.1);
}

/* Transition */
.settings-enter-active,
.settings-leave-active {
  transition: opacity 0.2s ease;
}

.settings-enter-active .settings-panel,
.settings-leave-active .settings-panel {
  transition: transform 0.2s ease;
}

.settings-enter-from,
.settings-leave-to {
  opacity: 0;
}

.settings-enter-from .settings-panel,
.settings-leave-to .settings-panel {
  transform: scale(0.95);
}
</style>
