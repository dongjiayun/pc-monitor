import { describe, it, expect } from 'vitest'

/**
 * Tests for the disk IO speed matching logic.
 * matchDiskIoWithVolumes() maps PhysicalDisk IO stats (named "0", "1"...)
 * to volumes by the matched disk's index.
 */
describe('matchDiskIoWithVolumes', () => {
  async function getMatchFn() {
    const mod = await import('../../electron/monitor')
    return mod.matchDiskIoWithVolumes
  }

  it('should match IO stats by disk index (PhysicalDisk "0" -> index 0)', async () => {
    const matchDiskIoWithVolumes = await getMatchFn()
    const volumes = [
      { drive: 'C:', size: 256060514304, used: 128030257152, free: 128030257152, usedPct: 50, fsType: 'NTFS', label: '' },
      { drive: 'D:', size: 1024123453440, used: 512061743104, free: 512061710336, usedPct: 50, fsType: 'NTFS', label: '' },
    ]
    const disksIO = [
      { name: '0', readBytesPerSec: 104857600, writeBytesPerSec: 52428800 },
      { name: '1', readBytesPerSec: 83886080, writeBytesPerSec: 41943040 },
    ]
    const volDiskMap = new Map<string, any>([
      ['C:', { index: 0, model: 'Samsung SSD 990 Pro', mediaType: 'SSD', interfaceType: 'NVMe', status: 'OK' }],
      ['D:', { index: 1, model: 'WD Blue 1TB', mediaType: 'HDD', interfaceType: 'SATA', status: 'OK' }],
    ])

    const result = matchDiskIoWithVolumes(volumes, disksIO, volDiskMap)

    expect(result).toHaveLength(2)
    // C: drive (disk index 0) - 100 MB/s read, 50 MB/s write
    expect(result[0].fs).toBe('C:')
    expect(result[0].ioReadSpeed).toBe(104857600)
    expect(result[0].ioWriteSpeed).toBe(52428800)
    expect(result[0].ioReadSpeed / 1024 / 1024).toBeCloseTo(100, 1)
    expect(result[0].ioWriteSpeed / 1024 / 1024).toBeCloseTo(50, 1)
    expect(result[0].isSSD).toBe(true)
    expect(result[0].diskName).toBe('Samsung SSD 990 Pro')
    // D: drive (disk index 1) - 80 MB/s read, 40 MB/s write
    expect(result[1].fs).toBe('D:')
    expect(result[1].ioReadSpeed).toBe(83886080)
    expect(result[1].ioWriteSpeed).toBe(41943040)
    expect(result[1].isSSD).toBe(false)
  })

  it('should return 0 for drives with no matching IO entry', async () => {
    const matchDiskIoWithVolumes = await getMatchFn()
    const volumes = [
      { drive: 'Z:', size: 0, used: 0, free: 0, usedPct: 0, fsType: '', label: '' },
    ]
    const disksIO: any[] = []
    const volDiskMap = new Map<string, any>()

    const result = matchDiskIoWithVolumes(volumes, disksIO, volDiskMap)
    expect(result).toHaveLength(1)
    expect(result[0].fs).toBe('Z:')
    expect(result[0].ioReadSpeed).toBe(0)
    expect(result[0].ioWriteSpeed).toBe(0)
  })

  it('should use disk.index to match PhysicalDisk name', async () => {
    const matchDiskIoWithVolumes = await getMatchFn()
    const volumes = [
      { drive: 'C:', size: 256060514304, used: 128030257152, free: 128030257152, usedPct: 50, fsType: 'NTFS', label: '' },
    ]
    const disksIO = [
      { name: '0', readBytesPerSec: 99999999, writeBytesPerSec: 88888888 },
    ]
    // C: maps to disk index 0, should match PhysicalDisk "0"
    const volDiskMap = new Map<string, any>([
      ['C:', { index: 0, model: 'Samsung SSD', mediaType: 'SSD', interfaceType: 'NVMe', status: 'OK' }],
    ])

    const result = matchDiskIoWithVolumes(volumes, disksIO, volDiskMap)
    expect(result[0].ioReadSpeed).toBe(99999999)
    expect(result[0].ioWriteSpeed).toBe(88888888)
  })

  it('should return 0 when disk has no index', async () => {
    const matchDiskIoWithVolumes = await getMatchFn()
    const volumes = [
      { drive: 'C:', size: 256060514304, used: 128030257152, free: 128030257152, usedPct: 50, fsType: 'NTFS', label: '' },
    ]
    const disksIO = [
      { name: '0', readBytesPerSec: 104857600, writeBytesPerSec: 52428800 },
    ]
    // Disk has no index property → should not match
    const volDiskMap = new Map<string, any>([
      ['C:', { model: 'Samsung SSD', mediaType: 'SSD', interfaceType: 'NVMe', status: 'OK' }],
    ])

    const result = matchDiskIoWithVolumes(volumes, disksIO, volDiskMap)
    expect(result[0].ioReadSpeed).toBe(0)
    expect(result[0].ioWriteSpeed).toBe(0)
  })

  it('should handle disksIO being empty gracefully', async () => {
    const matchDiskIoWithVolumes = await getMatchFn()
    const volumes = [
      { drive: 'C:', size: 256060514304, used: 128030257152, free: 128030257152, usedPct: 50, fsType: 'NTFS', label: '' },
    ]
    const volDiskMap = new Map<string, any>()
    const result = matchDiskIoWithVolumes(volumes, [], volDiskMap)

    expect(result).toHaveLength(1)
    expect(result[0].ioReadSpeed).toBe(0)
    expect(result[0].ioWriteSpeed).toBe(0)
  })
})
