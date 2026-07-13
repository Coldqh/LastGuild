import type { BiomeId, DecisionEffects } from '../types/game'

export interface ContentEventChoiceTemplate {
  id: string
  label: string
  description: string
  skill?: 'combat' | 'survival' | 'scouting' | 'medicine' | 'arcana' | 'history' | 'cartography' | 'diplomacy' | 'leadership'
  difficulty?: number
  successText: string
  failureText?: string
  successEffects: DecisionEffects
  failureEffects?: DecisionEffects
}

export interface ExpeditionContentEventTemplate {
  id: string
  title: string
  text: string
  biomes?: BiomeId[]
  requiresCivilization?: boolean
  requiresArtifactRumor?: boolean
  requiredProfessions?: string[]
  requiredTraits?: string[]
  fearTags?: string[]
  weight: number
  choices: ContentEventChoiceTemplate[]
}

export const EXPEDITION_CONTENT_EVENTS: ExpeditionContentEventTemplate[] = [
  { id: 'buried-road-marker', title: 'Камень под новой дорогой', text: 'После дождя из насыпи показался древний милевой камень. Современная дорога построена поверх более старого маршрута.', requiresCivilization: true, weight: 5, choices: [
    { id: 'excavate', label: 'Раскопать основание', description: 'Потратить день на археологическую разведку.', skill: 'history', difficulty: 5, successText: 'Под камнем найдена схема древнего пути.', failureText: 'Грунт обрушился, работа остановлена.', successEffects: { reveal: true, discoveryChance: 0.55, guildReputation: 1, progress: -0.3 }, failureEffects: { progress: -0.7, injuryChance: 0.2 } },
    { id: 'copy', label: 'Снять копию надписи', description: 'Сохранить сведения без раскопок.', skill: 'cartography', difficulty: 4, successText: 'Копия пригодна для архивного сравнения.', failureText: 'Часть знаков прочитана неверно.', successEffects: { reveal: true, morale: 2 }, failureEffects: { morale: -1 } },
    { id: 'continue', label: 'Не задерживаться', description: 'Сохранить темп похода.', successText: 'Отряд продолжил путь.', successEffects: { progress: 0.3 } },
  ] },
  { id: 'local-taboo', title: 'Запрет местных проводников', text: 'Проводники отказываются пересекать отмеченную камнями границу. Они не объясняют причину и требуют повернуть.', biomes: ['forest', 'ancient_forest', 'swamp', 'hills'], weight: 4, choices: [
    { id: 'respect', label: 'Уважить запрет', description: 'Обойти место и сохранить отношения.', skill: 'diplomacy', difficulty: 3, successText: 'Проводники показали более длинный безопасный путь.', failureText: 'Обход оказался тяжёлым.', successEffects: { morale: 4, progress: -0.4, guildReputation: 1 }, failureEffects: { progress: -0.9, food: -3 } },
    { id: 'ask', label: 'Добиться объяснения', description: 'Предложить плату и защиту.', skill: 'diplomacy', difficulty: 6, successText: 'Старший проводник рассказал о старом договоре с местным существом.', failureText: 'Проводники покинули лагерь.', successEffects: { reveal: true, discoveryChance: 0.35, food: -2 }, failureEffects: { cohesion: -5, progress: -0.5 } },
    { id: 'cross', label: 'Перейти границу', description: 'Приказ важнее суеверий.', skill: 'leadership', difficulty: 6, successText: 'Отряд пересёк границу, сохранив строй.', failureText: 'Люди нервничают, проводники отказываются идти дальше.', successEffects: { progress: 0.4, morale: -2 }, failureEffects: { morale: -9, cohesion: -7 } },
  ] },
  { id: 'artifact-whisper', title: 'Шёпот из груза', text: 'Один из найденных фрагментов начал повторять имена участников отряда. Никто не признаётся, что слышал его первым.', requiresArtifactRumor: true, requiredProfessions: ['Маг', 'Жрец', 'Искатель реликвий'], weight: 3, choices: [
    { id: 'isolate', label: 'Изолировать фрагмент', description: 'Запечатать находку и выставить охрану.', skill: 'arcana', difficulty: 6, successText: 'Влияние предмета удалось ограничить.', failureText: 'Печати усилили голос и вызвали панику.', successEffects: { medicine: -1, morale: 3 }, failureEffects: { morale: -10, stress: undefined, cohesion: -5, injuryChance: 0.2 } as DecisionEffects },
    { id: 'listen', label: 'Записать шёпот', description: 'Попытаться получить сведения.', skill: 'history', difficulty: 7, successText: 'Имена сложились в список прежних владельцев.', failureText: 'Один из участников потерял сознание.', successEffects: { discoveryChance: 0.7, guildReputation: 1 }, failureEffects: { medicine: -3, injuryChance: 0.5, morale: -6 } },
    { id: 'discard', label: 'Оставить предмет', description: 'Не рисковать людьми.', successText: 'Фрагмент спрятан в отмеченном месте.', successEffects: { morale: 4, progress: -0.2 } },
  ] },
  { id: 'flooded-scriptorium', title: 'Затопленный скрипторий', text: 'За обвалившейся стеной сохранились полки с документами. Вода быстро поднимается.', biomes: ['swamp', 'coast', 'forest'], requiresCivilization: true, weight: 3, choices: [
    { id: 'save-books', label: 'Спасать книги', description: 'Рискнуть снаряжением ради документов.', skill: 'history', difficulty: 6, successText: 'Несколько связок текстов вынесены сухими.', failureText: 'Вода уничтожила записи и часть припасов.', successEffects: { discoveryChance: 0.8, morale: 5, food: -2 }, failureEffects: { food: -6, medicine: -1, morale: -5 } },
    { id: 'copy-headings', label: 'Скопировать заголовки', description: 'Сохранить минимум сведений.', skill: 'cartography', difficulty: 4, successText: 'Архивисты смогут искать связанные тексты.', failureText: 'Чернила расплылись.', successEffects: { discoveryChance: 0.3 }, failureEffects: { progress: -0.2 } },
    { id: 'leave', label: 'Уйти до обвала', description: 'Не рисковать отрядом.', successText: 'Отряд покинул зал вовремя.', successEffects: { morale: 2 } },
  ] },
  { id: 'glass-rain', title: 'Стеклянный дождь', text: 'Магическая буря несёт мелкие острые кристаллы. Они звенят о броню и тянутся к зачарованным предметам.', biomes: ['desert', 'ashlands'], weight: 5, choices: [
    { id: 'cover', label: 'Укрыть отряд', description: 'Использовать щиты и плотную ткань.', skill: 'survival', difficulty: 5, successText: 'Отряд переждал бурю без тяжёлых ран.', failureText: 'Кристаллы пробили укрытие.', successEffects: { progress: -0.5, morale: 2 }, failureEffects: { medicine: -3, injuryChance: 0.55 } },
    { id: 'collect', label: 'Собрать образцы', description: 'Использовать редкую возможность.', skill: 'arcana', difficulty: 7, successText: 'Собраны активные кристаллы и данные о буре.', failureText: 'Образец взорвался в контейнере.', successEffects: { discoveryChance: 0.6, guildReputation: 1 }, failureEffects: { medicine: -4, morale: -7, injuryChance: 0.45 } },
    { id: 'march', label: 'Продолжать марш', description: 'Не терять время.', skill: 'leadership', difficulty: 7, successText: 'Строй прошёл через бурю.', failureText: 'Люди рассеялись, часть груза потеряна.', successEffects: { progress: 0.6, morale: -3 }, failureEffects: { food: -7, cohesion: -8, morale: -8 } },
  ] },
  { id: 'dreaming-grove', title: 'Роща с чужими снами', text: 'После ночёвки несколько участников описали один и тот же дворец и человека, зовущего их по именам.', biomes: ['ancient_forest', 'forest'], requiresCivilization: true, weight: 4, choices: [
    { id: 'record', label: 'Записать сны', description: 'Сравнить детали и найти координаты.', skill: 'history', difficulty: 6, successText: 'Совпадающие детали образовали карту.', failureText: 'Записи противоречат друг другу.', successEffects: { reveal: true, discoveryChance: 0.45 }, failureEffects: { cohesion: -4 } },
    { id: 'ward', label: 'Провести защитный обряд', description: 'Не позволить снам влиять на отряд.', skill: 'arcana', difficulty: 5, successText: 'Сон больше не повторился.', failureText: 'Обряд усилил видения.', successEffects: { morale: 4 }, failureEffects: { morale: -8, injuryChance: 0.15 } },
    { id: 'follow', label: 'Искать дворец', description: 'Изменить маршрут по видениям.', skill: 'scouting', difficulty: 7, successText: 'Следы привели к скрытым руинам.', failureText: 'Отряд потерял два дня.', successEffects: { reveal: true, discoveryChance: 0.75, progress: -0.2 }, failureEffects: { progress: -1.1, food: -5 } },
  ] },
  { id: 'dead-language-argument', title: 'Спор о мёртвом языке', text: 'Два специалиста по-разному переводят одну надпись. Один вариант предупреждает об опасности, другой обещает хранилище.', requiresCivilization: true, requiredProfessions: ['Археолог', 'Переводчик'], weight: 4, choices: [
    { id: 'compare', label: 'Провести полную сверку', description: 'Потратить время на доказательства.', skill: 'history', difficulty: 5, successText: 'Перевод уточнён: надпись является одновременно предупреждением и инструкцией.', failureText: 'Спор стал личным.', successEffects: { discoveryChance: 0.35, progress: -0.4, cohesion: 2 }, failureEffects: { cohesion: -8, progress: -0.3 } },
    { id: 'leader', label: 'Пусть решит лидер', description: 'Сохранить темп, но взять ответственность.', skill: 'leadership', difficulty: 5, successText: 'Лидер выбрал осторожное толкование.', failureText: 'Решение вызвало недоверие специалистов.', successEffects: { morale: 2 }, failureEffects: { cohesion: -6, morale: -3 } },
    { id: 'split', label: 'Проверить обе версии', description: 'Разделить разведчиков.', skill: 'scouting', difficulty: 7, successText: 'Обе версии привели к разным частям комплекса.', failureText: 'Одна группа попала в ловушку.', successEffects: { reveal: true, discoveryChance: 0.6 }, failureEffects: { medicine: -2, injuryChance: 0.45 } },
  ] },
  { id: 'old-battlefield-voices', title: 'Голоса старого поля', text: 'Ночью слышны команды погибших солдат. Они повторяют один и тот же приказ, которого нет в известных хрониках.', biomes: ['plains', 'hills', 'ashlands'], weight: 3, choices: [
    { id: 'listen', label: 'Восстановить приказ', description: 'Записать последовательность команд.', skill: 'history', difficulty: 6, successText: 'Приказ указывает на скрытый отход армии.', failureText: 'Голоса вызвали панику.', successEffects: { discoveryChance: 0.5, reveal: true }, failureEffects: { morale: -9, cohesion: -4 } },
    { id: 'ritual', label: 'Успокоить погибших', description: 'Провести погребальный обряд.', skill: 'arcana', difficulty: 6, successText: 'Голоса стихли, а один дух указал старую могилу.', failureText: 'Покойники приняли отряд за врагов.', successEffects: { guildReputation: 2, discoveryChance: 0.25 }, failureEffects: { startCombat: 'site_guardians', combatAdvantage: -1, morale: -6 } },
    { id: 'leave', label: 'Сменить лагерь', description: 'Не вмешиваться.', successText: 'Отряд ушёл до рассвета.', successEffects: { progress: -0.3, morale: 2 } },
  ] },
  { id: 'living-map', title: 'Карта меняет рисунок', text: 'Ночью линии на старой карте сдвинулись. Новый путь проходит через область, которой нет в современных атласах.', requiresArtifactRumor: true, requiredProfessions: ['Картограф', 'Маг'], weight: 2, choices: [
    { id: 'follow-map', label: 'Следовать новой линии', description: 'Довериться неизвестной магии.', skill: 'cartography', difficulty: 7, successText: 'Путь оказался настоящим и сократил переход.', failureText: 'Линия исчезла в момент, когда отряд потерял ориентиры.', successEffects: { progress: 1.2, reveal: true, discoveryChance: 0.4 }, failureEffects: { progress: -1, food: -5, morale: -5 } },
    { id: 'copy-map', label: 'Скопировать изменения', description: 'Не менять маршрут, но сохранить данные.', skill: 'arcana', difficulty: 6, successText: 'Изменение удалось зафиксировать.', failureText: 'Копия получилась пустой.', successEffects: { discoveryChance: 0.55 }, failureEffects: { morale: -1 } },
    { id: 'seal-map', label: 'Запечатать карту', description: 'Не позволить ей влиять на решения.', successText: 'Карта убрана в защищённый футляр.', successEffects: { cohesion: 2 } },
  ] },
  { id: 'ancestor-statue', title: 'Статуя с лицом участника', text: 'В разрушенном зале стоит древняя статуя, чьё лицо точно повторяет одного из членов отряда.', requiresCivilization: true, weight: 2, choices: [
    { id: 'study-face', label: 'Изучить сходство', description: 'Проверить род, одежду и надписи.', skill: 'history', difficulty: 7, successText: 'Найдена связь между семьёй участника и древней элитой.', failureText: 'Исследование только усилило тревогу.', successEffects: { discoveryChance: 0.65, morale: 3 }, failureEffects: { morale: -7, cohesion: -3 } },
    { id: 'break-statue', label: 'Разбить статую', description: 'Уничтожить возможный магический фокус.', skill: 'combat', difficulty: 5, successText: 'Внутри обнаружен тайник.', failureText: 'Разрушение активировало защиту.', successEffects: { discoveryChance: 0.45 }, failureEffects: { startCombat: 'site_guardians', combatAdvantage: -1 } },
    { id: 'leave', label: 'Не трогать', description: 'Записать место и уйти.', successText: 'Статуя осталась на месте.', successEffects: { reveal: true } },
  ] },
  { id: 'refugee-scholar', title: 'Учёный среди беженцев', text: 'Среди людей у дороги оказался архивист, несущий несколько страниц из уничтоженной библиотеки.', weight: 4, choices: [
    { id: 'escort', label: 'Сопроводить до безопасности', description: 'Изменить маршрут и защитить архивиста.', skill: 'leadership', difficulty: 5, successText: 'Учёный и страницы доставлены в безопасное место.', failureText: 'Задержка привлекла преследователей.', successEffects: { guildReputation: 2, discoveryChance: 0.5, progress: -0.7 }, failureEffects: { progress: -0.8, startCombat: 'monster', combatAdvantage: 0 } },
    { id: 'copy-pages', label: 'Скопировать страницы', description: 'Не брать человека с собой.', skill: 'history', difficulty: 5, successText: 'Главные фрагменты сохранены.', failureText: 'Текст слишком повреждён.', successEffects: { discoveryChance: 0.3, food: -1 }, failureEffects: { morale: -2 } },
    { id: 'refuse', label: 'Отказать', description: 'Не подвергать отряд риску.', successText: 'Отряд продолжил путь.', successEffects: { progress: 0.2, morale: -4 } },
  ] },
  { id: 'monster-eggs-in-ruin', title: 'Кладка в древнем архиве', text: 'Монстры устроили гнездо среди сохранившихся документов. Любое нападение может уничтожить находки.', requiresCivilization: true, requiredProfessions: ['Охотник', 'Археолог'], weight: 4, choices: [
    { id: 'lure', label: 'Выманить взрослых особей', description: 'Сохранить архив и избежать боя внутри.', skill: 'survival', difficulty: 7, successText: 'Существа покинули зал, документы уцелели.', failureText: 'Хищники заметили ловушку.', successEffects: { discoveryChance: 0.7, startCombat: 'monster', combatAdvantage: 1 }, failureEffects: { startCombat: 'monster', combatAdvantage: -1, morale: -5 } },
    { id: 'take-eggs', label: 'Забрать кладку', description: 'Получить редкий материал.', skill: 'scouting', difficulty: 6, successText: 'Кладка изъята без тревоги.', failureText: 'Одно яйцо раскололось и привлекло стаю.', successEffects: { discoveryChance: 0.4 }, failureEffects: { startCombat: 'monster', combatAdvantage: -1 } },
    { id: 'burn', label: 'Сжечь гнездо', description: 'Надёжно уничтожить угрозу вместе с частью архива.', skill: 'combat', difficulty: 4, successText: 'Гнездо уничтожено.', failureText: 'Огонь вышел из-под контроля.', successEffects: { guildReputation: 1 }, failureEffects: { injuryChance: 0.3, food: -4, morale: -4 } },
  ] },
]
