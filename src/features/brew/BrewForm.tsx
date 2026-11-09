import { useState, type FormEvent } from 'react'
import { addBrew, deleteBrew, getSettings, listBeans, listBrews, listGear, updateBrew, useLive } from '../../db'
import { Button } from '../../components/Button'
import { NumberStepper } from '../../components/NumberStepper'
import { NumberField, SelectField, TextField } from '../../components/fields'
import {
  buildDraft, changedVariables, dialInChangeCount, draftFromBrew, findReferenceBrew, pickDefaultBeanId,
  pickDefaultMethod, type DraftSource,
} from '../../domain/brewDraft'
import { beverageG, daysOffRoast, formatRatio, freshness, ratio } from '../../domain/calc'
import { METHOD_PROFILES } from '../../domain/methods'
import { METHODS, type Bean, type Brew, type Gear, type Method } from '../../domain/types'
import { parseNumber } from '../formUtil'
import { formatDateTime, formatDuration, formatGrams } from '../format'
import { METHOD_LABEL } from '../labels'
import {
  brewToForm, draftToForm, formToDialValues, toDateTimeLocal, validateBrewForm, type BrewFormErrors, type BrewFormValues,
} from './brewForm'

/**
 * ฟอร์มบันทึกการชง
 * - `new`   : ชงใหม่ — เติมค่าจากครั้งล่าสุดของเมล็ด+วิธีนี้
 * - `repeat`: "ชงซ้ำ" — คัดลอกค่าตั้งจาก `brew` ทั้งหมด เวลา = ตอนนี้
 * - `edit`  : แก้ไข/ลบบันทึกเดิม
 */
export interface BrewFormProps {
  mode: 'new' | 'repeat' | 'edit'
  /** ต้นทางของ repeat หรือบันทึกที่แก้ไข */
  brew?: Brew
  onDone: (message?: string) => void
  onGoToBeans: () => void
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

const SOURCE_TEXT: Record<DraftSource, string> = {
  sameBean: 'เติมค่าจากการชงครั้งล่าสุดของเมล็ดนี้',
  sameMethod: 'เติมค่าจากการชงครั้งล่าสุดของวิธีนี้ (เมล็ดอื่น)',
  recipe: 'เติมค่าจากสูตรตั้งต้น',
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

function BrewFormInner({ mode, brew, onDone, onGoToBeans, beans, gear, brews, defaultMethod }: InnerProps) {
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
    const method = pickDefaultMethod(brews, defaultMethod)
    const beanId = pickDefaultBeanId(activeBeans, brews) ?? ''
    const r = buildDraft({ method, beanId: beanId || undefined, brews })
    return { values: draftToForm(r.draft, beanId, new Date()), reference: r.reference, source: r.source }
  })

  const [values, setValues] = useState<BrewFormValues>(init.values)
  const [reference, setReference] = useState<Brew | undefined>(init.reference)
  const [source, setSource] = useState<DraftSource | undefined>(init.source)
  const [errors, setErrors] = useState<BrewFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string>()

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

  const canRefill = mode !== 'edit'
  const onMethod = (method: Method) => (canRefill ? refill(method, values.beanId) : set('method', method))
  const onBean = (beanId: string) => (canRefill ? refill(values.method, beanId) : set('beanId', beanId))

  const bean = beans.find((b) => b.id === values.beanId)
  const profile = METHOD_PROFILES[values.method]
  const step = stepsFor(values.method)
  const grinder = grinders.find((g) => g.id === values.grinderId)
  const scale = grinder?.grindScale

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
  const grinderName = (id?: string) => (id ? (gear.find((g) => g.id === id)?.name ?? 'อุปกรณ์ที่ลบแล้ว') : 'ไม่ระบุ')

  async function run(action: () => Promise<unknown>, message: string) {
    setActionError(undefined)
    setSaving(true)
    try {
      await action()
      onDone(message)
    } catch {
      setActionError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
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
    if (mode === 'edit' && brew) void run(() => updateBrew(brew.id, result.value), 'แก้ไขบันทึกแล้ว')
    else void run(() => addBrew(result.value), 'บันทึกการชงแล้ว')
  }

  const title = mode === 'edit' ? 'แก้ไขบันทึกการชง' : mode === 'repeat' ? 'ชงซ้ำ' : 'บันทึกการชง'

  if (mode !== 'edit' && activeBeans.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>🫘</p>
          <p className="mt-2 font-medium">ต้องมีเมล็ดในคลังก่อนจึงบันทึกการชงได้</p>
          <Button variant="primary" className="mt-4" onClick={onGoToBeans}>ไปเพิ่มเมล็ด</Button>
        </div>
        <Button className="w-full" onClick={() => onDone()}>ย้อนกลับ</Button>
      </div>
    )
  }

  // เมล็ดที่เลือกอาจถูก Archive ไปแล้ว (ตอนแก้ไข/ชงซ้ำ) → ต้องยังเลือกได้
  const beanOptions = bean && bean.archived ? [bean, ...activeBeans] : activeBeans
  const gearOptions = (list: Gear[], selectedId: string) =>
    selectedId && !list.some((g) => g.id === selectedId)
      ? [<option key={selectedId} value={selectedId}>(อุปกรณ์ที่ลบแล้ว)</option>, ...list.map(opt)]
      : list.map(opt)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={title}>
      <h2 className="text-xl font-bold">{title}</h2>

      {mode !== 'edit' && source && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {SOURCE_TEXT[source]}
          {reference && ` · ${formatDateTime(reference.brewedAt)}`}
        </p>
      )}
      {mode === 'repeat' && brew && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          คัดลอกค่าจากการชงเมื่อ {formatDateTime(brew.brewedAt)} — ปรับได้ทีละอย่างแล้วกดบันทึก
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="วิธีชง" required value={values.method} onChange={(e) => onMethod(e.target.value as Method)}>
          {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
        </SelectField>
        <SelectField label="เมล็ด" required value={values.beanId} error={errors.beanId} onChange={(e) => onBean(e.target.value)}>
          {!values.beanId && <option value="">— เลือกเมล็ด —</option>}
          {beanOptions.map((b) => <option key={b.id} value={b.id}>{b.name}{b.archived ? ' (Archive)' : ''}</option>)}
        </SelectField>
      </div>

      {bean && (
        <p className="-mt-2 text-sm text-stone-600 dark:text-stone-400">
          {days !== undefined && days >= 0 && (
            <>
              คั่วมา {days} วัน{freshness(days) === 'tooFresh' ? ' (ควรพักก่อน)' : freshness(days) === 'stale' ? ' (ผ่านมานาน)' : ''}
              {' · '}
            </>
          )}
          เหลือ {formatGrams(Math.max(0, bean.remainingG))} g
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label="กาแฟ (g)" required value={values.doseG} step={step.dose} min={step.dose}
          start={dose ?? 15} error={errors.doseG} changedFrom={prev('doseG', ' g')}
          onChange={(v) => set('doseG', v)} />
        <NumberStepper label="น้ำ (g)" required value={values.waterG} step={step.water} min={step.water}
          start={water ?? 250} error={errors.waterG} changedFrom={prev('waterG', ' g')}
          onChange={(v) => set('waterG', v)} />
      </div>

      <p aria-live="polite" className="-mt-2 text-center text-lg font-semibold tabular-nums">
        {r !== undefined ? `อัตราส่วน ${formatRatio(r)}` : 'อัตราส่วน —'}
        {bev !== undefined && bev > 0 && (
          <span className="ml-2 text-sm font-normal text-stone-600 dark:text-stone-400">
            ได้เครื่องดื่ม ~{formatGrams(bev)} g{parseNumber(values.yieldG) ? '' : ' (ประมาณ)'}
          </span>
        )}
      </p>

      {grinders.length > 0 && (
        <div>
          <SelectField label="เครื่องบด" value={values.grinderId} onChange={(e) => set('grinderId', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {gearOptions(grinders, values.grinderId)}
          </SelectField>
          {changed.has('grinderId') && (
            <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
              ▲ เปลี่ยน · ครั้งก่อน {grinderName(reference?.grinderId)}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label="เบอร์บด" value={values.grindSetting}
          step={scale?.step ?? 1} min={scale?.min ?? 0} max={scale?.max}
          start={reference?.grindSetting ?? (scale ? scale.min : undefined)}
          hint={scale ? `ช่วง ${scale.min}–${scale.max}` : undefined}
          error={errors.grindSetting} changedFrom={prev('grindSetting', '')}
          onChange={(v) => set('grindSetting', v)} />
        <NumberStepper label="อุณหภูมิ (°C)" value={values.tempC} step={1} min={0} max={100}
          start={reference?.tempC ?? 93}
          hint={profile.tempRangeC ? `แนะนำ ${profile.tempRangeC[0]}–${profile.tempRangeC[1]}` : undefined}
          error={errors.tempC} changedFrom={prev('tempC', ' °C')}
          onChange={(v) => set('tempC', v)} />
      </div>

      {changeCount >= 2 && (
        <p role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          เปลี่ยน {changeCount} ตัวแปรพร้อมกัน — จะดูยากว่าอะไรทำให้รสเปลี่ยน ลองปรับทีละอย่าง
        </p>
      )}

      <NumberStepper label="เวลาชง (วินาที)" value={values.totalTimeSec} step={5} min={5} start={profile.timeRangeSec[0]}
        hint={`${parseNumber(values.totalTimeSec) ? `= ${formatDuration(parseNumber(values.totalTimeSec)!)} · ` : ''}เป้าหมาย ${formatDuration(profile.timeRangeSec[0])}–${formatDuration(profile.timeRangeSec[1])}`}
        error={errors.totalTimeSec} onChange={(v) => set('totalTimeSec', v)} />

      <details className="rounded-2xl border border-stone-200 p-3 dark:border-stone-700">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary>
        <div className="mt-2 space-y-4">
          {brewers.length > 0 && (
            <SelectField label="อุปกรณ์ชง" value={values.brewerId} onChange={(e) => set('brewerId', e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {gearOptions(brewers, values.brewerId)}
            </SelectField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="น้ำหนักเครื่องดื่มจริง (g)" value={values.yieldG} error={errors.yieldG}
              hint="เว้นว่าง = ประมาณให้" onChange={(e) => set('yieldG', e.target.value)} />
            <NumberField label="TDS (%)" value={values.tds} error={errors.tds}
              hint="ถ้ามี Refractometer" onChange={(e) => set('tds', e.target.value)} />
          </div>
          <TextField label="วันและเวลาที่ชง" type="datetime-local" value={values.brewedAt} error={errors.brewedAt}
            max={toDateTimeLocal(new Date())} onChange={(e) => set('brewedAt', e.target.value)} />
        </div>
      </details>

      {lowStock && bean && (
        <p role="status" className="rounded-xl bg-orange-50 p-3 text-sm font-medium text-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
          เมล็ดเหลือ {formatGrams(Math.max(0, bean.remainingG))} g น้อยกว่าที่ใช้ — ยังบันทึกได้ (ยอดคงเหลือจะเป็น 0)
        </p>
      )}
      {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{actionError}</p>}

      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onDone()} disabled={saving}>ยกเลิก</Button>
        <Button variant="primary" type="submit" className="flex-1" disabled={saving}>บันทึก</Button>
      </div>

      {mode === 'edit' && brew && (
        <div className="border-t border-stone-200 pt-4 dark:border-stone-700">
          {!confirmDelete ? (
            <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" disabled={saving} onClick={() => setConfirmDelete(true)}>
              ลบบันทึกนี้
            </Button>
          ) : (
            <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium">ลบบันทึกนี้ถาวร? น้ำหนักกาแฟ {formatGrams(brew.doseG)} g จะถูกคืนเข้ายอดคงเหลือของเมล็ด</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>ไม่ลบ</Button>
                <Button variant="danger" className="flex-1" disabled={saving} onClick={() => void run(() => deleteBrew(brew.id), 'ลบบันทึกแล้ว')}>
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

const opt = (g: Gear) => <option key={g.id} value={g.id}>{g.name}</option>
