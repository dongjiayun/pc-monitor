import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNetworkStore = defineStore('network', () => {
  const totalReceived = ref(0)
  const totalSent = ref(0)
  const prevRxBytes = ref<number | null>(null)
  const prevTxBytes = ref<number | null>(null)

  function updateTotals(rxBytes: number, txBytes: number) {
    // Track cumulative delta since monitoring started
    if (prevRxBytes.value === null || prevTxBytes.value === null) {
      // First call: record baseline, set total to 0
      prevRxBytes.value = rxBytes
      prevTxBytes.value = txBytes
      totalReceived.value = 0
      totalSent.value = 0
    } else {
      // Compute delta since last update
      const rxDelta = rxBytes - prevRxBytes.value
      const txDelta = txBytes - prevTxBytes.value

      // Only add positive deltas (counters should only increase)
      if (rxDelta > 0) {
        totalReceived.value += rxDelta
      }
      if (txDelta > 0) {
        totalSent.value += txDelta
      }

      prevRxBytes.value = rxBytes
      prevTxBytes.value = txBytes
    }
  }

  function reset() {
    totalReceived.value = 0
    totalSent.value = 0
    prevRxBytes.value = null
    prevTxBytes.value = null
  }

  return { totalReceived, totalSent, updateTotals, reset }
})
