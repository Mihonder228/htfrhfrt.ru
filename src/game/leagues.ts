export interface League {
  name: string;
  minRating: number;
  botGold: number;
  pvpGold: number;
}

export const LEAGUES: League[] = [
  { name: 'Начинающийся 😭', minRating: 0, botGold: 100, pvpGold: 250 },
  { name: 'Новичок ☹️', minRating: 1000, botGold: 200, pvpGold: 450 },
  { name: 'Среднячок 😐', minRating: 2000, botGold: 400, pvpGold: 850 },
  { name: 'Отличник ☺️', minRating: 3000, botGold: 1000, pvpGold: 1500 },
  { name: 'Крутыш 😎', minRating: 4000, botGold: 2500, pvpGold: 3500 },
  { name: 'Дьявол 😈', minRating: 5000, botGold: 4000, pvpGold: 8000 },
];

export function getLeague(rating: number = 0): League {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (rating >= LEAGUES[i].minRating) return LEAGUES[i];
  }
  return LEAGUES[0];
}

export function getLeagueIndex(rating: number = 0): number {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (rating >= LEAGUES[i].minRating) return i;
  }
  return 0;
}

export function getNextLeague(rating: number = 0): League | null {
  for (let i = 0; i < LEAGUES.length; i++) {
    if (rating < LEAGUES[i].minRating) return LEAGUES[i];
  }
  return null;
}

export function calculateRatingChange(won: boolean, mode: string, draw: boolean = false): number {
  if (draw) return 0;
  if (mode === 'encore') return 0; // No rating for encore
  if (mode === 'pvp') {
    return won ? 50 : -25;
  } else if (mode === 'boss') {
    return won ? 30 : -15;
  } else {
    // pve
    return won ? 20 : -10;
  }
}
