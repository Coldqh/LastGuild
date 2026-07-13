import {
  Activity,
  Bug,
  Download,
  DownloadCloud,
  HeartPulse,
  Map,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  Skull,
  Swords,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { GameState } from '../types/game'
import { DIFFICULTY_RULES } from '../game/worldSettings'
import { deleteSaveSlot, downloadGameSave, importGameSave, listSaveSlots, loadBackup, loadFromSlot, saveToSlot } from '../game/storage'
import type { AppPreferences } from '../game/preferences'
import {
  devAddResources,
  devCreateCrisis,
  devCreateWar,
  devFinishExpeditions,
  devHealRoster,
  devRevealMap,
  downloadDebugLog,
  runSimulationAudit,
  type SimulationAuditResult,
} from '../game/devTools'

interface Props {
  state: GameState
  preferences: AppPreferences
  onPreferencesChange: (preferences: AppPreferences) => void
  onLoadState: (state: GameState) => void
  onClose: () => void
  onNewWorld: () => void
  onForceUpdate: () => Promise<void>
}

interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="settings-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

export default function SettingsModal({ state, preferences, onPreferencesChange, onLoadState, onClose, onNewWorld, onForceUpdate }: Props) {
  const [updating, setUpdating] = useState(false)
  const [slotRevision, setSlotRevision] = useState(0)
  const [message, setMessage] = useState('')
  const [auditYears, setAuditYears] = useState(10)
  const [audit, setAudit] = useState<SimulationAuditResult>()
  const [auditing, setAuditing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const slots = useMemo(() => listSaveSlots(), [slotRevision])

  const patchPreference = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    onPreferencesChange({ ...preferences, [key]: value })
  }

  const runUpdate = async () => {
    setUpdating(true)
    try { await onForceUpdate() } finally { setUpdating(false) }
  }

  const createSlot = () => {
    const id = `${Date.now()}`
    saveToSlot(state, id, `Кампания ${slots.length + 1}`)
    setSlotRevision((value) => value + 1)
    setMessage('Ручное сохранение создано.')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    const imported = importGameSave(await file.text())
    if (!imported) { setMessage('Файл не является корректным сохранением The Last Guild.'); return }
    onLoadState(imported)
    setMessage('Сохранение импортировано и загружено.')
  }

  const runAudit = () => {
    setAuditing(true)
    setMessage('')
    window.setTimeout(() => {
      try {
        const result = runSimulationAudit(state, auditYears)
        setAudit(result)
        setMessage(`Аудит ${result.years} лет завершён за ${result.elapsedMs} мс.`)
      } finally {
        setAuditing(false)
      }
    }, 30)
  }

  return (
    <div className="modal-backdrop settings-backdrop" onClick={onClose}>
      <article className="settings-modal paper-card" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-detail" onClick={onClose}><X size={18} /></button>
        <div className="section-title"><Settings size={21} /><div><p className="eyebrow">Система</p><h2>Настройки игры</h2></div></div>
        <div className="settings-version-card">
          <div><ShieldCheck /><span><strong>THE LAST GUILD v0.6.1</strong><small>Стабильность, производительность и управление симуляцией</small></span></div>
          <span className="version-chip">save v7</span>
        </div>

        <div className="settings-grid">
          <article><Save size={19} /><div><h3>Текущее сохранение</h3><p>Seed: <b>{state.seed}</b></p><p>{state.year} год, день {state.day} · {state.characters.filter((character) => character.employed).length} сотрудников</p></div></article>
          <article><RefreshCcw size={19} /><div><h3>Параметры мира</h3><p>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</p><p>{state.world.width}×{state.world.height} · {state.world.realms.length} государств</p></div></article>
        </div>

        <section className="settings-section">
          <div className="settings-section-title"><Swords size={18} /><div><h3>Организации и интерфейс</h3><p>Настройки не удаляют сохранение и применяются сразу.</p></div></div>
          <Toggle label="Включить конкурентов" description={preferences.competitorsEnabled ? `${state.rivalGuilds.length} организаций действуют в мире` : 'Чужие гильдии и их экспедиции отключены'} checked={preferences.competitorsEnabled} onChange={(value) => patchPreference('competitorsEnabled', value)} />
          <Toggle label="Переманивание сотрудников" description="Конкуренты могут нанимать свободных сильных кандидатов." checked={preferences.poachingEnabled} onChange={(value) => patchPreference('poachingEnabled', value)} />
          <Toggle label="Отделение филиалов" description="Автономный нелояльный филиал может стать новой гильдией." checked={preferences.branchSecessionEnabled} onChange={(value) => patchPreference('branchSecessionEnabled', value)} />
          <Toggle label="Показывать обучение" description="Пошаговые задачи первого игрового цикла." checked={preferences.tutorialEnabled} onChange={(value) => patchPreference('tutorialEnabled', value)} />
          <Toggle label="Центр решений в штабе" description="Контракты, раненые, кризисы и события в одной панели." checked={preferences.decisionCenterEnabled} onChange={(value) => patchPreference('decisionCenterEnabled', value)} />
          <Toggle label="Компактные карточки" description="Уменьшает отступы и высоту списков на насыщенных экранах." checked={preferences.compactCardsEnabled} onChange={(value) => patchPreference('compactCardsEnabled', value)} />
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><Activity size={18} /><div><h3>Тяжёлые системы мира</h3><p>Каждый блок можно отключить отдельно.</p></div></div>
          <Toggle label="Войны" description="Создание и развитие межгосударственных войн." checked={preferences.warsEnabled} onChange={(value) => patchPreference('warsEnabled', value)} />
          <Toggle label="Мировые кризисы" description="Эпидемии, восстания, бури и политические потрясения." checked={preferences.crisesEnabled} onChange={(value) => patchPreference('crisesEnabled', value)} />
          <Toggle label="Экономический упадок" description="Города могут беднеть, терять население и торговлю." checked={preferences.economicDeclineEnabled} onChange={(value) => patchPreference('economicDeclineEnabled', value)} />
          <Toggle label="Смена границ" description="Войны могут передавать поселения другому государству." checked={preferences.borderChangesEnabled} onChange={(value) => patchPreference('borderChangesEnabled', value)} />
          <Toggle label="Разрушение городов" description="Поселения могут погибать и превращаться в руины." checked={preferences.cityDestructionEnabled} onChange={(value) => patchPreference('cityDestructionEnabled', value)} />
          <Toggle label="Старение персонажей" description="Возраст растёт, ветераны уходят из полевой службы." checked={preferences.agingEnabled} onChange={(value) => patchPreference('agingEnabled', value)} />
          <Toggle label="Смерть от старости" description="Очень старые персонажи могут умереть естественной смертью." checked={preferences.oldAgeDeathEnabled} onChange={(value) => patchPreference('oldAgeDeathEnabled', value)} />
          <label className="settings-slider"><span><strong>Лимит хроники</strong><small>Старые записи архивируются для сохранения производительности.</small></span><input type="range" min="300" max="3000" step="100" value={preferences.maxChronicleEntries} onChange={(event) => patchPreference('maxChronicleEntries', Number(event.target.value))} /><b>{preferences.maxChronicleEntries}</b></label>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><Save size={18} /><div><h3>Ручные сохранения</h3><p>Автосохранение продолжает работать отдельно.</p></div></div>
          <div className="save-toolbar"><button className="secondary-button" onClick={createSlot}><Save size={15} />Создать слот</button><button className="secondary-button" onClick={() => downloadGameSave(state)}><Download size={15} />Экспортировать</button><button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} />Импортировать</button><button className="secondary-button" onClick={() => { const backup = loadBackup(); if (backup) { onLoadState(backup); setMessage('Резервная копия восстановлена.') } else setMessage('Резервная копия не найдена.') }}><RefreshCcw size={15} />Резерв</button><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></div>
          <div className="save-slot-list">
            {slots.length === 0 && <p className="muted">Ручных слотов пока нет.</p>}
            {slots.map((slot) => <div key={slot.id}><span><strong>{slot.name}</strong><small>{slot.year} год, день {slot.day} · {slot.seed}</small></span><button className="text-button" onClick={() => { const loaded = loadFromSlot(slot.id); if (loaded) { onLoadState(loaded); setMessage('Слот загружен.') } }}>Загрузить</button><button className="icon-button" title="Удалить" onClick={() => { deleteSaveSlot(slot.id); setSlotRevision((value) => value + 1) }}><Trash2 size={15} /></button></div>)}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><Bug size={18} /><div><h3>Инструменты разработки</h3><p>Скрытые команды для тестирования патчей и баланса.</p></div></div>
          <Toggle label="Включить dev-панель" description="Открывает отладочные команды и симуляционный аудит." checked={preferences.devToolsEnabled} onChange={(value) => patchPreference('devToolsEnabled', value)} />
          {preferences.devToolsEnabled && <div className="dev-panel">
            <div className="dev-actions">
              <button onClick={() => onLoadState(devAddResources(state))}><Zap size={15} />+ ресурсы</button>
              <button onClick={() => onLoadState(devRevealMap(state))}><Map size={15} />Открыть карту</button>
              <button onClick={() => onLoadState(devHealRoster(state))}><HeartPulse size={15} />Вылечить людей</button>
              <button onClick={() => onLoadState(devFinishExpeditions(state))}><Users size={15} />Завершить походы</button>
              <button onClick={() => onLoadState(devCreateCrisis(state))}><Skull size={15} />Создать кризис</button>
              <button onClick={() => onLoadState(devCreateWar(state))}><Swords size={15} />Создать войну</button>
            </div>
            <div className="audit-controls">
              <label><span>Горизонт аудита</span><select value={auditYears} onChange={(event) => setAuditYears(Number(event.target.value))}><option value={1}>1 год</option><option value={10}>10 лет</option><option value={50}>50 лет</option><option value={100}>100 лет</option></select></label>
              <button className="secondary-button" disabled={auditing} onClick={runAudit}><Activity size={15} />{auditing ? 'Симуляция…' : 'Запустить аудит'}</button>
              <button className="secondary-button" onClick={() => downloadDebugLog(state, audit)}><Download size={15} />Журнал отладки</button>
            </div>
            {audit && <div className="audit-result">
              <div><b>{audit.elapsedMs} мс</b><small>время расчёта</small></div>
              <div><b>{audit.populationChange > 0 ? '+' : ''}{audit.populationChange}%</b><small>население</small></div>
              <div><b>{audit.ruinedSettlements}</b><small>руин-городов</small></div>
              <div><b>{audit.activeWars}</b><small>активных войн</small></div>
              <div><b>{audit.abandonedRoutes}</b><small>мёртвых путей</small></div>
              <ul>{audit.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>}
          </div>}
        </section>

        {message && <p className="settings-message">{message}</p>}
        <div className="settings-actions">
          <button className="secondary-button" onClick={onNewWorld}><RefreshCcw size={16} />Создать новый мир</button>
          <button className="primary-button force-update-button" disabled={updating} onClick={runUpdate}><DownloadCloud size={17} />{updating ? 'Очистка кэша…' : 'Принудительно обновить игру'}</button>
        </div>
        <p className="settings-note">Перед импортом сохраняется резервная копия текущей кампании. Принудительное обновление очищает кэш приложения, но не удаляет игровые сохранения.</p>
      </article>
    </div>
  )
}
