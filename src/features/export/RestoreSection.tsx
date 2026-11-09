import { useId, useState } from 'react'
import { countData, createBackup, markBackedUp, restoreBackup, useLive } from '../../db'
import { parseBackup, type ParsedBackup } from '../../domain/backup'
import { backupCounts } from '../../domain/backup'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/I18nProvider'
import { formatDateTime } from '../format'
import { backupErrorText, countsText, type Message } from './backupText'
import { downloadTextFile, exportFileName, MAX_BACKUP_BYTES, MIME_JSON, readFileText } from './files'

type State =
  | { step: 'idle' }
  | { step: 'error'; message: Message }
  | { step: 'confirm'; fileName: string; backup: ParsedBackup; savedFirst: boolean }
  | { step: 'busy' }
  | { step: 'done'; message: Message }

/** นำข้อมูลกลับจากไฟล์สำรอง — ตรวจไฟล์ → ยืนยัน (แสดงจำนวนที่จะถูกแทนที่) → แทนที่ทั้งหมดใน Transaction เดียว */
export function RestoreSection() {
  const { t, locale } = useI18n()
  const inputId = useId()
  const [state, setState] = useState<State>({ step: 'idle' })
  const current = useLive(countData)

  async function onPick(input: HTMLInputElement) {
    const file = input.files?.[0]
    input.value = '' // เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setState({ step: 'error', message: (tt) => tt('restore.tooLarge') })
      return
    }
    try {
      const result = parseBackup(await readFileText(file))
      setState(
        result.ok
          ? { step: 'confirm', fileName: file.name, backup: result.backup, savedFirst: false }
          : { step: 'error', message: (tt) => backupErrorText(result.error, tt) },
      )
    } catch {
      setState({ step: 'error', message: (tt) => tt('restore.readFailed') })
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
      setState({ step: 'done', message: (tt) => tt('restore.done', { counts: countsText(counts, tt) }) })
    } catch {
      setState({ step: 'error', message: (tt) => tt('restore.failed') })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        {t('restore.introPre')}<strong>{t('restore.replaced')}</strong>{t('restore.introPost')}
      </p>

      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
          {t('restore.fileLabel')}
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
          {state.message(t)}
        </p>
      )}

      {state.step === 'done' && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
          {state.message(t)}
        </p>
      )}

      {state.step === 'confirm' && (
        <div role="group" aria-label={t('restore.confirmAria')} className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="font-semibold text-red-900 dark:text-red-200">{t('restore.confirmTitle')}</p>
          <dl className="space-y-1 text-sm text-stone-900 dark:text-stone-100">
            <div>
              <dt className="font-medium">{t('restore.inFile', { file: state.fileName, when: formatDateTime(state.backup.exportedAt, new Date(), locale) })}</dt>
              <dd>{countsText(backupCounts(state.backup), t)}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('restore.onDevice')}</dt>
              <dd>{current ? countsText(current, t) : '…'}</dd>
            </div>
          </dl>
          <p className="text-sm text-red-900 dark:text-red-200">{t('restore.irreversible')}</p>
          {state.savedFirst && (
            <p role="status" className="text-sm font-medium text-green-800 dark:text-green-300">
              {t('restore.savedFirst')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void confirm()}>{t('restore.confirmBtn')}</Button>
            <Button onClick={() => void saveCurrentFirst()}>{t('restore.saveFirst')}</Button>
            <Button variant="ghost" onClick={() => setState({ step: 'idle' })}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
