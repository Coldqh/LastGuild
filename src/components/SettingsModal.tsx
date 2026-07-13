import { Download, DownloadCloud, RefreshCcw, Save, Settings, ShieldCheck, Swords, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { GameState } from '../types/game'
import { DIFFICULTY_RULES } from '../game/worldSettings'
import { deleteSaveSlot, downloadGameSave, importGameSave, listSaveSlots, loadBackup, loadFromSlot, saveToSlot } from '../game/storage'
import type { AppPreferences } from '../game/preferences'

interface Props {
  state: GameState
  preferences: AppPreferences
  onPreferencesChange: (preferences: AppPreferences) => void
  onLoadState: (state: GameState) => void
  onClose: () => void
  onNewWorld: () => void
  onForceUpdate: () => Promise<void>
}

export default function SettingsModal({ state, preferences, onPreferencesChange, onLoadState, onClose, onNewWorld, onForceUpdate }: Props) {
  const [updating, setUpdating] = useState(false)
  const [slotRevision, setSlotRevision] = useState(0)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const slots = useMemo(() => listSaveSlots(), [slotRevision])

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

  return (
    <div className="modal-backdrop settings-backdrop" onClick={onClose}>
      <article className="settings-modal paper-card" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-detail" onClick={onClose}><X size={18} /></button>
        <div className="section-title"><Settings size={21} /><div><p className="eyebrow">Система</p><h2>Настройки игры</h2></div></div>
        <div className="settings-version-card">
          <div><ShieldCheck /><span><strong>THE LAST GUILD v0.5.1</strong><small>Первый месяц, обучение, сохранения и управление сложностью</small></span></div>
          <span className="version-chip">save v6</span>
        </div>

        <div className="settings-grid">
          <article><Save size={19} /><div><h3>Текущее сохранение</h3><p>Seed: <b>{state.seed}</b></p><p>{state.year} год, день {state.day} · {state.characters.filter((character) => character.employed).length} сотрудников</p></div></article>
          <article><RefreshCcw size={19} /><div><h3>Параметры мира</h3><p>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</p><p>{state.world.width}×{state.world.height} · {state.world.realms.length} государств</p></div></article>
        </div>

        <section className="settings-section">
          <div className="settings-section-title"><Swords size={18} /><div><h3>Конкурирующие гильдии</h3><p>Можно полностью убрать гонки, переманивание людей и чужие экспедиции.</p></div></div>
          <label className="settings-toggle"><span><strong>Включить конкурентов</strong><small>{preferences.competitorsEnabled ? `${state.rivalGuilds.length} организаций действуют в мире` : 'Регион принадлежит только гильдии игрока'}</small></span><input type="checkbox" checked={preferences.competitorsEnabled} onChange={(event) => onPreferencesChange({ ...preferences, competitorsEnabled: event.target.checked })} /></label>
          <label className="settings-toggle"><span><strong>Показывать обучение</strong><small>Пошаговые задачи для первого игрового цикла.</small></span><input type="checkbox" checked={preferences.tutorialEnabled} onChange={(event) => onPreferencesChange({ ...preferences, tutorialEnabled: event.target.checked })} /></label>
          <label className="settings-toggle"><span><strong>Центр решений в штабе</strong><small>Контракты, раненые, кризисы и события в одной панели.</small></span><input type="checkbox" checked={preferences.decisionCenterEnabled} onChange={(event) => onPreferencesChange({ ...preferences, decisionCenterEnabled: event.target.checked })} /></label>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><Save size={18} /><div><h3>Ручные сохранения</h3><p>Автосохранение продолжает работать отдельно.</p></div></div>
          <div className="save-toolbar"><button className="secondary-button" onClick={createSlot}><Save size={15} />Создать слот</button><button className="secondary-button" onClick={() => downloadGameSave(state)}><Download size={15} />Экспортировать</button><button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} />Импортировать</button><button className="secondary-button" onClick={() => { const backup = loadBackup(); if (backup) { onLoadState(backup); setMessage('Резервная копия восстановлена.') } else setMessage('Резервная копия не найдена.') }}><RefreshCcw size={15} />Резерв</button><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></div>
          <div className="save-slot-list">
            {slots.length === 0 && <p className="muted">Ручных слотов пока нет.</p>}
            {slots.map((slot) => <div key={slot.id}><span><strong>{slot.name}</strong><small>{slot.year} год, день {slot.day} · {slot.seed}</small></span><button className="text-button" onClick={() => { const loaded = loadFromSlot(slot.id); if (loaded) { onLoadState(loaded); setMessage('Слот загружен.') } }}>Загрузить</button><button className="icon-button" title="Удалить" onClick={() => { deleteSaveSlot(slot.id); setSlotRevision((value) => value + 1) }}><Trash2 size={15} /></button></div>)}
          </div>
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
