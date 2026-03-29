import { CardData, Rarity, CardStats } from '../types';

import { EMOJIS } from './emojis';

const ABILITIES_BY_THEME: Record<string, string[]> = {
  fire: ['Огненный шар', 'Берсерк', 'Гнев богов', 'Огненная аура', 'Огненный шторм', 'Стеклянная пушка'],
  ice: ['Ледяной удар', 'Оглушение', 'Каменная кожа', 'Ледяная броня', 'Ледяная стрела'],
  weapon: ['Критический удар', 'Пробивание брони', 'Снайпер', 'Казнь', 'Двойной удар', 'Удар в спину', 'Парирование', 'Отравленные клинки', 'Пробивание щитов', 'Убийца гигантов'],
  shield: ['Щит', 'Каменная кожа', 'Глухая оборона', 'Святой щит', 'Неуязвимость на 1 ход', 'Контрудар', 'Магический щит', 'Отражение урона', 'Каменный голем'],
  magic: ['Проклятие', 'Благословение', 'Отражение', 'Немота', 'Кража силы', 'Иллюзия', 'Аура слабости', 'Удар молнии', 'Темная магия', 'Энергетический щит'],
  death: ['Некромантия', 'Вампиризм', 'Предсмертный хрип', 'Энергетический вампир', 'Метка смерти', 'Проклятая кровь', 'Кровавая жажда', 'Смертельный яд', 'Кража жизни', 'Призыв нежити'],
  animal: ['Рывок', 'Кровотечение', 'Уклонение', 'Адаптация', 'Двойной удар', 'Невидимость'],
  nature: ['Регенерация', 'Шипы', 'Яд', 'Токсичность', 'Очищение', 'Землетрясение', 'Целитель'],
  face: ['Боевой клич', 'Аура силы', 'Аура слабости', 'Оглушение', 'Ослепление', 'Медитация', 'Гнев титана', 'Проклятие слабости'],
  heart: ['Благословение', 'Регенерация', 'Святой щит', 'Очищение', 'Святое сияние', 'Божественное вмешательство'],
  food: ['Регенерация', 'Медитация', 'Адаптация', 'Целитель'],
  vehicle: ['Рывок', 'Уклонение', 'Неуязвимость на 1 ход', 'Стеклянная пушка'],
  sport: ['Уклонение', 'Двойной удар', 'Контрудар', 'Парирование', 'Рывок', 'Убийца гигантов'],
};

export const ALL_ABILITIES = [
  'Пробивание брони', 'Вампиризм', 'Двойной удар', 'Щит', 'Яд', 'Оглушение', 'Уклонение', 'Регенерация',
  'Контрудар', 'Рывок', 'Аура слабости', 'Аура силы', 'Предсмертный хрип', 'Боевой клич', 'Немота',
  'Проклятие', 'Благословение', 'Кража силы', 'Шипы', 'Неуязвимость на 1 ход',
  'Критический удар', 'Казнь', 'Ослепление', 'Берсерк', 'Каменная кожа', 'Токсичность', 'Отражение',
  'Снайпер', 'Ледяной удар', 'Огненный шар', 'Гнев богов', 'Святой щит', 'Некромантия', 'Иллюзия',
  'Кровотечение', 'Медитация', 'Удар в спину', 'Глухая оборона', 'Проклятая кровь', 'Энергетический вампир',
  'Парирование', 'Метка смерти', 'Очищение', 'Адаптация',
  'Огненная аура', 'Ледяная броня', 'Кровавая жажда', 'Магический щит', 'Пробивание щитов',
  'Отравленные клинки', 'Удар молнии', 'Землетрясение', 'Целитель', 'Смертельный яд',
  'Отражение урона', 'Невидимость', 'Гнев титана', 'Убийца гигантов', 'Проклятие слабости',
  'Кража жизни', 'Огненный шторм', 'Ледяная стрела', 'Святое сияние', 'Темная магия',
  'Каменный голем', 'Стеклянная пушка', 'Божественное вмешательство', 'Призыв нежити', 'Энергетический щит'
];

// Псевдослучайный генератор
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function getAbilityForEmoji(emoji: string, seed: number): string {
  let theme = 'default';
  const codePoint = emoji.codePointAt(0) || 0;

  if (['🔥','🌋','☄️','🧨','🎇'].includes(emoji)) theme = 'fire';
  else if (['❄️','☃️','🥶','🧊','🌨️'].includes(emoji)) theme = 'ice';
  else if (['🗡️','⚔️','🔫','🏹','🪓','🔪','💣'].includes(emoji)) theme = 'weapon';
  else if (['🛡️','🪖','🧱','🪨'].includes(emoji)) theme = 'shield';
  else if (['🔮','🪄','🧙','🧚','🧞','✨'].includes(emoji)) theme = 'magic';
  else if (['💀','☠️','🧟','🧛','⚰️','🩸','👻'].includes(emoji)) theme = 'death';
  else if (codePoint >= 0x1F436 && codePoint <= 0x1F43E) theme = 'animal';
  else if (codePoint >= 0x1F980 && codePoint <= 0x1F9AE) theme = 'animal';
  else if (codePoint >= 0x1F330 && codePoint <= 0x1F344) theme = 'nature';
  else if (codePoint >= 0x1F600 && codePoint <= 0x1F64F) theme = 'face';
  else if (codePoint >= 0x1F910 && codePoint <= 0x1F92F) theme = 'face';
  else if (codePoint >= 0x2764 && codePoint <= 0x2764) theme = 'heart';
  else if (codePoint >= 0x1F493 && codePoint <= 0x1F49F) theme = 'heart';
  else if (codePoint >= 0x1F345 && codePoint <= 0x1F37F) theme = 'food';
  else if (codePoint >= 0x1F680 && codePoint <= 0x1F6C5) theme = 'vehicle';
  else if (codePoint >= 0x26BD && codePoint <= 0x26C3) theme = 'sport';
  else if (codePoint >= 0x1F3C0 && codePoint <= 0x1F3D3) theme = 'sport';

  const pool = theme === 'default' ? ALL_ABILITIES : ABILITIES_BY_THEME[theme];
  const index = Math.floor(seededRandom(seed) * pool.length);
  return pool[index];
}

export function generateCards(): CardData[] {
  const cards: CardData[] = [];

  for (let i = 0; i < 1050; i++) {
    const id = i + 1;
    const seed = id * 1337;
    const emoji = EMOJIS[i % EMOJIS.length];
    
    // Редкость от 1 до 7, с уклоном в частые
    const rarityRoll = seededRandom(seed + 2);
    let baseRarity: Rarity = 1;
    if (rarityRoll > 0.5) baseRarity = 2;
    if (rarityRoll > 0.75) baseRarity = 3;
    if (rarityRoll > 0.88) baseRarity = 4;
    if (rarityRoll > 0.95) baseRarity = 5;
    if (rarityRoll > 0.98) baseRarity = 6;
    if (rarityRoll > 0.995) baseRarity = 7;

    const rarityMultiplier = [0, 1, 2, 4, 6, 8, 10, 12][baseRarity];
    const maxHealth = 57 * rarityMultiplier;
    const minHealth = Math.max(1, Math.floor(maxHealth * 0.4));
    const health = Math.floor(seededRandom(seed + 1) * (maxHealth - minHealth + 1)) + minHealth;

    const maxPower = 10 * rarityMultiplier;
    const minPower = Math.max(1, Math.floor(maxPower * 0.4));
    const power = Math.floor(seededRandom(seed) * (maxPower - minPower + 1)) + minPower;

    const cost = Math.floor((power + health) / (4 * rarityMultiplier)) + 1;
    
    const ability = getAbilityForEmoji(emoji, seed + 3);
    
    // Симуляция количества владельцев (от 1000 до 100000)
    const ownersRoll = seededRandom(seed + 4);
    const owners = Math.floor(ownersRoll * 90000) + 5000; 

    const usageRate = Math.floor(seededRandom(seed + 5) * 100);

    cards.push({
      id,
      name: `Эмодзи ${emoji}`,
      emoji: emoji,
      baseRarity,
      power,
      health,
      cost,
      ability,
      owners,
      usageRate,
      imageUrl: `https://picsum.photos/seed/card${id}/400/300`,
    });
  }

  // Add ancient cards
  const ANCIENT_EMOJIS = ['𓋹', '𓁈', '𓃠', '𓆃', '☥', '𓅓', '𓆣', '𓃭', '𓆗', '☽', '𖤓', '༄'];
  
  for (let i = 0; i < ANCIENT_EMOJIS.length; i++) {
    const id = 1051 + i;
    const seed = id * 1337;
    const emoji = ANCIENT_EMOJIS[i];
    
    // Rarity from 5 to 7
    const rarityRoll = seededRandom(seed + 2);
    let baseRarity: Rarity = 5;
    if (rarityRoll > 0.6) baseRarity = 6;
    if (rarityRoll > 0.9) baseRarity = 7;

    const rarityMultiplier = [0, 1, 2, 4, 6, 8, 10, 12][baseRarity];
    const maxHealth = 65 * rarityMultiplier; // slightly stronger
    const minHealth = Math.max(1, Math.floor(maxHealth * 0.5));
    const health = Math.floor(seededRandom(seed + 1) * (maxHealth - minHealth + 1)) + minHealth;

    const maxPower = 12 * rarityMultiplier; // slightly stronger
    const minPower = Math.max(1, Math.floor(maxPower * 0.5));
    const power = Math.floor(seededRandom(seed) * (maxPower - minPower + 1)) + minPower;

    const cost = Math.floor((power + health) / (4 * rarityMultiplier)) + 1;
    const ability = getAbilityForEmoji(emoji, seed + 3);

    cards.push({
      id,
      name: `Древняя карта ${emoji}`,
      emoji,
      baseRarity,
      power,
      health,
      cost,
      ability,
      owners: 1000,
      usageRate: 50,
      imageUrl: `https://picsum.photos/seed/card${id}/400/300`,
    });
  }

  // Add Ultra card
  cards.push({
    id: 1051 + ANCIENT_EMOJIS.length,
    name: 'Глаз Гора',
    emoji: '𓂀',
    baseRarity: 8 as Rarity,
    power: 180,
    health: 1024,
    cost: 10,
    ability: 'Божественное вмешательство',
    owners: 10,
    usageRate: 100,
    imageUrl: `https://picsum.photos/seed/card${1051 + ANCIENT_EMOJIS.length}/400/300`,
  });

  return cards; 
}

// Глобальная база карт
export const ALL_CARDS = generateCards();

/**
 * Вычисляет текущую редкость карты в зависимости от недели и популярности.
 * Правило: Если владельцев < 20000, редкость НЕ меняется.
 * Иначе: Редкость меняется по псевдорандому, зависящему от недели и usageRate.
 */
const EPOCH_START = new Date('2024-01-01T00:00:00Z').getTime();
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export function getWeekNumber(): number {
  const now = Date.now();
  const elapsed = now - EPOCH_START;
  return Math.floor(elapsed / WEEK_MS) + 1;
}

export function getCurrentRarity(card: CardData, weekNumber: number, cardStats?: CardStats): Rarity {
  if (card.baseRarity === 8) return 8; // Ultra cards don't change rarity

  const realOwners = cardStats ? (cardStats.owners[card.id] || 0) : card.owners;
  const realUsage = cardStats ? (cardStats.totalPlayers > 0 ? ((cardStats.usage[card.id] || 0) / cardStats.totalPlayers) * 100 : 0) : card.usageRate;

  // Сид зависит от ID карты и номера недели
  const shiftSeed = card.id * 777 + weekNumber * 333;
  const randomShift = seededRandom(shiftSeed);
  
  // Сдвиг от -2 до +2
  let shift = Math.floor(randomShift * 5) - 2;
  
  // Если usageRate очень высокий (>80), карта становится "попсовой" (падает редкость)
  // Если usageRate очень низкий (<20), карта становится более редкой
  if (realUsage > 80) shift -= 1;
  if (realUsage < 20) shift += 1;

  let newRarity = card.baseRarity + shift;
  
  // Ограничиваем от 1 до 7
  if (newRarity < 1) newRarity = 1;
  if (newRarity > 7) newRarity = 7;

  return newRarity as Rarity;
}

export function getRarityBuffMultiplier(rarity: Rarity): number {
  switch (rarity) {
    case 1: return 1.0;  // +0%
    case 2: return 1.1;  // +10%
    case 3: return 1.2;  // +20%
    case 4: return 1.3;  // +30%
    case 5: return 1.5;  // +50%
    case 6: return 1.75; // +75%
    case 7: return 2.0;  // +100%
    case 8: return 2.5;  // +150%
    default: return 1.0;
  }
}

export function getBuffedStats(card: CardData, weekNumber: number, cardStats?: CardStats, upgradeInfo?: { level: number, ascension: number }, battles?: number): { power: number, health: number } {
  const currentRarity = getCurrentRarity(card, weekNumber, cardStats);
  const multiplier = getRarityBuffMultiplier(currentRarity);
  
  let power = card.power * multiplier;
  let health = card.health * multiplier;

  if (upgradeInfo) {
    // Level gives +10% per level above 1
    const levelBonus = 1 + 0.1 * (upgradeInfo.level - 1);
    // Ascension gives +100% per ascension
    const ascensionBonus = 1 + 1.0 * upgradeInfo.ascension;
    
    power = power * levelBonus * ascensionBonus;
    health = health * levelBonus * ascensionBonus;
  }
  
  if (battles) {
    const veteranLevel = Math.min(10, Math.floor(battles / 10));
    const veteranBonus = 1 + 0.1 * veteranLevel;
    power = power * veteranBonus;
    health = health * veteranBonus;
  }
  
  let finalPower = Math.round(power);
  let finalHealth = Math.round(health);

  if (power > card.power && finalPower === card.power) finalPower += 1;
  if (health > card.health && finalHealth === card.health) finalHealth += 1;

  return {
    power: Math.max(1, finalPower),
    health: Math.max(1, finalHealth)
  };
}

export function drawCard(weekNumber: number, cardStats?: CardStats, packType: 'normal' | 'golden' | 'ancient' = 'normal'): CardData {
  const roll = Math.random() * 100;
  let targetRarity: Rarity = 1;

  if (packType === 'ancient') {
    if (roll < 0.001) targetRarity = 8; // 0.001%
    else if (roll < 0.101) targetRarity = 7; // 0.1%
    else if (roll < 1.101) targetRarity = 6; // 1%
    else if (roll < 5.101) targetRarity = 5; // 4%
    else if (roll < 30.101) targetRarity = 4; // 25%
    else targetRarity = 3; // ~69.899%
  } else if (packType === 'golden') {
    if (roll < 13.6) targetRarity = 1; // ~13.6%
    else if (roll < 13.6 + 5.85) targetRarity = 2; // ~5.85%
    else if (roll < 19.45 + 50) targetRarity = 3; // 50% (10 * 5)
    else if (roll < 69.45 + 25) targetRarity = 4; // 25% (5 * 5)
    else if (roll < 94.45 + 5) targetRarity = 5; // 5% (1 * 5)
    else if (roll < 99.45 + 0.5) targetRarity = 6; // 0.5% (0.1 * 5)
    else targetRarity = 7; // 0.05% (0.01 * 5)
  } else {
    if (roll < 58.89) targetRarity = 1; // 58.89%
    else if (roll < 58.89 + 25) targetRarity = 2; // 25%
    else if (roll < 83.89 + 10) targetRarity = 3; // 10%
    else if (roll < 93.89 + 5) targetRarity = 4; // 5%
    else if (roll < 98.89 + 1) targetRarity = 5; // 1%
    else if (roll < 99.89 + 0.1) targetRarity = 6; // 0.1%
    else targetRarity = 7; // 0.01%
  }

  // Group cards by current rarity
  const cardsByRarity: Record<Rarity, CardData[]> = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: []
  };

  for (const card of ALL_CARDS) {
    cardsByRarity[getCurrentRarity(card, weekNumber, cardStats)].push(card);
  }

  // Fallback if no cards of target rarity exist
  while (targetRarity > 1 && cardsByRarity[targetRarity].length === 0) {
    targetRarity = (targetRarity - 1) as Rarity;
  }
  if (cardsByRarity[targetRarity].length === 0) {
    for (let r = 1; r <= 8; r++) {
      if (cardsByRarity[r as Rarity].length > 0) {
        targetRarity = r as Rarity;
        break;
      }
    }
  }

  const pool = cardsByRarity[targetRarity];
  return pool[Math.floor(Math.random() * pool.length)];
}
