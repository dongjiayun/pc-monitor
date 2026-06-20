import { describe, it, expect } from 'vitest'

/**
 * Monitor module smoke tests.
 * Full data fetch tests are covered by integration tests.
 * Component rendering with mock data is covered by components.test.ts.
 */

describe('Monitor Module', () => {
  it('should export expected functions', async () => {
    const mod = await import('../../electron/monitor')
    
    expect(typeof mod.preWarm).toBe('function')
    expect(typeof mod.getSystemInfo).toBe('function')
    expect(typeof mod.getCpuLoadData).toBe('function')
    expect(typeof mod.getGpuInfoData).toBe('function')
    expect(typeof mod.getDiskInfoData).toBe('function')
    expect(typeof mod.getMemoryInfoData).toBe('function')
    expect(typeof mod.getNetworkInfoData).toBe('function')
    expect(typeof mod.getVoltageInfoData).toBe('function')
    expect(typeof mod.getProcessInfoData).toBe('function')
  })

  it('should have preWarm as async function', async () => {
    const mod = await import('../../electron/monitor')
    const result = mod.preWarm()
    expect(result).toBeInstanceOf(Promise)
  })
})
