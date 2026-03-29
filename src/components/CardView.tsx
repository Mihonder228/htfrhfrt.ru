import React from 'react';
import { CardData, RARITY_COLORS, RARITY_NAMES, Rarity, CardStats } from '../types';
import { getCurrentRarity, getBuffedStats, getRarityBuffMultiplier } from '../game/generator';
import { EMOJIS } from '../game/emojis';
import { Sword, Heart, Zap, ShieldAlert, Users, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

interface CardViewProps {
  card: CardData;
  weekNumber: number;
  count?: number;
  cardStats?: CardStats;
  upgradeInfo?: { level: number, ascension: number };
  battles?: number;
  disableBuffs?: boolean;
  onClick?: () => void;
}

export const CardView: React.FC<CardViewProps> = React.memo(({ card, weekNumber, count, cardStats, upgradeInfo, battles, disableBuffs, onClick }) => {
  const { t, language } = useLanguage();
  const currentRarity = getCurrentRarity(card, weekNumber, cardStats);
  const realOwners = cardStats ? (cardStats.owners[card.id] || 0) : card.owners;
  const rarityChanged = currentRarity !== card.baseRarity;
  
  const buffedStats = disableBuffs ? { power: card.power, health: card.health } : getBuffedStats(card, weekNumber, cardStats, upgradeInfo, battles);
  const powerBuff = buffedStats.power - card.power;
  const healthBuff = buffedStats.health - card.health;
  const multiplier = getRarityBuffMultiplier(currentRarity);
  const buffPercent = Math.round((multiplier - 1) * 100);
  const veteranLevel = battles ? Math.min(10, Math.floor(battles / 10)) : 0;

  // Pick a consistent emoji for this card
  const cardEmoji = card.emoji || EMOJIS[card.id % EMOJIS.length];

  return (
    <motion.div 
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative w-64 h-96 rounded-2xl p-1 cursor-pointer bg-gradient-to-br ${RARITY_COLORS[currentRarity]} shadow-lg flex flex-col`}
    >
      {/* Внутренняя рамка */}
      <div className="flex-1 bg-slate-900/90 rounded-xl p-3 flex flex-col border border-white/10 relative overflow-hidden">
        
        {/* Изображение */}
        <div className="w-full h-36 rounded-lg overflow-hidden mb-3 relative border border-white/20 bg-slate-800 flex items-center justify-center group">
          <div className="text-7xl group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] relative z-10">
            {cardEmoji}
          </div>
          
          {/* Внутренняя тень для глубины */}
          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] z-20 pointer-events-none" />
          
          <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs font-bold text-yellow-400 border border-yellow-400/50 z-30 shadow-lg">
            <Zap size={12} className="drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" /> {card.cost}
          </div>
          
          {buffPercent > 0 && (
            <div className="absolute top-1 right-1 bg-green-500/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] font-bold text-white border border-green-400/50 z-30 shadow-lg" title={`${t('card.rarityBuff')}: +${buffPercent}%`}>
              <TrendingUp size={10} /> +{buffPercent}%
            </div>
          )}
          
          {veteranLevel > 0 && (
            <div className="absolute top-8 right-1 bg-amber-500/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] font-bold text-white border border-amber-400/50 z-30 shadow-lg" title={`${t('card.veteran') || 'Ветеран: Уровень'} ${veteranLevel}`}>
              ★ {veteranLevel}
            </div>
          )}
        </div>

        {/* Название и редкость */}
        <div className="text-center mb-2">
          <h3 className="font-bold text-sm leading-tight mb-1 flex items-center justify-center gap-1">
            {card.name
              .replace('Эмодзи', t('card.emoji') || 'Emoji')
              .replace('Древняя карта', t('card.ancientSeries') || 'Ancient Series')
              .replace('Босс:', t('arena.boss') + ':')}
            {card.id >= 1051 && (
              <span className="text-amber-400" title={t('filter.ancient')}>𓂀</span>
            )}
          </h3>
          
          {upgradeInfo && (upgradeInfo.level > 1 || upgradeInfo.ascension > 0) && (
            <div className="text-[10px] font-bold text-yellow-400 mb-1 flex items-center justify-center gap-1">
              {t('upgrade.level')} {upgradeInfo.level} {upgradeInfo.ascension > 0 && `★${upgradeInfo.ascension}`}
            </div>
          )}

          <div className="text-[10px] uppercase tracking-wider opacity-80 flex items-center justify-center gap-1">
            {t(`rarity.${currentRarity}`)}
            {rarityChanged && (
              <span className={currentRarity > card.baseRarity ? 'text-green-400' : 'text-red-400'} title={`${t('card.baseRarity')} ${t(`rarity.${card.baseRarity}`)}`}>
                {currentRarity > card.baseRarity ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>

        {/* Способность */}
        <div className="flex-1 bg-black/40 rounded p-2 text-xs text-center flex items-center justify-center italic text-slate-300 border border-white/5 relative group/ability">
          {t(`ability.${card.ability}` as any) || card.ability}
          {card.ability !== 'Нет' && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/ability:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-600 not-italic">
              {t(`ability_desc.${card.ability}` as any) || ''}
            </div>
          )}
        </div>

        {/* Статы */}
        <div className="flex justify-between items-center mt-3 px-2">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-red-400 font-bold text-lg leading-none">
              <Sword size={18} /> {card.power}
            </div>
            {powerBuff > 0 && <div className="text-[10px] text-green-400 font-bold">+{powerBuff}</div>}
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-green-400 font-bold text-lg leading-none">
              <Heart size={18} /> {card.health}
            </div>
            {healthBuff > 0 && <div className="text-[10px] text-green-400 font-bold">+{healthBuff}</div>}
          </div>
        </div>

        {/* Мета-инфа (Владельцы) */}
        <div className="absolute bottom-1 left-0 right-0 text-[9px] text-center opacity-50 flex justify-center items-center gap-1">
          <Users size={8} /> {realOwners.toLocaleString(language)}
        </div>
      </div>

      {/* Бейдж количества */}
      {count !== undefined && count > 0 && (
        <div className="absolute -top-3 -right-3 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-slate-900 shadow-xl z-10">
          x{count}
        </div>
      )}
    </motion.div>
  );
});
