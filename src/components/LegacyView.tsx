import { BookMarked, Landmark, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState, GuildMemorial } from '../types/game'

interface Props {
  state: GameState
  onFoundDoctrine: (founderId: string) => void
  onMemorial: (characterId: string, type: GuildMemorial['type']) => void
}

export default function LegacyView({ state, onFoundDoctrine, onMemorial }: Props) {
  const [memorialCharacter, setMemorialCharacter] = useState('')
  const [memorialType, setMemorialType] = useState<GuildMemorial['type']>('portrait')
  const eligibleFounders = useMemo(() => state.characters.filter((entry) => entry.employed && entry.level >= 4 && !state.doctrines.some((doctrine) => doctrine.founderId === entry.id)).slice(0, 6), [state.characters, state.doctrines])
  const legacyCandidates = state.characters.filter((entry) => ['dead', 'retired'].includes(entry.status) && (entry.expeditions >= 3 || entry.fame >= 20))
  return <section className="view focused-view legacy-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Поколения и память</p><h1>Наследие гильдии</h1><p>Исторические эпохи, школы наставников и памятные объекты собраны отдельно от текущего управления.</p></div><div className="capacity-badge"><Landmark size={18} /><b>{state.generations.length}</b><span>поколений</span></div></header>

    <div className="legacy-primary-grid">
      <section className="paper-card generations-panel compact-generations-panel">
        <div className="section-title"><Landmark size={20} /><div><p className="eyebrow">Эпохи</p><h2>Поколения</h2></div></div>
        {state.generations.map((generation) => <article key={generation.id}><div><strong>{generation.name}</strong><span>{generation.startedYear}–{generation.endedYear ?? 'сейчас'}</span></div><small>{generation.memberIds.length} участников · {generation.doctrineIds.length} школ</small></article>)}
      </section>

      <section className="paper-card memorial-panel compact-memorial-panel">
        <div className="section-title"><Landmark size={20} /><div><p className="eyebrow">Память</p><h2>Памятные объекты</h2></div></div>
        <div className="memorial-form"><select value={memorialCharacter} onChange={(event) => setMemorialCharacter(event.target.value)}><option value="">Выбрать ветерана</option>{legacyCandidates.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><select value={memorialType} onChange={(event) => setMemorialType(event.target.value as GuildMemorial['type'])}><option value="portrait">Портрет</option><option value="memorial">Мемориал</option><option value="award">Награда</option><option value="school">Школа</option><option value="hall">Зал</option></select><button className="secondary-button small" disabled={!memorialCharacter} onClick={() => onMemorial(memorialCharacter, memorialType)}>Учредить</button></div>
        <div className="compact-memorial-list">{state.memorials.map((memorial) => <article key={memorial.id}><strong>{memorial.name}</strong><span>{memorial.effect}</span></article>)}{!state.memorials.length && <p className="muted">Памятных объектов пока нет.</p>}</div>
      </section>
    </div>

    <section className="paper-card doctrine-panel compact-doctrine-panel">
      <div className="section-title"><BookMarked size={19} /><div><p className="eyebrow">Методы и традиции</p><h2>Школы наставников</h2></div></div>
      <div className="doctrine-grid compact-doctrine-grid">{state.doctrines.map((doctrine) => <article key={doctrine.id}><Sparkles size={18} /><h3>{doctrine.name}</h3><p>{doctrine.principle}</p><strong>{doctrine.bonus}</strong><small>{doctrine.weakness}</small></article>)}{eligibleFounders.map((founder) => <article className="doctrine-founder" key={founder.id}><h3>{founder.name}</h3><p>{founder.profession} · слава {founder.fame}</p><button className="secondary-button small" onClick={() => onFoundDoctrine(founder.id)}>Основать школу</button></article>)}</div>
    </section>
  </section>
}
