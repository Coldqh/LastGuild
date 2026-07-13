import type { GameState, ViewId } from '../types/game'

export type TutorialStepId = 'headquarters' | 'roster' | 'hire' | 'expeditions' | 'launch' | 'time' | 'debrief' | 'upgrade'

export interface TutorialStep {
  id: TutorialStepId
  title: string
  description: string
  targetView: ViewId
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'headquarters', title: 'Осмотри старый штаб', description: 'Проверь долг, помещения и стартовые проблемы гильдии.', targetView: 'headquarters' },
  { id: 'roster', title: 'Открой список людей', description: 'Посмотри действующий состав и историю службы.', targetView: 'roster' },
  { id: 'hire', title: 'Найми первого новичка', description: 'Вернись в штаб и открой внутреннюю вкладку «Наём».', targetView: 'headquarters' },
  { id: 'expeditions', title: 'Выбери первый контракт', description: 'Открой планировщик и изучи доступные цели.', targetView: 'expeditions' },
  { id: 'launch', title: 'Отправь отряд', description: 'Назначь лидера, собери припасы и утверди маршрут.', targetView: 'expeditions' },
  { id: 'time', title: 'Продвинь время', description: 'Дай экспедиции выйти в путь. Время остановится при важном событии.', targetView: 'headquarters' },
  { id: 'debrief', title: 'Разбери возвращение', description: 'Распредели авторство, лечение и судьбу находки.', targetView: 'expeditions' },
  { id: 'upgrade', title: 'Улучши помещение', description: 'Вложи первые доходы в штаб и закрепи прогресс.', targetView: 'headquarters' },
]

export interface AttentionItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  targetView: ViewId
}

export function getAttentionItems(state: GameState): AttentionItem[] {
  const items: AttentionItem[] = []
  if (state.pendingCombat) items.push({ id: 'combat', severity: 'critical', title: 'Идёт бой', description: 'Отряд ждёт командного решения.', targetView: 'expeditions' })
  if (state.pendingDecision) items.push({ id: 'decision', severity: 'critical', title: 'Решение экспедиции', description: state.pendingDecision.title, targetView: 'expeditions' })
  if (state.pendingDungeon) items.push({ id: 'dungeon', severity: 'critical', title: 'Исследование подземелья', description: 'Выбери следующую зону или прикажи отходить.', targetView: 'expeditions' })
  if (state.pendingDebrief) items.push({ id: 'debrief', severity: 'critical', title: 'Отряд вернулся', description: 'Нужен официальный разбор экспедиции.', targetView: 'expeditions' })

  state.opportunities
    .filter((entry) => !entry.accepted && entry.deadlineDay >= state.day && entry.deadlineDay - state.day <= 8)
    .slice(0, 4)
    .forEach((entry) => items.push({ id: `contract-${entry.id}`, severity: 'warning', title: `Срок контракта: ${entry.title}`, description: `Осталось ${entry.deadlineDay - state.day} дн.`, targetView: 'expeditions' }))

  const criticalInjured = state.characters.filter((character) => character.employed && character.status === 'recovering' && character.health < 45)
  if (criticalInjured.length) items.push({ id: 'injured', severity: 'warning', title: 'Тяжелораненые в лазарете', description: `${criticalInjured.length} сотрудников требуют времени и лечения.`, targetView: 'roster' })

  const activeCrises = state.crises.filter((crisis) => crisis.status === 'active')
  if (activeCrises.length) items.push({ id: 'crises', severity: 'warning', title: 'Мировые кризисы', description: `${activeCrises.length} кризисов уже влияют на регион.`, targetView: 'influence' })

  if (state.guild.debt > state.guild.treasury * 2) items.push({ id: 'debt', severity: 'warning', title: 'Долг давит на гильдию', description: 'Казна не покрывает даже половину обязательств.', targetView: 'headquarters' })

  if (!items.length) items.push({ id: 'clear', severity: 'info', title: 'Критических решений нет', description: 'Можно готовить новую экспедицию или развивать штаб.', targetView: 'headquarters' })
  return items
}

export function getEarlyGoals(state: GameState) {
  const employed = state.characters.filter((character) => character.employed).length
  const completedExpeditions = state.expeditions.filter((expedition) => ['completed', 'failed', 'lost'].includes(expedition.status)).length
  return [
    { label: 'Сохранить казну выше 300 крон', done: state.guild.treasury >= 300 },
    { label: 'Собрать штат из 9 человек', done: employed >= 9 },
    { label: 'Завершить первую экспедицию', done: completedExpeditions >= 1 },
    { label: 'Получить первое открытие', done: state.discoveries.length >= 1 },
    { label: 'Улучшить одно помещение', done: state.guild.rooms.some((room) => room.level > 1) },
  ]
}
