import { AlertTriangle, TentTree, CheckCircle2, DoorOpen, LockKeyhole, Map, Shield, Skull, X } from 'lucide-react'
import type { GameState } from '../types/game'

interface Props {
  state: GameState
  onExplore: (zoneId: string) => void
  onCamp: () => void
  onLeave: () => void
}

export default function DungeonExplorationModal({ state, onExplore, onCamp, onLeave }: Props) {
  const dungeon = state.pendingDungeon!
  const site = state.world.sites.find((candidate) => candidate.id === dungeon.siteId)!
  const current = site.zones.find((zone) => zone.id === dungeon.currentZoneId)
  const accessibleIds = new Set([...dungeon.discoveredZoneIds, ...(current?.connections ?? [])])
  return (
    <div className="modal-backdrop dungeon-backdrop">
      <article className="dungeon-modal paper-card">
        <header className="dungeon-header">
          <div><p className="eyebrow">Поэтапное исследование</p><h2>{site.name}</h2><p>{site.origin}. Исследовано {site.exploration}% · исторических слоёв {site.layers.length}.</p></div>
          <button className="icon-button" onClick={onLeave} title="Покинуть"><X size={18} /></button>
        </header>
        <div className="dungeon-progress"><span style={{ width: `${site.exploration}%` }} /></div>
        <div className="dungeon-layout">
          <div className="dungeon-zones">
            {site.zones.map((zone, index) => {
              const discovered = dungeon.discoveredZoneIds.includes(zone.id) || zone.explored
              const accessible = accessibleIds.has(zone.id)
              const secured = dungeon.securedZoneIds.includes(zone.id) || zone.secured
              return <article className={`dungeon-zone ${zone.id === dungeon.currentZoneId ? 'current' : ''} ${discovered ? 'discovered' : 'hidden'} ${secured ? 'secured' : ''}`} key={zone.id}>
                <div className="zone-number">{index + 1}</div>
                <div className="zone-main"><div className="zone-title"><h3>{discovered ? zone.name : 'Неизвестная зона'}</h3>{secured ? <CheckCircle2 size={16} /> : accessible ? <DoorOpen size={16} /> : <LockKeyhole size={16} />}</div>
                  <p>{discovered ? zone.description : 'Проход ещё не найден или закрыт предыдущей зоной.'}</p>
                  {discovered && <div className="zone-tags"><span><AlertTriangle size={13} />опасность {zone.danger}</span><span>{zone.historyLayer}</span>{zone.guardSpeciesId && <span><Skull size={13} />охрана</span>}{zone.trap && <span><Shield size={13} />{zone.trap}</span>}</div>}
                </div>
                <button disabled={!accessible || (zone.explored && secured)} onClick={() => onExplore(zone.id)}>{zone.explored && secured ? 'Зачищено' : zone.explored ? 'Закрепить' : 'Исследовать'}</button>
              </article>
            })}
          </div>
          <aside className="dungeon-sidebar">
            <section><h3><Map size={17} /> Текущая зона</h3><strong>{current?.name}</strong><p>{current?.historyLayer}</p><p>{current?.rewards.length ? `Возможные находки: ${current.rewards.join(', ')}` : 'Ценных объектов пока не найдено.'}</p></section>
            <section><h3><TentTree size={17} /> Базовый лагерь</h3><p>{site.campEstablished ? 'Лагерь уже создан. Следующие экспедиции получат безопасную точку входа.' : 'Нужно обезопасить минимум две зоны и потратить 6 единиц еды.'}</p><button className="secondary-button" disabled={site.campEstablished || dungeon.securedZoneIds.length < 2} onClick={onCamp}>{site.campEstablished ? 'Лагерь действует' : 'Создать лагерь'}</button></section>
            <section className="dungeon-notes"><h3>Журнал</h3>{[...dungeon.logs].reverse().slice(0, 8).map((entry, index) => <p key={index}>{entry}</p>)}</section>
            <button className="primary-button dungeon-leave" onClick={onLeave}><DoorOpen size={16} />Вернуться к маршруту</button>
          </aside>
        </div>
      </article>
    </div>
  )
}
