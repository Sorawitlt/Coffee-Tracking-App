import { useState, type FormEvent } from 'react'
import { addGear, deleteGear, updateGear } from '../../db'
import { Button } from '../../components/Button'
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/fields'
import { GEAR_TYPES } from '../../domain/inventory'
import type { Gear, GearType } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/I18nProvider'
import { GEAR_TYPE_KEY } from '../labels'
import { emptyGearForm, gearToForm, validateGearForm, type GearFormErrors, type GearFormValues } from './gearForm'

interface Props {
  /** ไม่ส่ง = เพิ่มอุปกรณ์ใหม่ */
  gear?: Gear
  onDone: () => void
}

export function GearForm({ gear, onDone }: Props) {
  const t = useT()
  const [values, setValues] = useState<GearFormValues>(() => (gear ? gearToForm(gear) : emptyGearForm()))
  const [errors, setErrors] = useState<GearFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<MessageKey>()

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
      setActionError('common.errorRetry')
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

  const err = (key: keyof GearFormValues) => {
    const k = errors[key]
    return k ? t(k) : undefined
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t(gear ? 'gear.form.edit' : 'gear.form.add')}>
      <h2 className="text-xl font-bold">{t(gear ? 'gear.form.edit' : 'gear.form.add')}</h2>

      <SelectField label={t('gear.form.type')} required value={values.type} onChange={(e) => set('type', e.target.value as GearType)}>
        {GEAR_TYPES.map((type) => <option key={type} value={type}>{t(GEAR_TYPE_KEY[type])}</option>)}
      </SelectField>

      <TextField label={t('gear.form.name')} required value={values.name} error={err('name')}
        placeholder={t('gear.form.namePlaceholder')} onChange={(e) => set('name', e.target.value)} />

      {values.type === 'grinder' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-700 dark:text-stone-300">{t('gear.form.scale')}</legend>
          <p className="text-sm text-stone-500 dark:text-stone-400">{t('gear.form.scaleHint')}</p>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label={t('gear.form.scaleMin')} value={values.scaleMin} error={err('scaleMin')} onChange={(e) => set('scaleMin', e.target.value)} />
            <NumberField label={t('gear.form.scaleMax')} value={values.scaleMax} error={err('scaleMax')} onChange={(e) => set('scaleMax', e.target.value)} />
            <NumberField label={t('gear.form.scaleStep')} value={values.scaleStep} error={err('scaleStep')} onChange={(e) => set('scaleStep', e.target.value)} />
          </div>
        </fieldset>
      )}

      <TextAreaField label={t('common.note')} value={values.notes} onChange={(e) => set('notes', e.target.value)} />

      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{t(actionError)}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="primary" type="submit" className="flex-1" disabled={saving}>{t('common.save')}</Button>
      </div>

      {gear && (
        <div className="border-t border-stone-200 pt-4 dark:border-stone-700">
          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving}
              onClick={() => setConfirmDelete(true)}>
              {t('gear.form.delete')}
            </Button>
          ) : (
            <div role="alertdialog" aria-label={t('common.confirmDelete')} className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">{t('gear.form.deleteWarning', { name: gear.name })}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>{t('common.keep')}</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteGear(gear.id))}>
                  {t('common.confirmDeleteBtn')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
