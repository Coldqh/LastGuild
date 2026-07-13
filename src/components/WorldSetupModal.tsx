import { Castle, Dice5, Flame, Globe2, History, Mountain, ShieldAlert, Sparkles, Swords, Trees, X } from 'lucide-react'
import type { WorldGenerationSettings, WorldPresetId } from '../types/game'
import { applyPreset, DIFFICULTY_RULES, markCustom, worldSize } from '../game/worldSettings'

interface Props {
  settings: WorldGenerationSettings
  seed: string
  onSeedChange: (seed: string) => void
  onSettingsChange: (settings: WorldGenerationSettings) => void
  onClose: () => void
  onCreate: () => void
}

const presets: Array<{ id: Exclude<WorldPresetId, 'custom'>; title: string; text: string; icon: typeof Globe2 }> = [
  { id: 'classic', title: 'Классическое фэнтези', text: 'Сбалансированные королевства, магия, руины и опасности.', icon: Globe2 },
  { id: 'fallen_empires', title: 'Павшие империи', text: 'Древний мир, мало живых городов, много руин и старых тайн.', icon: History },
  { id: 'wild_frontier', title: 'Дикий фронтир', text: 'Огромные неизвестные земли, чудовища и нестабильная магия.', icon: Trees },
  { id: 'age_of_war', title: 'Эпоха войны', text: 'Много государств, спорные границы, тяжёлая сложность.', icon: Swords },
]

const optionLabel: Record<string, string> = {
  compact: 'Компактная', regional: 'Региональная', vast: 'Огромная',
  sparse: 'Редко', normal: 'Обычно', dense: 'Плотно',
  young: 'Молодой мир', old: 'Старая история', ancient: 'Древний мир',
  calm: 'Спокойный', turbulent: 'Нестабильный', war_torn: 'Разорённый войнами',
  rare: 'Редкая', common: 'Распространённая', wild: 'Дикая',
  temperate: 'Умеренный', varied: 'Разнообразный', harsh: 'Суровый',
  story: 'История', standard: 'Стандарт', hard: 'Тяжело', brutal: 'Жестоко',
}

export default function WorldSetupModal({ settings, seed, onSeedChange, onSettingsChange, onClose, onCreate }: Props) {
  const size = worldSize(settings)
  const set = <K extends keyof WorldGenerationSettings>(key: K, value: WorldGenerationSettings[K]) => onSettingsChange(markCustom(settings, { [key]: value }))
  const randomSeed = () => onSeedChange(`world-${Math.random().toString(36).slice(2, 10)}`)

  return (
    <div className="modal-backdrop world-setup-backdrop" onClick={onClose}>
      <article className="world-setup-modal paper-card" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-detail" onClick={onClose}><X size={18} /></button>
        <header className="world-setup-header">
          <div><p className="eyebrow">Новая кампания · World Generator v0.2</p><h2>Какой мир получит гильдия?</h2><p>Все параметры реально участвуют в генерации карты, истории, государств, руин, монстров и сложности экспедиций.</p></div>
          <div className="world-build-summary"><strong>{size.width}×{size.height}</strong><span>{settings.realmCount} государств</span><small>{DIFFICULTY_RULES[settings.difficulty].label}</small></div>
        </header>

        <section className="preset-grid">
          {presets.map((preset) => {
            const Icon = preset.icon
            return <button key={preset.id} className={settings.preset === preset.id ? 'active' : ''} onClick={() => onSettingsChange(applyPreset(preset.id))}><Icon size={21} /><strong>{preset.title}</strong><span>{preset.text}</span></button>
          })}
        </section>

        <div className="world-settings-grid">
          <section>
            <h3><Mountain size={17} /> География и заселение</h3>
            <label><span>Размер карты</span><select value={settings.mapSize} onChange={(e) => set('mapSize', e.target.value as WorldGenerationSettings['mapSize'])}>{['compact', 'regional', 'vast'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Число государств <b>{settings.realmCount}</b></span><input type="range" min="3" max="8" value={settings.realmCount} onChange={(e) => set('realmCount', Number(e.target.value))} /></label>
            <label><span>Поселения</span><select value={settings.settlementDensity} onChange={(e) => set('settlementDensity', e.target.value as WorldGenerationSettings['settlementDensity'])}>{['sparse', 'normal', 'dense'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Климат</span><select value={settings.climate} onChange={(e) => set('climate', e.target.value as WorldGenerationSettings['climate'])}>{['temperate', 'varied', 'harsh'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
          </section>

          <section>
            <h3><History size={17} /> История мира</h3>
            <label><span>Глубина истории</span><select value={settings.historyDepth} onChange={(e) => set('historyDepth', e.target.value as WorldGenerationSettings['historyDepth'])}>{['young', 'old', 'ancient'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Политическая обстановка</span><select value={settings.conflictLevel} onChange={(e) => set('conflictLevel', e.target.value as WorldGenerationSettings['conflictLevel'])}>{['calm', 'turbulent', 'war_torn'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Плотность руин</span><select value={settings.ruinDensity} onChange={(e) => set('ruinDensity', e.target.value as WorldGenerationSettings['ruinDensity'])}>{['sparse', 'normal', 'dense'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Стартовые знания</span><select value={settings.startingKnowledge} onChange={(e) => set('startingKnowledge', Number(e.target.value) as 1 | 2 | 3)}><option value="1">Почти ничего</option><option value="2">Местные карты</option><option value="3">Хороший архив</option></select></label>
          </section>

          <section>
            <h3><Sparkles size={17} /> Магия и чудовища</h3>
            <label><span>Распространённость магии</span><select value={settings.magicLevel} onChange={(e) => set('magicLevel', e.target.value as WorldGenerationSettings['magicLevel'])}>{['rare', 'common', 'wild'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <label><span>Плотность монстров</span><select value={settings.monsterDensity} onChange={(e) => set('monsterDensity', e.target.value as WorldGenerationSettings['monsterDensity'])}>{['sparse', 'normal', 'dense'].map((value) => <option value={value} key={value}>{optionLabel[value]}</option>)}</select></label>
            <div className="setting-warning"><Flame size={18} /><p>Дикая магия создаёт больше пепельных земель, аномалий и опасных решений в пути.</p></div>
          </section>

          <section>
            <h3><ShieldAlert size={17} /> Сложность кампании</h3>
            <div className="difficulty-grid">
              {(['story', 'standard', 'hard', 'brutal'] as const).map((difficulty) => <button key={difficulty} className={settings.difficulty === difficulty ? 'active' : ''} onClick={() => set('difficulty', difficulty)}><strong>{optionLabel[difficulty]}</strong><span>{difficulty === 'story' ? 'Меньше смертей' : difficulty === 'standard' ? 'Базовый баланс' : difficulty === 'hard' ? 'Дороже и опаснее' : 'Гильдию ломают ошибки'}</span></button>)}
            </div>
            <div className="difficulty-rules"><span>Старт: {DIFFICULTY_RULES[settings.difficulty].startingTreasury} кр.</span><span>Долг: {DIFFICULTY_RULES[settings.difficulty].startingDebt}</span><span>Смертность ×{DIFFICULTY_RULES[settings.difficulty].death}</span></div>
          </section>
        </div>

        <footer className="world-setup-footer">
          <label className="seed-field"><span>Seed мира</span><div><input value={seed} onChange={(event) => onSeedChange(event.target.value)} placeholder="Пусто — случайный seed" /><button onClick={randomSeed} title="Случайный seed"><Dice5 size={18} /></button></div></label>
          <div className="world-create-summary"><Castle size={19} /><span>Будет создано примерно <b>{settings.realmCount}</b> государств, <b>{Math.round(size.width * size.height / (settings.ruinDensity === 'dense' ? 25 : 38))}</b> древних мест и сеть дорог с реками.</span></div>
          <button className="primary-button create-world-button" onClick={onCreate}>Создать мир и уничтожить текущее сохранение</button>
        </footer>
      </article>
    </div>
  )
}
