import type { BiomeId, MonsterSpecies } from '../types/game'

export const BIOME_LABELS: Record<BiomeId, string> = {
  ocean: 'Море',
  coast: 'Побережье',
  plains: 'Равнины',
  forest: 'Лес',
  ancient_forest: 'Древний лес',
  hills: 'Холмы',
  mountains: 'Горы',
  swamp: 'Болото',
  desert: 'Пустошь',
  tundra: 'Тундра',
  ashlands: 'Пепельные земли',
}

export const BIOME_COLORS: Record<BiomeId, string> = {
  ocean: '#172d3b',
  coast: '#31586a',
  plains: '#667247',
  forest: '#344b31',
  ancient_forest: '#203525',
  hills: '#756848',
  mountains: '#716d66',
  swamp: '#3f5142',
  desert: '#8a704a',
  tundra: '#8b9593',
  ashlands: '#51433e',
}

export const REALM_COLORS = ['#9d5b4b', '#526f8a', '#6c7f4b', '#856b9b', '#9a7b3f', '#477f73']
export const GOVERNMENTS = ['наследственное королевство', 'союз свободных городов', 'княжеская конфедерация', 'магократия', 'теократия', 'клановый совет']
export const CULTURES = ['арденская', 'вельская', 'дворфийская', 'эльфийская', 'марская', 'орочья пограничная', 'тирская']
export const ANCESTRIES = ['Человек', 'Эльф', 'Дворф', 'Полуорк', 'Тифлинг', 'Гном', 'Полурослик', 'Драконорождённый']
export const PROFESSIONS = ['Воин', 'Следопыт', 'Маг', 'Жрец', 'Плут', 'Охотник', 'Картограф', 'Археолог', 'Лекарь', 'Переводчик', 'Искатель реликвий']
export const TRAITS = ['осторожный', 'смелый', 'алчный', 'набожный', 'любопытный', 'дисциплинированный', 'гордый', 'надёжный', 'суеверный', 'жестокий', 'общительный', 'скрытный', 'честолюбивый', 'терпеливый']
export const AMBITIONS = ['стать легендой гильдии', 'найти исчезнувший город', 'разбогатеть', 'основать собственный отряд', 'доказать древнюю теорию', 'отомстить чудовищу', 'возглавить гильдию', 'восстановить честь рода']
export const FEARS = ['нежить', 'глубокие пещеры', 'потеря товарищей', 'дикая магия', 'бесславная смерть', 'океан', 'огонь', 'предательство']

export const FIRST_NAMES = ['Тарвен', 'Лесса', 'Бран', 'Эмбер', 'Иара', 'Орен', 'Мира', 'Корв', 'Сайла', 'Дорн', 'Невин', 'Фарра', 'Эдрик', 'Мейра', 'Торин', 'Каэль', 'Руна', 'Весс', 'Альма', 'Гаррет']
export const LAST_NAMES = ['Морк', 'Вейл', 'Каменник', 'Эллар', 'Грей', 'Тихая', 'Роук', 'Харт', 'Северный', 'Дейн', 'Рилл', 'Кроу', 'Фарен', 'Тал', 'Брант']

export const SITE_PREFIXES = ['Затонувший', 'Проклятый', 'Серебряный', 'Безмолвный', 'Разбитый', 'Пепельный', 'Забытый', 'Чёрный', 'Лунный', 'Глубинный']
export const SITE_NOUNS = ['храм', 'рудник', 'некрополь', 'город', 'монастырь', 'шпиль', 'лабиринт', 'архив', 'дворец', 'разлом']
export const REALM_PREFIXES = ['Арден', 'Вель', 'Мар', 'Касс', 'Эль', 'Тор', 'Рен', 'Дор', 'Саль', 'Ир']
export const REALM_SUFFIXES = ['ия', 'ор', 'марк', 'хольм', 'вар', 'ен', 'иян', 'гард']
export const SETTLEMENT_PREFIXES = ['Старый', 'Северный', 'Каменный', 'Речной', 'Белый', 'Красный', 'Нижний', 'Высокий', 'Тихий', 'Пограничный']
export const SETTLEMENT_NOUNS = ['Брод', 'Холм', 'Предел', 'Порт', 'Ключ', 'Дол', 'Клин', 'Острог', 'Рынок', 'Берег']

export const MONSTER_SPECIES: MonsterSpecies[] = [
  { id: 'wolves', name: 'Серые лютоволки', origin: 'natural', habitats: ['forest', 'plains', 'tundra'], threat: 2, behavior: 'охотятся стаями и преследуют слабых', weakness: 'огонь и громкий шум' },
  { id: 'trolls', name: 'Речные тролли', origin: 'natural', habitats: ['swamp', 'forest', 'hills'], threat: 5, behavior: 'защищают охотничью территорию', weakness: 'огонь' },
  { id: 'spiders', name: 'Пещерные пауки', origin: 'natural', habitats: ['mountains', 'ancient_forest'], threat: 3, behavior: 'устраивают колонии в тёмных проходах', weakness: 'дым' },
  { id: 'wights', name: 'Клятвенные мертвецы', origin: 'undead', habitats: ['ashlands', 'swamp', 'hills'], threat: 6, behavior: 'охраняют места старых войн', weakness: 'освящённое серебро' },
  { id: 'wyverns', name: 'Горные виверны', origin: 'natural', habitats: ['mountains', 'hills'], threat: 7, behavior: 'охотятся возле скал и защищают кладки', weakness: 'сети и тяжёлые арбалеты' },
  { id: 'glassborn', name: 'Стеклорождённые', origin: 'magical', habitats: ['ashlands', 'desert'], threat: 5, behavior: 'питаются остаточной магией', weakness: 'холод' },
  { id: 'goblins', name: 'Гоблинские налётчики', origin: 'civilized', habitats: ['hills', 'forest', 'mountains'], threat: 3, behavior: 'ставят засады на дорогах и торгуются при перевесе врага', weakness: 'раскол командования' },
  { id: 'constructs', name: 'Древние стражи', origin: 'construct', habitats: ['desert', 'mountains', 'ashlands'], threat: 8, behavior: 'защищают заданные зоны до разрушения', weakness: 'рунические ключи' },
]
