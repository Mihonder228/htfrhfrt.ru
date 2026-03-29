import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { ALL_CARDS, getCurrentRarity, drawCard } from './game/generator';
import { getLeague, getNextLeague, calculateRatingChange, getLeagueIndex } from './game/leagues';
import { EMOJIS } from './game/emojis';
import { CardView } from './components/CardView';
import { BattleArena } from './components/BattleArena';
import { PlayerState, CardData } from './types';
import { Calendar, Coins, PackageOpen, Swords, Info, User, LogOut, Users, UserPlus, Trophy, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, collection, getDocs } from 'firebase/firestore';
import { sounds } from './lib/soundService';
import { ProfileModal } from './components/ProfileModal';
import { useLanguage } from './contexts/LanguageContext';
import { Language } from './i18n/translations';

const EPOCH_START = new Date('2024-01-01T00:00:00Z').getTime();
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

function getWeekInfo() {
  const now = Date.now();
  const elapsed = now - EPOCH_START;
  const weekNumber = Math.floor(elapsed / WEEK_MS) + 1;
  const nextWeekStart = EPOCH_START + weekNumber * WEEK_MS;
  const timeLeft = nextWeekStart - now;
  return { weekNumber, timeLeft };
}

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [weekInfo, setWeekInfo] = useState(getWeekInfo());
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regEmoji, setRegEmoji] = useState('');
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  
  const [player, setPlayer] = useState<PlayerState & { friends: string[], username?: string, avatarEmoji?: string }>({
    gold: 1000,
    collection: {},
    deck: [],
    lastLoginWeek: 1,
    friends: [],
    packsOpened: 0,
    upgrades: {},
    showcase: []
  });

  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);

  const [selectedCardForUpgrade, setSelectedCardForUpgrade] = useState<CardData | null>(null);

  // Initialize Socket
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    
    newSocket.on('online_users', (users: string[]) => {
      setOnlineUsernames(users);
    });
    
    return () => { newSocket.close(); };
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userPublicRef = doc(db, 'users_public', currentUser.uid);
        
        try {
          const userSnap = await getDoc(userRef);
          const userPublicSnap = await getDoc(userPublicRef);
          
          if (!userSnap.exists()) {
            // Create new private user profile
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || `${currentUser.uid}@example.com`,
              role: 'user',
              createdAt: new Date()
            });
          }
          
          if (!userPublicSnap.exists()) {
            // Create new public user profile, migrating data if it exists in private doc
            const existingData = userSnap.exists() ? userSnap.data() : null;
            const defaultUsername = currentUser.displayName || existingData?.username || t('player.default');
            await setDoc(userPublicRef, {
              uid: currentUser.uid,
              username: defaultUsername,
              gold: existingData?.gold ?? 1000,
              collection: {},
              deck: [],
              friends: existingData?.friends || [],
              lastLoginWeek: weekInfo.weekNumber,
              collectionVersion: 2,
              isRegistered: false,
              packsOpened: 0,
              upgrades: {}
            });
            setRegUsername(defaultUsername);
            setNeedsRegistration(true);
          } else {
            const publicData = userPublicSnap.data();
            const updates: any = { lastLoginWeek: weekInfo.weekNumber };
            
            if (!publicData.isRegistered) {
              setRegUsername(publicData.username || currentUser.displayName || t('player.default'));
              setNeedsRegistration(true);
            }
            
            // Reset collection if version is not 2
            if (publicData.collectionVersion !== 2) {
              updates.collection = {};
              updates.deck = [];
              updates.gold = Math.max(publicData.gold || 0, 1000);
              updates.collectionVersion = 2;
              updates.packsOpened = 0;
              updates.upgrades = {};
            }
            
            // Weekly reset logic for upgrades
            if (publicData.lastLoginWeek && publicData.lastLoginWeek < weekInfo.weekNumber) {
              let refund = 0;
              const currentUpgrades = publicData.upgrades || {};
              Object.values(currentUpgrades).forEach((upg: any) => {
                if (upg.spentGold) refund += Math.floor(upg.spentGold * 0.75);
              });
              
              if (refund > 0) {
                updates.gold = (publicData.gold || 0) + refund;
                updates.upgrades = {}; // Reset all upgrades
              }
            }

            // Update last login and potentially reset collection
            await updateDoc(userPublicRef, updates);
          }
        } catch (error) {
          console.error("Error during user initialization:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [weekInfo.weekNumber]);

  useEffect(() => {
    if (socket && user && player.username) {
      socket.emit('set_username', player.username);
    }
  }, [socket, user, player.username]);

  // Firestore Data Sync
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'users_public', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayer({
          gold: data.gold || 0,
          collection: data.collection || {},
          deck: data.deck || [],
          lastLoginWeek: data.lastLoginWeek || 1,
          friends: data.friends || [],
          username: data.username,
          avatarEmoji: data.avatarEmoji,
          packsOpened: data.packsOpened || 0,
          upgrades: data.upgrades || {},
          rating: data.rating || 0,
          showcase: data.showcase || []
        });
      }
    }, (error) => {
      console.error("Firestore Error: ", error);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Fetch all players (for leaderboard/friends)
  useEffect(() => {
    if (!user || !isAuthReady) return;
    
    const fetchPlayers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users_public'));
        const playersList = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          username: doc.data().username,
          avatarEmoji: doc.data().avatarEmoji,
          gold: doc.data().gold,
          collectionSize: Object.keys(doc.data().collection || {}).length,
          collection: doc.data().collection || {},
          deck: doc.data().deck || [],
          showcase: doc.data().showcase || [],
          isOnline: onlineUsernames.includes(doc.data().username)
        }));
        setAllPlayers(playersList);
      } catch (error) {
        console.error("Error fetching players: ", error);
      }
    };
    
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user, isAuthReady, onlineUsernames]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWeekInfo(getWeekInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message || t('auth.error'));
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPlayer({
        gold: 1000,
        collection: {},
        deck: [],
        lastLoginWeek: weekInfo.weekNumber,
        friends: [],
        rating: 0
      });
    } catch (error) {
      console.error(error);
    }
  };

  const addFriend = async (friendUid: string) => {
    if (!user || player.friends.includes(friendUid)) return;
    try {
      const userPublicRef = doc(db, 'users_public', user.uid);
      await updateDoc(userPublicRef, {
        friends: [...player.friends, friendUid]
      });
    } catch (error) {
      console.error("Error adding friend: ", error);
    }
  };

  const formatTime = (ms: number) => {
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const m = Math.floor((ms / 1000 / 60) % 60);
    const s = Math.floor((ms / 1000) % 60);
    return `${d}${t('header.days')} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const weekNumber = weekInfo.weekNumber;

  const [activeTab, setActiveTab] = useState<'collection' | 'shop' | 'battle' | 'players'>('collection');
  const [openedCards, setOpenedCards] = useState<CardData[] | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardFilterRarity, setCardFilterRarity] = useState<string>('all');
  const [collectionPage, setCollectionPage] = useState(1);
  const CARDS_PER_PAGE = 24;

  useEffect(() => {
    setCollectionPage(1);
  }, [cardSearchQuery, cardFilterRarity]);

  const cardStats = useMemo(() => {
    const owners: Record<number, number> = {};
    const usage: Record<number, number> = {};
    let totalPlayers = allPlayers.length;
    
    allPlayers.forEach(p => {
      Object.keys(p.collection).forEach(cardId => {
        const id = Number(cardId);
        owners[id] = (owners[id] || 0) + 1;
      });
      (p.deck || []).forEach((cardId: number) => {
        usage[cardId] = (usage[cardId] || 0) + 1;
      });
    });

    return { owners, usage, totalPlayers };
  }, [allPlayers]);

  const myCards = useMemo(() => {
    return Object.keys(player.collection)
      .map(id => ALL_CARDS.find(c => c.id === Number(id))!)
      .filter(Boolean)
      .sort((a, b) => {
        const rA = getCurrentRarity(a, weekNumber, cardStats);
        const rB = getCurrentRarity(b, weekNumber, cardStats);
        if (rA !== rB) return rB - rA;
        return b.power - a.power;
      });
  }, [player.collection, weekNumber, cardStats]);

  const openPack = async (amount: number, packType: 'normal' | 'ancient' = 'normal') => {
    sounds.playClick();
    const baseCost = packType === 'ancient' ? 250 : 100;
    const cost = amount === 1 ? baseCost : Math.floor(amount * baseCost * 0.8);
    if (!user || player.gold < cost) return;
    
    sounds.playOpenPack();
    const newCards: CardData[] = [];
    const newCollection = { ...player.collection };
    let currentPacksOpened = player.packsOpened || 0;
    
    for (let p = 0; p < amount; p++) {
      currentPacksOpened++;
      const isGolden = packType === 'normal' && currentPacksOpened % 10 === 0;
      const actualPackType = isGolden ? 'golden' : packType;
      for (let i = 0; i < 5; i++) {
        const drawnCard = drawCard(weekNumber, cardStats, actualPackType);
        newCards.push(drawnCard);
        newCollection[drawnCard.id] = (newCollection[drawnCard.id] || 0) + 1;
      }
    }
    
    try {
      const userPublicRef = doc(db, 'users_public', user.uid);
      await updateDoc(userPublicRef, {
        gold: player.gold - cost,
        collection: newCollection,
        packsOpened: currentPacksOpened
      });
      setOpenedCards(newCards);
    } catch (error) {
      console.error("Error opening pack: ", error);
    }
  };

  const handleUpgradeCard = async (cardId: number, type: 'level' | 'ascension') => {
    sounds.playClick();
    if (!user) return;
    const currentUpgrades = player.upgrades[cardId] || { level: 1, ascension: 0, spentGold: 0 };
    let cost = 0;
    let newLevel = currentUpgrades.level;
    let newAscension = currentUpgrades.ascension;

    if (type === 'level') {
      if (newLevel >= 10) return;
      cost = newLevel * 50;
      newLevel += 1;
    } else if (type === 'ascension') {
      if (newLevel < 10 || newAscension >= 5) return;
      cost = (newAscension + 1) * 500;
      newAscension += 1;
      newLevel = 1; // Reset level after ascension
    }

    if (player.gold < cost) return;

    if (type === 'level') {
      sounds.playUpgradeLevel();
    } else {
      sounds.playUpgradeAscension();
    }

    try {
      const userPublicRef = doc(db, 'users_public', user.uid);
      await updateDoc(userPublicRef, {
        gold: player.gold - cost,
        [`upgrades.${cardId}`]: {
          level: newLevel,
          ascension: newAscension,
          spentGold: currentUpgrades.spentGold + cost
        }
      });
    } catch (error) {
      console.error("Error upgrading card: ", error);
    }
  };

  const handleBattleEnd = async (won: boolean, mode: string, draw: boolean = false, deckUsed: number[] = []) => {
    if (user) {
      try {
        const currentRating = player.rating || 0;
        const league = getLeague(currentRating);
        
        let reward = 0;
        if (won) {
          if (mode === 'pvp') reward = league.pvpGold;
          else if (mode === 'boss') reward = league.botGold * 2;
          else if (mode === 'encore') {
            const leagueIdx = getLeagueIndex(currentRating);
            reward = 4000 * (leagueIdx + 1);
          }
          else reward = league.botGold;
        }

        const ratingChange = calculateRatingChange(won, mode, draw);
        const newRating = Math.max(0, currentRating + ratingChange);
        
        const newBattles = { ...(player.battles || {}) };
        deckUsed.forEach(id => {
          newBattles[id] = (newBattles[id] || 0) + 1;
        });

        const userPublicRef = doc(db, 'users_public', user.uid);
        await updateDoc(userPublicRef, {
          gold: player.gold + reward,
          rating: newRating,
          battles: newBattles
        });
      } catch (error) {
        console.error("Error updating after battle: ", error);
      }
    }
  };

  const handleRegister = async () => {
    if (!user || !regUsername.trim() || !regEmoji) return;
    try {
      const userPublicRef = doc(db, 'users_public', user.uid);
      await updateDoc(userPublicRef, {
        username: regUsername.trim(),
        avatarEmoji: regEmoji,
        isRegistered: true,
        rating: 0
      });
      setNeedsRegistration(false);
      if (socket) {
        socket.emit('set_username', regUsername.trim());
      }
    } catch (error) {
      console.error("Error registering:", error);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">{t('profile.loading')}</div>;
  }

  if (user && needsRegistration) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-200">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <h2 className="text-2xl font-bold mb-6 text-center">{t('profile.create')}</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.nickname')}</label>
            <input 
              type="text" 
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder={t('profile.enterNickname')}
              maxLength={20}
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.avatar')}</label>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
              {EMOJIS.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setRegEmoji(emoji)}
                  className={`text-2xl p-2 rounded-lg transition-colors ${regEmoji === emoji ? 'bg-blue-500/30 border border-blue-500' : 'hover:bg-slate-700 border border-transparent'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleRegister}
            disabled={!regUsername.trim() || !regEmoji}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {t('profile.startGame')}
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-200">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
              🎰
            </div>
            <h1 className="font-bold text-3xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
              Emojigacha
            </h1>
          </div>
          
          <div className="space-y-4">
            {authError && <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{authError}</div>}
            
            <button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <User size={20} /> {t('login.button')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
              🎰
            </div>
            <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400 hidden sm:block">
              Emojigacha
            </h1>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700/50 hidden md:flex">
              <Calendar size={16} className="text-blue-400" />
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">{t('header.week')} {weekNumber}</span>
                <span className="text-[10px] text-slate-400 leading-none mt-1">{t('header.changesIn')} {formatTime(weekInfo.timeLeft)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-yellow-900/20 px-3 py-1.5 rounded-full border border-yellow-700/30 text-yellow-400">
              <Coins size={16} />
              <span className="font-bold">{player.gold}</span>
            </div>

            <div className="flex items-center gap-2 bg-purple-900/20 px-3 py-1.5 rounded-full border border-purple-700/30 text-purple-400">
              <Trophy size={16} className="shrink-0" />
              <div className="flex flex-col">
                <div className="text-sm font-bold leading-none flex items-center gap-1">
                  <span className="hidden sm:inline">{t(`league.${getLeagueIndex(player.rating || 0)}` as any)}</span>
                  <span>({player.rating || 0})</span>
                </div>
                {getNextLeague(player.rating || 0) ? (
                  <div className="text-[10px] text-purple-300 leading-none mt-1">
                    <span className="hidden sm:inline">{t('header.toNextLeague')} </span>
                    <span className="sm:hidden">{t('header.toNext')} </span>
                    {getNextLeague(player.rating || 0)!.minRating - (player.rating || 0)}
                  </div>
                ) : (
                  <div className="text-[10px] text-purple-300 leading-none mt-1">
                    {t('header.maxLeague')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
              <div 
                className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
                onClick={() => setViewingProfile(user.uid)}
              >
                {player.avatarEmoji ? (
                  <span className="text-xl">{player.avatarEmoji}</span>
                ) : (
                  <img src={user.photoURL || ''} alt="Avatar" className="w-6 h-6 rounded-full" />
                )}
                <span className={`hidden sm:inline ${(player.username || user.displayName) === 'Михондер' ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                  {player.username || user.displayName || t('player.default')}
                </span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
              >
                <option value="en">EN</option>
                <option value="ru">RU</option>
                <option value="zh">ZH</option>
                <option value="ko">KO</option>
                <option value="ja">JA</option>
              </select>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                title={t('nav.logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 py-6 flex gap-4 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => { sounds.playClick(); setActiveTab('collection'); }}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'collection' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
        >
          <PackageOpen size={18} /> {t('nav.collection')}
        </button>
        <button 
          onClick={() => { sounds.playClick(); setActiveTab('shop'); }}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'shop' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
        >
          <Coins size={18} /> {t('nav.shop')}
        </button>
        <button 
          onClick={() => { sounds.playClick(); setActiveTab('battle'); }}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'battle' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
        >
          <Swords size={18} /> {t('nav.arena')}
        </button>
        <button 
          onClick={() => { sounds.playClick(); setActiveTab('players'); }}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'players' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
        >
          <Users size={18} /> {t('nav.players')}
        </button>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-12">
        {activeTab === 'collection' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">{t('nav.collection')} ({myCards.length} {t('profile.uniqueCards').toLowerCase()})</h2>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('collection.search')}
                    value={cardSearchQuery}
                    onChange={(e) => { setCardSearchQuery(e.target.value); setCollectionPage(1); }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <select
                  value={cardFilterRarity}
                  onChange={(e) => { setCardFilterRarity(e.target.value); setCollectionPage(1); }}
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
            
            {myCards.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                <PackageOpen size={48} className="mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400">{t('collection.empty')}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-6">
                  {myCards
                    .filter(card => card.name.toLowerCase().includes(cardSearchQuery.toLowerCase()))
                    .filter(card => {
                      if (cardFilterRarity === 'all') return true;
                      if (cardFilterRarity === 'ancient') return card.id >= 1051;
                      return getCurrentRarity(card, weekNumber, cardStats).toString() === cardFilterRarity;
                    })
                    .slice((collectionPage - 1) * CARDS_PER_PAGE, collectionPage * CARDS_PER_PAGE)
                    .map(card => (
                    <CardView 
                      key={card.id} 
                      card={card} 
                      weekNumber={weekNumber} 
                      count={player.collection[card.id]} 
                      cardStats={cardStats}
                      upgradeInfo={player.upgrades[card.id]}
                      battles={player.battles?.[card.id]}
                      onClick={() => setSelectedCardForUpgrade(card)}
                    />
                  ))}
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
                        onClick={() => setCollectionPage(p => Math.max(1, p - 1))}
                        disabled={collectionPage === 1}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        &lt;
                      </button>
                      <span className="text-slate-400">
                        {collectionPage} / {totalPages}
                      </span>
                      <button 
                        onClick={() => setCollectionPage(p => Math.min(totalPages, p + 1))}
                        disabled={collectionPage === totalPages}
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
        )}

        {activeTab === 'shop' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">{t('nav.shop')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                <PackageOpen size={64} className="text-blue-400 mb-6 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
                <h3 className="text-xl font-bold mb-2">{t('shop.basicBooster')}</h3>
                <p className="text-slate-400 mb-6 text-sm">{t('shop.basicBoosterDesc')}</p>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  {[1, 5, 10, 25, 50, 100].map(amount => {
                    const cost = amount === 1 ? 100 : Math.floor(amount * 100 * 0.8);
                    const isDiscounted = amount > 1;
                    return (
                      <button 
                        key={amount}
                        onClick={() => openPack(amount, 'normal')}
                        disabled={player.gold < cost}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1"
                      >
                        <span className="text-sm">{amount}{t('shop.packs')}</span>
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Coins size={14} /> 
                          <span>{cost}</span>
                          {isDiscounted && <span className="text-[10px] text-green-400 ml-1">-20%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500" />
                <PackageOpen size={64} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                <h3 className="text-xl font-bold mb-2">Древний пак</h3>
                <p className="text-slate-400 mb-6 text-sm">Содержит древние карты (шанс на Ультра 0.001%)</p>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  {[1, 5, 10, 25, 50, 100].map(amount => {
                    const cost = amount === 1 ? 250 : Math.floor(amount * 250 * 0.8);
                    const isDiscounted = amount > 1;
                    return (
                      <button 
                        key={amount}
                        onClick={() => openPack(amount, 'ancient')}
                        disabled={player.gold < cost}
                        className="w-full bg-gradient-to-r from-amber-600 to-red-700 hover:from-amber-500 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1"
                      >
                        <span className="text-sm">{amount}{t('shop.packs')}</span>
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Coins size={14} /> 
                          <span>{cost}</span>
                          {isDiscounted && <span className="text-[10px] text-green-400 ml-1">-20%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {openedCards && (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                  onClick={() => setOpenedCards(null)}
                >
                  <div className="text-center" onClick={e => e.stopPropagation()}>
                    <h2 className="text-3xl font-bold mb-8 text-white drop-shadow-lg">{t('shop.newCards')}</h2>
                    <div className="flex flex-wrap justify-center gap-6 mb-12 max-h-[70vh] overflow-y-auto">
                      {openedCards.sort((a, b) => getCurrentRarity(b, weekNumber, cardStats) - getCurrentRarity(a, weekNumber, cardStats)).slice(0, 10).map((card, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ scale: 0, rotateY: 180 }}
                          animate={{ scale: 1, rotateY: 0 }}
                          transition={{ delay: idx * 0.1, type: 'spring' }}
                        >
                          <CardView card={card} weekNumber={weekNumber} cardStats={cardStats} upgradeInfo={player.upgrades?.[card.id]} battles={player.battles?.[card.id]} />
                        </motion.div>
                      ))}
                    </div>
                    {openedCards.length > 10 && (
                      <p className="text-slate-400 mb-4">{t('shop.showingTop')} {openedCards.length}</p>
                    )}
                    <button 
                      onClick={() => { sounds.playClick(); setOpenedCards(null); }}
                      className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-slate-200 transition-colors"
                    >
                      {t('shop.claim')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {selectedCardForUpgrade && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => { sounds.playClick(); setSelectedCardForUpgrade(null); }}
            >
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{t('upgrade.title')}</h2>
                <CardView 
                  card={selectedCardForUpgrade} 
                  weekNumber={weekNumber} 
                  cardStats={cardStats} 
                  upgradeInfo={player.upgrades?.[selectedCardForUpgrade.id]} 
                  battles={player.battles?.[selectedCardForUpgrade.id]}
                />
                
                <div className="mt-8 w-full space-y-4">
                  {(() => {
                    const upgrades = player.upgrades[selectedCardForUpgrade.id] || { level: 1, ascension: 0, spentGold: 0 };
                    const levelCost = upgrades.level * 50;
                    const ascCost = (upgrades.ascension + 1) * 500;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl">
                          <div>
                            <div className="font-bold">{t('upgrade.level')} {upgrades.level}/10</div>
                            <div className="text-xs text-slate-400">+10% {t('upgrade.stats')}</div>
                          </div>
                          <button 
                            onClick={() => { sounds.playClick(); handleUpgradeCard(selectedCardForUpgrade.id, 'level'); }}
                            disabled={upgrades.level >= 10 || player.gold < levelCost}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            {upgrades.level >= 10 ? t('upgrade.max') : (
                              <>
                                <Coins size={14} className="text-yellow-400" /> {levelCost}
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl">
                          <div>
                            <div className="font-bold text-yellow-400">{t('upgrade.ascension')} {upgrades.ascension}/5</div>
                            <div className="text-xs text-slate-400">+100% {t('upgrade.stats')}</div>
                          </div>
                          <button 
                            onClick={() => { sounds.playClick(); handleUpgradeCard(selectedCardForUpgrade.id, 'ascension'); }}
                            disabled={upgrades.level < 10 || upgrades.ascension >= 5 || player.gold < ascCost}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            {upgrades.ascension >= 5 ? t('upgrade.max') : (
                              <>
                                <Coins size={14} className="text-yellow-400" /> {ascCost}
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                <button 
                  onClick={() => setSelectedCardForUpgrade(null)}
                  className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors w-full"
                >
                  {t('profile.cancel')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'battle' && socket && (
          <BattleArena 
            socket={socket} 
            myCards={myCards} 
            weekNumber={weekNumber} 
            onBattleEnd={handleBattleEnd}
            username={player.username || user.displayName || t('player.default')}
            upgrades={player.upgrades || {}}
            battles={player.battles || {}}
            cardStats={cardStats}
            rating={player.rating || 0}
          />
        )}

        {activeTab === 'players' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold">{t('nav.players')}</h2>
              <div className="relative w-full sm:w-64">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('players.search')}
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPlayers
                .filter(p => p.uid !== user.uid)
                .filter(p => p.username?.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                .map((p, i) => (
                <div 
                  key={i} 
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-slate-600 transition-colors"
                  onClick={() => setViewingProfile(p.uid)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl">
                        {p.avatarEmoji ? p.avatarEmoji : <User size={20} className="text-slate-400" />}
                      </div>
                      {p.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />}
                    </div>
                    <div>
                      <div className={`font-bold ${p.username === 'Михондер' ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                        {p.username}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="flex items-center gap-1"><PackageOpen size={10} /> {p.collectionSize}</span>
                        <span className="flex items-center gap-1 text-yellow-500"><Coins size={10} /> {p.gold}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); addFriend(p.uid); }}
                    disabled={player.friends.includes(p.uid)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg transition-colors"
                    title={t('players.addFriend')}
                  >
                    <UserPlus size={18} className={player.friends.includes(p.uid) ? 'text-green-400' : 'text-blue-400'} />
                  </button>
                </div>
              ))}
              {allPlayers.filter(p => p.uid !== user.uid && p.username?.toLowerCase().includes(playerSearchQuery.toLowerCase())).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500">
                  {t('players.notFound')}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <ProfileModal 
        isOpen={viewingProfile !== null}
        onClose={() => setViewingProfile(null)}
        profileUser={viewingProfile === user.uid ? player : allPlayers.find(p => p.uid === viewingProfile)}
        isCurrentUser={viewingProfile === user.uid}
        currentUserUid={user.uid}
        weekNumber={weekInfo.weekNumber}
        cardStats={cardStats}
      />
    </div>
  );
}
