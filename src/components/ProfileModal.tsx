import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, Check, Star, Trophy } from 'lucide-react';
import { CardData, PlayerState, CardStats } from '../types';
import { ALL_CARDS, getCurrentRarity } from '../game/generator';
import { getLeague } from '../game/leagues';
import { CardView } from './CardView';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUser: any; // The user data to display
  isCurrentUser: boolean;
  currentUserUid?: string;
  weekNumber: number;
  cardStats?: CardStats;
}

export function ProfileModal({ isOpen, onClose, profileUser, isCurrentUser, currentUserUid, weekNumber, cardStats }: ProfileModalProps) {
  const { t } = useLanguage();
  const [isEditingShowcase, setIsEditingShowcase] = useState(false);
  const [tempShowcase, setTempShowcase] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRarity, setFilterRarity] = useState('all');

  // Calculate stats
  const stats = useMemo(() => {
    if (!profileUser || !profileUser.collection) return null;
    
    let totalCards = 0;
    let uniqueCards = 0;
    const rarityCounts: Record<number, { unique: number, total: number }> = {
      1: { unique: 0, total: 0 },
      2: { unique: 0, total: 0 },
      3: { unique: 0, total: 0 },
      4: { unique: 0, total: 0 },
      5: { unique: 0, total: 0 },
      6: { unique: 0, total: 0 },
      7: { unique: 0, total: 0 }
    };

    Object.entries(profileUser.collection).forEach(([idStr, count]) => {
      const countNum = count as number;
      if (countNum > 0) {
        totalCards += countNum;
        uniqueCards += 1;
        
        const card = ALL_CARDS.find(c => c.id === parseInt(idStr));
        if (card) {
          const rarity = getCurrentRarity(card, weekNumber, cardStats);
          if (rarityCounts[rarity]) {
            rarityCounts[rarity].unique += 1;
            rarityCounts[rarity].total += countNum;
          }
        }
      }
    });

    return { totalCards, uniqueCards, rarityCounts };
  }, [profileUser, weekNumber, cardStats]);

  const handleSaveShowcase = async () => {
    if (!isCurrentUser || !currentUserUid) return;
    try {
      await updateDoc(doc(db, 'users_public', currentUserUid), {
        showcase: tempShowcase
      });
      setIsEditingShowcase(false);
    } catch (error) {
      console.error("Error saving showcase", error);
    }
  };

  const toggleShowcaseCard = (cardId: number) => {
    setTempShowcase(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }
      if (prev.length < 5) {
        return [...prev, cardId];
      }
      return prev;
    });
  };

  const showcaseIds = isEditingShowcase ? tempShowcase : (profileUser?.showcase || []);
  const showcaseCards = showcaseIds.map((id: number) => ALL_CARDS.find(c => c.id === id)).filter(Boolean) as CardData[];

  // For editing, we need the user's collection
  const collectionCards = useMemo(() => {
    if (!isEditingShowcase || !profileUser?.collection) return [];
    return Object.keys(profileUser.collection)
      .map(id => ALL_CARDS.find(c => c.id === parseInt(id)))
      .filter(Boolean) as CardData[];
  }, [isEditingShowcase, profileUser?.collection]);

  return (
    <AnimatePresence>
      {isOpen && profileUser && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl border-2 border-slate-600">
                {profileUser.avatarEmoji || '👤'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{profileUser.username || 'Player'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400 text-sm">{t('profile.title')}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
                    <Trophy size={14} /> {profileUser.rating || 0}
                  </span>
                  <span className="text-slate-300 text-sm bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    {getLeague(profileUser.rating || 0).name}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-3xl font-bold text-white mb-1">{stats.totalCards}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{t('profile.totalCards')}</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-3xl font-bold text-amber-400 mb-1">{stats.uniqueCards}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{t('profile.uniqueCards')}</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-2">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">{t('profile.byRarity')}</div>
                <div className="flex justify-between text-sm flex-wrap gap-2">
                  <div className="text-slate-300"><span className="text-slate-400">{t('rarity.1').substring(0, 4)}:</span> {stats.rarityCounts[1].unique}/{stats.rarityCounts[1].total}</div>
                  <div className="text-green-400"><span className="text-slate-400">{t('rarity.2').substring(0, 4)}:</span> {stats.rarityCounts[2].unique}/{stats.rarityCounts[2].total}</div>
                  <div className="text-blue-400"><span className="text-slate-400">{t('rarity.3').substring(0, 4)}:</span> {stats.rarityCounts[3].unique}/{stats.rarityCounts[3].total}</div>
                  <div className="text-purple-400"><span className="text-slate-400">{t('rarity.4').substring(0, 4)}:</span> {stats.rarityCounts[4].unique}/{stats.rarityCounts[4].total}</div>
                  <div className="text-orange-400"><span className="text-slate-400">{t('rarity.5').substring(0, 4)}:</span> {stats.rarityCounts[5].unique}/{stats.rarityCounts[5].total}</div>
                  <div className="text-red-400"><span className="text-slate-400">{t('rarity.6').substring(0, 4)}:</span> {stats.rarityCounts[6].unique}/{stats.rarityCounts[6].total}</div>
                  <div className="text-yellow-400"><span className="text-slate-400">{t('rarity.7').substring(0, 4)}:</span> {stats.rarityCounts[7].unique}/{stats.rarityCounts[7].total}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Star className="text-amber-400" size={20} />
                {t('profile.showcase')}
              </h3>
              {isCurrentUser && !isEditingShowcase && (
                <button 
                  onClick={() => {
                    setTempShowcase(profileUser.showcase || []);
                    setIsEditingShowcase(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Edit2 size={16} />
                  {t('profile.edit')}
                </button>
              )}
              {isCurrentUser && isEditingShowcase && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditingShowcase(false)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                  >
                    {t('profile.cancel')}
                  </button>
                  <button 
                    onClick={handleSaveShowcase}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Check size={16} />
                    {t('profile.save')}
                  </button>
                </div>
              )}
            </div>

            {isEditingShowcase && (
              <div className="mb-4 text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                {t('profile.selectShowcase')} ({tempShowcase.length}/5)
              </div>
            )}

            <div className="flex flex-wrap gap-4 justify-center min-h-[200px] bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
              {showcaseCards.length > 0 ? (
                showcaseCards.map((card, idx) => (
                  <div key={`showcase-${card.id}-${idx}`} className="relative scale-75 origin-top">
                    <CardView card={card} weekNumber={weekNumber} battles={profileUser.battles?.[card.id]} />
                    {isEditingShowcase && (
                      <button
                        onClick={() => toggleShowcaseCard(card.id)}
                        className="absolute -top-4 -right-4 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10 shadow-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center w-full text-slate-500 italic">
                  {t('profile.showcaseEmpty')}
                </div>
              )}
            </div>

            {isEditingShowcase && (
              <div className="mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <h4 className="text-lg font-medium text-white">{t('profile.yourCollection')}</h4>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder={t('collection.search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-48 bg-slate-900 border border-slate-800 rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors text-slate-200"
                    />
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value)}
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
                </div>
                <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-700">
                  {collectionCards
                    .filter(card => card.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .filter(card => {
                      if (filterRarity === 'all') return true;
                      if (filterRarity === 'ancient') return card.id >= 1051;
                      return getCurrentRarity(card, weekNumber, cardStats).toString() === filterRarity;
                    })
                    .map(card => {
                    const isSelected = tempShowcase.includes(card.id);
                    return (
                      <div 
                        key={`col-${card.id}`} 
                        onClick={() => toggleShowcaseCard(card.id)}
                        className={`relative scale-50 origin-top-left cursor-pointer transition-transform hover:scale-[0.52] ${isSelected ? 'ring-4 ring-amber-500 rounded-2xl' : 'opacity-70 hover:opacity-100'}`}
                        style={{ width: 128, height: 192, marginBottom: -96, marginRight: -64 }}
                      >
                        <CardView card={card} weekNumber={weekNumber} battles={profileUser.battles?.[card.id]} />
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                            <div className="bg-amber-500 text-white rounded-full p-2 shadow-lg">
                              <Check size={32} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
