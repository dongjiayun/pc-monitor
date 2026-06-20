import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Track all data passed to marks
const dataPassedToMarks: any[] = []
const changeDataCalls: any[] = []
const renderMock = vi.fn()
const destroyMock = vi.fn()

function createMarkMock() {
  const mark = {
    data: vi.fn((d: any) => { dataPassedToMarks.push(d); return mark }),
    encode: vi.fn(() => mark),
    style: vi.fn(() => mark),
    scale: vi.fn(() => mark),
    axis: vi.fn(() => mark),
    legend: vi.fn(() => mark),
    changeData: vi.fn((d: any) => { changeDataCalls.push(d) }),
  }
  return mark
}

const chartMock: any = {
  axis: vi.fn().mockReturnThis(),
  legend: vi.fn().mockReturnThis(),
  line: vi.fn(() => createMarkMock()),
  area: vi.fn(() => createMarkMock()),
  render: renderMock,
  destroy: destroyMock,
}

vi.mock('@antv/g2', () => ({
  Chart: vi.fn(() => chartMock)
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  dataPassedToMarks.length = 0
  changeDataCalls.length = 0
  renderMock.mockResolvedValue(undefined)
})

/**
 * Trend Chart Tests
 * Verify chart initialization and data-driven updates using @antv/g2.
 */
describe('Trend Charts - Initialization', () => {
  it('CpuMonitor should init chart on mount with history data', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history: [40, 42, 45, 43],
        tempHistory: [58, 59, 60, 61],
        timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04']
      }
    })

    // Chart should be created 2 times (load + temp charts)
    const { Chart } = await import('@antv/g2')
    expect(Chart).toHaveBeenCalledTimes(2)
    expect(renderMock).toHaveBeenCalledTimes(2)

    // Find the data passed for the load chart (values 40-43)
    const loadData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.length === 4 && d[0]?.value === 40
    )
    expect(loadData).toBeDefined()
    expect(loadData[0]).toEqual({ time: '12:00:01', value: 40 })
    expect(loadData[3]).toEqual({ time: '12:00:04', value: 43 })

    // Find the data passed for the temp chart (values 58-61)
    const tempData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.length === 4 && d[0]?.value === 58
    )
    expect(tempData).toBeDefined()
    expect(tempData[0]).toEqual({ time: '12:00:01', value: 58 })
    expect(tempData[3]).toEqual({ time: '12:00:04', value: 61 })
  })

  it('GpuMonitor should init chart on mount with history data', async () => {
    const GpuMonitor = (await import('@/components/GpuMonitor.vue')).default
    mount(GpuMonitor, {
      props: {
        data: { controllers: [{ model: 'RTX', vendor: 'NVIDIA', temperature: 65, utilizationGpu: 55, utilizationMemory: 30, memoryTotal: 8589934592, memoryUsed: 3000000000, memoryFree: 5589934592, fanSpeed: 0, powerDraw: 0 }], display: { width: 1920, height: 1080, depth: 32, refreshRate: 60 } },
        history: [50, 52, 55, 53],
        tempHistory: [62, 64, 65, 63],
        timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04']
      }
    })

    const { Chart } = await import('@antv/g2')
    expect(Chart).toHaveBeenCalledTimes(2)
    expect(renderMock).toHaveBeenCalledTimes(2)

    // Find load chart data (values 50-53)
    const loadData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.length === 4 && d[0]?.value === 50
    )
    expect(loadData).toBeDefined()
    expect(loadData[0]).toEqual({ time: '12:00:01', value: 50 })
    expect(loadData[3]).toEqual({ time: '12:00:04', value: 53 })
  })

  it('MemoryMonitor should init chart on mount with history data', async () => {
    const MemoryMonitor = (await import('@/components/MemoryMonitor.vue')).default
    mount(MemoryMonitor, {
      props: {
        data: { total: 17179869184, free: 8589934592, used: 8589934592, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 50, available: 8589934592, layouts: [] },
        history: [48, 49, 50, 51],
        timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04'],
        formatBytes: (b: number) => `${b}`
      }
    })

    const { Chart } = await import('@antv/g2')
    expect(Chart).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledTimes(1)

    // Find memory chart data
    const memData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.length === 4 && d[0]?.value === 48
    )
    expect(memData).toBeDefined()
    expect(memData[0]).toEqual({ time: '12:00:01', value: 48 })
    expect(memData[3]).toEqual({ time: '12:00:04', value: 51 })
  })

  it('NetworkMonitor should init chart on mount with history data', async () => {
    const NetworkMonitor = (await import('@/components/NetworkMonitor.vue')).default
    mount(NetworkMonitor, {
      props: {
        data: { iface: 'eth0', ip4: '', ip6: '', mac: '', rxSec: 1000, txSec: 500, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' },
        rxHistory: [1000, 1024, 980, 1050],
        txHistory: [500, 512, 480, 520],
        timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04'],
        formatSpeed: (b: number) => `${b} B/s`,
        formatBytes: (b: number) => `${b}`
      }
    })

    const { Chart } = await import('@antv/g2')
    expect(Chart).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledTimes(1)

    // Find network data (should have both 下载 and 上传 entries)
    const netData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.some((e: any) => e.type === '下载') && d.some((e: any) => e.type === '上传')
    )
    expect(netData).toBeDefined()
    const rxPoints = netData.filter((d: any) => d.type === '下载')
    const txPoints = netData.filter((d: any) => d.type === '上传')
    expect(rxPoints).toHaveLength(4)
    expect(txPoints).toHaveLength(4)
    expect(rxPoints[0].value).toBe(1000)
    expect(txPoints[0].value).toBe(500)
  })
})

describe('Trend Charts - Updates on new props', () => {
  it('CpuMonitor should redraw chart when history prop receives new array', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    const wrapper = mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history: [40],
        tempHistory: [58],
        timestamps: ['12:00:01']
      }
    })

    changeDataCalls.length = 0

    await wrapper.setProps({
      history: [40, 45],
      tempHistory: [58, 62],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    // changeData should have been called with 2 data points (history update)
    expect(changeDataCalls.length).toBeGreaterThan(0)
    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.length === 2 && d[0]?.value === 40
    )
    expect(update).toBeDefined()
  })

  it('CpuMonitor should redraw chart on multiple consecutive updates', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    const wrapper = mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history: [40],
        tempHistory: [58],
        timestamps: ['12:00:01']
      }
    })

    // Update 1
    changeDataCalls.length = 0
    await wrapper.setProps({
      history: [40, 45],
      tempHistory: [58, 62],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(changeDataCalls.length).toBeGreaterThan(0)

    // Update 2
    changeDataCalls.length = 0
    await wrapper.setProps({
      history: [40, 45, 48],
      tempHistory: [58, 62, 64],
      timestamps: ['12:00:01', '12:00:02', '12:00:03']
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.length === 3 && d[2]?.value === 48
    )
    expect(update).toBeDefined()
  })

  it('MemoryMonitor should redraw when history prop updates', async () => {
    const MemoryMonitor = (await import('@/components/MemoryMonitor.vue')).default
    const wrapper = mount(MemoryMonitor, {
      props: {
        data: { total: 17179869184, free: 8589934592, used: 8589934592, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 50, available: 8589934592, layouts: [] },
        history: [50],
        timestamps: ['12:00:01'],
        formatBytes: (b: number) => `${b}`
      }
    })

    changeDataCalls.length = 0
    await wrapper.setProps({
      history: [50, 52],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.length === 2 && d[1]?.value === 52
    )
    expect(update).toBeDefined()
  })

  it('NetworkMonitor should redraw when rxHistory/txHistory props update', async () => {
    const NetworkMonitor = (await import('@/components/NetworkMonitor.vue')).default
    const wrapper = mount(NetworkMonitor, {
      props: {
        data: { iface: 'eth0', ip4: '', ip6: '', mac: '', rxSec: 1000, txSec: 500, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' },
        rxHistory: [1000],
        txHistory: [500],
        timestamps: ['12:00:01'],
        formatSpeed: (b: number) => `${b} B/s`,
        formatBytes: (b: number) => `${b}`
      }
    })

    changeDataCalls.length = 0
    await wrapper.setProps({
      rxHistory: [1000, 1024],
      txHistory: [500, 512],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.some((e: any) => e.type === '下载' && e.value === 1024)
    )
    expect(update).toBeDefined()
  })
})

describe('Trend Charts - Edge cases', () => {
  it('CpuMonitor should handle empty history arrays on mount and update later', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    const wrapper = mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history: [],
        tempHistory: [],
        timestamps: []
      }
    })

    // Chart should still init with empty data
    const { Chart } = await import('@antv/g2')
    expect(Chart).toHaveBeenCalled()

    // Now fill with data
    changeDataCalls.length = 0
    await wrapper.setProps({
      history: [50, 55],
      tempHistory: [60, 62],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.length === 2 && d[0]?.value === 50
    )
    expect(update).toBeDefined()
  })

  it('CpuMonitor should update temp chart when only tempHistory changes', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    const wrapper = mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history: [50],
        tempHistory: [60],
        timestamps: ['12:00:01']
      }
    })

    changeDataCalls.length = 0

    // Only change tempHistory
    await wrapper.setProps({
      tempHistory: [60, 62],
      timestamps: ['12:00:01', '12:00:02']
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    // changeData should have been called (for temp chart update)
    const update = changeDataCalls.find((d: any) =>
      Array.isArray(d) && d.length === 2 && d[1]?.value === 62
    )
    expect(update).toBeDefined()
  })

  it('should maintain data integrity with 60 data points (MAX_HISTORY)', async () => {
    const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
    const history = Array.from({ length: 60 }, (_, i) => i)
    const tempHistory = Array.from({ length: 60 }, (_, i) => 50 + i)
    const timestamps = Array.from({ length: 60 }, (_, i) => `12:00:${String(i).padStart(2, '0')}`)

    mount(CpuMonitor, {
      props: {
        data: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
        history,
        tempHistory,
        timestamps
      }
    })

    // Find 60-point data
    const sixtyData = dataPassedToMarks.find((d: any) =>
      Array.isArray(d) && d.length === 60 && d[0]?.value === 0
    )
    expect(sixtyData).toBeDefined()
    expect(sixtyData[0].value).toBe(0)
    expect(sixtyData[59].value).toBe(59)
    expect(sixtyData[59].time).toBe('12:00:59')
  })
})
