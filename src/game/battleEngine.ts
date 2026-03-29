import { CardData } from '../types';
import { ALL_CARDS, getBuffedStats } from './generator';
import { getLeague } from './leagues';

export interface BattleEvent {
  type: 'ATTACK' | 'DAMAGE' | 'HEAL' | 'DEATH' | 'ABILITY' | 'START' | 'END' | 'UPDATE_BOARD';
  message: string;
  translationKey?: string;
  translationParams?: Record<string, string | number>;
  source?: string;
  target?: string;
  value?: number;
  myBoard?: CardData[];
  opponentBoard?: CardData[];
}

export interface BattleResult {
  winner: string | 'draw';
  log: BattleEvent[];
  waveReached?: number;
}

export function generateBotTeam(size: number, rating: number = 0): CardData[] {
  const team: CardData[] = [];
  const league = getLeague(rating);
  
  // Determine allowed rarities based on league
  let minRarity = 1;
  let maxRarity = 2;
  let level = 1;
  let ascension = 0;
  
  if (league.name.includes('Новичок')) { minRarity = 2; maxRarity = 3; level = 3; }
  else if (league.name.includes('Среднячок')) { minRarity = 3; maxRarity = 4; level = 6; ascension = 1; }
  else if (league.name.includes('Отличник')) { minRarity = 4; maxRarity = 5; level = 10; ascension = 2; }
  else if (league.name.includes('Крутыш')) { minRarity = 5; maxRarity = 6; level = 10; ascension = 4; }
  else if (league.name.includes('Дьявол')) { minRarity = 6; maxRarity = 7; level = 10; ascension = 5; }

  const allowedCards = ALL_CARDS.filter(c => c.baseRarity >= minRarity && c.baseRarity <= maxRarity);
  const pool = allowedCards.length > 0 ? allowedCards : ALL_CARDS;

  const levelBonus = 1 + 0.1 * (level - 1);
  const ascensionBonus = 1 + 1.0 * ascension;

  for (let i = 0; i < size; i++) {
    const baseCard = pool[Math.floor(Math.random() * pool.length)];
    team.push({
      ...baseCard,
      power: Math.max(1, Math.floor(baseCard.power * levelBonus * ascensionBonus)),
      health: Math.max(1, Math.floor(baseCard.health * levelBonus * ascensionBonus))
    });
  }
  return team;
}

export function generateBossTeam(rating: number = 0): CardData[] {
  const team: CardData[] = [];
  const league = getLeague(rating);
  
  let minRarity = 3;
  let powerMultiplier = 1;
  let healthMultiplier = 2;
  
  if (league.name.includes('Новичок')) { minRarity = 3; powerMultiplier = 1.4; healthMultiplier = 4.5; }
  else if (league.name.includes('Среднячок')) { minRarity = 4; powerMultiplier = 1.6; healthMultiplier = 6; }
  else if (league.name.includes('Отличник')) { minRarity = 5; powerMultiplier = 1.8; healthMultiplier = 7.5; }
  else if (league.name.includes('Крутыш')) { minRarity = 6; powerMultiplier = 2.1; healthMultiplier = 10; }
  else if (league.name.includes('Дьявол')) { minRarity = 7; powerMultiplier = 2.5; healthMultiplier = 12; }

  const strongCards = ALL_CARDS.filter(c => c.baseRarity === minRarity);
  const pool = strongCards.length > 0 ? strongCards : ALL_CARDS.filter(c => c.baseRarity >= 3);
  const baseCard = pool[Math.floor(Math.random() * pool.length)] || ALL_CARDS[0];

  team.push({
    ...baseCard,
    name: `Босс: ${baseCard.name}`,
    power: Math.floor(baseCard.power * powerMultiplier),
    health: Math.floor(baseCard.health * healthMultiplier)
  });
  return team;
}

function applyPassiveAbilities(card: any) {
  if (card.ability === 'Каменный голем') {
    card.maxHealth = Math.floor(card.maxHealth * 1.5);
    card.health = card.maxHealth;
    card.power = Math.floor(card.power * 0.8);
  }
  if (card.ability === 'Стеклянная пушка') {
    card.maxHealth = Math.floor(card.maxHealth * 0.5);
    card.health = card.maxHealth;
    card.power = Math.floor(card.power * 2);
  }
}

export function resolveBattle(team1: CardData[], team2: CardData[], name1: string, name2: string, weekNumber: number, isBoss: boolean = false, isPvP: boolean = false): BattleResult {
  const log: BattleEvent[] = [];
  
  const t1 = team1.map((c, idx) => {
    const p = c.power;
    const h = c.health;
    const card = { ...c, power: p, health: h, maxHealth: h, owner: name1, instanceId: `my-${idx}` };
    applyPassiveAbilities(card);
    return card;
  });
  const t2 = team2.map((c, idx) => {
    let p = c.power;
    let h = c.health;
    if (!isBoss && !isPvP) {
      const buffed = getBuffedStats(c, weekNumber);
      p = buffed.power;
      h = buffed.health;
    }
    const card = { ...c, power: p, health: h, maxHealth: h, owner: name2, instanceId: `opp-${idx}` };
    applyPassiveAbilities(card);
    return card;
  });

  log.push({ 
    type: 'START', 
    message: `Бой начинается: ${name1} против ${name2}!`,
    translationKey: 'battle.start',
    translationParams: { name1, name2 }
  });

  let turn = 0;
  let t1Index = 0;
  let t2Index = 0;

  while (t1Index < t1.length && t2Index < t2.length && turn < 100) {
    turn++;
    const c1 = t1[t1Index];
    const c2 = t2[t2Index];

    // c1 attacks c2
    performAttack(c1, c2, log);
    log.push({ 
      type: 'UPDATE_BOARD', 
      message: `Обновление поля`,
      myBoard: t1.map(c => ({...c})),
      opponentBoard: t2.map(c => ({...c}))
    });

    if (c2.health <= 0) {
      log.push({ 
        type: 'DEATH', 
        message: `${c2.name} (${c2.owner}) погибает!`,
        translationKey: 'battle.death',
        translationParams: { name: c2.name, owner: c2.owner },
        source: c2.instanceId
      });
      t2Index++;
      if (t2Index >= t2.length) break;
    }

    // c2 retaliates if alive
    if (c2.health > 0) {
      performAttack(c2, c1, log);
      log.push({ 
        type: 'UPDATE_BOARD', 
        message: `Обновление поля`,
        myBoard: t1.map(c => ({...c})),
        opponentBoard: t2.map(c => ({...c}))
      });

      if (c1.health <= 0) {
        log.push({ 
          type: 'DEATH', 
          message: `${c1.name} (${c1.owner}) погибает!`,
          translationKey: 'battle.death',
          translationParams: { name: c1.name, owner: c1.owner },
          source: c1.instanceId
        });
        t1Index++;
      }
    }
  }

  let winner = 'draw';
  if (t1Index >= t1.length && t2Index < t2.length) winner = name2;
  else if (t2Index >= t2.length && t1Index < t1.length) winner = name1;

  log.push({ 
    type: 'END', 
    message: `Бой окончен. Победитель: ${winner === 'draw' ? 'Ничья' : winner}`,
    translationKey: winner === 'draw' ? 'battle.end.draw' : 'battle.end.winner',
    translationParams: { winner }
  });

  return { winner, log };
}

export function resolveEncoreBattle(myDeck: CardData[], username: string, rating: number, weekNumber: number): BattleResult & { opponentDeck: CardData[] } {
  const log: BattleEvent[] = [];
  
  const myTeam = myDeck.map((c, idx) => {
    const card = { ...c, power: c.power, health: c.health, maxHealth: c.health, owner: username, instanceId: `my-${idx}` };
    applyPassiveAbilities(card);
    return card;
  });

  let myDeckIndex = 0;
  let myBoard: CardData[] = [];
  
  // Fill initial board
  while (myBoard.length < 3 && myDeckIndex < myTeam.length) {
    myBoard.push(myTeam[myDeckIndex]);
    myDeckIndex++;
  }

  let wave = 1;
  let enemyBoard: CardData[] = [];
  let enemyTeamFull: CardData[] = [];

  log.push({ 
    type: 'START', 
    message: `Режим "На бис" начинается! Игрок ${username} готов.`,
    translationKey: 'battle.encore.start',
    translationParams: { username }
  });

  for (; wave <= 10; wave++) {
    if (myBoard.length === 0) break;

    log.push({ 
      type: 'START', 
      message: `--- Волна ${wave} ---`,
      translationKey: 'battle.encore.wave',
      translationParams: { wave }
    });
    
    const isBoss = wave === 10;
    const enemyTeamRaw = isBoss ? generateBossTeam(rating) : generateBotTeam(3, rating);
    
    const currentEnemyTeam = enemyTeamRaw.map((c, idx) => {
      let p = c.power;
      let h = c.health;
      if (!isBoss) {
        const buffed = getBuffedStats(c, weekNumber);
        p = buffed.power;
        h = buffed.health;
      }
      const card = { ...c, power: p, health: h, maxHealth: h, owner: isBoss ? '__BOSS__' : `__BOT__ ${wave}`, instanceId: `enemy-${wave}-${idx}` };
      applyPassiveAbilities(card);
      return card;
    });

    enemyTeamFull = enemyTeamFull.concat(currentEnemyTeam);
    enemyBoard = [...currentEnemyTeam];

    log.push({ 
      type: 'UPDATE_BOARD', 
      message: `Волна ${wave} началась!`,
      myBoard: myBoard.map(c => ({...c})),
      opponentBoard: enemyBoard.map(c => ({...c}))
    });

    let turn = 0;
    while (myBoard.length > 0 && enemyBoard.length > 0 && turn < 100) {
      turn++;

      // Player attacks
      for (let i = 0; i < myBoard.length; i++) {
        const attacker = myBoard[i];
        if (attacker.health <= 0) continue;
        
        const aliveEnemies = enemyBoard.filter(e => e.health > 0);
        if (aliveEnemies.length === 0) break;
        
        const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        performAttack(attacker, target, log);
        log.push({ 
          type: 'UPDATE_BOARD', 
          message: `Обновление поля`,
          myBoard: myBoard.map(c => ({...c})),
          opponentBoard: enemyBoard.map(c => ({...c}))
        });
      }

      // Remove dead enemies
      enemyBoard = enemyBoard.filter(e => {
        if (e.health <= 0) {
          log.push({ 
            type: 'DEATH', 
            message: `${e.name} (${e.owner}) погибает!`,
            translationKey: 'battle.death',
            translationParams: { name: e.name, owner: e.owner },
            source: e.instanceId
          });
          return false;
        }
        return true;
      });

      // Enemy attacks
      for (let i = 0; i < enemyBoard.length; i++) {
        const attacker = enemyBoard[i];
        if (attacker.health <= 0) continue;
        
        const alivePlayers = myBoard.filter(p => p.health > 0);
        if (alivePlayers.length === 0) break;
        
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        performAttack(attacker, target, log);
        log.push({ 
          type: 'UPDATE_BOARD', 
          message: `Обновление поля`,
          myBoard: myBoard.map(c => ({...c})),
          opponentBoard: enemyBoard.map(c => ({...c}))
        });
      }

      // Remove dead players and replace
      let boardChanged = false;
      myBoard = myBoard.filter(p => {
        if (p.health <= 0) {
          log.push({ 
            type: 'DEATH', 
            message: `${p.name} (${p.owner}) погибает!`,
            translationKey: 'battle.death',
            translationParams: { name: p.name, owner: p.owner },
            source: p.instanceId
          });
          boardChanged = true;
          return false;
        }
        return true;
      });

      // Fill player board
      while (myBoard.length < 3 && myDeckIndex < myTeam.length) {
        myBoard.push(myTeam[myDeckIndex]);
        log.push({ 
          type: 'START', 
          message: `${myTeam[myDeckIndex].name} выходит на поле!`,
          translationKey: 'battle.encore.entersField',
          translationParams: { name: myTeam[myDeckIndex].name }
        });
        myDeckIndex++;
        boardChanged = true;
      }

      if (boardChanged || turn % 2 === 0) {
        log.push({ 
          type: 'UPDATE_BOARD', 
          message: `Обновление поля`,
          myBoard: myBoard.map(c => ({...c})),
          opponentBoard: enemyBoard.map(c => ({...c}))
        });
      }
    }

    if (myBoard.length === 0) {
      break;
    }
  }

  let winner = myBoard.length > 0 ? username : 'Бот';
  log.push({ 
    type: 'END', 
    message: `Режим "На бис" окончен. ${winner === username ? 'Вы прошли все волны!' : `Вы проиграли на волне ${wave}`}`,
    translationKey: winner === username ? 'battle.encore.win' : 'battle.encore.lose',
    translationParams: { wave }
  });

  return { winner, log, waveReached: Math.min(wave, 10), opponentDeck: enemyTeamFull };
}

export function resolveEncore(team1: CardData[], rating: number, name1: string, weekNumber: number): BattleResult & { opponentDeck: CardData[] } {
  const log: BattleEvent[] = [];
  
  const t1 = team1.map(c => {
    return { ...c, maxHealth: c.health, owner: name1 };
  });

  const botDeck: CardData[] = [];
  for (let i = 0; i < 9; i++) {
    botDeck.push(...generateBotTeam(3, rating));
  }
  botDeck.push(...generateBossTeam(rating));

  const t2 = botDeck.map((c, index) => {
    let p = c.power;
    let h = c.health;
    const isBoss = index >= botDeck.length - 5; // Boss team has 1 card but generateBossTeam returns 1 card. Wait, generateBossTeam returns 1 card.
    // Actually generateBossTeam returns 1 card. So botDeck length is 9*3 + 1 = 28.
    // The boss is the last card.
    if (index < 27) {
      const buffed = getBuffedStats(c, weekNumber);
      p = buffed.power;
      h = buffed.health;
    }
    return { ...c, power: p, health: h, maxHealth: h, owner: '__ENCORE__' };
  });

  log.push({ 
    type: 'START', 
    message: `Режим "На бис" начинается! 10 волн врагов.`,
    translationKey: 'battle.encore.start10'
  });

  let turn = 0;
  let t1Index = 0;
  let t2Index = 0;
  let currentWave = 0;

  while (t1Index < t1.length && t2Index < t2.length && turn < 1000) {
    turn++;
    
    let expectedWave = Math.floor(t2Index / 3) + 1;
    if (expectedWave > 10) expectedWave = 10;
    
    if (expectedWave > currentWave) {
      currentWave = expectedWave;
      log.push({ 
        type: 'START', 
        message: `--- Волна ${currentWave} начинается! ---`,
        translationKey: 'battle.encore.waveStart',
        translationParams: { wave: currentWave }
      });
    }

    const c1 = t1[t1Index];
    const c2 = t2[t2Index];

    performAttack(c1, c2, log);
    if (c2.health <= 0) {
      log.push({ 
        type: 'DEATH', 
        message: `${c2.name} (${c2.owner}) погибает!`,
        translationKey: 'battle.death',
        translationParams: { name: c2.name, owner: c2.owner }
      });
      t2Index++;
      if (t2Index >= t2.length) break;
    }

    if (c2.health > 0) {
      performAttack(c2, c1, log);
      if (c1.health <= 0) {
        log.push({ 
          type: 'DEATH', 
          message: `${c1.name} (${c1.owner}) погибает!`,
          translationKey: 'battle.death',
          translationParams: { name: c1.name, owner: c1.owner }
        });
        t1Index++;
      }
    }
  }

  let winner = 'draw';
  if (t1Index >= t1.length && t2Index < t2.length) winner = 'Волны Врагов';
  else if (t2Index >= t2.length && t1Index < t1.length) winner = name1;

  log.push({ 
    type: 'END', 
    message: `Режим "На бис" окончен. Победитель: ${winner === 'draw' ? 'Ничья' : winner}`,
    translationKey: winner === 'draw' ? 'battle.end.draw' : 'battle.end.winner',
    translationParams: { winner }
  });

  return { winner, log, opponentDeck: botDeck };
}

function performAttack(attacker: any, defender: any, globalLog: BattleEvent[]) {
  const log = {
    push: (e: BattleEvent) => {
      if (!e.source) e.source = attacker.instanceId;
      if (!e.target) e.target = defender.instanceId;
      globalLog.push(e);
    }
  };
  if (attacker.health <= 0) return;

  if (attacker.isPoisoned) {
    const poisonDamage = Math.floor(attacker.maxHealth * 0.05);
    attacker.health -= poisonDamage;
    log.push({ type: 'DAMAGE', message: `${attacker.name} получает ${poisonDamage} урона от яда!`, value: poisonDamage });
    if (attacker.health <= 0) return;
  }
  if (attacker.isBleeding) {
    const bleedDamage = Math.floor(attacker.maxHealth * 0.05);
    attacker.health -= bleedDamage;
    log.push({ type: 'DAMAGE', message: `${attacker.name} получает ${bleedDamage} урона от кровотечения!`, value: bleedDamage });
    if (attacker.health <= 0) return;
  }

  if (attacker.ability === 'Смертельный яд' && !attacker.isSilenced) {
    defender.isPoisoned = true;
    log.push({ type: 'ABILITY', message: `${attacker.name} использует Смертельный яд (отравление)!` });
  }

  if (attacker.isStunned) {
    attacker.isStunned = false;
    log.push({ 
      type: 'ABILITY', 
      message: `${attacker.name} оглушен и пропускает ход!`,
      translationKey: 'battle.ability.stunned',
      translationParams: { name: attacker.name }
    });
    return;
  }

  // Start of attack abilities
  if (!attacker.hasAttacked) {
    attacker.hasAttacked = true;
    if (attacker.ability === 'Боевой клич') attacker.power = Math.floor(attacker.power * 1.5);
    if (attacker.ability === 'Рывок') attacker.power = Math.floor(attacker.power * 1.5);
    if (attacker.ability === 'Аура силы') attacker.power = Math.floor(attacker.power * 1.2);
    if (attacker.ability === 'Гнев титана' && defender.maxHealth > attacker.maxHealth) {
      attacker.power = Math.floor(attacker.power * 1.5);
      log.push({ type: 'ABILITY', message: `${attacker.name} использует Гнев титана (+50% урона)!` });
    }
    if (attacker.ability === 'Убийца гигантов' && defender.health > attacker.health) {
      attacker.power = Math.floor(attacker.power * 2);
      log.push({ type: 'ABILITY', message: `${attacker.name} использует Убийцу гигантов (+100% урона)!` });
    }
    if (attacker.ability === 'Благословение') {
      attacker.maxHealth = Math.floor(attacker.maxHealth * 1.2);
      attacker.health += Math.floor(attacker.maxHealth * 0.2);
    }
    if (attacker.ability === 'Немота' && !defender.isSilenced) {
      defender.isSilenced = true;
      log.push({ type: 'ABILITY', message: `${attacker.name} накладывает Немоту на ${defender.name}!` });
    }
    if (attacker.ability === 'Проклятие') {
      defender.maxHealth = Math.floor(defender.maxHealth * 0.8);
      defender.health = Math.min(defender.health, defender.maxHealth);
    }
    if (attacker.ability === 'Аура слабости') {
      defender.power = Math.floor(defender.power * 0.8);
    }
  }

  if (!defender.hasDefended) {
    defender.hasDefended = true;
    if (defender.ability === 'Неуязвимость на 1 ход' && !defender.isSilenced) defender.invulnerable = true;
    if (defender.ability === 'Магический щит' && !defender.isSilenced) defender.magicShieldActive = true;
    if (defender.ability === 'Иллюзия' && !defender.isSilenced) defender.illusionActive = true;
  }

  if (attacker.ability === 'Очищение' && !attacker.isSilenced) {
    if (attacker.isPoisoned || attacker.isBleeding) {
      attacker.isPoisoned = false;
      attacker.isBleeding = false;
      log.push({ type: 'ABILITY', message: `${attacker.name} очищается от негативных эффектов!` });
    }
  }

  if (attacker.ability === 'Святое сияние' && !attacker.isSilenced) {
    if (attacker.isPoisoned || attacker.isBleeding) {
      attacker.isPoisoned = false;
      attacker.isBleeding = false;
    }
    const heal = Math.floor(attacker.maxHealth * 0.1);
    attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
    log.push({ type: 'ABILITY', message: `${attacker.name} использует Святое сияние (очищение и +${heal} HP)!`, value: heal });
  }

  if (attacker.ability === 'Медитация' && !attacker.isSilenced) {
    const heal = Math.floor(attacker.maxHealth * 0.05);
    attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
  }

  log.push({ 
    type: 'ATTACK', 
    message: `${attacker.name} (${attacker.owner}) атакует ${defender.name} (${defender.owner})!`,
    translationKey: 'battle.attack',
    translationParams: { attackerName: attacker.name, attackerOwner: attacker.owner, defenderName: defender.name, defenderOwner: defender.owner }
  });
  
  let damage = attacker.power;
  
  if (attacker.ability === 'Кровавая жажда' && !attacker.isSilenced) {
    const missingHpPercent = 1 - (attacker.health / attacker.maxHealth);
    const bonus = Math.floor(missingHpPercent * 10) * 0.1;
    damage = Math.floor(damage * (1 + bonus));
  }

  if (attacker.ability === 'Берсерк' && attacker.health < attacker.maxHealth * 0.5 && !attacker.isSilenced) {
    damage = Math.floor(damage * 1.5);
  }
  if (attacker.ability === 'Глухая оборона' && !attacker.isSilenced) {
    damage = Math.floor(damage * 0.5);
  }
  if (attacker.ability === 'Удар в спину' && !attacker.attacksCount && !attacker.isSilenced) {
    damage = Math.floor(damage * 3);
  }
  
  let isDouble = attacker.ability === 'Двойной удар' && !attacker.isSilenced;
  let isPiercing = (attacker.ability === 'Пробивание брони' || attacker.ability === 'Пробивание щитов') && !attacker.isSilenced;
  let isShieldPiercing = attacker.ability === 'Пробивание щитов' && !attacker.isSilenced;
  let isVampire = attacker.ability === 'Вампиризм' && !attacker.isSilenced;
  let isSniper = attacker.ability === 'Снайпер' && !attacker.isSilenced;
  
  const attacks = isDouble ? 2 : 1;

  for (let i = 0; i < attacks; i++) {
    if (defender.health <= 0) break;
    attacker.attacksCount = (attacker.attacksCount || 0) + 1;

    let dodged = false;
    if (!isSniper) {
      if (defender.ability === 'Уклонение' && !defender.isSilenced && Math.random() < 0.2) dodged = true;
      if (defender.ability === 'Невидимость' && !defender.isSilenced && defender.health > defender.maxHealth * 0.5 && Math.random() < 0.5) dodged = true;
      if (defender.illusionActive && Math.random() < 0.5) {
        dodged = true;
        defender.illusionActive = false;
      }
      if (attacker.ability === 'Ослепление' && !attacker.isSilenced && Math.random() < 0.3) dodged = true;
    }

    if (dodged) {
      log.push({ type: 'ABILITY', message: `${defender.name} уклоняется от атаки!` });
      continue;
    }

    if (defender.invulnerable) {
      log.push({ type: 'ABILITY', message: `${defender.name} использует Неуязвимость и игнорирует урон!` });
      defender.invulnerable = false;
      continue;
    }
    if (defender.magicShieldActive && !isShieldPiercing) {
      log.push({ type: 'ABILITY', message: `${defender.name} использует Магический щит и игнорирует урон!` });
      defender.magicShieldActive = false;
      continue;
    }

    let finalDamage = damage;
    
    if (attacker.ability === 'Удар молнии' && !attacker.isSilenced && Math.random() < 0.2) {
      finalDamage *= 2;
      defender.isStunned = true;
      log.push({ type: 'ABILITY', message: `${attacker.name} использует Удар молнии (200% урона и оглушение)!` });
    }
    if (attacker.ability === 'Огненный шторм' && !attacker.isSilenced && Math.random() < 0.2) {
      finalDamage = Math.floor(finalDamage * 1.5);
      defender.isBleeding = true;
      log.push({ type: 'ABILITY', message: `${attacker.name} использует Огненный шторм (150% урона и кровотечение)!` });
    }
    if (attacker.ability === 'Божественное вмешательство' && !attacker.isSilenced && Math.random() < 0.05) {
      finalDamage = defender.health;
      log.push({ type: 'ABILITY', message: `${attacker.name} использует Божественное вмешательство (Мгновенное убийство)!` });
    }

    if (attacker.ability === 'Критический удар' && !attacker.isSilenced && Math.random() < 0.2) {
      finalDamage *= 2;
      log.push({ type: 'ABILITY', message: `Критический удар от ${attacker.name}!` });
    }
    if (attacker.ability === 'Гнев богов' && !attacker.isSilenced && Math.random() < 0.05) {
      finalDamage = defender.health + 999;
      log.push({ type: 'ABILITY', message: `${attacker.name} обрушивает Гнев богов!` });
    }
    if (attacker.ability === 'Огненный шар' && attacker.attacksCount === 1 && !attacker.isSilenced) {
      finalDamage += Math.floor(defender.maxHealth * 0.2);
    }

    if (defender.ability === 'Метка смерти' && !defender.isSilenced) {
      finalDamage = Math.floor(finalDamage * 1.2);
    }

    let hasShield = defender.ability === 'Щит' && !defender.isSilenced && !isShieldPiercing;
    if (hasShield && !isPiercing && !isSniper) {
      finalDamage = Math.ceil(finalDamage / 2);
      log.push({ 
        type: 'ABILITY', 
        message: `${defender.name} использует Щит и снижает урон!`,
        translationKey: 'battle.ability.shield',
        translationParams: { name: defender.name }
      });
    }
    
    if (defender.ability === 'Каменная кожа' && !defender.isSilenced && !isPiercing && !isShieldPiercing) {
      finalDamage = Math.ceil(finalDamage * 0.7);
    }
    if (defender.ability === 'Глухая оборона' && !defender.isSilenced && !isPiercing && !isShieldPiercing) {
      finalDamage = Math.ceil(finalDamage * 0.5);
    }
    if (defender.ability === 'Ледяная броня' && !defender.isSilenced && !isShieldPiercing) {
      finalDamage = Math.floor(finalDamage * 0.7);
      if (Math.random() < 0.1) {
        attacker.isStunned = true;
        log.push({ type: 'ABILITY', message: `${defender.name} использует Ледяную броню (заморозка)!` });
      }
    }
    if (defender.ability === 'Энергетический щит' && !defender.isSilenced && defender.health < defender.maxHealth * 0.3 && !isShieldPiercing) {
      const heal = Math.floor(finalDamage * 0.5);
      defender.health = Math.min(defender.maxHealth, defender.health + heal);
      finalDamage = Math.floor(finalDamage * 0.5);
      log.push({ type: 'ABILITY', message: `${defender.name} использует Энергетический щит (поглощение ${heal} урона)!`, value: heal });
    }

    let reflected = false;
    if (defender.ability === 'Отражение' && !defender.isSilenced && Math.random() < 0.1) {
      reflected = true;
      log.push({ type: 'ABILITY', message: `${defender.name} отражает атаку!` });
      attacker.health -= finalDamage;
      finalDamage = 0;
    }
    if (defender.ability === 'Парирование' && !defender.isSilenced && Math.random() < 0.15) {
      log.push({ type: 'ABILITY', message: `${defender.name} парирует атаку и бьет в ответ!` });
      attacker.health -= Math.floor(defender.power * 0.5);
      finalDamage = 0;
    }
    if (defender.ability === 'Отражение урона' && !defender.isSilenced) {
      const reflectDamage = Math.floor(finalDamage * 0.3);
      attacker.health -= reflectDamage;
      log.push({ type: 'ABILITY', message: `${defender.name} использует Отражение урона (возвращает ${reflectDamage} урона)!`, value: reflectDamage });
    }

    if (!reflected && finalDamage > 0) {
      defender.health -= finalDamage;
      log.push({ 
        type: 'DAMAGE', 
        message: `${defender.name} получает ${finalDamage} урона. (Осталось: ${Math.max(0, defender.health)} HP)`,
        translationKey: 'battle.damage',
        translationParams: { name: defender.name, damage: finalDamage, hp: Math.max(0, defender.health) },
        value: finalDamage
      });

      if (attacker.ability === 'Казнь' && !attacker.isSilenced && defender.health > 0 && defender.health < defender.maxHealth * 0.2) {
        log.push({ type: 'ABILITY', message: `${attacker.name} совершает Казнь!` });
        defender.health = 0;
      }
      if (attacker.ability === 'Огненная аура' && !attacker.isSilenced) {
        const burnDamage = Math.floor(attacker.maxHealth * 0.05);
        defender.health -= burnDamage;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Огненную ауру (${burnDamage} урона)!`, value: burnDamage });
      }
      if (attacker.ability === 'Отравленные клинки' && !attacker.isSilenced && Math.random() < 0.3) {
        defender.isPoisoned = true;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Отравленные клинки (отравление)!` });
      }
      if (attacker.ability === 'Землетрясение' && !attacker.isSilenced && Math.random() < 0.1) {
        defender.isStunned = true;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Землетрясение (оглушение)!` });
      }
      if (attacker.ability === 'Целитель' && !attacker.isSilenced) {
        const heal = Math.floor(attacker.maxHealth * 0.1);
        attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Целитель (+${heal} HP)!`, value: heal });
      }
      if (attacker.ability === 'Проклятие слабости' && !attacker.isSilenced && Math.random() < 0.2) {
        defender.isWeakened = true;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Проклятие слабости (слабость)!` });
      }
      if (attacker.ability === 'Кража жизни' && !attacker.isSilenced) {
        const heal = Math.floor(finalDamage * 0.5);
        attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Кражу жизни (+${heal} HP)!`, value: heal });
      }
      if (attacker.ability === 'Ледяная стрела' && !attacker.isSilenced && Math.random() < 0.2) {
        defender.isStunned = true;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Ледяную стрелу (заморозка)!` });
      }
      if (attacker.ability === 'Темная магия' && !attacker.isSilenced) {
        const darkDamage = Math.floor(defender.maxHealth * 0.05);
        defender.health -= darkDamage;
        log.push({ type: 'ABILITY', message: `${attacker.name} использует Темную магию (${darkDamage} урона)!`, value: darkDamage });
      }
      if (attacker.ability === 'Кража силы' && !attacker.isSilenced) {
        const stolen = Math.max(1, Math.floor(defender.power * 0.1));
        defender.power -= stolen;
        attacker.power += stolen;
      }
      if (attacker.ability === 'Ледяной удар' && !attacker.isSilenced) {
        defender.power = Math.floor(defender.power * 0.9);
      }
      if (attacker.ability === 'Оглушение' && !attacker.isSilenced && Math.random() < 0.25) {
        defender.isStunned = true;
      }
      if (defender.ability === 'Контрудар' && !defender.isSilenced) {
        attacker.health -= Math.floor(finalDamage * 0.5);
      }
      if (defender.ability === 'Шипы' && !defender.isSilenced) {
        attacker.health -= Math.floor(attacker.maxHealth * 0.1);
      }
      if (defender.ability === 'Проклятая кровь' && !defender.isSilenced) {
        attacker.health -= Math.floor(attacker.maxHealth * 0.05);
      }
    }

    if (isVampire) {
      const heal = Math.ceil(finalDamage / 2);
      attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
      log.push({ 
        type: 'HEAL', 
        message: `${attacker.name} вампиризмом восстанавливает ${heal} HP!`,
        translationKey: 'battle.ability.vampirism',
        translationParams: { name: attacker.name, heal },
        value: heal
      });
    }
    if (attacker.ability === 'Энергетический вампир' && !attacker.isSilenced) {
      const heal = Math.max(1, Math.floor(defender.power * 0.1));
      attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
    }
  }

  // End of attack abilities
  if (attacker.ability === 'Регенерация' && !attacker.isSilenced) {
    const heal = Math.floor(attacker.maxHealth * 0.1);
    attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
  }
  if (attacker.ability === 'Адаптация' && !attacker.isSilenced) {
    attacker.power = Math.floor(attacker.power * 1.1);
    attacker.maxHealth = Math.floor(attacker.maxHealth * 1.1);
    attacker.health += Math.floor(attacker.maxHealth * 0.1);
  }
  if (attacker.ability === 'Яд' && !attacker.isSilenced) {
    defender.health -= Math.floor(defender.maxHealth * 0.1);
    log.push({ type: 'ABILITY', message: `${defender.name} получает урон от Яда!` });
  }
  if (attacker.ability === 'Кровотечение' && !attacker.isSilenced) {
    defender.health -= Math.floor(defender.maxHealth * 0.05);
  }
  if (attacker.ability === 'Токсичность' && !attacker.isSilenced) {
    defender.health -= Math.floor(defender.maxHealth * 0.05);
  }

  checkDeath(attacker, defender, globalLog);
  checkDeath(defender, attacker, globalLog);
}

function checkDeath(card: any, killer: any, globalLog: BattleEvent[]) {
  const log = {
    push: (e: BattleEvent) => {
      if (!e.source) e.source = card.instanceId;
      if (!e.target) e.target = killer.instanceId;
      globalLog.push(e);
    }
  };
  if (card.health <= 0) {
    if (card.ability === 'Святой щит' && !card.isSilenced && !card.holyShieldUsed) {
      card.holyShieldUsed = true;
      card.health = Math.floor(card.maxHealth * 0.1);
      log.push({ type: 'ABILITY', message: `${card.name} спасается Святым щитом!` });
      return;
    }
    if (card.ability === 'Некромантия' && !card.isSilenced && !card.revived) {
      card.revived = true;
      card.health = Math.floor(card.maxHealth * 0.3);
      log.push({ type: 'ABILITY', message: `${card.name} восстает из мертвых!` });
      return;
    }
    if (card.ability === 'Предсмертный хрип' && !card.isSilenced && !card.deathrattleUsed) {
      card.deathrattleUsed = true;
      killer.health -= card.power;
      log.push({ type: 'ABILITY', message: `Предсмертный хрип ${card.name} наносит ${card.power} урона!` });
    }
    if (card.ability === 'Призыв нежити' && !card.isSilenced && !card.undeadSummoned) {
      card.undeadSummoned = true;
      card.health = Math.floor(card.maxHealth * 0.5);
      card.power = Math.floor(card.power * 0.5);
      card.name = `Скелет (${card.name})`;
      log.push({ type: 'ABILITY', message: `${card.name} призывает нежить после смерти!` });
      return;
    }
  }
}
