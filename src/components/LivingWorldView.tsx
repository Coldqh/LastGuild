import { useMemo, useState } from 'react'
import { BookOpenCheck, Castle, Coins, Landmark, Network, Route, ScrollText, ShieldAlert, Swords, TrendingDown, TrendingUp } from 'lucide-react'
import type { GameState, HistoricalMapSnapshot, WorldTile } from '../types/game'

interface Props { state: GameState }
type Tab = 'economy' | 'wars' | 'knowledge' | 'history' | 'map'

const HEX_W = 20
const HEX_H = 18
const X_STEP = 15
const Y_STEP = 18
const center = (tile: WorldTile): [number, number] => [18 + tile.x * X_STEP, 18 + tile.y * Y_STEP + (tile.x % 2 ? 9 : 0)]
const points = (cx: number, cy: number) => [[cx - 10, cy], [cx - 5, cy - 9], [cx + 5, cy - 9], [cx + 10, cy], [cx + 5, cy + 9], [cx - 5, cy + 9]].map(([x, y]) => `${x},${y}`).join(' ')

const stageLabels = {
  found: 'Найдено', verified: 'Проверено', published: 'Опубликовано', contested: 'Оспаривается', spreading: 'Распространяется', used: 'Используется',
}

function MiniHistoryMap({ state, snapshot }: { state: GameState; snapshot: HistoricalMapSnapshot }) {
  const realmMap = useMemo(() => new Map(state.world.realms.map((realm) => [realm.id, realm])), [state.world.realms])
  const width = state.world.width * X_STEP + HEX_W + 40
  const height = state.world.height * Y_STEP + HEX_H + 36
  return (
    <div className="historical-map-scroll">
      <svg width={width} height={height} className="historical-map-svg" role="img" aria-label={`Карта мира на ${snapshot.year} год`}>
        {state.world.tiles.map((tile) => {
          const [cx, cy] = center(tile)
          const realmId = snapshot.realmByTile[tile.id]
          const fill = tile.biome === 'ocean' ? '#17232a' : realmId ? realmMap.get(realmId)?.color ?? '#3a3a36' : '#242521'
          return <polygon key={tile.id} points={points(cx, cy)} fill={fill} stroke="#111410" strokeWidth=".55" opacity={tile.biome === 'ocean' ? .72 : .9} />
        })}
        {state.world.settlements.map((settlement) => {
          const status = snapshot.settlementStates[settlement.id]
          if (!status || status.status === 'ruined') return null
          const tile = state.world.tiles.find((entry) => entry.id === settlement.tileId)
          if (!tile) return null
          const [cx, cy] = center(tile)
          return <circle key={settlement.id} cx={cx} cy={cy} r={settlement.kind === 'capital' ? 3.8 : 2.4} fill="#f1d495" stroke="#16100a" strokeWidth="1" />
        })}
      </svg>
    </div>
  )
}

export default function LivingWorldView({ state }: Props) {
  const [tab, setTab] = useState<Tab>('economy')
  const [snapshotId, setSnapshotId] = useState(state.historySnapshots.at(-1)?.id ?? '')
  const snapshot = state.historySnapshots.find((entry) => entry.id === snapshotId) ?? state.historySnapshots.at(-1)
  const activeWars = state.wars.filter((war) => war.status !== 'ended')
  const activeRoutes = state.world.routes.filter((route) => route.type !== 'river' && route.status === 'active')
  const disruptedRoutes = state.world.routes.filter((route) => route.type !== 'river' && route.status !== 'active')
  const growing = [...state.world.settlements].filter((settlement) => settlement.status !== 'ruined').sort((a, b) => b.growth - a.growth).slice(0, 6)
  const declining = [...state.world.settlements].filter((settlement) => settlement.status !== 'ruined').sort((a, b) => a.growth - b.growth).slice(0, 6)
  const history = [...state.world.history].sort((a, b) => b.year - a.year).slice(0, 80)

  return (
    <section className="view living-world-view">
      <header className="view-heading">
        <div><p className="eyebrow">Симуляция региона</p><h1>Живой мир</h1><p>Города производят товары, дороги зарабатывают деньги, войны меняют владельцев, а открытия проходят путь от слуха до политического инструмента.</p></div>
        <div className="living-world-metrics">
          <span><Swords size={16} /><b>{activeWars.length}</b> активных войн</span>
          <span><Route size={16} /><b>{activeRoutes.length}</b> работающих путей</span>
          <span><BookOpenCheck size={16} /><b>{state.knowledgeSpreads.filter((entry) => entry.stage !== 'used').length}</b> распространяемых открытий</span>
        </div>
      </header>

      <div className="segmented-control living-tabs">
        <button className={tab === 'economy' ? 'active' : ''} onClick={() => setTab('economy')}><Coins size={15} />Экономика</button>
        <button className={tab === 'wars' ? 'active' : ''} onClick={() => setTab('wars')}><Swords size={15} />Войны</button>
        <button className={tab === 'knowledge' ? 'active' : ''} onClick={() => setTab('knowledge')}><Network size={15} />Знания</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><ScrollText size={15} />Хроника мира</button>
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}><Landmark size={15} />Историческая карта</button>
      </div>

      {tab === 'economy' && <div className="living-grid">
        <article className="paper-card living-panel wide-panel">
          <div className="section-title"><Route size={20} /><div><p className="eyebrow">Торговая сеть</p><h2>Маршруты региона</h2></div></div>
          <div className="route-economy-list">
            {[...state.world.routes].filter((route) => route.type !== 'river').sort((a, b) => b.income - a.income).slice(0, 14).map((route) => <div key={route.id} className={`route-economy-row ${route.status}`}>
              <span><strong>{route.name}</strong><small>{route.goods.length ? route.goods.join(' · ') : 'обычные грузы'} · основан {route.establishedYear} г.</small></span>
              <span><b>{route.income}</b><small>доход</small></span><span><b>{Math.round(route.safety)}</b><small>безопасность</small></span><em>{route.status === 'active' ? 'работает' : route.status === 'disrupted' ? 'нарушен' : 'заброшен'}</em>
            </div>)}
          </div>
          {disruptedRoutes.length > 0 && <p className="living-warning"><ShieldAlert size={16} />{disruptedRoutes.length} маршрутов теряют доход из-за войны, чудовищ или нестабильности.</p>}
        </article>

        <article className="paper-card living-panel"><div className="section-title"><TrendingUp size={20} /><div><p className="eyebrow">Рост</p><h2>Набирают силу</h2></div></div><div className="settlement-economy-list">{growing.map((settlement) => <div key={settlement.id}><span><strong>{settlement.name}</strong><small>{settlement.production.join(' · ')}</small></span><b>+{settlement.growth.toFixed(1)}</b><small>{settlement.population.toLocaleString('ru-RU')} жителей</small></div>)}</div></article>
        <article className="paper-card living-panel"><div className="section-title"><TrendingDown size={20} /><div><p className="eyebrow">Упадок</p><h2>Теряют людей</h2></div></div><div className="settlement-economy-list">{declining.map((settlement) => <div key={settlement.id}><span><strong>{settlement.name}</strong><small>волнения {Math.round(settlement.unrest)} · продовольствие {Math.round(settlement.foodSecurity)}</small></span><b>{settlement.growth.toFixed(1)}</b><small>{settlement.status}</small></div>)}</div></article>
      </div>}

      {tab === 'wars' && <div className="living-grid">
        {state.wars.length === 0 && <article className="paper-card empty-state wide-panel"><Castle size={28} /><h2>Крупных войн пока нет</h2><p>Отношения государств могут ухудшиться из-за границ, маршрутов, документов и ресурсов.</p></article>}
        {state.wars.map((war) => {
          const attacker = state.world.realms.find((realm) => realm.id === war.attackerRealmId)
          const defender = state.world.realms.find((realm) => realm.id === war.defenderRealmId)
          return <article key={war.id} className={`paper-card war-card ${war.status}`}>
            <div className="war-card-head"><span><p className="eyebrow">{war.status === 'ended' ? 'Завершена' : war.status === 'preparing' ? 'Мобилизация' : 'Идёт война'}</p><h2>{war.name}</h2></span><Swords size={24} /></div>
            <p><b>{attacker?.name}</b> против <b>{defender?.name}</b></p><p>{war.cause}. Цель: {war.goal}.</p>
            <div className="war-progress"><span style={{ width: `${clampForUi(war.progress)}%` }} /></div>
            <div className="war-stats"><span>Снабжение: {Math.round(war.attackerSupply)} / {Math.round(war.defenderSupply)}</span><span>Истощение: {Math.round(war.attackerExhaustion)} / {Math.round(war.defenderExhaustion)}</span><span>Потери: {war.casualties.toLocaleString('ru-RU')}</span></div>
            {war.lastEvent && <p className="war-last-event">{war.lastEvent}</p>}
          </article>
        })}
      </div>}

      {tab === 'knowledge' && <div className="knowledge-spread-list">
        {state.knowledgeSpreads.length === 0 && <article className="paper-card empty-state"><BookOpenCheck size={28} /><h2>Нет крупных открытий</h2><p>После возвращения экспедиции сведения начнут проверяться и распространяться.</p></article>}
        {state.knowledgeSpreads.map((spread) => {
          const discovery = state.discoveries.find((entry) => entry.id === spread.discoveryId)
          return <article key={spread.id} className="paper-card knowledge-spread-card"><div><p className="eyebrow">{stageLabels[spread.stage]}</p><h2>{spread.title}</h2><p>{spread.lastUpdate}</p></div><div className="knowledge-spread-meta"><span>Достоверность <b>{Math.round(spread.credibility)}</b></span><span>Спорность <b>{Math.round(spread.controversy)}</b></span><span>Известно государствам <b>{spread.knownRealmIds.length}</b></span><span>Решение гильдии <b>{discovery?.disposition ?? 'не принято'}</b></span></div><div className="knowledge-progress"><span style={{ width: `${spread.progress}%` }} /></div></article>
        })}
      </div>}

      {tab === 'history' && <div className="world-history-list">{history.map((event) => <article key={event.id} className="paper-card history-event-card"><span className="history-year">{event.year}</span><div><p className="eyebrow">{event.kind ?? event.tags[0] ?? 'событие'}</p><h2>{event.title}</h2><p>{event.description}</p>{event.cause && <p><b>Причина:</b> {event.cause}</p>}{event.consequence && <p><b>Последствие:</b> {event.consequence}</p>}{event.hiddenTruth && state.guild.scientificAuthority >= 35 && <details><summary>Скрытая версия</summary><p>{event.hiddenTruth}</p></details>}</div></article>)}</div>}

      {tab === 'map' && snapshot && <div className="historical-map-layout">
        <article className="paper-card historical-map-card"><div className="section-title"><Landmark size={20} /><div><p className="eyebrow">Выбранный срез</p><h2>{snapshot.title}</h2></div></div><MiniHistoryMap state={state} snapshot={snapshot} /></article>
        <aside className="paper-card snapshot-sidebar"><h2>Годы карты</h2><div className="snapshot-list">{state.historySnapshots.map((entry) => <button key={entry.id} className={entry.id === snapshot.id ? 'active' : ''} onClick={() => setSnapshotId(entry.id)}><strong>{entry.year}</strong><span>{entry.title}</span></button>)}</div><p>Каждый игровой год создаётся новый срез. Захваты, разрушенные города и закрытые пути остаются в истории карты.</p></aside>
      </div>}
    </section>
  )
}

function clampForUi(progress: number): number {
  return Math.max(4, Math.min(96, 50 + progress / 2))
}
