import { useState, type FormEvent } from 'react'
import {
  addBrew, deleteBrew, getSettings, listBeans, listBrews, listGear, updateBrew, useLive, type BrewInput,
} from '../../db'
import { Button } from '../../components/Button'
import { NumberStepper } from '../../components/NumberStepper'
import { NumberField, SelectField, TextField } from '../../components/fields'
import {
  buildDraft, changedVariables, dialInChangeCount, draftFromBrew, findReferenceBrew, pickDefaultBeanId,
  pickDefaultMethod, type DraftSource,
} from '../../domain/brewDraft'
import { RATIO_PRESETS } from '../../domain/brewPlan'
import { beverageG, daysOffRoast, formatRatio, freshness, ratio, waterForDose } from '../../domain/calc'
import { grindGuideFor, getGearModel } from '../../domain/catalog'
import { adviceToStore } from '../../domain/dialIn'
import { snapToStep } from '../../domain/inventory'
import { METHOD_PROFILES } from '../../domain/methods'
import { METHODS, type Bean, type Brew, type Gear, type Method } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n/I18nProvider'
import { numberToText, parseNumber } from '../formUtil'
import { formatDateTime, formatDuration, formatGrams } from '../format'
import { METHOD_LABEL } from '../labels'
import {
  brewToForm, draftToForm, formToDialValues, toDateTimeLocal, validateBrewForm, type BrewFormErrors, type BrewFormValues,
} from './brewForm'
import { TastingFields } from './TastingFields'
import { emptyTasting, tastingFromBrew, tastingToFields, type TastingValues } from './tasting'

/**
 * ฟอร์มบันทึกการชง
 * - `new`   : ชงใหม่ — เติมค่าจากครั้งล่าสุดของเมล็ด+วิธีนี้
 * - `repeat`: "ชงซ้ำ" — คัดลอกค่าตั้งจาก `brew` ทั้งหมด เวลา = ตอนนี้
 * - `edit`  : แก้ไข/ลบบันทึกเดิม
 *
 * ส่วน "ชิม & ให้คะแนน" (ไม่บังคับ) อยู่ในทุกโหมดยกเว้น `start` — ชงซ้ำเริ่มจากผลชิมว่าง (ผลชิมเป็นของการชงครั้งนั้น ๆ)
 * บันทึกแล้วคำนวณ "ครั้งหน้าลอง" เก็บไว้กับบันทึก และส่ง id ให้ผู้เรียกแสดงหน้าคำแนะนำ (`BrewResult`)
 * - `start` : "เตรียมชง" ของผู้ช่วยชง — หน้าตั้งค่าเดียวกัน แต่ไม่บันทึก กดแล้วส่งค่าไป `onStart` เพื่อเริ่มจับเวลา
 *             (ซ่อนช่องที่เป็นผลของการชง: เวลาชง, น้ำหนักเครื่องดื่ม, TDS, วันเวลา)
 */
export interface BrewFormProps {
  mode: 'new' | 'repeat' | 'edit' | 'start'
  /** ต้นทางของ repeat หรือบันทึกที่แก้ไข */
  brew?: Brew
  /**
   * ค่าที่กรอกไว้แล้ว (mode `new`: ผลจากผู้ช่วยชงหลังชงเสร็จ · mode `start`: ย้อนกลับมาแก้ค่าก่อนชง)
   * ยังเทียบ "ค่าที่เปลี่ยน" กับการชงครั้งก่อนของเมล็ด+วิธีเดียวกันตามปกติ
   */
  prefill?: BrewFormPrefill
  /** mode `start`: ผู้ใช้กด "เริ่มชง" (ค่าผ่านการตรวจสอบแล้ว) */
  onStart?: (input: BrewInput) => void
  /**
   * จบฟอร์ม — `messageKey` = คีย์ข้อความยืนยัน (ไม่มี = ยกเลิก)
   * `adviceBrewId` = มีคำแนะนำใหม่ให้แสดง → ผู้เรียกเปิด `BrewResult` ของบันทึกนี้
   */
  onDone: (messageKey?: MessageKey, adviceBrewId?: string) => void
  onGoToBeans: () => void
}

export interface BrewFormPrefill {
  values: BrewFormValues
  /** ข้อความบอกที่มาของค่า แสดงเหนือฟอร์ม */
  note?: string
}

export function BrewForm(props: BrewFormProps) {
  const beans = useLive(() => listBeans({ includeArchived: true }))
  const gear = useLive(() => listGear())
  const brews = useLive(() => listBrews())
  const settings = useLive(() => getSettings())
  if (!beans || !gear || !brews || !settings) return null
  return <BrewFormInner {...props} beans={beans} gear={gear} brews={brews} defaultMethod={settings.defaultMethod} />
}

interface InnerProps extends BrewFormProps {
  beans: Bean[]
  gear: Gear[]
  brews: Brew[]
  defaultMethod: Method
}

const SOURCE_KEY: Record<DraftSource, MessageKey> = {
  sameBean: 'brew.source.sameBean',
  sameMethod: 'brew.source.sameMethod',
  recipe: 'brew.source.recipe',
}

/** ขนาด +/− ที่เหมาะกับแต่ละวิธีชง */
function stepsFor(method: Method) {
  const style = METHOD_PROFILES[method].style
  return {
    dose: style === 'coldBrew' ? 5 : 0.5,
    water: style === 'espresso' ? 1 : style === 'coldBrew' ? 50 : 5,
  }
}

const withUnit = (v: number | undefined, unit: string) => (v === undefined ? '—' : `${formatGrams(v)}${unit}`)

function BrewFormInner({ mode, brew, prefill, onStart, onDone, onGoToBeans, beans, gear, brews, defaultMethod }: InnerProps) {
  const { t, locale } = useI18n()
  const activeBeans = beans.filter((b) => !b.archived)
  const grinders = gear.filter((g) => g.type === 'grinder')
  const brewers = gear.filter((g) => g.type === 'brewer')

  // ค่าเริ่มต้นคำนวณครั้งเดียวตอนเปิดฟอร์ม
  const [init] = useState(() => {
    if (mode === 'edit' && brew) {
      return {
        values: brewToForm(brew),
        reference: findReferenceBrew(brews, { beanId: brew.beanId, method: brew.method, before: brew }),
        source: undefined as DraftSource | undefined,
      }
    }
    if (mode === 'repeat' && brew) {
      return { values: draftToForm(draftFromBrew(brew), brew.beanId, new Date()), reference: brew, source: undefined }
    }
    const method = prefill?.values.method ?? pickDefaultMethod(brews, defaultMethod)
    const beanId = prefill?.values.beanId ?? pickDefaultBeanId(activeBeans, brews) ?? ''
    const r = buildDraft({ method, beanId: beanId || undefined, brews })
    return {
      values: prefill?.values ?? draftToForm(r.draft, beanId, new Date()),
      reference: r.reference,
      source: prefill ? undefined : r.source,
    }
  })

  const [values, setValues] = useState<BrewFormValues>(init.values)
  const [reference, setReference] = useState<Brew | undefined>(init.reference)
  const [source, setSource] = useState<DraftSource | undefined>(init.source)
  const [errors, setErrors] = useState<BrewFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<MessageKey>()
  const [tasting, setTasting] = useState<TastingValues>(() =>
    mode === 'edit' && brew ? tastingFromBrew(brew) : emptyTasting(),
  )

  const set = <K extends keyof BrewFormValues>(key: K, value: BrewFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  /** เปลี่ยนวิธีชง/เมล็ด (ชงใหม่-ชงซ้ำ) → เติมค่าตั้งใหม่จากประวัติที่ตรงกัน; เวลา/ผลวัดที่กรอกไว้คงเดิม */
  function refill(method: Method, beanId: string) {
    const r = buildDraft({ method, beanId: beanId || undefined, brews })
    setReference(r.reference)
    setSource(r.source)
    setErrors({})
    setValues((v) => ({
      ...draftToForm(r.draft, beanId, new Date()),
      brewedAt: v.brewedAt,
      totalTimeSec: v.totalTimeSec,
      yieldG: v.yieldG,
      tds: v.tds,
    }))
  }

  // ฟอร์มบันทึกผลจากผู้ช่วยชง (new + prefill) ห้ามเติมค่าทับ — ค่าที่ชงจริงต้องคงไว้
  const canRefill = mode !== 'edit' && !(mode === 'new' && prefill)
  const onMethod = (method: Method) => (canRefill ? refill(method, values.beanId) : set('method', method))
  const onBean = (beanId: string) => (canRefill ? refill(values.method, beanId) : set('beanId', beanId))

  const bean = beans.find((b) => b.id === values.beanId)
  const profile = METHOD_PROFILES[values.method]
  const step = stepsFor(values.method)
  const grinder = grinders.find((g) => g.id === values.grinderId)
  const scale = grinder?.grindScale
  // ช่วงที่ผู้ผลิตแนะนำ (จากฐานข้อมูลอ้างอิง) — ใช้เป็นคำใบ้ + จุดเริ่มของปุ่ม +/− เมื่อยังไม่เคยชง
  const guide = grindGuideFor(getGearModel(grinder?.catalogId), values.method)
  const grindHint = [
    scale ? t('brew.form.grindRange', { min: scale.min, max: scale.max }) : '',
    guide ? t('brew.form.grindGuide', { min: guide.min, max: guide.max, method: METHOD_LABEL[values.method] }) : '',
  ].filter(Boolean).join(' · ') || undefined
  const guideStart = guide ? snapToStep((guide.min + guide.max) / 2, scale?.step ?? 1, scale?.min ?? 0) : undefined

  // --- ค่าที่คำนวณสด ---
  const dose = parseNumber(values.doseG)
  const water = parseNumber(values.waterG)
  const doseOk = dose !== undefined && dose > 0
  const waterOk = water !== undefined && water > 0
  const r = doseOk && waterOk ? ratio(dose, water) : undefined
  const bev = doseOk && waterOk ? beverageG({ method: values.method, doseG: dose, waterG: water, yieldG: parseNumber(values.yieldG) }) : undefined
  const days = bean ? daysOffRoast(bean.roastDate, new Date()) : undefined
  const lowStock = bean && doseOk && bean.remainingG < dose && mode !== 'edit'

  // --- ไฮไลต์ค่าที่ต่างจากครั้งก่อน ---
  const current = formToDialValues(values)
  const changed = new Set(reference ? changedVariables(reference, current) : [])
  const changeCount = reference ? dialInChangeCount(reference, current) : 0
  const prev = (key: 'doseG' | 'waterG' | 'grindSetting' | 'tempC', unit: string) =>
    changed.has(key) ? withUnit(reference?.[key], unit) : undefined
  const grinderName = (id?: string) => (id ? (gear.find((g) => g.id === id)?.name ?? t('common.deletedGear')) : t('common.unspecified'))

  async function run(action: () => Promise<Brew | void>, messageKey: MessageKey) {
    setActionError(undefined)
    setSaving(true)
    try {
      const saved = await action()
      // แสดงหน้าคำแนะนำเฉพาะเมื่อมีคำแนะนำใหม่ (แก้ไขที่ไม่ได้เปลี่ยนคำแนะนำ = กลับรายการเงียบ ๆ)
      const showAdvice =
        saved && saved.advice && (mode !== 'edit' || JSON.stringify(saved.advice) !== JSON.stringify(brew?.advice))
      onDone(messageKey, showAdvice && saved ? saved.id : undefined)
    } catch {
      setActionError('common.errorRetry')
      setSaving(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateBrewForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    if (mode === 'start') {
      onStart?.(result.value)
      return
    }
    const value: BrewInput = { ...result.value, ...tastingToFields(tasting) }
    value.advice = adviceToStore(value, { bean, grinder: gear.find((g) => g.id === value.grinderId) })
    if (mode === 'edit' && brew) void run(() => updateBrew(brew.id, value), 'brew.msg.edited')
    else void run(() => addBrew(value), 'brew.msg.saved')
  }

  const title = t(
    mode === 'edit' ? 'brew.form.titleEdit' : mode === 'repeat' ? 'brew.form.titleRepeat' : mode === 'start' ? 'brew.form.titleStart' : 'brew.form.titleNew',
  )
  const err = (key: keyof BrewFormValues) => {
    const k = errors[key]
    return k ? t(k) : undefined
  }

  if (mode !== 'edit' && activeBeans.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>🫘</p>
          <p className="mt-2 font-medium">{t('brew.form.needBeans')}</p>
          <Button variant="primary" className="mt-4" onClick={onGoToBeans}>{t('brew.form.goAddBeans')}</Button>
        </div>
        {mode !== 'start' && <Button className="w-full" onClick={() => onDone()}>{t('brew.form.back')}</Button>}
      </div>
    )
  }

  // เมล็ดที่เลือกอาจถูก Archive ไปแล้ว (ตอนแก้ไข/ชงซ้ำ) → ต้องยังเลือกได้
  const beanOptions = bean && bean.archived ? [bean, ...activeBeans] : activeBeans
  const gearOptions = (list: Gear[], selectedId: string) =>
    selectedId && !list.some((g) => g.id === selectedId)
      ? [<option key={selectedId} value={selectedId}>{t('common.deletedGearOption')}</option>, ...list.map(opt)]
      : list.map(opt)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={title}>
      <h2 className="text-xl font-bold">{title}</h2>

      {prefill?.note && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {prefill.note}
        </p>
      )}
      {mode !== 'edit' && source && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {t(SOURCE_KEY[source])}
          {reference && ` · ${formatDateTime(reference.brewedAt, new Date(), locale)}`}
        </p>
      )}
      {mode === 'repeat' && brew && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {t('brew.form.copiedFrom', { when: formatDateTime(brew.brewedAt, new Date(), locale) })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('common.method')} required value={values.method} onChange={(e) => onMethod(e.target.value as Method)}>
          {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
        </SelectField>
        <SelectField label={t('common.bean')} required value={values.beanId} error={err('beanId')} onChange={(e) => onBean(e.target.value)}>
          {!values.beanId && <option value="">{t('brew.form.chooseBean')}</option>}
          {beanOptions.map((b) => <option key={b.id} value={b.id}>{b.name}{b.archived ? ` (${t('bean.archive')})` : ''}</option>)}
        </SelectField>
      </div>

      {bean && (
        <p className="-mt-2 text-sm text-stone-600 dark:text-stone-400">
          {days !== undefined && days >= 0 && (
            <>
              {t('brew.form.roastedDays', { n: days })}{freshness(days) === 'tooFresh' ? t('brew.form.tooFreshSuffix') : freshness(days) === 'stale' ? t('brew.form.staleSuffix') : ''}
              {' · '}
            </>
          )}
          {t('brew.form.remainingG', { g: formatGrams(Math.max(0, bean.remainingG)) })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label={t('brew.form.dose')} required value={values.doseG} step={step.dose} min={step.dose}
          start={dose ?? 15} error={err('doseG')} changedFrom={prev('doseG', ' g')}
          onChange={(v) => set('doseG', v)} />
        <NumberStepper label={t('brew.form.water')} required value={values.waterG} step={step.water} min={step.water}
          start={water ?? 250} error={err('waterG')} changedFrom={prev('waterG', ' g')}
          onChange={(v) => set('waterG', v)} />
      </div>

      <p aria-live="polite" className="-mt-2 text-center text-lg font-semibold tabular-nums">
        {r !== undefined ? t('brew.form.ratio', { ratio: formatRatio(r) }) : t('brew.form.ratioNone')}
        {bev !== undefined && bev > 0 && (
          <span className="ml-2 text-sm font-normal text-stone-600 dark:text-stone-400">
            {t('brew.form.beverage', { g: formatGrams(bev) })}{parseNumber(values.yieldG) ? '' : t('brew.form.estimated')}
          </span>
        )}
      </p>

      {mode === 'start' && (
        <div role="group" aria-label={t('brew.form.ratioPresets')} className="-mt-2 flex flex-wrap justify-center gap-2">
          {RATIO_PRESETS[values.method].map((x) => (
            <button
              key={x}
              type="button"
              disabled={!doseOk}
              aria-pressed={r !== undefined && Math.abs(r - x) < 0.05}
              onClick={() => dose !== undefined && set('waterG', numberToText(waterForDose(dose, x)))}
              className="min-h-12 min-w-16 rounded-xl border border-stone-300 bg-white px-3 text-base font-semibold tabular-nums text-stone-800 hover:bg-stone-100 disabled:opacity-50 aria-pressed:border-amber-700 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:aria-pressed:border-amber-500 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-200"
            >
              {`1:${x}`}
            </button>
          ))}
        </div>
      )}

      {grinders.length > 0 && (
        <div>
          <SelectField label={t('brew.form.grinder')} value={values.grinderId} onChange={(e) => set('grinderId', e.target.value)}>
            <option value="">{t('common.notSpecified')}</option>
            {gearOptions(grinders, values.grinderId)}
          </SelectField>
          {changed.has('grinderId') && (
            <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
              {t('brew.form.changedPrev', { prev: grinderName(reference?.grinderId) })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label={t('brew.form.grindSetting')} value={values.grindSetting}
          step={scale?.step ?? 1} min={scale?.min ?? 0} max={scale?.max}
          start={reference?.grindSetting ?? guideStart ?? (scale ? scale.min : undefined)}
          hint={grindHint}
          error={err('grindSetting')} changedFrom={prev('grindSetting', '')}
          onChange={(v) => set('grindSetting', v)} />
        <NumberStepper label={t('brew.form.temp')} value={values.tempC} step={1} min={0} max={100}
          start={reference?.tempC ?? 93}
          hint={profile.tempRangeC ? t('brew.form.tempHint', { min: profile.tempRangeC[0], max: profile.tempRangeC[1] }) : undefined}
          error={err('tempC')} changedFrom={prev('tempC', ' °C')}
          onChange={(v) => set('tempC', v)} />
      </div>

      {changeCount >= 2 && (
        <p role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          {t('brew.form.manyChanges', { n: changeCount })}
        </p>
      )}

      {mode === 'start' ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {t('brew.form.targetTime', { range: `${formatDuration(profile.timeRangeSec[0])}–${formatDuration(profile.timeRangeSec[1])}` })}
        </p>
      ) : (
        <NumberStepper label={t('brew.form.time')} value={values.totalTimeSec} step={5} min={5} start={profile.timeRangeSec[0]}
          hint={t(parseNumber(values.totalTimeSec) ? 'brew.form.timeHintWith' : 'brew.form.timeHint', {
            time: parseNumber(values.totalTimeSec) ? formatDuration(parseNumber(values.totalTimeSec)!) : '',
            range: `${formatDuration(profile.timeRangeSec[0])}–${formatDuration(profile.timeRangeSec[1])}`,
          })}
          error={err('totalTimeSec')} onChange={(v) => set('totalTimeSec', v)} />
      )}

      {mode !== 'start' && <TastingFields value={tasting} onChange={setTasting} />}

      {mode !== 'start' && (
        <details className="rounded-2xl border border-stone-200 p-3 dark:border-stone-700">
          <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">{t('brew.form.more')}</summary>
          <div className="mt-2 space-y-4">
            {brewers.length > 0 && (
              <SelectField label={t('brew.form.brewer')} value={values.brewerId} onChange={(e) => set('brewerId', e.target.value)}>
                <option value="">{t('common.notSpecified')}</option>
                {gearOptions(brewers, values.brewerId)}
              </SelectField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t('brew.form.yield')} value={values.yieldG} error={err('yieldG')}
                hint={t('brew.form.yieldHint')} onChange={(e) => set('yieldG', e.target.value)} />
              <NumberField label={t('brew.form.tds')} value={values.tds} error={err('tds')}
                hint={t('brew.form.tdsHint')} onChange={(e) => set('tds', e.target.value)} />
            </div>
            <TextField label={t('brew.form.brewedAt')} type="datetime-local" value={values.brewedAt} error={err('brewedAt')}
              max={toDateTimeLocal(new Date())} onChange={(e) => set('brewedAt', e.target.value)} />
          </div>
        </details>
      )}

      {lowStock && bean && (
        <p role="status" className="rounded-xl bg-orange-50 p-3 text-sm font-medium text-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
          {t('brew.form.lowStock', { g: formatGrams(Math.max(0, bean.remainingG)), action: t(mode === 'start' ? 'brew.form.lowStockStart' : 'brew.form.lowStockSave') })}
        </p>
      )}
      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{t(actionError)}</p>}

      <div className="flex gap-3">
        {mode !== 'start' && <Button className="flex-1" onClick={() => onDone()} disabled={saving}>{t('common.cancel')}</Button>}
        <Button variant="primary" type="submit" className={mode === 'start' ? 'h-14 flex-1 text-lg' : 'flex-1'} disabled={saving}>
          {mode === 'start' ? t('brew.form.start') : t('common.save')}
        </Button>
      </div>

      {mode === 'edit' && brew && (
        <div className="border-t border-stone-200 pt-4 dark:border-stone-700">
          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving} onClick={() => setConfirmDelete(true)}>
              {t('brew.form.delete')}
            </Button>
          ) : (
            <div role="alertdialog" aria-label={t('common.confirmDelete')} className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">{t('brew.form.deleteWarning', { g: formatGrams(brew.doseG) })}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>{t('common.keep')}</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteBrew(brew.id), 'brew.msg.deleted')}>
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

const opt = (g: Gear) => <option key={g.id} value={g.id}>{g.name}</option>
