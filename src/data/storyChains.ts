import type { StoryChainKind, StoryChainRarity } from '../types/game'

export interface StoryStageTemplate {
  id: string
  title: string
  description: string
  objectiveType: string
  requiredRoles: string[]
  reward: number
  dangerModifier: number
  target: 'civilization_site' | 'artifact_site' | 'remote_site' | 'settlement' | 'monster_lair'
  completionText: string
}

export interface StoryChainTemplate {
  id: string
  title: string
  summary: string
  kind: StoryChainKind
  rarity: StoryChainRarity
  civilizationRequired?: boolean
  artifactRequired?: boolean
  stages: StoryStageTemplate[]
}

export const STORY_CHAIN_TEMPLATES: StoryChainTemplate[] = [
  {
    id: 'broken-seal', title: 'Сломанная печать', summary: 'Небольшой обломок выводит гильдию на след артефакта и настоящей причины падения древнего государства.', kind: 'fallen_civilization', rarity: 'common', civilizationRequired: true, artifactRequired: true,
    stages: [
      { id: 'seal-fragment', title: 'Обломок печати', description: 'Проверить происхождение обломка, найденного на старой дороге.', objectiveType: 'исследование', requiredRoles: ['Археолог', 'Картограф'], reward: 260, dangerModifier: 0, target: 'civilization_site', completionText: 'Руны связали обломок с погибшей цивилизацией.' },
      { id: 'second-inscription', title: 'Вторая надпись', description: 'Сравнить печать с надписями в другом комплексе той же эпохи.', objectiveType: 'руины', requiredRoles: ['Археолог', 'Маг'], reward: 420, dangerModifier: 1, target: 'civilization_site', completionText: 'Надписи указали на предмет, разделённый перед падением государства.' },
      { id: 'lost-part', title: 'Потерянная часть', description: 'Найти часть артефакта, спрятанную в опасном комплексе.', objectiveType: 'артефакт', requiredRoles: ['Искатель реликвий', 'Воин'], reward: 720, dangerModifier: 2, target: 'artifact_site', completionText: 'Первая часть реликвии доставлена в архив.' },
      { id: 'cause-of-fall', title: 'Причина падения', description: 'Добраться до центрального архива и восстановить последние записи цивилизации.', objectiveType: 'руины', requiredRoles: ['Археолог', 'Переводчик', 'Лекарь'], reward: 1100, dangerModifier: 3, target: 'civilization_site', completionText: 'Гильдия получила доказательство, меняющее принятую историю.' },
    ],
  },
  {
    id: 'ten-year-silence', title: 'Десять лет молчания', summary: 'Следы старой экспедиции указывают, что её участники могли выжить и создать собственное поселение.', kind: 'lost_expedition', rarity: 'uncommon',
    stages: [
      { id: 'weathered-journal', title: 'Выцветший журнал', description: 'Проверить координаты из журнала пропавшего картографа.', objectiveType: 'поиск', requiredRoles: ['Картограф', 'Следопыт'], reward: 300, dangerModifier: 0, target: 'remote_site', completionText: 'Найден лагерь, покинутый много лет назад.' },
      { id: 'survivor-signs', title: 'Следы выживших', description: 'Пройти дальше по знакам, оставленным людьми старой экспедиции.', objectiveType: 'спасение', requiredRoles: ['Следопыт', 'Лекарь'], reward: 520, dangerModifier: 1, target: 'remote_site', completionText: 'Следы подтвердили, что часть отряда пережила первую зиму.' },
      { id: 'hidden-colony', title: 'Поселение без карты', description: 'Установить контакт с изолированной общиной потомков экспедиции.', objectiveType: 'дипломатия', requiredRoles: ['Переводчик', 'Жрец'], reward: 780, dangerModifier: 1, target: 'settlement', completionText: 'Изолированное поселение признало связь с внешним миром.' },
      { id: 'return-or-remain', title: 'Возвращение или разрыв', description: 'Доставить свидетельства в гильдию и решить судьбу людей, отказавшихся возвращаться.', objectiveType: 'дипломатия', requiredRoles: ['Переводчик', 'Картограф'], reward: 900, dangerModifier: 0, target: 'settlement', completionText: 'История пропавшей экспедиции получила официальный конец.' },
    ],
  },
  {
    id: 'beast-with-a-name', title: 'Зверь, которого называют по имени', summary: 'Легендарное чудовище оказывается участником старого договора, а не обычной целью охоты.', kind: 'legendary_monster', rarity: 'uncommon',
    stages: [
      { id: 'victims-map', title: 'Карта нападений', description: 'Собрать сведения о нападениях и определить территорию существа.', objectiveType: 'разведка', requiredRoles: ['Охотник', 'Картограф'], reward: 340, dangerModifier: 1, target: 'monster_lair', completionText: 'Нападения образовали границу, а не охотничий маршрут.' },
      { id: 'old-offering', title: 'Старое подношение', description: 'Исследовать святилище, где местные оставляли дары чудовищу.', objectiveType: 'руины', requiredRoles: ['Жрец', 'Археолог'], reward: 500, dangerModifier: 1, target: 'civilization_site', completionText: 'Найден текст договора между людьми и существом.' },
      { id: 'meet-the-beast', title: 'Встреча у логова', description: 'Добраться до логова и решить, охотиться или попытаться восстановить договор.', objectiveType: 'охота', requiredRoles: ['Охотник', 'Переводчик', 'Лекарь'], reward: 980, dangerModifier: 4, target: 'monster_lair', completionText: 'Судьба легендарного существа решена.' },
    ],
  },
  {
    id: 'false-saint', title: 'Святой, которого не было', summary: 'Найденные документы ставят под сомнение происхождение влиятельного культа.', kind: 'religious_secret', rarity: 'rare', civilizationRequired: true,
    stages: [
      { id: 'contradictory-relic', title: 'Противоречивая реликвия', description: 'Проверить предмет, возраст которого не совпадает с храмовой хроникой.', objectiveType: 'артефакт', requiredRoles: ['Жрец', 'Археолог'], reward: 440, dangerModifier: 1, target: 'civilization_site', completionText: 'Датировка реликвии опровергла официальную легенду.' },
      { id: 'forbidden-copy', title: 'Запрещённая копия', description: 'Найти копию раннего жития в закрытом архиве.', objectiveType: 'поиск', requiredRoles: ['Переводчик', 'Плут'], reward: 660, dangerModifier: 2, target: 'remote_site', completionText: 'В тексте отсутствует имя почитаемого святого.' },
      { id: 'witness-tomb', title: 'Гробница свидетеля', description: 'Исследовать погребение человека, создавшего культ.', objectiveType: 'руины', requiredRoles: ['Археолог', 'Жрец', 'Воин'], reward: 950, dangerModifier: 3, target: 'civilization_site', completionText: 'Найдены признания основателя и доказательства политической подделки.' },
      { id: 'truth-before-faith', title: 'Истина перед верой', description: 'Подготовить доказательства к публикации или тайной передаче.', objectiveType: 'дипломатия', requiredRoles: ['Переводчик', 'Жрец'], reward: 1250, dangerModifier: 2, target: 'settlement', completionText: 'Гильдия определила судьбу опасной правды.' },
    ],
  },
  {
    id: 'road-below-road', title: 'Дорога под дорогой', summary: 'Старый торговый путь скрывает более древний маршрут и причину исчезновения караванов.', kind: 'lost_route', rarity: 'common', civilizationRequired: true,
    stages: [
      { id: 'missing-caravans', title: 'Исчезающие караваны', description: 'Осмотреть места последних нападений на дороге.', objectiveType: 'разведка', requiredRoles: ['Следопыт', 'Охотник'], reward: 280, dangerModifier: 1, target: 'remote_site', completionText: 'Следы уходят не в лес, а под разрушенную мостовую.' },
      { id: 'buried-milestone', title: 'Погребённый милевой камень', description: 'Расчистить древний спуск и определить направление подземного пути.', objectiveType: 'руины', requiredRoles: ['Картограф', 'Археолог'], reward: 480, dangerModifier: 1, target: 'civilization_site', completionText: 'Маршрут оказался частью древней транспортной сети.' },
      { id: 'deep-fortress', title: 'Крепость под трактом', description: 'Исследовать объект, вытеснивший чудовищ на поверхность.', objectiveType: 'руины', requiredRoles: ['Воин', 'Археолог', 'Лекарь'], reward: 820, dangerModifier: 3, target: 'civilization_site', completionText: 'Источник нападений обнаружен в глубинном комплексе.' },
      { id: 'new-corridor', title: 'Новый коридор', description: 'Картографировать безопасный проход и подготовить его к торговле.', objectiveType: 'картография', requiredRoles: ['Картограф', 'Следопыт'], reward: 1050, dangerModifier: 1, target: 'remote_site', completionText: 'Новый путь готов изменить региональную торговлю.' },
    ],
  },
  {
    id: 'city-that-denies-itself', title: 'Город, отрицающий своё прошлое', summary: 'Современный город скрывает, что построен поверх столицы уничтоженного народа.', kind: 'vanished_city', rarity: 'rare', civilizationRequired: true,
    stages: [
      { id: 'wrong-foundation', title: 'Неправильный фундамент', description: 'Исследовать камни под городской стеной, не совпадающие с официальной датировкой.', objectiveType: 'исследование', requiredRoles: ['Археолог', 'Картограф'], reward: 380, dangerModifier: 0, target: 'settlement', completionText: 'Фундамент оказался на века старше города.' },
      { id: 'sealed-quarter', title: 'Запечатанный квартал', description: 'Получить доступ к закрытым подвалам старого района.', objectiveType: 'дипломатия', requiredRoles: ['Переводчик', 'Плут'], reward: 620, dangerModifier: 1, target: 'settlement', completionText: 'Под городом обнаружены улицы другой культуры.' },
      { id: 'names-under-plaster', title: 'Имена под штукатуркой', description: 'Собрать надписи и доказать происхождение первых жителей.', objectiveType: 'руины', requiredRoles: ['Археолог', 'Переводчик'], reward: 840, dangerModifier: 2, target: 'civilization_site', completionText: 'Имена связали современную элиту с уничтожением прежних жителей.' },
      { id: 'city-trial', title: 'Суд над памятью города', description: 'Представить доказательства властям, наследникам и жителям.', objectiveType: 'дипломатия', requiredRoles: ['Переводчик', 'Жрец'], reward: 1180, dangerModifier: 2, target: 'settlement', completionText: 'Город вынужден признать или окончательно скрыть своё происхождение.' },
    ],
  },
  {
    id: 'crown-in-ledger', title: 'Корона в долговой книге', summary: 'Архивная находка способна изменить наследование одного из государств.', kind: 'state_conspiracy', rarity: 'uncommon', artifactRequired: true,
    stages: [
      { id: 'merchant-copy', title: 'Купеческая копия', description: 'Проверить старый договор, обнаруженный торговым домом.', objectiveType: 'исследование', requiredRoles: ['Переводчик', 'Дипломат'], reward: 360, dangerModifier: 0, target: 'settlement', completionText: 'Подписи указывают на неизвестного наследника.' },
      { id: 'seal-owner', title: 'Владелец печати', description: 'Найти реликвию, подтверждающую подлинность договора.', objectiveType: 'артефакт', requiredRoles: ['Искатель реликвий', 'Археолог'], reward: 690, dangerModifier: 2, target: 'artifact_site', completionText: 'Печать признала документ подлинным.' },
      { id: 'living-heir', title: 'Живой наследник', description: 'Установить судьбу рода, вычеркнутого из официальной истории.', objectiveType: 'поиск', requiredRoles: ['Следопыт', 'Переводчик'], reward: 880, dangerModifier: 2, target: 'remote_site', completionText: 'Найден человек с доказуемым правом на престол.' },
      { id: 'dynasty-choice', title: 'Цена династии', description: 'Передать доказательства одной из сторон или скрыть их.', objectiveType: 'дипломатия', requiredRoles: ['Дипломат', 'Жрец'], reward: 1350, dangerModifier: 3, target: 'settlement', completionText: 'Гильдия вмешалась в будущее государства.' },
    ],
  },
  {
    id: 'night-of-return', title: 'Ночь возвращённой столицы', summary: 'Исчезнувший город появляется на одну ночь, и гильдия должна решить, что вынести из него до рассвета.', kind: 'fallen_civilization', rarity: 'legendary', civilizationRequired: true, artifactRequired: true,
    stages: [
      { id: 'impossible-star-map', title: 'Невозможная звёздная карта', description: 'Проверить карту неба, показывающую созвездия будущего года.', objectiveType: 'исследование', requiredRoles: ['Маг', 'Картограф'], reward: 620, dangerModifier: 1, target: 'civilization_site', completionText: 'Расчёты указали точную ночь возвращения города.' },
      { id: 'prepare-crossing', title: 'Подготовка перехода', description: 'Создать лагерь возле аномалии и пережить магический фронт.', objectiveType: 'исследование', requiredRoles: ['Маг', 'Лекарь', 'Следопыт'], reward: 900, dangerModifier: 3, target: 'remote_site', completionText: 'Отряд дождался появления улиц исчезнувшей столицы.' },
      { id: 'one-night-city', title: 'Одна ночь в мёртвой столице', description: 'Исследовать город до рассвета и выбрать главную цель.', objectiveType: 'руины', requiredRoles: ['Археолог', 'Маг', 'Воин'], reward: 1600, dangerModifier: 5, target: 'civilization_site', completionText: 'Из города вынесены доказательства и часть его наследия.' },
      { id: 'price-of-return', title: 'Цена возвращения', description: 'Решить, пытаться ли вернуть город окончательно.', objectiveType: 'артефакт', requiredRoles: ['Маг', 'Жрец', 'Картограф'], reward: 2200, dangerModifier: 5, target: 'artifact_site', completionText: 'Судьба исчезнувшей столицы и другого города связана окончательно.' },
    ],
  },
]
