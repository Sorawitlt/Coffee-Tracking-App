import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import {
  cuesBetween, secondsLeftInStep, secondsUntilNextStep, stepIndexAt, strongestCue, type PlanStep,
} from '../../domain/brewPlan'
import { formatRatio, ratio } from '../../domain/calc'
import { METHOD_PROFILES } from '../../domain/methods'
import { elapsedMs, finishTimer, pauseTimer, resumeTimer, startTimer } from '../../domain/timer'
import type { Bean } from '../../domain/types'
import { formatDuration, formatGrams } from '../format'
import { METHOD_LABEL } from '../labels'
import { canVibrate, createCuePlayer } from './cues'
import { loadPrefs, savePrefs, type AssistantPrefs } from './prefs'
import type { AssistantSession } from './session'
import { stepDelta, stepHint, stepTarget, stepTitle } from './stepText'
import { useWakeLock } from './useWakeLock'

/** การชงที่ยาวกว่านี้ (เช่น Cold brew) ไม่กันหน้าจอดับ — เปลืองแบตเกินเหตุ */
export const LONG_BREW_SEC = 30 * 60
/** ความถี่ที่อ่านนาฬิกา (ms) — ถี่พอให้เสียงเตือนตรงเวลาในระดับ ~0.2 วินาที */
const TICK_MS = 200
/** เสียงเตือนที่ค้างเกินนี้ (เช่น เบราว์เซอร์หน่วง timer ตอนซ่อนหน้า) ไม่เล่นย้อนหลัง เพราะจะทำให้สับสน */
const STALE_CUE_MS = 3000

interface Props {
  session: AssistantSession
  bean?: Bean | null
  onChange: (next: AssistantSession) => void
  /** ทิ้งการชงนี้ */
  onCancel: () => void
  /** ย้อนกลับไปแก้ค่าตั้ง (ใช้ได้เฉพาะก่อนเริ่มจับเวลา) */
  onEdit: () => void
}

/** หน้าจับเวลา: ตัวเลขใหญ่ + ขั้นตอนปัจจุบัน/ถัดไป + ปุ่มใหญ่กดมือเดียว */
export function BrewingScreen({ session, bean, onChange, onCancel, onEdit }: Props) {
  const { input, plan, timer } = session
  const running = timer.status === 'running'
  const started = timer.status !== 'ready'

  // --- นาฬิกา: อ่านเวลาจริงเป็นระยะ (ไม่นับ tick) ---
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [running])

  const elapsed = elapsedMs(timer, now)
  const elapsedSec = elapsed / 1000
  const currentIndex = started ? stepIndexAt(plan, elapsedSec) : -1
  const current: PlanStep | undefined = plan.steps[currentIndex]
  const upcoming: PlanStep | undefined = plan.steps[currentIndex + 1]
  const left = started ? secondsLeftInStep(plan, elapsedSec) : undefined
  const untilNext = started ? secondsUntilNextStep(plan, elapsedSec) : undefined
  const overTarget = started && elapsedSec >= plan.totalTimeSec
  const [lo, hi] = METHOD_PROFILES[input.method].timeRangeSec

  // --- เสียง / สั่น ---
  const [player] = useState(createCuePlayer)
  const [prefs, setPrefs] = useState<AssistantPrefs>(loadPrefs)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const lastCueMs = useRef(elapsed)

  useEffect(() => {
    if (!running) {
      lastCueMs.current = elapsed
      return
    }
    const fromMs = Math.max(lastCueMs.current, elapsed - STALE_CUE_MS)
    lastCueMs.current = elapsed
    const cue = strongestCue(cuesBetween(plan, fromMs / 1000, elapsed / 1000))
    if (cue) player.play(cue.kind, prefsRef.current)
  }, [elapsed, running, plan])

  function updatePrefs(next: AssistantPrefs) {
    setPrefs(next)
    savePrefs(next)
    player.unlock()
    // เพิ่งเปิดเสียง/สั่น → ให้ลองทันที ผู้ใช้จะรู้ว่าเครื่องนี้ใช้ได้จริง
    if ((next.sound && !prefs.sound) || (next.vibrate && !prefs.vibrate)) player.play('tick', next)
  }

  // --- กันจอดับ ---
  const keepAwake = plan.totalTimeSec <= LONG_BREW_SEC
  const wake = useWakeLock(keepAwake)

  // --- ปุ่มควบคุม ---
  const [confirmCancel, setConfirmCancel] = useState(false)

  function start() {
    const t = Date.now()
    player.unlock()
    lastCueMs.current = 0
    setNow(t)
    player.play('step', prefsRef.current) // ขั้นแรกเริ่มพร้อมกดปุ่ม
    onChange({ ...session, timer: startTimer(timer, t), startedAtMs: t })
  }
  function pause() {
    onChange({ ...session, timer: pauseTimer(timer, Date.now()) })
  }
  function resume() {
    const t = Date.now()
    player.unlock()
    lastCueMs.current = elapsedMs(timer, t)
    setNow(t)
    onChange({ ...session, timer: resumeTimer(timer, t) })
  }
  function finish() {
    onChange({ ...session, timer: finishTimer(timer, Date.now()) })
  }

  const r = ratio(input.doseG, input.waterG)
  const big = elapsedSec >= 3600 ? 'text-5xl' : 'text-7xl'

  return (
    <section
      aria-label="ผู้ช่วยชง"
      className="space-y-4"
      // เบราว์เซอร์ (โดยเฉพาะ iOS) ปลดล็อกเสียงได้เฉพาะในเหตุการณ์แตะ — เช่น เปิดแอปกลับมาแล้วเซสชันเดินต่อ
      onPointerDownCapture={() => player.unlock()}
    >
      <header className="text-center">
        <h2 className="text-xl font-bold">
          {METHOD_LABEL[input.method]}
          <span className="font-normal text-stone-600 dark:text-stone-400"> · {bean ? bean.name : 'เมล็ด'}</span>
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          กาแฟ {formatGrams(input.doseG)} g · น้ำ {formatGrams(input.waterG)} g ({formatRatio(r)})
          {input.tempC !== undefined && ` · ${formatGrams(input.tempC)} °C`}
          {input.grindSetting !== undefined && ` · บด ${formatGrams(input.grindSetting)}`}
        </p>
      </header>

      <div className="text-center">
        <p
          role="timer"
          aria-label="เวลาที่ผ่านไป"
          className={`font-bold leading-none tabular-nums ${big} ${overTarget ? 'text-amber-700 dark:text-amber-400' : ''}`}
        >
          {formatDuration(Math.floor(elapsedSec))}
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          เป้าหมาย {formatDuration(lo)}{hi !== lo && `–${formatDuration(hi)}`}
        </p>
        <div
          role="progressbar"
          aria-label="ความคืบหน้าเทียบเวลาเป้าหมาย"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round((elapsedSec / plan.totalTimeSec) * 100))}
          className="mx-auto mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${overTarget ? 'bg-amber-600' : 'bg-amber-800 dark:bg-amber-500'}`}
            style={{ width: `${Math.min(100, (elapsedSec / plan.totalTimeSec) * 100)}%` }}
          />
        </div>
      </div>

      {/* ขั้นตอนปัจจุบัน — อ่านออกเสียงให้ผู้ใช้โปรแกรมอ่านหน้าจอเมื่อเปลี่ยนขั้น */}
      <div role="group" aria-label="ขั้นตอนปัจจุบัน" aria-live="polite" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-700 dark:bg-amber-950/40">
        {!started ? (
          <>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">พร้อมชง — กดเริ่มเมื่อเริ่มเทน้ำ</p>
            {plan.steps[0] && <p className="mt-1 text-lg font-semibold">ขั้นแรก: {stepTitle(plan.steps[0])} {stepTarget(plan.steps[0])}</p>}
          </>
        ) : current ? (
          <>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              ขั้นที่ {currentIndex + 1} / {plan.steps.length}
              {timer.status === 'paused' && ' · หยุดพัก'}
            </p>
            <p className="mt-1 text-3xl font-bold">{stepTitle(current)}</p>
            {stepTarget(current) && (
              <p className="mt-1 text-4xl font-bold tabular-nums text-amber-900 dark:text-amber-300">
                {stepTarget(current)}
                {stepDelta(current) && <span className="ml-2 text-xl font-semibold text-stone-600 dark:text-stone-400">({stepDelta(current)})</span>}
              </p>
            )}
            {stepHint(current) && <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">{stepHint(current)}</p>}
            {left !== undefined && left > 0 && (
              <p className="mt-2 text-sm tabular-nums text-stone-600 dark:text-stone-400">
                อีก {formatDuration(Math.ceil(left))}{upcoming ? ' ถึงขั้นถัดไป' : ' ถึงเวลาเป้าหมาย'}
              </p>
            )}
            {overTarget && !upcoming && (
              <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                ครบเวลาเป้าหมายแล้ว — เมื่อเสร็จกด “เสร็จสิ้น”
              </p>
            )}
          </>
        ) : (
          <p className="text-lg font-semibold">
            เตรียมพร้อม — ขั้นแรกในอีก {formatDuration(Math.ceil(untilNext ?? 0))}
          </p>
        )}
      </div>

      {started && upcoming && (
        <p className="text-center text-sm text-stone-700 dark:text-stone-300">
          ถัดไป <span className="font-semibold tabular-nums">{formatDuration(upcoming.startSec)}</span> · {stepTitle(upcoming)} {stepTarget(upcoming)}
        </p>
      )}

      {/* ปุ่มหลัก — ใหญ่ กดมือเดียว */}
      {!started ? (
        <div className="space-y-3">
          <Button variant="primary" className="h-16 w-full text-xl" onClick={start}>▶ เริ่มจับเวลา</Button>
          <Button className="w-full" onClick={onEdit}>← แก้ไขค่า</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {running ? (
              <Button className="h-16 text-xl" onClick={pause}>⏸ พัก</Button>
            ) : (
              <Button variant="primary" className="h-16 text-xl" onClick={resume}>▶ ต่อ</Button>
            )}
            <Button variant="primary" className="h-16 text-xl" onClick={finish}>✓ เสร็จสิ้น</Button>
          </div>
          {!confirmCancel ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" onClick={() => setConfirmCancel(true)}>
              ยกเลิกการชงนี้
            </Button>
          ) : (
            <div role="alertdialog" aria-label="ยืนยันการยกเลิก" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">ยกเลิกการชงนี้? เวลาที่จับไว้จะหายไป (ยังไม่หักน้ำหนักเมล็ด)</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmCancel(false)}>ชงต่อ</Button>
                <Button variant="danger" className="flex-1" onClick={onCancel}>ยืนยันยกเลิก</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ตารางขั้นตอนทั้งหมด */}
      {plan.steps.length > 0 && (
        <ol aria-label="ขั้นตอนทั้งหมด" className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-800">
          {plan.steps.map((s, i) => {
            const done = started && i < currentIndex
            const isCurrent = started && i === currentIndex
            return (
              <li
                key={s.index}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-baseline gap-3 px-3 py-2 text-sm ${isCurrent ? 'bg-amber-100 font-semibold dark:bg-amber-950/60' : ''} ${done ? 'text-stone-400 line-through dark:text-stone-500' : ''}`}
              >
                <span className="w-12 shrink-0 tabular-nums">{formatDuration(s.startSec)}</span>
                <span className="flex-1">{stepTitle(s)}</span>
                <span className="tabular-nums">{stepTarget(s) ?? ''}</span>
              </li>
            )
          })}
        </ol>
      )}

      {/* ตั้งค่าเสียง/สั่น + สถานะกันจอดับ */}
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <Toggle pressed={prefs.sound} onClick={() => updatePrefs({ ...prefs, sound: !prefs.sound })}>
            {prefs.sound ? '🔔 เสียง: เปิด' : '🔕 เสียง: ปิด'}
          </Toggle>
          {canVibrate() && (
            <Toggle pressed={prefs.vibrate} onClick={() => updatePrefs({ ...prefs, vibrate: !prefs.vibrate })}>
              {prefs.vibrate ? '📳 สั่น: เปิด' : '📴 สั่น: ปิด'}
            </Toggle>
          )}
        </div>
        <p role="status" className="text-stone-600 dark:text-stone-400">
          {!keepAwake
            ? 'การชงแบบแช่นานไม่กันหน้าจอดับ — แอปไม่เตือนตอนปิดจอ กลับมาเปิดแอปเมื่อถึงเวลา เวลายังนับต่อให้ถูกต้อง'
            : wake === 'active'
              ? '☀️ หน้าจอจะไม่ดับระหว่างชง'
              : wake === 'unsupported'
                ? 'เครื่องนี้ไม่รองรับการกันจอดับ — ตั้งเวลาล็อกหน้าจอให้นานขึ้นก่อนชง'
                : wake === 'failed'
                  ? 'เปิดการกันจอดับไม่ได้ (อาจอยู่ในโหมดประหยัดแบตเตอรี่) — ตั้งเวลาล็อกหน้าจอให้นานขึ้นก่อนชง'
                  : ''}
        </p>
      </div>
    </section>
  )
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="min-h-12 rounded-xl border border-stone-300 bg-white px-4 font-medium text-stone-800 aria-pressed:border-amber-700 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:aria-pressed:border-amber-500 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-200"
    >
      {children}
    </button>
  )
}
