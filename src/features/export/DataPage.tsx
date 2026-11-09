import { useEffect, useState, type ReactNode } from 'react'
import {
  createBackup, getSettings, isStoragePersistent, markBackedUp, readTables, requestPersistentStorage, useLive,
} from '../../db'
import { backupCounts } from '../../domain/backup'
import { beansToCsv, brewsToCsv } from '../../domain/export'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/I18nProvider'
import { formatDateTime } from '../format'
import { countsText, daysAgoText, type Message } from './backupText'
import { downloadTextFile, exportFileName, MIME_CSV, MIME_JSON, type ExportKind } from './files'
import { RestoreSection } from './RestoreSection'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

type Notice = { kind: 'ok' | 'error'; message: Message }

/** หน้า "ข้อมูลของฉัน": สำรอง/นำกลับ (JSON) · ส่งออก CSV · สถานะที่เก็บข้อมูลในเครื่อง */
export default function DataPage({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n()
  const settings = useLive(getSettings)
  const [notice, setNotice] = useState<Notice>()
  const [busy, setBusy] = useState(false)
  const [persistent, setPersistent] = useState<boolean>()

  useEffect(() => {
    void isStoragePersistent().then(setPersistent)
  }, [])

  async function run(job: () => Promise<Message>) {
    setBusy(true)
    setNotice(undefined)
    try {
      setNotice({ kind: 'ok', message: await job() })
    } catch (err) {
      console.error('export failed', err)
      setNotice({ kind: 'error', message: (tt) => tt('data.exportFailed') })
    } finally {
      setBusy(false)
    }
  }

  const backup = () =>
    run(async () => {
      const file = await createBackup()
      const name = exportFileName('backup')
      downloadTextFile(name, JSON.stringify(file), MIME_JSON)
      await markBackedUp(file.exportedAt)
      const counts = backupCounts(file.data)
      return (tt) => tt('data.backupDone', { name, counts: countsText(counts, tt) })
    })

  const exportCsv = (kind: Exclude<ExportKind, 'backup'>) =>
    run(async () => {
      const { beans, gear, brews } = await readTables()
      const csv = kind === 'brews' ? brewsToCsv(brews, beans, gear) : beansToCsv(beans)
      const name = exportFileName(kind)
      downloadTextFile(name, csv, MIME_CSV)
      const rows = kind === 'brews' ? brews.length : beans.length
      return (tt) => tt('data.csvDone', { name, rows })
    })

  const last = settings?.lastBackupAt

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose} aria-label={t('common.back')}>{t('common.backArrow')}</Button>
        <h2 className="text-xl font-bold">{t('data.title')}</h2>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl p-3 text-sm font-medium ${
            notice.kind === 'error'
              ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200'
          }`}
        >
          {notice.message(t)}
        </p>
      )}

      <Card title={t('data.backupCard')}>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {t('data.backupIntro')}
        </p>
        <p className="text-sm" data-testid="last-backup">
          {t('data.lastBackup')}{' '}
          <strong>
            {settings === undefined
              ? '…'
              : last
                ? `${formatDateTime(last, new Date(), locale)} (${daysAgoText(Math.floor((Date.now() - Date.parse(last)) / 86_400_000), t)})`
                : t('data.never')}
          </strong>
        </p>
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void backup()}>
          {t('data.download')}
        </Button>
      </Card>

      <Card title={t('data.restoreCard')}>
        <RestoreSection />
      </Card>

      <Card title={t('data.csvCard')}>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {t('data.csvIntro')} <code>dose_g</code>, <code>temp_c</code>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void exportCsv('brews')}>{t('data.csvBrews')}</Button>
          <Button disabled={busy} onClick={() => void exportCsv('beans')}>{t('data.csvBeans')}</Button>
        </div>
      </Card>

      <Card title={t('data.storageCard')}>
        <p className="text-sm" data-testid="persist-status">
          {t('data.status')}{' '}
          <strong>
            {persistent === undefined ? '…' : t(persistent ? 'data.persistent' : 'data.notGuaranteed')}
          </strong>
        </p>
        {persistent === false && (
          <>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {t('data.storageWarning')}
            </p>
            <Button onClick={() => void requestPersistentStorage().then(setPersistent)}>{t('data.requestPersist')}</Button>
          </>
        )}
      </Card>
    </div>
  )
}
