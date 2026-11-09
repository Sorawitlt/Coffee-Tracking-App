import {
  READY, elapsedMs, finishTimer, isActive, pauseTimer, reopenTimer, resumeTimer, startTimer, type TimerState,
} from './timer'

const T0 = 1_700_000_000_000

describe('ตัวจับเวลา', () => {
  it('ready → เวลา 0 และกด finish/pause/resume ไม่มีผล', () => {
    expect(elapsedMs(READY, T0)).toBe(0)
    expect(pauseTimer(READY, T0)).toBe(READY)
    expect(resumeTimer(READY, T0)).toBe(READY)
    expect(finishTimer(READY, T0)).toBe(READY)
  })

  it('start แล้วนับตามเวลานาฬิกา (ไม่ขึ้นกับจำนวนครั้งที่อ่าน)', () => {
    const t = startTimer(READY, T0)
    expect(t).toEqual({ status: 'running', startedAtMs: T0, offsetMs: 0 })
    expect(elapsedMs(t, T0)).toBe(0)
    expect(elapsedMs(t, T0 + 45_000)).toBe(45_000)
    // อ่านข้ามช่วงยาว (เช่น จอดับ 10 นาที) ยังถูกต้อง
    expect(elapsedMs(t, T0 + 600_000)).toBe(600_000)
  })

  it('start ซ้ำตอนเดินอยู่ไม่รีเซ็ต', () => {
    const t = startTimer(READY, T0)
    expect(startTimer(t, T0 + 5_000)).toBe(t)
  })

  it('pause หยุดนับ, resume นับต่อจากเดิม, เวลาที่พักไม่ถูกนับ', () => {
    let t: TimerState = startTimer(READY, T0)
    t = pauseTimer(t, T0 + 30_000)
    expect(t).toEqual({ status: 'paused', elapsedMs: 30_000 })
    expect(elapsedMs(t, T0 + 999_000)).toBe(30_000)

    t = resumeTimer(t, T0 + 100_000)
    expect(elapsedMs(t, T0 + 100_000)).toBe(30_000)
    expect(elapsedMs(t, T0 + 115_000)).toBe(45_000)
  })

  it('pause → resume หลายรอบสะสมเวลาถูกต้อง', () => {
    let t: TimerState = startTimer(READY, 0)
    t = pauseTimer(t, 10_000)
    t = resumeTimer(t, 50_000)
    t = pauseTimer(t, 60_000) // เดินอีก 10 วิ → 20 วิ
    t = resumeTimer(t, 70_000)
    expect(elapsedMs(t, 75_000)).toBe(25_000)
  })

  it('finish เก็บเวลารวมไว้คงที่ จากทั้งสถานะ running และ paused', () => {
    const running = startTimer(READY, T0)
    expect(finishTimer(running, T0 + 171_000)).toEqual({ status: 'finished', elapsedMs: 171_000 })
    const paused = pauseTimer(running, T0 + 60_000)
    expect(finishTimer(paused, T0 + 500_000)).toEqual({ status: 'finished', elapsedMs: 60_000 })
  })

  it('finished แล้ว pause/resume/start ไม่มีผล', () => {
    const done = finishTimer(startTimer(READY, T0), T0 + 10_000)
    expect(pauseTimer(done, T0 + 20_000)).toBe(done)
    expect(resumeTimer(done, T0 + 20_000)).toBe(done)
    expect(startTimer(done, T0 + 20_000)).toBe(done)
    expect(elapsedMs(done, T0 + 99_999)).toBe(10_000)
  })

  it('reopen: กดจบพลาดแล้วกลับไปจับเวลาต่อจากเวลาตอนกดจบ', () => {
    const done = finishTimer(startTimer(READY, T0), T0 + 80_000)
    const back = reopenTimer(done)
    expect(back).toEqual({ status: 'paused', elapsedMs: 80_000 })
    const again = resumeTimer(back, T0 + 200_000)
    expect(elapsedMs(again, T0 + 210_000)).toBe(90_000)
    // สถานะอื่นไม่ถูกแตะ
    expect(reopenTimer(back)).toBe(back)
  })

  it('นาฬิกาเครื่องถูกปรับย้อนหลัง → เวลาไม่ติดลบและไม่ถอยต่ำกว่าที่นับไว้แล้ว', () => {
    const t = resumeTimer({ status: 'paused', elapsedMs: 20_000 }, T0)
    expect(elapsedMs(t, T0 - 60_000)).toBe(20_000)
  })

  it('isActive: เฉพาะ running / paused', () => {
    expect(isActive(READY)).toBe(false)
    expect(isActive(startTimer(READY, 0))).toBe(true)
    expect(isActive({ status: 'paused', elapsedMs: 1 })).toBe(true)
    expect(isActive({ status: 'finished', elapsedMs: 1 })).toBe(false)
  })
})
