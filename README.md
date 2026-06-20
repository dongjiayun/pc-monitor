# PC Monitor

<p align="center">
  <img src="public/icon.png" width="64" height="64" alt="PC Monitor">
</p>

Windows 桌面性能监控工具 — 美观实时的系统监控，毛玻璃 UI 风格。

## 功能

- **CPU** — 负载、温度、频率、功耗、每核心负载
- **GPU** — 负载、温度、风扇转速、功耗、显存使用
- **内存** — 使用率、内存条信息（品牌/频率）
- **硬盘** — 分区使用率、读写速度、温度、健康度、接口类型
- **网络** — 实时上下行速度、总流量统计、VPN 检测
- **电压与传感器** — 主板电压、风扇转速、电池信息
- **总功耗估算** — CPU + GPU + 其他组件功耗估算

## 预览

![PC Monitor 预览](docs/screenshot.png)

## 下载

前往 [Releases](https://github.com/dongjiayun/pc-monitor/releases) 下载最新安装包。

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（浏览器预览）
npm run dev

# 启动 Electron
npm run dev:electron

# 构建安装包
npm run build:pack

# 运行测试
npm test
```

## 技术栈

- **框架**: Vue 3 + TypeScript + Pinia
- **UI**: 毛玻璃效果（backdrop-filter）
- **图表**: @antv/g2
- **桌面**: Electron 28 + electron-builder
- **监控**: WMI + LibreHardwareMonitor

## 数据采集

当前帧实时数据通过单次 PowerShell 调用批量采集，包含：
- WMI: CPU/GPU/内存/硬盘/网络/电池
- LHM: 芯片温度、功耗、电压、风扇、存储传感器（Throughput）
- 采样间隔: 1 秒

## 许可证

MIT
