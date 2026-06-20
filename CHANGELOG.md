# Changelog

## [1.0.0] - 2026-06-20

### 新增
- 磨砂玻璃 UI 风格：半透明背景 + 毛玻璃模糊（backdrop-filter） + 边缘高光光泽
- 磨砂玻璃风格延伸至状态栏、系统信息行、设置面板、GPU 统计块等所有 UI 元素
- 硬盘读写速度通过 LibreHardwareMonitor Throughput 传感器回退采集，解决 WMI 在某些系统上返回 0 的问题

### 优化
- 窗口添加 `type: 'toolbar'`，点击"显示桌面"（Win+D）时窗口不会被隐藏
- 风扇转速显示从 `f2()`（保留 2 位小数）改为 `Math.round()` 显示整数
- 卡片 hover 状态增加阴影增强效果

### 修复
- 硬盘读写速度始终显示为 0 的问题（WMI 失败时自动回退到 LHM Throughput 传感器）

### 变更文件
- `electron/main.ts` — 窗口创建添加 `type: 'toolbar'`
- `electron/monitor.ts` — `getLhmDiskSensors()` 透传 `readSpeed`/`writeSpeed`；`matchDiskIoWithVolumes()` WMI 为 0 时使用 LHM 数据
- `electron/lhm_gpu.ps1` — Storage 段新增 `readSpeed`/`writeSpeed` 字段，捕获 `Throughput` 传感器
- `src/styles/main.css` — 所有背景改为半透明 `rgba`，卡片新增 `::before`/`::after` 光泽边缘
- `src/App.vue` — 透明度控制改用 `opacity`
- `src/components/GpuMonitor.vue` — GPU 统计块添加玻璃边框
- `src/components/SettingsPanel.vue` — 设置面板改为磨砂玻璃风格
- `src/components/CpuMonitor.vue` — 风扇转速整数显示
