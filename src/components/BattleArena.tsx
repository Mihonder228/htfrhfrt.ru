import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { CardData, CardStats } from '../types';
import { CardView } from './CardView';
import { Swords, Users, User, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BattleEvent, BattleResult } from '../game/battleEngine';
import { getBuffedStats, getCurrentRarity } from '../game/generator';
import { getLeague, calculateRatingChange } from '../game/leagues';
import { sounds } from '../lib/soundService';
import { useLanguage } from '../contexts/LanguageContext';

interface BattleArenaProps {
  myCards: CardData[];
  weekNumber: number;
  onBattleEnd: (won: boolean, mode: string, draw?: boolean, deckUsed?: number[]) => void;
  socket: Socket;
  username: string;
  upgrades: Record<number, { level: number, ascension: number, spentGold: number }>;
  battles: Record<number, number>;
  cardStats?: CardStats;
  rating: number;
}

export const BattleArena: React.FC<BattleArenaProps> = ({ myCards, weekNumber, onBattleEnd, socket, username, upgrades, battles, cardStats, rating }) => {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<'select_mode' | 'select_deck' | 'queue' | 'battle' | 'result'>('select_mode');
  const [mode, setMode] = useState<'single' | 'team' | 'boss' | 'encore'>('single');
  const [isPvP, setIsPvP] = useState(false);
  const [selectedCards, setSelectedCards] = useState<CardData[]>([]);
  
  const [battleResult, setBattleResult] = useState<(BattleResult & { myRole: string, opponentName: string, opponentDeck: CardData[], myDeck: CardData[] }) | null>(null);
  const [visibleLog, setVisibleLog] = useState<BattleEvent[]>([]);
  const [activeMyBoard, setActiveMyBoard] = useState<CardData[]>([]);
  const [activeOpponentBoard, setActiveOpponentBoard] = useState<CardData[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [attackingCardId, setAttackingCardId] = useState<string | null>(null);
  const [defendingCardId, setDefendingCardId] = useState<string | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{ id: string, text: string, type: 'damage' | 'heal' | 'ability', targetId: string }[]>([]);
  const [deadCards, setDeadCards] = useState<Set<string>>(new Set());
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleBattleResult = (data: BattleResult & { myRole: string, opponentDeck: CardData[], myDeck: CardData[] }) => {
      setBattleResult(data);
      if (mode === 'encore') {
        setActiveMyBoard([]);
        setActiveOpponentBoard([]);
      } else {
        setActiveMyBoard(data.myDeck || []);
        setActiveOpponentBoard(data.opponentDeck || []);
      }
      setPhase('battle');
      playAnimation(data.log);
    };

    socket.on('battle_result', handleBattleResult);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      socket.off('battle_result', handleBattleResult);
    };
  }, [socket]);

  const playAnimation = (log: BattleEvent[]) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setVisibleLog([]);
    setIsAnimating(true);
    setDeadCards(new Set());
    setFloatingTexts([]);
    let i = 0;
    intervalRef.current = setInterval(() => {
      let event = log[i];
      while (event && event.type === 'UPDATE_BOARD') {
        if (event.myBoard) setActiveMyBoard(event.myBoard);
        if (event.opponentBoard) setActiveOpponentBoard(event.opponentBoard);
        i++;
        event = log[i];
      }
      
      if (!event) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsAnimating(false);
        return;
      }

      setVisibleLog(prev => [...prev, event]);
      
      if (event.type === 'ATTACK') {
        setAttackingCardId(event.source || null);
        setDefendingCardId(event.target || null);
        setTimeout(() => {
          setAttackingCardId(null);
          setDefendingCardId(null);
        }, 300);
      }
      
      if (event.type === 'DAMAGE' || event.type === 'HEAL' || event.type === 'ABILITY') {
        const textId = Math.random().toString();
        const targetId = event.target || event.source;
        if (targetId) {
          const text = event.type === 'DAMAGE' ? `-${event.value || ''}` : event.type === 'HEAL' ? `+${event.value || ''}` : (event.translationKey ? t(event.translationKey, event.translationParams as any) : event.message);
          setFloatingTexts(prev => [...prev, { id: textId, text, type: event.type.toLowerCase() as any, targetId }]);
          setTimeout(() => {
            setFloatingTexts(prev => prev.filter(ft => ft.id !== textId));
          }, 1000);
        }
      }

      if (event.type === 'DEATH' && event.source) {
        setDeadCards(prev => new Set(prev).add(event.source!));
      }
      
      i++;
    }, 400);
  };

  useEffect(() => {
    if (!isAnimating && battleResult) {
      const won = battleResult.winner === battleResult.myRole;
      const draw = battleResult.winner === 'draw';
      if (won) sounds.playVictory();
      else if (!draw) sounds.playDefeat();
    }
  }, [isAnimating, battleResult]);

  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardFilterRarity, setCardFilterRarity] = useState<string>('all');
  const [deckPage, setDeckPage] = useState(1);
  const CARDS_PER_PAGE = 24;

  useEffect(() => {
    setDeckPage(1);
  }, [cardSearchQuery, cardFilterRarity]);

  const handleStartQueue = () => {
    sounds.playClick();
    if (!socket) return;
    
    // Prepare deck with buffed stats
    const buffedDeck = selectedCards.map(card => {
      const buffed = getBuffedStats(card, weekNumber, cardStats, upgrades[card.id], battles[card.id]);
      return { ...card, power: buffed.power, health: buffed.health, maxHealth: buffed.health };
    });

    if (isPvP) {
      socket.emit('join_queue', { mode, deck: buffedDeck, username, rating });
      setPhase('queue');
    } else if (mode === 'encore') {
      socket.emit('start_encore', { deck: buffedDeck, username, rating });
      setPhase('queue');
    } else {
      socket.emit('start_pve', { mode, deck: buffedDeck, username, rating });
      setPhase('queue'); // Will immediately transition to 'battle'
    }
  };

  const handleCancelQueue = () => {
    sounds.playClick();
    if (!socket) return;
    socket.emit('leave_queue');
    setPhase('select_mode');
  };

  const handleCardClick = (card: CardData) => {
    sounds.playClick();
    const maxCards = mode === 'encore' ? 15 : mode === 'boss' ? 5 : mode === 'team' ? 3 : 1;
    if (selectedCards.find(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else if (selectedCards.length < maxCards) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleFinish = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (battleResult) {
      const won = battleResult.winner === battleResult.myRole;
      const draw = battleResult.winner === 'draw';
      onBattleEnd(won, isPvP ? 'pvp' : mode, draw, selectedCards.map(c => c.id));
    }
    setPhase('select_mode');
    setSelectedCards([]);
    setBattleResult(null);
    setVisibleLog([]);
    setIsAnimating(false);
  };

  if (phase === 'select_mode') {
    const league = getLeague(rating);
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Swords size={64} className="text-slate-700 mb-6" />
        <h2 className="text-3xl font-bold mb-8">{t('nav.arena')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-blue-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('single'); setIsPvP(false); setPhase('select_deck'); }}>
            <User size={32} className="text-blue-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.singlePvE')}</h3>
            <p className="text-sm text-slate-400">{t('arena.singlePvEDesc').replace('{gold}', league.botGold.toString())}</p>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-purple-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('team'); setIsPvP(false); setPhase('select_deck'); }}>
            <Users size={32} className="text-purple-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.teamPvE')}</h3>
            <p className="text-sm text-slate-400">{t('arena.teamPvEDesc').replace('{gold}', league.botGold.toString())}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-red-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('single'); setIsPvP(true); setPhase('select_deck'); }}>
            <User size={32} className="text-red-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.singlePvP')}</h3>
            <p className="text-sm text-slate-400">{t('arena.singlePvPDesc').replace('{gold}', league.pvpGold.toString())}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-orange-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('team'); setIsPvP(true); setPhase('select_deck'); }}>
            <Users size={32} className="text-orange-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.teamPvP')}</h3>
            <p className="text-sm text-slate-400">{t('arena.teamPvPDesc').replace('{gold}', league.pvpGold.toString())}</p>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-yellow-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('boss'); setIsPvP(false); setPhase('select_deck'); }}>
            <Swords size={32} className="text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.bossPvE')}</h3>
            <p className="text-sm text-slate-400">{t('arena.bossPvEDesc').replace('{gold}', (league.botGold * 2).toString())}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-pink-500/50 transition-colors cursor-pointer"
               onClick={() => { setMode('encore'); setIsPvP(false); setPhase('select_deck'); }}>
            <Swords size={32} className="text-pink-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('arena.encore')}</h3>
            <p className="text-sm text-slate-400">{t('arena.encoreDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'select_deck') {
    const maxCards = mode === 'encore' ? 15 : mode === 'boss' ? 5 : mode === 'team' ? 3 : 1;
    return (
      <div className="flex flex-col items-center py-6">
        <h2 className="text-2xl font-bold mb-2">{t('arena.selectCards')} ({selectedCards.length}/{maxCards})</h2>
        <p className="text-slate-400 mb-6">{t('arena.mode')}: {mode === 'encore' ? t('arena.encore') : mode === 'boss' ? t('arena.bossPvE') : mode === 'single' ? t('arena.singlePvE').split(' ')[0] : t('arena.teamPvE').split(' ')[0]} ({isPvP ? 'PvP' : 'PvE'})</p>
        
        <div className="flex gap-4 mb-8">
          <button onClick={() => { setPhase('select_mode'); setSelectedCards([]); }} className="px-6 py-2 bg-slate-800 rounded-xl font-medium hover:bg-slate-700">{t('profile.cancel')}</button>
          <button 
            onClick={handleStartQueue} 
            disabled={selectedCards.length !== maxCards}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPvP ? t('arena.searchOpponent') : t('arena.startBattle')}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl mb-8">
          <div className="relative w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('collection.search')}
              value={cardSearchQuery}
              onChange={(e) => { setCardSearchQuery(e.target.value); setDeckPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <select
            value={cardFilterRarity}
            onChange={(e) => { setCardFilterRarity(e.target.value); setDeckPage(1); }}
            className="w-full sm:w-auto bg-slate-900 border border-slate-800 rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors text-slate-200"
          >
            <option value="all">{t('rarity.all')}</option>
            <option value="1">{t('rarity.1')}</option>
            <option value="2">{t('rarity.2')}</option>
            <option value="3">{t('rarity.3')}</option>
            <option value="4">{t('rarity.4')}</option>
            <option value="5">{t('rarity.5')}</option>
            <option value="6">{t('rarity.6')}</option>
            <option value="7">{t('rarity.7')}</option>
            <option value="8">{t('rarity.8')}</option>
            <option value="ancient">{t('filter.ancient')}</option>
          </select>
        </div>

        {myCards.length === 0 ? (
          <div className="text-slate-500 text-center py-10">{t('collection.empty')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {myCards
                .filter(card => card.name.toLowerCase().includes(cardSearchQuery.toLowerCase()))
                .filter(card => {
                  if (cardFilterRarity === 'all') return true;
                  if (cardFilterRarity === 'ancient') return card.id >= 1051;
                  return getCurrentRarity(card, weekNumber, cardStats).toString() === cardFilterRarity;
                })
                .slice((deckPage - 1) * CARDS_PER_PAGE, deckPage * CARDS_PER_PAGE)
                .map(card => {
                const isSelected = selectedCards.find(c => c.id === card.id);
                return (
                  <div key={card.id} className="relative">
                    <CardView card={card} weekNumber={weekNumber} cardStats={cardStats} upgradeInfo={upgrades[card.id]} battles={battles[card.id]} onClick={() => handleCardClick(card)} />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 rounded-2xl pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
            
            {(() => {
              const filteredCards = myCards
                .filter(card => card.name.toLowerCase().includes(cardSearchQuery.toLowerCase()))
                .filter(card => {
                  if (cardFilterRarity === 'all') return true;
                  if (cardFilterRarity === 'ancient') return card.id >= 1051;
                  return getCurrentRarity(card, weekNumber, cardStats).toString() === cardFilterRarity;
                });
              const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
              
              if (totalPages <= 1) return null;
              
              return (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button 
                    onClick={() => setDeckPage(p => Math.max(1, p - 1))}
                    disabled={deckPage === 1}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    &lt;
                  </button>
                  <span className="text-slate-400">
                    {deckPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setDeckPage(p => Math.min(totalPages, p + 1))}
                    disabled={deckPage === totalPages}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    &gt;
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  if (phase === 'queue') {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 size={64} className="text-blue-500 animate-spin mb-6" />
        <h2 className="text-3xl font-bold mb-4">{t('arena.searching')}</h2>
        <p className="text-slate-400 mb-8 max-w-md">
          {t('arena.queueDesc')}
        </p>
        <button onClick={handleCancelQueue} className="px-6 py-2 bg-red-600/20 text-red-400 rounded-xl font-medium hover:bg-red-600/30 border border-red-600/50">
          {t('profile.cancel')}
        </button>
      </div>
    );
  }

  if (phase === 'battle' || phase === 'result') {
    const won = battleResult?.winner === battleResult?.myRole;
    const draw = battleResult?.winner === 'draw';

    const league = getLeague(rating);
    let expectedReward = 0;
    if (won) {
      if (isPvP) expectedReward = league.pvpGold;
      else if (mode === 'boss') expectedReward = league.botGold * 2;
      else expectedReward = league.botGold;
    }
    const expectedRatingChange = calculateRatingChange(won || false, isPvP ? 'pvp' : mode === 'boss' ? 'boss' : 'pve');

    const formatLogMessage = (event: BattleEvent) => {
      if (!event.translationKey) return event.message;
      
      const params = { ...event.translationParams };
      
      Object.keys(params).forEach(key => {
        let val = String(params[key]);
        if (val === '__BOT__') val = t('arena.bot');
        else if (val === '__BOSS__') val = t('arena.boss');
        else if (val === '__ENCORE__') val = t('arena.waves');
        else if (val.startsWith('__BOT__ ')) {
          const wave = val.split(' ')[1];
          val = `${t('arena.bot')} (${t('arena.wave')} ${wave})`;
        }
        params[key] = val;
      });

      return t(event.translationKey, params);
    };

    return (
      <div className="flex flex-col items-center py-6 max-w-6xl mx-auto w-full h-[calc(100vh-100px)]">
        <h2 className="text-2xl font-bold mb-4 shrink-0">{t('arena.battleProgress')}</h2>
        
        <div className="flex flex-col gap-4 w-full flex-1 min-h-0">
          
          {/* Opponent Cards */}
          <div className="flex flex-col items-center bg-slate-900/50 border border-slate-800 rounded-2xl p-3 shrink-0">
            <h3 className="text-lg font-bold mb-2 text-red-400">
              {battleResult?.opponentName === '__BOT__' ? t('arena.bot') : 
               battleResult?.opponentName === '__BOSS__' ? t('arena.boss') : 
               battleResult?.opponentName === '__ENCORE__' ? t('arena.waves') : 
               battleResult?.opponentName || 'Opponent'}
            </h3>
            <div className="flex flex-row flex-wrap justify-center gap-2 w-full">
              <AnimatePresence mode="popLayout">
                {activeOpponentBoard.map((card, idx) => {
                  const instanceId = card.instanceId || `opp-${card.id}-${idx}`;
                  const isAttacking = attackingCardId === instanceId;
                  const isDefending = defendingCardId === instanceId;
                  const isDead = deadCards.has(instanceId);
                  const cardFloatingTexts = floatingTexts.filter(ft => ft.targetId === instanceId);

                  return (
                    <motion.div 
                      layout 
                      key={instanceId} 
                      initial={{ opacity: 0, y: -20 }} 
                      animate={{ 
                        opacity: isDead ? 0.3 : 1, 
                        y: isAttacking ? 20 : 0,
                        scale: isDefending ? 0.95 : 1,
                        filter: isDead ? 'grayscale(100%)' : 'none'
                      }} 
                      exit={{ opacity: 0, scale: 0.5 }} 
                      transition={{ delay: idx * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                      className="relative"
                    >
                      <div style={{ width: 128, height: 192 }} className="relative">
                        <div className="absolute top-0 left-0 origin-top-left scale-50">
                          <CardView card={card} weekNumber={weekNumber} cardStats={cardStats} disableBuffs={true} />
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {cardFloatingTexts.map(ft => (
                          <motion.div
                            key={ft.id}
                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: 1, y: -40, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 font-black text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap ${
                              ft.type === 'damage' ? 'text-red-500' : 
                              ft.type === 'heal' ? 'text-green-500' : 
                              'text-purple-400 text-sm'
                            }`}
                          >
                            {ft.text}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Battle Log */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col justify-end overflow-hidden relative min-h-[150px]">
            <div className="flex flex-col gap-2 overflow-y-auto pr-2">
              <AnimatePresence>
                {visibleLog.map((event, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`p-2 rounded-lg text-xs md:text-sm border ${
                      event?.type === 'ATTACK' ? 'bg-slate-800 border-slate-700 text-slate-200' :
                      event?.type === 'DAMAGE' ? 'bg-red-900/20 border-red-900/50 text-red-300' :
                      event?.type === 'HEAL' ? 'bg-green-900/20 border-green-900/50 text-green-300' :
                      event?.type === 'DEATH' ? 'bg-slate-950 border-slate-800 text-slate-500 font-bold' :
                      event?.type === 'ABILITY' ? 'bg-purple-900/20 border-purple-900/50 text-purple-300 italic' :
                      'bg-blue-900/20 border-blue-900/50 text-blue-300 font-bold text-center'
                    }`}
                  >
                    {formatLogMessage(event)}
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Dummy div to scroll to bottom */}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </div>

          {/* Player Cards */}
          <div className="flex flex-col items-center bg-slate-900/50 border border-slate-800 rounded-2xl p-3 shrink-0">
            <h3 className="text-lg font-bold mb-2 text-blue-400">
              {t('arena.you')} ({battleResult?.myRole})
            </h3>
            <div className="flex flex-row flex-wrap justify-center gap-2 w-full">
              <AnimatePresence mode="popLayout">
                {activeMyBoard.map((card, idx) => {
                  const instanceId = card.instanceId || `my-${card.id}-${idx}`;
                  const isAttacking = attackingCardId === instanceId;
                  const isDefending = defendingCardId === instanceId;
                  const isDead = deadCards.has(instanceId);
                  const cardFloatingTexts = floatingTexts.filter(ft => ft.targetId === instanceId);

                  return (
                    <motion.div 
                      layout 
                      key={instanceId} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ 
                        opacity: isDead ? 0.3 : 1, 
                        y: isAttacking ? -20 : 0,
                        scale: isDefending ? 0.95 : 1,
                        filter: isDead ? 'grayscale(100%)' : 'none'
                      }} 
                      exit={{ opacity: 0, scale: 0.5 }} 
                      transition={{ delay: idx * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                      className="relative"
                    >
                      <div style={{ width: 128, height: 192 }} className="relative">
                        <div className="absolute top-0 left-0 origin-top-left scale-50">
                          <CardView card={card} weekNumber={weekNumber} cardStats={cardStats} upgradeInfo={upgrades[card.id]} battles={battles[card.id]} disableBuffs={true} />
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {cardFloatingTexts.map(ft => (
                          <motion.div
                            key={ft.id}
                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: 1, y: -40, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 font-black text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap ${
                              ft.type === 'damage' ? 'text-red-500' : 
                              ft.type === 'heal' ? 'text-green-500' : 
                              'text-purple-400 text-sm'
                            }`}
                          >
                            {ft.text}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {!isAnimating && battleResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <h3 className={`text-6xl font-black mb-8 drop-shadow-[0_0_15px_rgba(0,0,0,1)] ${draw ? 'text-slate-400' : won ? 'text-green-500' : 'text-red-500'}`}>
              {draw ? t('arena.draw') : won ? t('arena.victory') : t('arena.defeat')}
            </h3>
            <button 
              onClick={() => { sounds.playClick(); handleFinish(); }}
              className="px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold text-2xl shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105"
            >
              {t('arena.finishBattle')} {won && `(+${expectedReward} ${t('arena.gold')})`} {(!draw) && `(${expectedRatingChange > 0 ? '+' : ''}${expectedRatingChange} ${t('arena.rating')})`}
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  return null;
};
