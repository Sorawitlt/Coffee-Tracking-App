import { useId, useMemo, useState, type FormEvent } from 'react'
import { BeanInUseError, addBean, countBrewsOfBean, deleteBean, listBeans, setBeanArchived, updateBean, useLive } from '../../db'
import { findOrigin, findVariety, originValue } from '../../domain/catalog'
import { CatalogRef } from '../catalog/CatalogRef'
import { originOptions, roasterOptions, varietyOptions, type SuggestOption } from './beanSuggest'
import { Button } from '../../components/Button'
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/fields'
import { BEAN_PROCESSES, ROAST_LEVELS } from '../../domain/inventory'
import type { Bean, BeanProcess, RoastLevel } from '../../domain/types'
import type { MessageKey, MessageParams } from '../../i18n'
import { useI18n } from '../../i18n/I18nProvider'
import { CURRENCIES, PROCESS_KEY, ROAST_LEVEL_KEY } from '../labels'
import { DEFAULT_CURRENCY, beanToForm, emptyBeanForm, validateBeanForm, type BeanFormErrors, type BeanFormValues } from './beanForm'
import { toLocalDate } from '../../domain/calc'

interface Props {
  /** ไม่ส่ง = เพิ่มเมล็ดใหม่ */
  bean?: Bean
  onDone: () => void
}

export function BeanForm({ bean, onDone }: Props) {
  const { t, lang } = useI18n()
  const listId = useId()
  const allBeans = useLive(() => listBeans({ includeArchived: true }))
  const roasters = useMemo(() => roasterOptions(allBeans ?? []), [allBeans])
  const varieties = useMemo(() => varietyOptions(lang), [lang])
  const origins = useMemo(() => originOptions(lang), [lang])
  const mode = bean ? 'edit' : 'add'
  const [values, setValues] = useState<BeanFormValues>(() => (bean ? beanToForm(bean) : emptyBeanForm()))
  const [errors, setErrors] = useState<BeanFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<{ key: MessageKey; params?: MessageParams }>()
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
          ? { key: 'bean.err.inUse', params: { n: err.brewCount } }
          : { key: 'common.errorRetry' },
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

  const err = (key: keyof BeanFormValues) => {
    const k = errors[key]
    return k ? t(k) : undefined
  }

  const currencies = CURRENCIES.includes(values.currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [values.currency, ...CURRENCIES]

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={t(bean ? 'bean.form.edit' : 'bean.form.add')}>
      <h2 className="text-xl font-bold">{t(bean ? 'bean.form.edit' : 'bean.form.add')}</h2>

      <TextField label={t('bean.form.name')} required value={values.name} error={err('name')}
        placeholder={t('bean.form.namePlaceholder')} onChange={(e) => set('name', e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label={t('bean.form.roaster')} value={values.roaster} list={`${listId}-roaster`} autoComplete="off"
          onChange={(e) => set('roaster', e.target.value)} />
        <TextField label={t('bean.form.origin')} value={values.origin} list={`${listId}-origin`} autoComplete="off"
          onChange={(e) => set('origin', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label={t('bean.form.variety')} value={values.variety} list={`${listId}-variety`} autoComplete="off"
          onChange={(e) => set('variety', e.target.value)} />
        <SelectField label={t('bean.form.process')} value={values.process}
          onChange={(e) => set('process', e.target.value as BeanProcess | '')}>
          <option value="">{t('common.notSpecified')}</option>
          {BEAN_PROCESSES.map((p) => <option key={p} value={p}>{t(PROCESS_KEY[p])}</option>)}
        </SelectField>
      </div>

      <Suggestions id={`${listId}-roaster`} options={roasters} />
      <Suggestions id={`${listId}-origin`} options={origins} />
      <Suggestions id={`${listId}-variety`} options={varieties} />
      <BeanRefs origin={values.origin} variety={values.variety} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('bean.form.roastLevel')} required value={values.roastLevel}
          onChange={(e) => set('roastLevel', e.target.value as RoastLevel)}>
          {ROAST_LEVELS.map((r) => <option key={r} value={r}>{t(ROAST_LEVEL_KEY[r])}</option>)}
        </SelectField>
        <TextField label={t('bean.form.roastDate')} type="date" required value={values.roastDate} error={err('roastDate')}
          max={toLocalDate(new Date())} onChange={(e) => set('roastDate', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label={t('bean.form.weight')} required value={values.weightG} error={err('weightG')}
          placeholder="250" onChange={(e) => set('weightG', e.target.value)} />
        <NumberField label={t('bean.form.remaining')} value={values.remainingG} error={err('remainingG')}
          hint={t(mode === 'add' ? 'bean.form.remainingHintAdd' : 'bean.form.remainingHintEdit')}
          onChange={(e) => set('remainingG', e.target.value)} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <NumberField label={t('bean.form.price')} value={values.priceTotal} error={err('priceTotal')}
          hint={t('bean.form.priceHint')} onChange={(e) => set('priceTotal', e.target.value)} />
        <SelectField label={t('bean.form.currency')} value={values.currency || DEFAULT_CURRENCY}
          onChange={(e) => set('currency', e.target.value)}>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
      </div>

      <TextAreaField label={t('common.note')} value={values.notes} onChange={(e) => set('notes', e.target.value)} />

      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{t(actionError.key, actionError.params)}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="primary" type="submit" className="flex-1" disabled={saving}>{t('common.save')}</Button>
      </div>

      {bean && (
        <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-stone-700">
          <Button className="w-full" disabled={saving}
            onClick={() => void run(() => setBeanArchived(bean.id, !bean.archived))}>
            {t(bean.archived ? 'bean.form.unarchive' : 'bean.form.archiveBtn')}
          </Button>

          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving || (brewCount ?? 0) > 0}
              onClick={() => setConfirmDelete(true)}>
              {t('bean.form.delete')}
            </Button>
          ) : (
            <div role="alertdialog" aria-label={t('common.confirmDelete')} className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">{t('bean.form.deleteWarning', { name: bean.name })}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>{t('common.keep')}</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteBean(bean.id))}>
                  {t('common.confirmDeleteBtn')}
                </Button>
              </div>
            </div>
          )}
          {(brewCount ?? 0) > 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {t('bean.form.inUseNote', { n: brewCount ?? 0 })}
            </p>
          )}
        </div>
      )}
    </form>
  )
}

function Suggestions({ id, options }: { id: string; options: SuggestOption[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => <option key={o.value} value={o.value} label={o.label} />)}
    </datalist>
  )
}

/** แสดงแหล่งอ้างอิงเมื่อแหล่งปลูก/สายพันธุ์ที่กรอกตรงกับฐานข้อมูล */
function BeanRefs({ origin, variety }: { origin: string; variety: string }) {
  const o = findOrigin(origin)
  const v = findVariety(variety)
  if (!o && !v) return null
  return (
    <div className="space-y-1">
      {o && <CatalogRef name={originValue(o)} sources={o.sources} />}
      {v && <CatalogRef name={v.name} sources={v.sources} />}
    </div>
  )
}
