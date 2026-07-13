import { DownloadCloud, RefreshCcw, Save, Settings, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import type { GameState } from '../types/game'
import { DIFFICULTY_RULES } from '../game/worldSettings'

interface Props {
  state: GameState
  onClose: () => void
  onNewWorld: () => void
  onForceUpdate: () => Promise<void>
}

export default function SettingsModal({ state, onClose, onNewWorld, onForceUpdate }: Props) {
  const [updating, setUpdating] = useState(false)
  const runUpdate = async () => {
    setUpdating(true)
    try { await onForceUpdate() } finally { setUpdating(false) }
  }
  return (
    <div className="modal-backdrop settings-backdrop" onClick={onClose}>
      <article className="settings-modal paper-card" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-detail" onClick={onClose}><X size={18} /></button>
        <div className="section-title"><Settings size={21} /><div><p className="eyebrow">Система</p><h2>Настройки игры</h2></div></div>
        <div className="settings-version-card">
          <div><ShieldCheck /><span><strong>THE LAST GUILD v0.4</strong><small>Бой, подземелья и чудовища</small></span></div>
          <span className="version-chip">save v5</span>
        </div>
        <div className="settings-grid">
          <article>
            <Save size={19} /><div><h3>Текущее сохранение</h3><p>Seed: <b>{state.seed}</b></p><p>{state.year} год, день {state.day} · {state.characters.filter((character) => character.employed).length} сотрудников</p></div>
          </article>
          <article>
            <RefreshCcw size={19} /><div><h3>Параметры мира</h3><p>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</p><p>{state.world.width}×{state.world.height} · {state.world.realms.length} государств</p></div>
          </article>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={onNewWorld}><RefreshCcw size={16} />Создать новый мир</button>
          <button className="primary-button force-update-button" disabled={updating} onClick={runUpdate}><DownloadCloud size={17} />{updating ? 'Очистка кэша…' : 'Принудительно обновить игру'}</button>
        </div>
        <p className="settings-note">Кнопка сохраняет текущую кампанию, удаляет браузерный кэш приложения, проверяет сервис-воркеры и перезагружает страницу с новым cache-bust параметром. Сохранение не удаляется.</p>
      </article>
    </div>
  )
}
