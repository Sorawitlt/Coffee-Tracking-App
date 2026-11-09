import { useState, type FormEvent } from 'react'
import { addGear, deleteGear, updateGear } from '../../db'
import { Button } from '../../components/Button'
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/fields'
import { GEAR_TYPES } from '../../domain/inventory'
import type { Gear, GearType } from '../../domain/types'
import { GEAR_TYPE_LABEL } from '../labels'
import { emptyGearForm, gearToForm, validateGearForm, type GearFormErrors, type GearFormValues } from './gearForm'

interface Props {
  /** ไม่ส่ง = เพิ่มอุปกรณ์ใหม่ */
  gear?: Gear
  onDone: () => void
}

export function GearForm({ gear, onDone }: Props) {
  const [values, setValues] = useState<GearFormValues>(() => (gear ? gearToForm(gear) : emptyGearForm()))
  const [errors, setErrors] = useState<GearFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string>()

  const set = <K extends keyof GearFormValues>(key: K, value: GearFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(undefined)
    setSaving(true)
    try {
      await action()
      onDone()
    } catch {
      setActionError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      setSaving(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateGearForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    void run(() => (gear ? updateGear(gear.id, result.value) : addGear(result.value)))
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={gear ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}>
      <h2 className="text-xl font-bold">{gear ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}</h2>

      <SelectField label="ชนิด" required value={values.type} onChange={(e) => set('type', e.target.value as GearType)}>
        {GEAR_TYPES.map((t) => <option key={t} value={t}>{GEAR_TYPE_LABEL[t]}</option>)}
      </SelectField>

      <TextField label="ชื่อ / รุ่น" required value={values.name} error={errors.name}
        placeholder="เช่น Comandante C40" onChange={(e) => set('name', e.target.value)} />

      {values.type === 'grinder' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-700 dark:text-stone-300">สเกลเบอร์บด (ไม่บังคับ)</legend>
          <p className="text-sm text-stone-500 dark:text-stone-400">ใช้ให้แอปแนะนำ “บดละเอียดขึ้น 1 ขั้น” เป็นเบอร์จริง — เลขน้อย = ละเอียด</p>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="ต่ำสุด" value={values.scaleMin} error={errors.scaleMin} onChange={(e) => set('scaleMin', e.target.value)} />
            <NumberField label="สูงสุด" value={values.scaleMax} error={errors.scaleMax} onChange={(e) => set('scaleMax', e.target.value)} />
            <NumberField label="ขั้นละ" value={values.scaleStep} error={errors.scaleStep} onChange={(e) => set('scaleStep', e.target.value)} />
          </div>
        </fieldset>
      )}

      <TextAreaField label="โน้ต" value={values.notes} onChange={(e) => set('notes', e.target.value)} />

      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{actionError}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>ยกเลิก</Button>
        <Button variant="primary" type="submit" className="flex-1" disabled={saving}>บันทึก</Button>
      </div>

      {gear && (
        <div className="border-t border-stone-200 pt-4 dark:border-stone-700">
          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving}
              onClick={() => setConfirmDelete(true)}>
              ลบอุปกรณ์นี้
            </Button>
          ) : (
            <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">ลบ “{gear.name}” ถาวร? ประวัติการชงเดิมจะไม่ถูกลบ</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>ไม่ลบ</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteGear(gear.id))}>
                  ยืนยันลบ
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
