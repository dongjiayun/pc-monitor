# Changelog

## [1.0.0] - 2026-06-20

### 新增
- 磨砂玻璃 UI 风格：半透明背景 + 毛玻璃模糊（backdrop-filter） + 边缘高光光泽
- 磨砂玻璃风格延伸至状态栏、系统信息行、设置面板、GPU 统计块等所有 UI 元素
- 硬盘读写速度通过 LibreHardwareMonitor Throughput 传感器回退采集，解决 WMI 在某些系统上返回 0 的问题
- Widget 桌面小部件模式：通过 `SetParent(WorkerW)` 实现"显示桌面"(Win+D) 后窗口依然可见
- 新增 `set-widget-parent.ps1` 脚本，自动查找桌面 WorkerW 窗口并设为父窗口

### 优化
- 磨砂玻璃透明度降低（背景从 `rgba(0,0,0,0.35)` → `rgba(0,0,0,0.55)`），提高文字可读性
- 卡片背景从极透明改为深色半透明底（`rgba(22,22,26,0.55)`）
- 高斯模糊强度增强（`blur(50px)` → `blur(60px)`），毛玻璃效果更明显
- 风扇转速显示从 `f2()`（保留 2 位小数）改为 `Math.round()` 显示整数
- 卡片 hover 状态增加阴影增强效果
- 所有 UI 元素统一背景色系，提升整体一致性

### 修复
- 硬盘读写速度始终显示为 0 的问题（WMI 失败时自动回退到 LHM Throughput 传感器）

### 变更文件
- `electron/main.ts` — 移除 `type: 'toolbar'`，新增 `setWidgetParent()` 函数；页面加载后调用 widget 设置
- `electron/monitor.ts` — `getLhmDiskSensors()` 透传 `readSpeed`/`writeSpeed`；`matchDiskIoWithVolumes()` WMI 为 0 时使用 LHM 数据
- `electron/lhm_gpu.ps1` — Storage 段新增 `readSpeed`/`writeSpeed` 字段，捕获 `Throughput` 传感器
- `scripts/set-widget-parent.ps1` — 新增：通过 Win32 API SetParent 将窗口设为桌面 WorkerW 子窗口
- `scripts/build.ps1` — 手动组装模式新增 Step b5 复制 widget 脚本
- `package.json` — `extraResources` 新增 widget 脚本条目
- `src/styles/main.css` — 背景色加深、高斯模糊增强、统一深色系背景
- `src/App.vue` — 动态透明度范围从 `0.3~1.0` 改为 `0.5~1.0`
- `src/components/GpuMonitor.vue` — GPU 统计块背景改为深色半透明
- `src/components/SettingsPanel.vue` — 设置面板背景不透明度提高
