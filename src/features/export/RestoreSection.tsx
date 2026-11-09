import { useId, useState } from 'react'
import { countData, createBackup, markBackedUp, restoreBackup, useLive } from '../../db'
import { parseBackup, type ParsedBackup } from '../../domain/backup'
import { backupCounts } from '../../domain/backup'
import { Button } from '../../components/Button'
import { formatDateTime } from '../format'
import { backupErrorText, countsText } from './backupText'
import { downloadTextFile, exportFileName, MAX_BACKUP_BYTES, MIME_JSON, readFileText } from './files'

type State =
  | { step: 'idle' }
  | { step: 'error'; text: string }
  | { step: 'confirm'; fileName: string; backup: ParsedBackup; savedFirst: boolean }
  | { step: 'busy' }
  | { step: 'done'; text: string }

/** นำข้อมูลกลับจากไฟล์สำรอง — ตรวจไฟล์ → ยืนยัน (แสดงจำนวนที่จะถูกแทนที่) → แทนที่ทั้งหมดใน Transaction เดียว */
export function RestoreSection() {
  const inputId = useId()
  const [state, setState] = useState<State>({ step: 'idle' })
  const current = useLive(countData)

  async function onPick(input: HTMLInputElement) {
    const file = input.files?.[0]
    input.value = '' // เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setState({ step: 'error', text: 'ไฟล์ใหญ่เกินไป — ไม่ใช่ไฟล์สำรองของ Brew Log' })
      return
    }
    try {
      const result = parseBackup(await readFileText(file))
      setState(
        result.ok
          ? { step: 'confirm', fileName: file.name, backup: result.backup, savedFirst: false }
          : { step: 'error', text: backupErrorText(result.error) },
      )
    } catch {
      setState({ step: 'error', text: 'อ่านไฟล์ไม่ได้ กรุณาลองเลือกไฟล์ใหม่' })
    }
  }

  async function saveCurrentFirst() {
    if (state.step !== 'confirm') return
    const file = await createBackup()
    downloadTextFile(exportFileName('backup'), JSON.stringify(file), MIME_JSON)
    await markBackedUp(file.exportedAt)
    setState({ ...state, savedFirst: true })
  }

  async function confirm() {
    if (state.step !== 'confirm') return
    const { backup } = state
    setState({ step: 'busy' })
    try {
      const counts = await restoreBackup(backup)
      setState({ step: 'done', text: `นำข้อมูลกลับเรียบร้อย: ${countsText(counts)}` })
    } catch {
      setState({ step: 'error', text: 'นำข้อมูลกลับไม่สำเร็จ — ข้อมูลเดิมในเครื่องยังอยู่ครบ ไม่มีอะไรเปลี่ยนแปลง' })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        เลือกไฟล์ <code>.json</code> ที่เคยสำรองไว้ — ข้อมูลทั้งหมดในเครื่องนี้จะถูก<strong>แทนที่</strong>ด้วยข้อมูลในไฟล์
      </p>

      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
          ไฟล์สำรอง (.json)
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          disabled={state.step === 'busy'}
          onChange={(e) => void onPick(e.currentTarget)}
          className="block w-full text-base file:mr-3 file:min-h-12 file:rounded-xl file:border file:border-stone-300 file:bg-white file:px-4 file:font-semibold dark:file:border-stone-600 dark:file:bg-stone-800 dark:file:text-stone-100"
        />
      </div>

      {state.step === 'error' && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.text}
        </p>
      )}

      {state.step === 'done' && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
          {state.text}
        </p>
      )}

      {state.step === 'confirm' && (
        <div role="group" aria-label="ยืนยันการนำข้อมูลกลับ" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="font-semibold text-red-900 dark:text-red-200">แทนที่ข้อมูลทั้งหมดในเครื่องนี้?</p>
          <dl className="space-y-1 text-sm text-stone-900 dark:text-stone-100">
            <div>
              <dt className="font-medium">ในไฟล์ ({state.fileName}) · สำรองเมื่อ {formatDateTime(state.backup.exportedAt)}</dt>
              <dd>{countsText(backupCounts(state.backup))}</dd>
            </div>
            <div>
              <dt className="font-medium">ในเครื่องตอนนี้ (จะถูกลบ)</dt>
              <dd>{current ? countsText(current) : '…'}</dd>
            </div>
          </dl>
          <p className="text-sm text-red-900 dark:text-red-200">ย้อนกลับไม่ได้ — ถ้าไม่แน่ใจ ให้สำรองข้อมูลปัจจุบันก่อน</p>
          {state.savedFirst && (
            <p role="status" className="text-sm font-medium text-green-800 dark:text-green-300">
              ดาวน์โหลดไฟล์สำรองของข้อมูลปัจจุบันแล้ว
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void confirm()}>ยืนยัน แทนที่ข้อมูล</Button>
            <Button onClick={() => void saveCurrentFirst()}>สำรองข้อมูลปัจจุบันก่อน</Button>
            <Button variant="ghost" onClick={() => setState({ step: 'idle' })}>ยกเลิก</Button>
          </div>
        </div>
      )}
    </div>
  )
}
