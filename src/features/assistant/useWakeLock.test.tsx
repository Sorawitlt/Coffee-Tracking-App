import { act, renderHook, waitFor } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

class FakeSentinel {
  released = false
  private listeners: Array<() => void> = []
  addEventListener = vi.fn((_type: string, fn: () => void) => { this.listeners.push(fn) })
  release = vi.fn(async () => { this.released = true; this.listeners.forEach((fn) => fn()) })
  /** จำลองระบบปล่อย lock เอง (เช่น ซ่อนหน้า) */
  systemRelease() { this.released = true; this.listeners.forEach((fn) => fn()) }
}

function installWakeLock(request: () => Promise<FakeSentinel>) {
  const req = vi.fn(request)
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: req } })
  return req
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  // @ts-expect-error — ลบตัวที่เทสต์ใส่ไว้
  delete navigator.wakeLock
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('useWakeLock', () => {
  it('เบราว์เซอร์ไม่รองรับ → unsupported', () => {
    const { result } = renderHook(() => useWakeLock(true))
    expect(result.current).toBe('unsupported')
  })

  it('เปิดใช้ → ขอ lock หน้าจอ และสถานะ active; ปิดใช้ → ปล่อยทันที', async () => {
    const sentinel = new FakeSentinel()
    const request = installWakeLock(async () => sentinel)
    const { result, rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } })
    await waitFor(() => expect(result.current).toBe('active'))
    expect(request).toHaveBeenCalledWith('screen')

    rerender({ on: false })
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled())
    await waitFor(() => expect(result.current).toBe('off'))
  })

  it('ไม่ได้เปิดใช้ → ไม่ขอ lock', () => {
    const request = installWakeLock(async () => new FakeSentinel())
    const { result } = renderHook(() => useWakeLock(false))
    expect(result.current).toBe('off')
    expect(request).not.toHaveBeenCalled()
  })

  it('ขอไม่ได้ (เช่น โหมดประหยัดแบตเตอรี่) → failed ไม่พัง', async () => {
    installWakeLock(async () => { throw new DOMException('battery saver', 'NotAllowedError') })
    const { result } = renderHook(() => useWakeLock(true))
    await waitFor(() => expect(result.current).toBe('failed'))
  })

  it('ถอดคอมโพเนนต์ระหว่างรอคำขอ → ปล่อย lock ที่ได้มาทันที ไม่ค้าง', async () => {
    const sentinel = new FakeSentinel()
    let resolve!: (s: FakeSentinel) => void
    installWakeLock(() => new Promise<FakeSentinel>((r) => { resolve = r }))
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount()
    await act(async () => { resolve(sentinel) })
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('หน้าถูกซ่อนแล้วกลับมา (ระบบปล่อย lock ไป) → ขอใหม่อัตโนมัติ', async () => {
    const first = new FakeSentinel()
    const second = new FakeSentinel()
    const queue = [first, second]
    const request = installWakeLock(async () => queue.shift()!)
    const { result } = renderHook(() => useWakeLock(true))
    await waitFor(() => expect(result.current).toBe('active'))

    act(() => { setVisibility('hidden'); first.systemRelease() })
    await waitFor(() => expect(result.current).toBe('off'))

    act(() => setVisibility('visible'))
    await waitFor(() => expect(result.current).toBe('active'))
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('หน้ายังซ่อนอยู่ → ไม่ขอ lock (เบราว์เซอร์จะปฏิเสธอยู่ดี)', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    const request = installWakeLock(async () => new FakeSentinel())
    renderHook(() => useWakeLock(true))
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
  })
})
