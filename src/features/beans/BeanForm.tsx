import { useState, type FormEvent } from 'react'
import { BeanInUseError, addBean, countBrewsOfBean, deleteBean, setBeanArchived, updateBean, useLive } from '../../db'
import { Button } from '../../components/Button'
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/fields'
import { BEAN_PROCESSES, ROAST_LEVELS } from '../../domain/inventory'
import type { Bean, BeanProcess, RoastLevel } from '../../domain/types'
import { CURRENCIES, PROCESS_LABEL, ROAST_LEVEL_LABEL } from '../labels'
import { DEFAULT_CURRENCY, beanToForm, emptyBeanForm, validateBeanForm, type BeanFormErrors, type BeanFormValues } from './beanForm'
import { toLocalDate } from '../../domain/calc'

interface Props {
  /** ไม่ส่ง = เพิ่มเมล็ดใหม่ */
  bean?: Bean
  onDone: () => void
}

export function BeanForm({ bean, onDone }: Props) {
  const mode = bean ? 'edit' : 'add'
  const [values, setValues] = useState<BeanFormValues>(() => (bean ? beanToForm(bean) : emptyBeanForm()))
  const [errors, setErrors] = useState<BeanFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const brewCount = useLive(() => (bean ? countBrewsOfBean(bean.id) : 0), [bean?.id])

  const set = <K extends keyof BeanFormValues>(key: K, value: BeanFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(undefined)
    setSaving(true)
    try {
      await action()
      onDone()
    } catch (err) {
      setActionError(
        err instanceof BeanInUseError
          ? `ลบไม่ได้ — เมล็ดนี้มีประวัติการชง ${err.brewCount} ครั้ง ใช้ Archive แทน`
          : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
      )
      setSaving(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateBeanForm(values, { mode })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    void run(() => (bean ? updateBean(bean.id, result.value) : addBean(result.value)))
  }

  const currencies = CURRENCIES.includes(values.currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [values.currency, ...CURRENCIES]

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={bean ? 'แก้ไขเมล็ด' : 'เพิ่มเมล็ด'}>
      <h2 className="text-xl font-bold">{bean ? 'แก้ไขเมล็ด' : 'เพิ่มเมล็ด'}</h2>

      <TextField label="ชื่อเมล็ด" required value={values.name} error={errors.name}
        placeholder="เช่น Ethiopia Guji" onChange={(e) => set('name', e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="โรงคั่ว" value={values.roaster} onChange={(e) => set('roaster', e.target.value)} />
        <TextField label="แหล่งปลูก" value={values.origin} onChange={(e) => set('origin', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label="สายพันธุ์" value={values.variety} onChange={(e) => set('variety', e.target.value)} />
        <SelectField label="Process" value={values.process}
          onChange={(e) => set('process', e.target.value as BeanProcess | '')}>
          <option value="">— ไม่ระบุ —</option>
          {BEAN_PROCESSES.map((p) => <option key={p} value={p}>{PROCESS_LABEL[p]}</option>)}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="ระดับคั่ว" required value={values.roastLevel}
          onChange={(e) => set('roastLevel', e.target.value as RoastLevel)}>
          {ROAST_LEVELS.map((r) => <option key={r} value={r}>{ROAST_LEVEL_LABEL[r]}</option>)}
        </SelectField>
        <TextField label="วันที่คั่ว" type="date" required value={values.roastDate} error={errors.roastDate}
          max={toLocalDate(new Date())} onChange={(e) => set('roastDate', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="น้ำหนักถุง (g)" required value={values.weightG} error={errors.weightG}
          placeholder="250" onChange={(e) => set('weightG', e.target.value)} />
        <NumberField label="คงเหลือ (g)" value={values.remainingG} error={errors.remainingG}
          hint={mode === 'add' ? 'เว้นว่าง = ถุงเต็ม' : 'หักอัตโนมัติตอนชง'}
          onChange={(e) => set('remainingG', e.target.value)} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <NumberField label="ราคาทั้งถุง" value={values.priceTotal} error={errors.priceTotal}
          hint="ใช้คำนวณต้นทุนต่อแก้ว" onChange={(e) => set('priceTotal', e.target.value)} />
        <SelectField label="สกุลเงิน" value={values.currency || DEFAULT_CURRENCY}
          onChange={(e) => set('currency', e.target.value)}>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
      </div>

      <TextAreaField label="โน้ต" value={values.notes} onChange={(e) => set('notes', e.target.value)} />

      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{actionError}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>ยกเลิก</Button>
        <Button variant="primary" type="submit" className="flex-1" disabled={saving}>บันทึก</Button>
      </div>

      {bean && (
        <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-stone-700">
          <Button className="w-full" disabled={saving}
            onClick={() => void run(() => setBeanArchived(bean.id, !bean.archived))}>
            {bean.archived ? 'กู้คืนจาก Archive' : 'Archive (ซ่อนจากรายการ)'}
          </Button>

          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving || (brewCount ?? 0) > 0}
              onClick={() => setConfirmDelete(true)}>
              ลบเมล็ดนี้
            </Button>
          ) : (
            <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">ลบ “{bean.name}” ถาวร? การลบย้อนกลับไม่ได้</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>ไม่ลบ</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteBean(bean.id))}>
                  ยืนยันลบ
                </Button>
              </div>
            </div>
          )}
          {(brewCount ?? 0) > 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              มีประวัติการชง {brewCount} ครั้ง จึงลบไม่ได้ — ใช้ Archive แทน
            </p>
          )}
        </div>
      )}
    </form>
  )
}
