import {
  Activity,
  Bug,
  ChevronLeft,
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
import { contentRepeatRate } from '../game/campaign'
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

type SettingsTab = 'general' | 'world' | 'saves' | 'dev'

const tabs: Array<{ id: SettingsTab; label: string; short: string; icon: typeof Settings }> = [
  { id: 'general', label: 'Основное', short: 'Интерфейс и организации', icon: Settings },
  { id: 'world', label: 'Симуляция', short: 'Войны, кризисы и старение', icon: Activity },
  { id: 'saves', label: 'Сохранения', short: 'Слоты, импорт и экспорт', icon: Save },
  { id: 'dev', label: 'Разработка', short: 'Тесты и аудит', icon: Bug },
]

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="settings-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

export default function SettingsModal({ state, preferences, onPreferencesChange, onLoadState, onClose, onNewWorld, onForceUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
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
        <header className="settings-modal-header">
          <div>
            <p className="eyebrow">Система</p>
            <h2>Настройки</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть настройки"><X size={18} /></button>
        </header>

        <div className={`settings-layout ${mobilePanelOpen ? 'mobile-panel-open' : 'mobile-menu-open'}`}>
          <nav className="settings-category-nav" aria-label="Разделы настроек">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => { setActiveTab(tab.id); setMobilePanelOpen(true) }}>
                  <Icon size={17} />
                  <span><strong>{tab.label}</strong><small>{tab.short}</small></span>
                </button>
              )
            })}
          </nav>

          <div className="settings-content">
            <div className="settings-mobile-section-header">
              <button className="settings-mobile-back" onClick={() => setMobilePanelOpen(false)}><ChevronLeft size={18} />Разделы</button>
              <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
            </div>
            {message && <p className="settings-message">{message}</p>}

            {activeTab === 'general' && <>
              <section className="settings-hero-card">
                <div><ShieldCheck size={20} /><span><strong>THE LAST GUILD v0.8.3.2</strong><small>Полная мобильная перестройка интерфейса</small></span></div>
                <span className="version-chip">save v10</span>
              </section>

              <div className="settings-summary-grid">
                <article><Save size={18} /><div><h3>Кампания</h3><p>{state.year} год, день {state.day}</p><small>{state.characters.filter((character) => character.employed).length} сотрудников</small></div></article>
                <article><RefreshCcw size={18} /><div><h3>Мир</h3><p>{state.settings.preset}</p><small>{DIFFICULTY_RULES[state.settings.difficulty].label}</small></div></article>
              </div>

              <section className="settings-panel-section">
                <div className="settings-section-title"><Swords size={18} /><div><h3>Организации</h3><p>Внешняя конкуренция и автономия филиалов.</p></div></div>
                <Toggle label="Конкурирующие гильдии" description={preferences.competitorsEnabled ? `${state.rivalGuilds.length} организаций активны` : 'Полностью отключены'} checked={preferences.competitorsEnabled} onChange={(value) => patchPreference('competitorsEnabled', value)} />
                <Toggle label="Переманивание сотрудников" description="Конкуренты могут забирать сильных кандидатов." checked={preferences.poachingEnabled} onChange={(value) => patchPreference('poachingEnabled', value)} />
                <Toggle label="Отделение филиалов" description="Нелояльный филиал может стать отдельной гильдией." checked={preferences.branchSecessionEnabled} onChange={(value) => patchPreference('branchSecessionEnabled', value)} />
              </section>

              <section className="settings-panel-section">
                <div className="settings-section-title"><Settings size={18} /><div><h3>Интерфейс</h3><p>Только то, что влияет на плотность экрана.</p></div></div>
                <Toggle label="Обучение" description="Показывать пошаговые задачи первого цикла." checked={preferences.tutorialEnabled} onChange={(value) => patchPreference('tutorialEnabled', value)} />
                <Toggle label="Центр решений" description="Показывать важные события в штабе." checked={preferences.decisionCenterEnabled} onChange={(value) => patchPreference('decisionCenterEnabled', value)} />
                <Toggle label="Компактные карточки" description="Ещё сильнее уменьшает списки и отступы." checked={preferences.compactCardsEnabled} onChange={(value) => patchPreference('compactCardsEnabled', value)} />
              </section>

              <div className="settings-primary-actions">
                <button className="secondary-button" onClick={onNewWorld}><RefreshCcw size={16} />Новый мир</button>
                <button className="primary-button force-update-button" disabled={updating} onClick={runUpdate}><DownloadCloud size={17} />{updating ? 'Обновление…' : 'Обновить игру'}</button>
              </div>
              <p className="settings-note">Обновление очищает кэш, но не удаляет кампанию.</p>
            </>}

            {activeTab === 'world' && <section className="settings-panel-section settings-panel-section-first">
              <div className="settings-section-title"><Activity size={18} /><div><h3>Симуляция мира</h3><p>Отключай тяжёлые системы отдельно.</p></div></div>
              <Toggle label="Войны" description="Межгосударственные конфликты и их развитие." checked={preferences.warsEnabled} onChange={(value) => patchPreference('warsEnabled', value)} />
              <Toggle label="Мировые кризисы" description="Эпидемии, восстания и катастрофы." checked={preferences.crisesEnabled} onChange={(value) => patchPreference('crisesEnabled', value)} />
              <Toggle label="Экономический упадок" description="Города могут беднеть и терять торговлю." checked={preferences.economicDeclineEnabled} onChange={(value) => patchPreference('economicDeclineEnabled', value)} />
              <Toggle label="Смена границ" description="Войны могут передавать поселения." checked={preferences.borderChangesEnabled} onChange={(value) => patchPreference('borderChangesEnabled', value)} />
              <Toggle label="Разрушение городов" description="Поселения могут превращаться в руины." checked={preferences.cityDestructionEnabled} onChange={(value) => patchPreference('cityDestructionEnabled', value)} />
              <Toggle label="Старение персонажей" description="Возраст и уход из полевой службы." checked={preferences.agingEnabled} onChange={(value) => patchPreference('agingEnabled', value)} />
              <Toggle label="Смерть от старости" description="Естественная смерть пожилых героев." checked={preferences.oldAgeDeathEnabled} onChange={(value) => patchPreference('oldAgeDeathEnabled', value)} />
              <label className="settings-slider"><span><strong>Лимит хроники</strong><small>Старые записи архивируются автоматически.</small></span><input type="range" min="300" max="3000" step="100" value={preferences.maxChronicleEntries} onChange={(event) => patchPreference('maxChronicleEntries', Number(event.target.value))} /><b>{preferences.maxChronicleEntries}</b></label>
            </section>}

            {activeTab === 'saves' && <section className="settings-panel-section settings-panel-section-first">
              <div className="settings-section-title"><Save size={18} /><div><h3>Сохранения</h3><p>Автосохранение работает отдельно.</p></div></div>
              <div className="save-toolbar">
                <button className="secondary-button" onClick={createSlot}><Save size={15} />Создать слот</button>
                <button className="secondary-button" onClick={() => downloadGameSave(state)}><Download size={15} />Экспорт</button>
                <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} />Импорт</button>
                <button className="secondary-button" onClick={() => { const backup = loadBackup(); if (backup) { onLoadState(backup); setMessage('Резервная копия восстановлена.') } else setMessage('Резервная копия не найдена.') }}><RefreshCcw size={15} />Резерв</button>
                <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
              </div>
              <div className="save-slot-list">
                {slots.length === 0 && <p className="muted">Ручных слотов пока нет.</p>}
                {slots.map((slot) => <div key={slot.id}><span><strong>{slot.name}</strong><small>{slot.year} год, день {slot.day}</small></span><button className="text-button" onClick={() => { const loaded = loadFromSlot(slot.id); if (loaded) { onLoadState(loaded); setMessage('Слот загружен.') } }}>Загрузить</button><button className="icon-button" title="Удалить" onClick={() => { deleteSaveSlot(slot.id); setSlotRevision((value) => value + 1) }}><Trash2 size={15} /></button></div>)}
              </div>
            </section>}

            {activeTab === 'dev' && <section className="settings-panel-section settings-panel-section-first">
              <div className="settings-section-title"><Bug size={18} /><div><h3>Разработка</h3><p>Отладочные команды и аудит баланса.</p></div></div>
              <Toggle label="Включить dev-панель" description="Показывает тестовые команды." checked={preferences.devToolsEnabled} onChange={(value) => patchPreference('devToolsEnabled', value)} />
              {preferences.devToolsEnabled && <div className="dev-panel">
                <div className="dev-actions">
                  <button onClick={() => onLoadState(devAddResources(state))}><Zap size={15} />Ресурсы</button>
                  <button onClick={() => onLoadState(devRevealMap(state))}><Map size={15} />Карта</button>
                  <button onClick={() => onLoadState(devHealRoster(state))}><HeartPulse size={15} />Лечение</button>
                  <button onClick={() => onLoadState(devFinishExpeditions(state))}><Users size={15} />Походы</button>
                  <button onClick={() => onLoadState(devCreateCrisis(state))}><Skull size={15} />Кризис</button>
                  <button onClick={() => onLoadState(devCreateWar(state))}><Swords size={15} />Война</button>
                </div>
                <div className={`content-validator-result ${state.contentValidation.some((issue) => issue.severity === 'error') ? 'danger' : ''}`}>
                  <ShieldCheck size={16} />
                  <span><strong>Валидатор контента</strong><small>{state.contentValidation.length === 0 ? 'Проблем не найдено.' : `Проблем: ${state.contentValidation.length}`}</small></span>
                </div>
                <div className="content-telemetry-grid">
                  <div><b>{state.campaign.telemetry.totalEvents}</b><small>событий</small></div>
                  <div><b>{Object.keys(state.campaign.telemetry.eventCounts).length}</b><small>уникальных</small></div>
                  <div><b>{contentRepeatRate(state)}%</b><small>повторы</small></div>
                  <div><b>{state.storyChains.filter((chain) => chain.status === 'active').length}</b><small>цепочек</small></div>
                </div>
                <div className="audit-controls">
                  <label><span>Аудит</span><select value={auditYears} onChange={(event) => setAuditYears(Number(event.target.value))}><option value={1}>1 год</option><option value={10}>10 лет</option><option value={50}>50 лет</option><option value={100}>100 лет</option></select></label>
                  <button className="secondary-button" disabled={auditing} onClick={runAudit}><Activity size={15} />{auditing ? 'Считаю…' : 'Запустить'}</button>
                  <button className="secondary-button" onClick={() => downloadDebugLog(state, audit)}><Download size={15} />Журнал</button>
                </div>
                {audit && <div className="audit-result">
                  <div><b>{audit.elapsedMs} мс</b><small>расчёт</small></div>
                  <div><b>{audit.populationChange > 0 ? '+' : ''}{audit.populationChange}%</b><small>население</small></div>
                  <div><b>{audit.ruinedSettlements}</b><small>руины</small></div>
                  <div><b>{audit.activeWars}</b><small>войны</small></div>
                  <div><b>{audit.abandonedRoutes}</b><small>пути</small></div>
                  <ul>{audit.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>}
              </div>}
            </section>}
          </div>
        </div>
      </article>
    </div>
  )
}
