export type Rarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface CardData {
  id: number;
  name: string;
  emoji?: string;
  baseRarity: Rarity;
  power: number;
  health: number;
  cost: number;
  ability: string;
  owners: number; // Количество игроков, владеющих картой в мире (симуляция)
  usageRate: number; // Популярность использования (0-100)
  imageUrl: string;
  owner?: string;
  maxHealth?: number;
  instanceId?: string;
}

export interface PlayerState {
  gold: number;
  collection: Record<number, number>; // cardId -> count
  deck: number[];
  lastLoginWeek: number;
  packsOpened?: number;
  upgrades?: Record<number, { level: number, ascension: number, spentGold: number }>;
  battles?: Record<number, number>;
  friends: string[];
  rating?: number;
  showcase?: number[];
}

export interface CardStats {
  owners: Record<number, number>;
  usage: Record<number, number>;
  totalPlayers: number;
}

export const RARITY_NAMES: Record<Rarity, string> = {
  1: 'Обычная',
  2: 'Необычная',
  3: 'Редкая',
  4: 'Эпическая',
  5: 'Легендарная',
  6: 'Мифическая',
  7: 'Божественная',
  8: 'Ультра',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  1: 'from-slate-400 to-slate-600 border-slate-400 text-slate-100',
  2: 'from-green-400 to-green-700 border-green-400 text-green-50',
  3: 'from-blue-400 to-blue-700 border-blue-400 text-blue-50',
  4: 'from-purple-400 to-purple-800 border-purple-400 text-purple-50',
  5: 'from-orange-400 to-red-600 border-orange-400 text-orange-50',
  6: 'from-red-600 to-rose-900 border-red-500 text-red-50',
  7: 'from-yellow-300 via-yellow-500 to-amber-700 border-yellow-300 text-yellow-50 shadow-[0_0_20px_rgba(250,204,21,0.6)]',
  8: 'from-fuchsia-500 via-cyan-500 to-emerald-500 border-transparent text-white shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-gradient-xy',
};
