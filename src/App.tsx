import React, { useState, useMemo } from 'react';
import { scenarios } from './data';
import { CardUI } from './components/CardUI';
import { Feedback, ActionType, Scenario, Card, HistoryItem } from './types';
import { 
  ChevronRight, Play, Info, Award, TrendingUp, RotateCcw, 
  Flame, Target, Compass, HelpCircle, Zap, BarChart2,
  Volume2, VolumeX, Star, Keyboard, Sparkles, Brain, MessageSquare,
  Search, Users
} from 'lucide-react';
import Markdown from 'react-markdown';
import { generateOfflineAnalysis, generateOfflineFollowUp } from './utils/offlineAnalysis';
import { CONCEPT_DISPLAY_NAMES, getScenarioCategories } from './utils/concepts';
import { analyzeHandMath, evaluateHandStrength } from './utils/handMath';
import { getApiUrl } from './utils/api';
import { playPokerSound } from './utils/sound';
import { SUIT_SYMBOLS, parseCards } from './utils/cards';
import { shuffleArray, reskinScenario, matchesSearch, getOptionBBLabel } from './utils/scenario';
import { GTO_RANKS, isComboInGtoRange } from './utils/gto';
import { isPositionMatch, parseSeatAction, isFolded, SIX_MAX_SEATS, NINE_MAX_SEATS } from './utils/table';
import { MiniCard } from './components/MiniCard';

export default function App() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [filteredScenarios, setFilteredScenarios] = useState<Scenario[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [handsPlayed, setHandsPlayed] = useState(0);

  // Question Pool customizer settings (Shuffle & Deduplication)
  const [shuffleEnabled, setShuffleEnabled] = useState(() => {
    try {
      return localStorage.getItem('poker_shuffle_enabled') !== 'false'; // default to true
    } catch {
      return true;
    }
  });
  const searchedScenarios = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return scenarios.filter(s => matchesSearch(s, searchQuery));
  }, [searchQuery]);

  // Gemini AI Opponent Mindset states
  const [sidebarTab, setSidebarTab] = useState<'coach' | 'hud' | 'ai'>('coach');
  const [aiMode, setAiMode] = useState<'online' | 'offline'>(() => {
    try {
      return (localStorage.getItem('poker_ai_mode') as 'online' | 'offline') || 'offline'; // default to offline for fast loading as requested!
    } catch {
      return 'offline';
    }
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [loadingPhrase, setLoadingPhrase] = useState("正在模擬對手心理模型...");
  const [showMobileAiPanel, setShowMobileAiPanel] = useState(false);

  // Interactive Custom Hand Review States
  const [customPocketCards, setCustomPocketCards] = useState('');
  const [customCommunityCards, setCustomCommunityCards] = useState('');
  const [customActionDescription, setCustomActionDescription] = useState('');
  const [customAnalysisResult, setCustomAnalysisResult] = useState<string | null>(null);
  const [customIsAnalyzing, setCustomIsAnalyzing] = useState(false);
  const [customAnalysisError, setCustomAnalysisError] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'pocket' | 'community' | null>(null);

  // Table size state (defaulting to 9max based on user preferences)
  const [tableSize, setTableSize] = useState<'6max' | '9max'>(() => {
    try {
      return (localStorage.getItem('poker_table_size') as '6max' | '9max') || '9max';
    } catch {
      return '9max';
    }
  });

  // GTO Preflop Matrix Visualizer states
  const [rightTab, setRightTab] = useState<'stats' | 'gto'>('stats');
  const [gtoPosition, setGtoPosition] = useState<string>('utg');
  const [hoveredGtoCombo, setHoveredGtoCombo] = useState<string | null>(null);

  // GTO Preflop Quiz Game states
  const [gtoSubTab, setGtoSubTab] = useState<'view' | 'quiz'>('view');
  const [quizCombo, setQuizCombo] = useState<string>('');
  const [quizPosition, setQuizPosition] = useState<string>('utg');
  const [quizSelectedAction, setQuizSelectedAction] = useState<'raise' | 'fold' | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizFilterPos, setQuizFilterPos] = useState<string>('any');
  const [quizFilterType, setQuizFilterType] = useState<'any' | 'pairs' | 'suited' | 'offsuit'>('any');
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizMaxStreak, setQuizMaxStreak] = useState(() => {
    try {
      return Number(localStorage.getItem('poker_quiz_max_streak') || '0');
    } catch {
      return 0;
    }
  });
  const [quizHistoryStats, setQuizHistoryStats] = useState(() => {
    try {
      const saved = localStorage.getItem('poker_quiz_stats_v2');
      return saved ? JSON.parse(saved) : {
        utg_correct: 0, utg_total: 0,
        co_correct: 0, co_total: 0,
        btn_correct: 0, btn_total: 0,
        sb_correct: 0, sb_total: 0,
        pairs_correct: 0, pairs_total: 0,
        suited_correct: 0, suited_total: 0,
        offsuit_correct: 0, offsuit_total: 0
      };
    } catch {
      return {
        utg_correct: 0, utg_total: 0,
        co_correct: 0, co_total: 0,
        btn_correct: 0, btn_total: 0,
        sb_correct: 0, sb_total: 0,
        pairs_correct: 0, pairs_total: 0,
        suited_correct: 0, suited_total: 0,
        offsuit_correct: 0, offsuit_total: 0
      };
    }
  });
  const [isQuizStatsExpanded, setIsQuizStatsExpanded] = useState(false);

  const resetQuizStats = () => {
    playPokerSound('click', isMuted);
    if (window.confirm('確定要清除所有「翻前開牌挑戰」的歷史統計、連勝紀錄與正確率數據嗎？')) {
      const emptyStats = {
        utg_correct: 0, utg_total: 0,
        co_correct: 0, co_total: 0,
        btn_correct: 0, btn_total: 0,
        sb_correct: 0, sb_total: 0,
        pairs_correct: 0, pairs_total: 0,
        suited_correct: 0, suited_total: 0,
        offsuit_correct: 0, offsuit_total: 0
      };
      setQuizScore({ correct: 0, total: 0 });
      setQuizStreak(0);
      setQuizMaxStreak(0);
      setQuizHistoryStats(emptyStats);
      try {
        localStorage.setItem('poker_quiz_max_streak', '0');
        localStorage.setItem('poker_quiz_stats_v2', JSON.stringify(emptyStats));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Sound Muted state persistence
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('poker_training_muted') === 'true';
    } catch {
      return false;
    }
  });

  const [pokerVolume, setPokerVolume] = useState(() => {
    try {
      const vol = localStorage.getItem('poker_training_volume');
      return vol ? Number(vol) : 0.5;
    } catch {
      return 0.5;
    }
  });

  const handleVolumeChange = (v: number) => {
    setPokerVolume(v);
    try {
      localStorage.setItem('poker_training_volume', String(v));
    } catch (e) {
      console.error(e);
    }
  };

  // Starred Bookmarks scenario IDs persistence
  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('poker_starred_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load / Save persistent training history
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('poker_training_history_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleMute = () => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('poker_training_muted', String(newVal));
      return newVal;
    });
  };

  const toggleStar = (id: string) => {
    setStarredIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('poker_starred_ids', JSON.stringify(next));
      playPokerSound('click', isMuted);
      return next;
    });
  };

  const generateNewQuizQuestion = () => {
    // Determine position based on filter or random
    const positions = tableSize === '9max'
      ? ['utg', 'utg1', 'utg2', 'mp', 'hj', 'co', 'btn', 'sb']
      : ['utg', 'co', 'btn', 'sb'];
    const activePos = quizFilterPos === 'any' 
      ? positions[Math.floor(Math.random() * positions.length)]
      : quizFilterPos;
      
    // Generate card combo matching filter type
    let combo = '';
    let found = false;
    let attempts = 0;
    while (!found && attempts < 200) {
      attempts++;
      const r1 = GTO_RANKS[Math.floor(Math.random() * GTO_RANKS.length)];
      const r2 = GTO_RANKS[Math.floor(Math.random() * GTO_RANKS.length)];
      const idx1 = GTO_RANKS.indexOf(r1);
      const idx2 = GTO_RANKS.indexOf(r2);
      
      let candidate = '';
      if (idx1 === idx2) {
        candidate = r1 + r2;
      } else if (idx1 < idx2) {
        candidate = r1 + r2 + 's';
      } else {
        candidate = r2 + r1 + 'o';
      }
      
      const isPair = idx1 === idx2;
      const isSuited = candidate.endsWith('s');
      const isOffsuit = candidate.endsWith('o');
      
      if (quizFilterType === 'any') {
        combo = candidate;
        found = true;
      } else if (quizFilterType === 'pairs' && isPair) {
        combo = candidate;
        found = true;
      } else if (quizFilterType === 'suited' && isSuited) {
        combo = candidate;
        found = true;
      } else if (quizFilterType === 'offsuit' && isOffsuit) {
        combo = candidate;
        found = true;
      }
    }
    
    // Fallback if loop somehow fails to find (it shouldn't)
    if (!combo) {
      combo = 'AA';
    }

    setQuizPosition(activePos);
    setQuizCombo(combo);
    setQuizSelectedAction(null);
    setQuizFeedback(null);
  };

  const handleQuizAnswer = (action: 'raise' | 'fold') => {
    if (quizSelectedAction) return;
    setQuizSelectedAction(action);
    playPokerSound('click', isMuted);
    
    const isRecommended = isComboInGtoRange(quizCombo, quizPosition, tableSize);
    const correctAnswer = isRecommended ? 'raise' : 'fold';
    const isCorrect = action === correctAnswer;
    
    // Update basic score
    setQuizScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
    
    // Update streak
    let nextStreak = 0;
    if (isCorrect) {
      nextStreak = quizStreak + 1;
      setQuizStreak(nextStreak);
      if (nextStreak > quizMaxStreak) {
        setQuizMaxStreak(nextStreak);
        try {
          localStorage.setItem('poker_quiz_max_streak', String(nextStreak));
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setQuizStreak(0);
    }
    
    // Update categorized historical stats
    const updatedStats = { ...quizHistoryStats };
    const posKeyTotal = `${quizPosition}_total` as keyof typeof quizHistoryStats;
    const posKeyCorrect = `${quizPosition}_correct` as keyof typeof quizHistoryStats;
    
    updatedStats[posKeyTotal] = (updatedStats[posKeyTotal] || 0) + 1;
    if (isCorrect) {
      updatedStats[posKeyCorrect] = (updatedStats[posKeyCorrect] || 0) + 1;
    }
    
    // Check combo type for stats
    const isPair = quizCombo.length === 2;
    const isSuited = quizCombo.endsWith('s');
    const isOffsuit = quizCombo.endsWith('o');
    
    let typePrefix = '';
    if (isPair) typePrefix = 'pairs';
    else if (isSuited) typePrefix = 'suited';
    else if (isOffsuit) typePrefix = 'offsuit';
    
    if (typePrefix) {
      const typeKeyTotal = `${typePrefix}_total` as keyof typeof quizHistoryStats;
      const typeKeyCorrect = `${typePrefix}_correct` as keyof typeof quizHistoryStats;
      updatedStats[typeKeyTotal] = (updatedStats[typeKeyTotal] || 0) + 1;
      if (isCorrect) {
        updatedStats[typeKeyCorrect] = (updatedStats[typeKeyCorrect] || 0) + 1;
      }
    }
    
    setQuizHistoryStats(updatedStats);
    try {
      localStorage.setItem('poker_quiz_stats_v2', JSON.stringify(updatedStats));
    } catch (e) {
      console.error(e);
    }
    
    const posLabelMap: Record<string, string> = {
      utg: 'UTG 槍口位',
      utg1: 'UTG+1 槍口+1',
      utg2: 'UTG+2 槍口+2',
      mp: 'MP 中位',
      hj: 'HJ 劫持位',
      co: 'CO 關位',
      btn: 'BTN 莊家位',
      sb: 'SB 小盲位',
      bb: 'BB 大盲位'
    };
    const posLabel = posLabelMap[quizPosition] || quizPosition.toUpperCase();
    
    if (isCorrect) {
      playPokerSound('correct', isMuted);
      const isRecommendedText = isRecommended ? (quizPosition === 'bb' ? '防守範圍 (跟注/3-bet)' : 'RFI 加注範圍') : '棄牌範圍';
      setQuizFeedback(`🟢 答對了！ ${quizCombo} 在 ${posLabel} 屬 ${isRecommendedText}。`);
    } else {
      playPokerSound('incorrect', isMuted);
      const correctActionText = isRecommended ? (quizPosition === 'bb' ? '防守跟注或加注' : '加注開牌') : '直接棄牌';
      setQuizFeedback(`🔴 答錯了！ ${quizCombo} 在 ${posLabel} 應該 ${correctActionText}。`);
    }
    setGtoPosition(quizPosition);
  };

  React.useEffect(() => {
    if (gtoSubTab === 'quiz' && !quizCombo) {
      generateNewQuizQuestion();
    }
  }, [gtoSubTab, quizCombo]);

  React.useEffect(() => {
    if (gtoSubTab === 'quiz') {
      generateNewQuizQuestion();
    }
  }, [quizFilterPos, quizFilterType]);

  // Reset AI states on scenario/step changes
  React.useEffect(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
    setAiChatHistory([]);
    setCustomQuestion("");
  }, [scenarioIndex, stepIndex]);

  // Rotate loading phrases when analyzing
  React.useEffect(() => {
    if (!isAnalyzing) return;
    const phrases = [
      "正在讀取對手數據及過往行動...",
      "正在模擬對手的心理模型與犯錯傾向...",
      "分析公共牌結構與手牌範圍重疊...",
      "解構對手下注行為動機...",
      "生成客製化的剝削性行動建議...",
      "整合 GTO 理論與剝削模型比對..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % phrases.length;
      setLoadingPhrase(phrases[i]);
    }, 2200);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const triggerAiAnalysis = async () => {
    playPokerSound('click', isMuted);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setAiChatHistory([]);
    setLoadingPhrase("正在讀取對手數據及過往行動...");

    if (aiMode === 'offline') {
      setTimeout(() => {
        try {
          const res = generateOfflineAnalysis(scenario, step);
          setAnalysisResult(res.analysis);
        } catch (err: any) {
          setAnalysisError("離線引擎分析錯誤。");
        } finally {
          setIsAnalyzing(false);
        }
      }, 600);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/poker/mindset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          currentStep: step,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "分析失敗，請重試。");
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || "連線至 AI 引擎失敗，請檢查網路狀態。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const triggerAiFollowUp = async () => {
    if (!customQuestion.trim() || isAnalyzing) return;
    
    const questionText = customQuestion.trim();
    setCustomQuestion("");
    playPokerSound('click', isMuted);

    const userMsg = { role: 'user' as const, text: questionText };
    setAiChatHistory(prev => [...prev, userMsg]);
    setIsAnalyzing(true);
    setLoadingPhrase("教練正在深思熟慮中...");

    if (aiMode === 'offline') {
      setTimeout(() => {
        try {
          const reply = generateOfflineFollowUp(questionText, scenario, step);
          setAiChatHistory(prev => [...prev, { role: 'model' as const, text: reply }]);
        } catch (err: any) {
          setAiChatHistory(prev => [...prev, { role: 'model' as const, text: "❌ 離線引擎回覆錯誤。" }]);
        } finally {
          setIsAnalyzing(false);
        }
      }, 500);
      return;
    }

    try {
      const fullHistoryToSend = [
        ...(analysisResult ? [{ role: 'model' as const, text: analysisResult }] : []),
        ...aiChatHistory,
      ];

      const response = await fetch(getApiUrl("/api/poker/mindset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          currentStep: step,
          message: questionText,
          history: fullHistoryToSend,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "回覆失敗。");
      }

      setAiChatHistory(prev => [...prev, { role: 'model' as const, text: data.analysis }]);
    } catch (err: any) {
      console.error(err);
      setAiChatHistory(prev => [...prev, { role: 'model' as const, text: `❌ 錯誤: ${err.message || "無法獲取 AI 回覆，請重試。"}` }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startGame = (difficulty: string) => {
    playPokerSound('click', isMuted);
    let filtered = scenarios;

    if (difficulty !== 'All') {
      filtered = filtered.filter(s => s.difficulty === difficulty);
    }

    // Map titles to strip suffixes and dynamically reskin cards and feedback texts
    filtered = filtered.map(s => {
      const cleaned = {
        ...s,
        title: s.title.replace(/\s*#\d+$/, '')
      };
      return reskinScenario(cleaned);
    });

    // Shuffle scenarios randomly if enabled
    if (shuffleEnabled) {
      filtered = shuffleArray(filtered);
    }

    setFilteredScenarios(filtered);
    setSelectedDifficulty(difficulty);
    setScenarioIndex(0);
    setStepIndex(0);
    setFeedback(null);
    setSelectedAction(null);
    setTotalScore(0);
    setHandsPlayed(0);
  };

  const startConceptTraining = (concept: string) => {
    playPokerSound('click', isMuted);
    let filtered = scenarios.filter(s => {
      const cats = getScenarioCategories(s);
      return cats.includes(concept);
    });

    // Reskin cards/feedback texts with randomized suits for visual variety
    filtered = filtered.map(s => {
      return reskinScenario(s);
    });

    // Shuffle scenarios randomly if enabled
    if (shuffleEnabled) {
      filtered = shuffleArray(filtered);
    }

    setFilteredScenarios(filtered);
    setSelectedDifficulty(`專項：${concept}`);
    setScenarioIndex(0);
    setStepIndex(0);
    setFeedback(null);
    setSelectedAction(null);
    setTotalScore(0);
    setHandsPlayed(0);
  };

  const startStarredTraining = () => {
    playPokerSound('click', isMuted);
    let filtered = scenarios.filter(s => starredIds.includes(s.id));
    if (filtered.length === 0) return;

    // Map titles to strip suffixes and dynamically reskin cards and feedback texts
    filtered = filtered.map(s => {
      const cleaned = {
        ...s,
        title: s.title.replace(/\s*#\d+$/, '')
      };
      return reskinScenario(cleaned);
    });

    // Shuffle scenarios randomly if enabled
    if (shuffleEnabled) {
      filtered = shuffleArray(filtered);
    }

    setFilteredScenarios(filtered);
    setSelectedDifficulty('我的星標收藏');
    setScenarioIndex(0);
    setStepIndex(0);
    setFeedback(null);
    setSelectedAction(null);
    setTotalScore(0);
    setHandsPlayed(0);
  };

  const startSingleScenario = (scen: Scenario) => {
    playPokerSound('click', isMuted);
    const reskinned = reskinScenario({
      ...scen,
      title: scen.title.replace(/\s*#\d+$/, '')
    });
    setFilteredScenarios([reskinned]);
    setSelectedDifficulty(`單局挑戰：${reskinned.title}`);
    setScenarioIndex(0);
    setStepIndex(0);
    setFeedback(null);
    setSelectedAction(null);
    setTotalScore(0);
    setHandsPlayed(0);
  };

  const resetAllStats = () => {
    playPokerSound('click', isMuted);
    if (window.confirm('確定要清除所有生涯統計數據與答題歷史紀錄嗎？')) {
      localStorage.removeItem('poker_training_history_v2');
      setHistory([]);
    }
  };

  const triggerCustomHandAnalysis = async () => {
    if (!customPocketCards.trim()) return;
    setCustomIsAnalyzing(true);
    setCustomAnalysisResult(null);
    setCustomAnalysisError(null);
    playPokerSound('click', isMuted);

    try {
      const parsedHoleCards = customPocketCards.split(/[\s,]+/).filter(Boolean).map(cardStr => {
        const rank = (cardStr[0]?.toUpperCase() || 'A') as any;
        const suitChar = cardStr[1]?.toLowerCase() || 's';
        let suit: any = 'spades';
        if (suitChar === 'h' || suitChar === '♥') suit = 'hearts';
        else if (suitChar === 'd' || suitChar === '♦') suit = 'diamonds';
        else if (suitChar === 'c' || suitChar === '♣') suit = 'clubs';
        return { rank, suit };
      });

      const parsedCommunityCards = customCommunityCards.split(/[\s,]+/).filter(Boolean).map(cardStr => {
        const rank = (cardStr[0]?.toUpperCase() || '2') as any;
        const suitChar = cardStr[1]?.toLowerCase() || 's';
        let suit: any = 'spades';
        if (suitChar === 'h' || suitChar === '♥') suit = 'hearts';
        else if (suitChar === 'd' || suitChar === '♦') suit = 'diamonds';
        else if (suitChar === 'c' || suitChar === '♣') suit = 'clubs';
        return { rank, suit };
      });

      const payload = {
        scenario: {
          title: "玩家實戰自訂牌局分析",
          difficulty: "進階模式 (玩家實戰)",
          situation: customActionDescription || "玩家提供的自訂德州撲克局勢分析。",
          holeCards: parsedHoleCards,
          position: "Hero 視角",
          effectiveStack: "100 BB",
          userBB: 100,
          villainProfile: "常規未知對手"
        },
        currentStep: {
          street: parsedCommunityCards.length === 0 ? "Preflop" : parsedCommunityCards.length === 3 ? "Flop" : parsedCommunityCards.length === 4 ? "Turn" : "River",
          communityCards: parsedCommunityCards,
          potSize: 15,
          description: "請教練評估此時的底牌範圍、下注尺寸、勝率（Equity）以及在 GTO 視角下的最優行動線與剝削調整建議。"
        }
      };

      const res = await fetch(getApiUrl('/api/poker/mindset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || '無法取得 AI 診斷，請確定後台 API 金鑰狀態。');
      }

      setCustomAnalysisResult(data.analysis);
    } catch (err: any) {
      console.error(err);
      setCustomAnalysisError(err.message || "診斷連線異常，請確認 API 金鑰或網路狀態。");
    } finally {
      setCustomIsAnalyzing(false);
    }
  };

  // Career Statistics Compilation
  const stats = useMemo(() => {
    const total = history.length;
    const totalScoreGained = history.reduce((sum, h) => sum + h.score, 0);
    const avgScore = total > 0 ? (totalScoreGained / total).toFixed(1) : '0';
    const accuracy = total > 0 ? ((history.filter(h => h.score >= 8).length / total) * 100).toFixed(0) : '0';
    
    // Group stats by concept categories
    const conceptMap: Record<string, { total: number; score: number }> = {};
    history.forEach(item => {
      const cats = item.category || [];
      cats.forEach(c => {
        if (!conceptMap[c]) {
          conceptMap[c] = { total: 0, score: 0 };
        }
        conceptMap[c].total += 1;
        conceptMap[c].score += item.score;
      });
    });

    const conceptStats = Object.entries(conceptMap).map(([concept, data]) => {
      const avg = ((data.score / (data.total * 10)) * 100).toFixed(0);
      return {
        concept,
        displayName: CONCEPT_DISPLAY_NAMES[concept] || concept,
        total: data.total,
        accuracy: parseInt(avg)
      };
    }).sort((a, b) => b.accuracy - a.accuracy);

    // Dynamic Title based on hands played & accuracy
    let title = '撲克學徒';
    let titleColor = 'text-slate-400';
    if (total >= 50 && parseInt(accuracy) >= 85) {
      title = 'GTO 狂熱大師';
      titleColor = 'text-emerald-400';
    } else if (total >= 20 && parseInt(accuracy) >= 75) {
      title = '鯊魚常勝軍';
      titleColor = 'text-blue-400';
    } else if (total >= 5) {
      title = '實戰常規玩家';
      titleColor = 'text-amber-400';
    }

    // Find weak categories for Leak Diagnostic Report
    const playedConcepts = conceptStats.filter(c => c.total > 0);
    const worstConcept = playedConcepts.length > 0 
      ? [...playedConcepts].sort((a, b) => a.accuracy - b.accuracy)[0]
      : null;

    let leakAdvice = '';
    if (worstConcept && worstConcept.accuracy < 80) {
      const c = worstConcept.concept;
      if (c === 'Preflop' || c === '3-Bet/4-Bet') {
        leakAdvice = '您的起手牌玩得太寬或 3-Bet/4-Bet 應對偏差。建議：減少在不利位置（OOP）玩邊緣起手牌；面對 3-Bet 時，減少被動跟注，應多選擇 4-Bet 或果斷棄牌以防止被剝削。';
      } else if (c === '同花聽牌' || c === '聽牌打法') {
        leakAdvice = '聽牌打法容易過度跟注。建議：當對手下注尺寸較大（大於半池）且成牌賠率不足時果斷棄牌；在深籌碼、有位置優勢時，多使用「半詐唬加注」而非一味跟注控池。';
      } else if (c === '控池' || c === '邊緣牌') {
        leakAdvice = '邊緣牌控池出現漏洞。建議：持中等強度成牌（如中對、底對、頂對弱 kicker）時，不要主動下注膨脹底池；多採用「過牌-跟注」防守線，避免強迫自己與對手的超強價值範圍對決。';
      } else if (c === '短碼策略') {
        leakAdvice = '短籌碼極限決策偏差。建議：當有效籌碼低於 15BB 時，應嚴格執行 Push/Fold（全下或棄牌）策略，避免不必要的加注-棄牌（Raise-Fold），浪費寶貴的計分牌。';
      } else if (c === '錦標賽' || c === 'ICM 壓力') {
        leakAdvice = '錦標賽生存與 ICM 防守不周。建議：在決賽桌或泡沫期，ICM 壓力極大時防守範圍應大幅度收緊；避免與大籌碼正面碰撞，多尋找短籌碼或被動玩家進行剝削。';
      } else if (c === '慢打/Slow Play') {
        leakAdvice = '超強牌慢打設陷阱不當。建議：在多聽牌的濕潤牌面上切勿慢打，應立刻下重注獲取價值；只有在極乾燥牌面（如 K-7-2 rainbow）或預判對手極其激進時，才進行過牌-設陷阱。';
      } else if (c === '抓雞/Bluff Catch' || c === 'Blocker') {
        leakAdvice = '河牌抓雞不準確。建議：在決定跟注抓雞前，必須明確對手範圍中是否存在足夠的「空氣/詐唬牌」；並檢查自己手牌是否包含「阻擋對手強牌」的關鍵 Blocker，否則盲目抓雞容易造成大量失分。';
      } else if (c === 'Value Bet' || c === '強牌價值') {
        leakAdvice = '價值下注不足或尺寸失衡。建議：河牌面對被動對手要敢於用頂對好踢腳做薄價值下注；強牌從轉牌就開始規劃三條街的下注尺寸——對手能跟的範圍寬就打大，拿到堅果時不要吝嗇使用超額下注。';
      } else if (c === 'SPR') {
        leakAdvice = 'SPR（底池籌碼比）運用不當。建議：翻牌前先預估翻後 SPR——SPR 低於 3 時頂對以上的牌直接規劃套池，不要控池；SPR 高於 6 的深籌碼局面，單對牌力要謹慎控池，避免用一對打光全部籌碼。也可以主動用 3-bet 尺寸設計對自己有利的 SPR。';
      } else {
        leakAdvice = '實戰常規戰術有待加強。建議：多在翻牌後分析對手的完整行動線與其歷史下注尺寸，配合其個人形象（REG/FISH）靈活制定剝削性決策，不要死記硬背 GTO 公式。';
      }
    } else if (playedConcepts.length > 0) {
      leakAdvice = '做得太棒了！您各項戰術觀念的精準度均維持在 80% 以上的高水準，GTO 模型極其穩健，並無明顯漏洞。請繼續迎接全部難度的混合挑戰！';
    }

    return { total, avgScore, accuracy, conceptStats, title, titleColor, worstConcept, leakAdvice };
  }, [history]);

  // Keyboard shortcut listener hook
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      if (key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (!selectedDifficulty) {
        if (rightTab === 'gto' && gtoSubTab === 'quiz') {
          if (!quizSelectedAction) {
            if (key === 'r' || key === 'R' || key === '1') {
              e.preventDefault();
              handleQuizAnswer('raise');
              return;
            }
            if (key === 'f' || key === 'F' || key === '2') {
              e.preventDefault();
              handleQuizAnswer('fold');
              return;
            }
          } else {
            if (key === ' ' || key === 'Enter' || key === 'n' || key === 'N' || key === 'ArrowRight') {
              e.preventDefault();
              generateNewQuizQuestion();
              return;
            }
          }
        }
        return;
      }

      if (key === 'Escape') {
        e.preventDefault();
        playPokerSound('click', isMuted);
        setSelectedDifficulty(null);
        return;
      }

      const activeScenario = filteredScenarios[scenarioIndex];
      if (!activeScenario) return;

      if (key === 's' || key === 'S') {
        e.preventDefault();
        toggleStar(activeScenario.id);
        return;
      }

      if (feedback) {
        if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      const activeStep = activeScenario.steps[stepIndex];
      if (!activeStep) return;

      const digit = parseInt(key);
      if (!isNaN(digit) && digit >= 1 && digit <= activeStep.options.length) {
        e.preventDefault();
        handleAction(activeStep.options[digit - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedDifficulty, feedback, scenarioIndex, stepIndex, filteredScenarios, 
    isMuted, starredIds, rightTab, gtoSubTab, quizSelectedAction, quizCombo, 
    quizPosition
  ]);

  if (!selectedDifficulty) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8 font-sans flex flex-col justify-center">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* Left Column: Game modes Selection */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-black text-2xl tracking-tighter italic shadow-lg shadow-emerald-500/20">TP</div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase">德州撲克 <span className="text-emerald-400 font-mono">AI</span> 高階大師教練</h1>
                  <p className="text-slate-500 text-xs sm:text-sm uppercase tracking-widest">
                    Enterprise-Grade GTO Training Engine • {scenarios.length} Premium Hands
                  </p>
                </div>
              </div>
              <button 
                onClick={toggleMute} 
                className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
                title={isMuted ? "開啟音效" : "靜音模式"}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
              </button>
            </div>

            {/* Question Pool Optimization Settings */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  AI 題庫智慧優化設定
                </span>
                <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">QUESTION POOL ENGINE</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={shuffleEnabled}
                    onChange={(e) => {
                      const val = e.target.checked;
                      playPokerSound('click', isMuted);
                      setShuffleEnabled(val);
                      try {
                        localStorage.setItem('poker_shuffle_enabled', String(val));
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="mt-0.5 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500/30 bg-slate-950 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                      隨機打亂手牌
                    </div>
                    <div className="text-[10px] text-slate-500 leading-normal">
                      每次開始訓練均隨機打亂題庫出牌順序，全面鍛鍊真實牌局下的臨場反應與判斷。
                    </div>
                  </div>
                </label>
              </div>

              <div className="h-px bg-slate-800/60 my-2"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="max-w-md">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    預設訓練人數與 GTO 桌型
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    切換您首選的人數桌型。德州撲克 GTO 翻前 RFI 開牌範圍、盲位順序與 3D 牌桌座位圖將自動完成全局適配 (系統已預設為您最常玩的 9 人桌)。
                  </div>
                </div>
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      playPokerSound('click', isMuted);
                      setTableSize('9max');
                      try { localStorage.setItem('poker_table_size', '9max'); } catch(e){}
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      tableSize === '9max'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    9人桌 (9-Max)
                  </button>
                  <button
                    onClick={() => {
                      playPokerSound('click', isMuted);
                      setTableSize('6max');
                      try { localStorage.setItem('poker_table_size', '6max'); } catch(e){}
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      tableSize === '6max'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    6人桌 (6-Max)
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Scenario Search & Keyword Filter */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  精準搜尋特定手牌 / 戰術
                </h2>
                <span className="text-[9px] text-slate-500 font-mono">SEARCH ENGINE</span>
              </div>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="輸入起手牌 (如: AA, AKs, QQ) 或戰術關鍵字 (如: 控池, 聽牌, 3-bet)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-3" />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      playPokerSound('click', isMuted);
                      setSearchQuery('');
                    }}
                    className="text-slate-500 hover:text-white text-xs font-bold absolute right-3 top-2.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Search Results */}
              {searchQuery.trim() !== '' && (
                <div className="mt-2 bg-slate-950/80 border border-slate-850 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-900/60 p-1">
                  {searchedScenarios.length > 0 ? (
                    searchedScenarios.map((scen) => {
                      const pocketStr = scen.holeCards.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit] || c.suit[0].toUpperCase()}`).join(' ');
                      return (
                        <button
                          key={scen.id}
                          onClick={() => startSingleScenario(scen)}
                          className="w-full text-left p-2.5 hover:bg-slate-900 rounded-lg flex items-center justify-between transition-colors group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                                {scen.title.replace(/\s*#\d+$/, '')}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded ${
                                scen.difficulty === '新手' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                scen.difficulty === '中階' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {scen.difficulty}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-normal line-clamp-1">{scen.preAction || '點擊直接載入此德州撲克手牌挑戰'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-extrabold text-emerald-400 font-mono tracking-wide">{pocketStr}</div>
                            <div className="text-[9px] text-slate-600 font-mono uppercase">{scen.position}</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-600">
                      找不到與「{searchQuery}」相關的手牌或戰略。
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Difficulty Start Cards */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  依難度快速開始
                </h2>
                {starredIds.length > 0 && (
                  <button 
                    onClick={startStarredTraining}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full transition-all hover:scale-[1.02]"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    已星標收藏 ({starredIds.length} 手)
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: '新手', desc: '適合掌握基礎起手牌與下注概念' },
                  { key: '中階', desc: '考驗控池、聽牌半詐唬與範圍判斷' },
                  { key: '進階', desc: '探討 Blocker、高階 4-bet 及 ICM 策略' },
                  { key: 'All', desc: `混合全部 ${scenarios.length} 手獨立情境極致鍛鍊` }
                ].map(diff => (
                  <button
                    key={diff.key}
                    onClick={() => startGame(diff.key)}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left hover:border-slate-700 active:scale-[0.99] transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none group-hover:scale-150 transition-transform"></div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-sm tracking-wider text-white">
                        {diff.key === 'All' ? '全部難度綜合' : `${diff.key}模式`}
                      </span>
                      <Play className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">{diff.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Specialized Tactical Training Concepts Grid */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                戰術概念專項訓練
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'Value Bet', label: '價值下注與尺寸' },
                  { key: 'SPR', label: 'SPR 套池決策' },
                  { key: '同花聽牌', label: '同花聽牌應對' },
                  { key: '控池', label: '邊緣牌控制底池' },
                  { key: '短碼策略', label: '短碼 Push/Fold' },
                  { key: '慢打/Slow Play', label: '慢打與設陷阱' },
                  { key: '抓雞/Bluff Catch', label: '河牌 Blocker 抓雞' },
                  { key: 'ICM 壓力', label: 'ICM 錦標賽生存' },
                ].map(concept => (
                  <button
                    key={concept.key}
                    onClick={() => startConceptTraining(concept.key)}
                    className="py-2.5 px-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-[11px] text-slate-300 font-medium rounded-xl text-left flex items-center justify-between transition-all active:scale-[0.98]"
                  >
                    <span>{concept.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts Guide Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-sans">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  大師訓練鍵盤快捷鍵
                </span>
                <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">SHORTCUTS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400 leading-normal">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-1.5 bg-slate-950/40 rounded border border-slate-900/40">
                    <span className="text-slate-400 font-medium">選擇實戰動作</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[10px] font-bold">[1], [2], [3]</kbd>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-950/40 rounded border border-slate-900/40">
                    <span className="text-slate-400 font-medium">下一街 / 下一手</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[10px] font-bold">[Space] / [Enter]</kbd>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-1.5 bg-slate-950/40 rounded border border-slate-900/40">
                    <span className="text-slate-400 font-medium">翻前開牌挑戰</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[10px] font-bold">[R] 加注 / [F] 棄牌</kbd>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-950/40 rounded border border-slate-900/40">
                    <span className="text-slate-400 font-medium">靜音 / 離開返回</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[10px] font-bold">[M] 鍵 / [Esc] 鍵</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Career Progress Dashboard */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">大師生涯分析</span>
              </div>
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 ${stats.titleColor}`}>
                {stats.title}
              </span>
            </div>

            {/* Tab Swapper: Career Stats vs GTO Preflop Matrix */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                onClick={() => {
                  playPokerSound('click', isMuted);
                  setRightTab('stats');
                }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  rightTab === 'stats'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                生涯數據 & 漏洞診斷
              </button>
              <button
                onClick={() => {
                  playPokerSound('click', isMuted);
                  setRightTab('gto');
                }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  rightTab === 'gto'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                GTO 開牌範圍矩陣
              </button>
            </div>

            {rightTab === 'stats' ? (
              <>
                {/* Lifetime Stats Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5 font-mono">生涯手牌</div>
                    <div className="text-xl font-bold text-white font-mono">{stats.total}</div>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5 font-mono">大師正確率</div>
                    <div className="text-xl font-bold text-emerald-400 font-mono">{stats.accuracy}%</div>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5 font-mono">手牌平均分</div>
                    <div className="text-xl font-bold text-amber-400 font-mono">{stats.avgScore}</div>
                  </div>
                </div>

                {/* Diagnostic Report Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">戰術觀念精準度診斷</span>
                    <span className="text-[9px] text-slate-600 uppercase font-mono">DIAGNOSTICS REPORT</span>
                  </div>
                  
                  {stats.conceptStats.length > 0 ? (
                    <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                      {stats.conceptStats.map(item => (
                        <div key={item.concept} className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-300 font-medium">{item.displayName}</span>
                            <span className={`font-mono font-bold ${
                              item.accuracy >= 80 ? 'text-emerald-400' : item.accuracy >= 50 ? 'text-amber-400' : 'text-rose-400'
                            }`}>{item.accuracy}% ({item.total}手)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                item.accuracy >= 80 ? 'bg-emerald-500' : item.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${item.accuracy}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 px-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                      <BarChart2 className="w-8 h-8 text-slate-700 mx-auto" />
                      <p className="text-xs text-slate-500">
                        目前尚未累積數據。開始任何難度或專項訓練，AI 將自動為您生成戰術精準度評估！
                      </p>
                    </div>
                  )}
                </div>

                {/* AI GTO Leak Diagnostic Report */}
                {stats.total > 0 && (
                  <div className="p-4 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
                        AI 智慧漏洞診斷建議
                      </span>
                      {stats.worstConcept && stats.worstConcept.accuracy < 80 ? (
                        <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.25 rounded">
                          防禦漏洞：{stats.worstConcept.displayName}
                        </span>
                      ) : (
                        <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.25 rounded">
                          GTO 結構：極穩健
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {stats.leakAdvice}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">GTO 100BB 翻前範圍訓練</span>
                  <span className="text-[9px] text-slate-600 uppercase font-mono">13x13 RANGE TOOLS</span>
                </div>

                {/* Sub-tab Swapper for GTO Visualizer vs Quiz */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    onClick={() => {
                      playPokerSound('click', isMuted);
                      setGtoSubTab('view');
                    }}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1 ${
                      gtoSubTab === 'view'
                        ? 'bg-slate-850 text-emerald-400 font-extrabold shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    📊 範圍總覽
                  </button>
                  <button
                    onClick={() => {
                      playPokerSound('click', isMuted);
                      setGtoSubTab('quiz');
                      generateNewQuizQuestion();
                    }}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1 ${
                      gtoSubTab === 'quiz'
                        ? 'bg-slate-850 text-emerald-400 font-extrabold shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    🎯 翻前挑戰
                  </button>
                </div>

                {gtoSubTab === 'quiz' && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span className="uppercase tracking-wider flex items-center gap-1 text-emerald-400 font-bold">
                        <Target className="w-3.5 h-3.5" />
                        RFI 翻前開牌挑戰
                      </span>
                      <span className="text-slate-400 font-bold">
                        正確率: {quizScore.total > 0 ? ((quizScore.correct / quizScore.total) * 100).toFixed(0) : 0}% ({quizScore.correct}/{quizScore.total})
                      </span>
                    </div>

                    {/* Streaks metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-900/60 text-center">
                      <div className="flex flex-col items-center justify-center border-r border-slate-800/80 py-0.5">
                        <span className="text-slate-500 uppercase text-[9px] font-mono tracking-wider flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500 fill-current animate-pulse" />
                          目前連勝
                        </span>
                        <span className="text-emerald-400 font-extrabold text-xs">
                          {quizStreak} 關
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-0.5">
                        <span className="text-slate-500 uppercase text-[9px] font-mono tracking-wider flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-400" />
                          最高紀錄
                        </span>
                        <span className="text-amber-400 font-extrabold text-xs">
                          {quizMaxStreak} 關
                        </span>
                      </div>
                    </div>
                                  {/* Filter controls */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5 text-[10px]">
                      <div className="space-y-1">
                        <span className="text-slate-500 font-bold uppercase block text-[8px] tracking-wider">練習位置過濾</span>
                        <select
                          value={quizFilterPos}
                          onChange={(e) => {
                            playPokerSound('click', isMuted);
                            setQuizFilterPos(e.target.value as any);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500/80 font-sans text-[11px]"
                        >
                          <option value="any">隨機所有位置 (Random)</option>
                          {(tableSize === '9max' ? [
                            { value: 'utg', label: 'UTG 槍口位 (10% RFI)' },
                            { value: 'utg1', label: 'UTG+1 (12% RFI)' },
                            { value: 'utg2', label: 'UTG+2 (14% RFI)' },
                            { value: 'mp', label: 'MP 中位 (16% RFI)' },
                            { value: 'hj', label: 'HJ 劫持 (19% RFI)' },
                            { value: 'co', label: 'CO 關位 (26% RFI)' },
                            { value: 'btn', label: 'BTN 莊家位 (45% RFI)' },
                            { value: 'sb', label: 'SB 小盲位 (48% RFI)' },
                            { value: 'bb', label: 'BB 大盲位 (56% 防守)' }
                          ] : [
                            { value: 'utg', label: 'UTG 槍口位 (15% RFI)' },
                            { value: 'co', label: 'CO 關位 (26% RFI)' },
                            { value: 'btn', label: 'BTN 莊家位 (45% RFI)' },
                            { value: 'sb', label: 'SB 小盲位 (52% RFI)' },
                            { value: 'bb', label: 'BB 大盲位 (58% 防守)' }
                          ]).map(pos => (
                            <option key={pos.value} value={pos.value}>{pos.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 font-bold uppercase block text-[8px] tracking-wider">手牌類型過濾</span>
                        <select
                          value={quizFilterType}
                          onChange={(e) => {
                            playPokerSound('click', isMuted);
                            setQuizFilterType(e.target.value as any);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500/80 font-sans text-[11px]"
                        >
                          <option value="any">隨機所有類型 (Random)</option>
                          <option value="pairs">口袋對子 (Pocket Pairs)</option>
                          <option value="suited">同花手牌 (Suited)</option>
                          <option value="offsuit">雜色手牌 (Offsuit)</option>
                        </select>
                      </div>
                    </div>

                    {/* Current Question */}
                    <div className="py-2.5 text-center space-y-1.5 bg-slate-900/40 border border-slate-900 rounded-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">目前位置</div>
                      <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs rounded-full">
                        {{
                          utg: tableSize === '9max' ? 'UTG 槍口位 (10% RFI)' : 'UTG 槍口位 (15% RFI)',
                          utg1: 'UTG+1 槍口+1 (12% RFI)',
                          utg2: 'UTG+2 槍口+2 (14% RFI)',
                          mp: 'MP 中位 (16% RFI)',
                          hj: 'HJ 劫持位 (19% RFI)',
                          co: 'CO 關位 (26% RFI)',
                          btn: 'BTN 莊家位 (45% RFI)',
                          sb: tableSize === '9max' ? 'SB 小盲位 (48% RFI)' : 'SB 小盲位 (52% RFI)',
                          bb: tableSize === '9max' ? 'BB 大盲位 (56% 防守)' : 'BB 大盲位 (58% 防守)'
                        }[quizPosition] || quizPosition.toUpperCase()}
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">隨機手牌</div>
                        <div className="text-3xl font-mono font-extrabold text-white tracking-wider flex items-center justify-center gap-1">
                          <span>{quizCombo}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!quizSelectedAction ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => handleQuizAnswer('raise')}
                          className="py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                        >
                          <span>{quizPosition === 'bb' ? '防守跟注/加注 (DEFEND)' : '加注開牌 (RAISE)'}</span>
                          <span className="text-[9px] font-mono opacity-80 font-bold">[R] 或 [1]</span>
                        </button>
                        <button
                          onClick={() => handleQuizAnswer('fold')}
                          className="py-2 bg-slate-800 hover:bg-slate-750 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all border border-slate-700/50 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                        >
                          <span>直接棄牌 (FOLD)</span>
                          <span className="text-[9px] font-mono opacity-60 font-bold">[F] 或 [2]</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div className="p-3 bg-slate-900 rounded-lg text-xs leading-relaxed text-center font-medium">
                          {quizFeedback}
                        </div>
                        <button
                          onClick={generateNewQuizQuestion}
                          className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-extrabold text-xs rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <span>下一手挑戰</span>
                          <span className="text-[9px] font-mono opacity-80 border border-emerald-400/20 px-1 rounded bg-slate-950/40">[Space]</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Collapsible accuracy diagnostics */}
                    <div className="border border-slate-900/60 rounded-xl overflow-hidden bg-slate-900/20 mt-1">
                      <button
                        onClick={() => {
                          playPokerSound('click', isMuted);
                          setIsQuizStatsExpanded(prev => !prev);
                        }}
                        className="w-full px-3 py-2 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex items-center justify-between text-[10.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                          查看「翻前挑戰」多維度準確率診斷
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-0.5">
                          {isQuizStatsExpanded ? '收合 ▲' : '展開 ▼'}
                        </span>
                      </button>

                      {isQuizStatsExpanded && (
                        <div className="p-3 bg-slate-950/90 border-t border-slate-900/80 text-[10.5px] space-y-3.5">
                          {/* Position Accuracies */}
                          <div className="space-y-2">
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-900/40 pb-1">按位置分析 (Position Accuracy)</div>
                            {[
                              { key: 'utg', label: 'UTG 槍口位 (15% RFI)' },
                              { key: 'co', label: 'CO 關位 (26% RFI)' },
                              { key: 'btn', label: 'BTN 莊家位 (45% RFI)' },
                              { key: 'sb', label: 'SB 小盲位 (52% RFI)' }
                            ].map(pos => {
                              const correct = quizHistoryStats[`${pos.key}_correct` as keyof typeof quizHistoryStats] || 0;
                              const total = quizHistoryStats[`${pos.key}_total` as keyof typeof quizHistoryStats] || 0;
                              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                              return (
                                <div key={pos.key} className="space-y-1">
                                  <div className="flex justify-between font-medium">
                                    <span className="text-slate-400">{pos.label}</span>
                                    <span className={total > 0 ? (pct >= 85 ? "text-emerald-400 font-mono font-bold" : pct >= 60 ? "text-amber-400 font-mono font-bold" : "text-rose-400 font-mono font-bold") : "text-slate-600 font-mono"}>
                                      {total > 0 ? `${pct}% (${correct}/${total})` : '暫無數據'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-950">
                                    <div 
                                      className={`h-full rounded-full ${pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                                      style={{ width: `${total > 0 ? pct : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Hand Type Accuracies */}
                          <div className="space-y-2">
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-900/40 pb-1">按手牌類型分析 (Hand Type Accuracy)</div>
                            {[
                              { key: 'pairs', label: '口袋對子 (Pocket Pairs)' },
                              { key: 'suited', label: '同花手牌 (Suited Combinations)' },
                              { key: 'offsuit', label: '雜色手牌 (Offsuit Combinations)' }
                            ].map(type => {
                              const correct = quizHistoryStats[`${type.key}_correct` as keyof typeof quizHistoryStats] || 0;
                              const total = quizHistoryStats[`${type.key}_total` as keyof typeof quizHistoryStats] || 0;
                              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                              return (
                                <div key={type.key} className="space-y-1">
                                  <div className="flex justify-between font-medium">
                                    <span className="text-slate-400">{type.label}</span>
                                    <span className={total > 0 ? (pct >= 85 ? "text-emerald-400 font-mono font-bold" : pct >= 60 ? "text-amber-400 font-mono font-bold" : "text-rose-400 font-mono font-bold") : "text-slate-600 font-mono"}>
                                      {total > 0 ? `${pct}% (${correct}/${total})` : '暫無數據'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-950">
                                    <div 
                                      className={`h-full rounded-full ${pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                                      style={{ width: `${total > 0 ? pct : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Reset Quiz Stats Button */}
                          <button
                            onClick={resetQuizStats}
                            className="w-full py-2 mt-1.5 bg-transparent hover:bg-rose-500/5 text-rose-500/50 hover:text-rose-400 text-[10px] font-mono uppercase tracking-wider rounded-lg border border-rose-500/10 hover:border-rose-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            重設此挑戰歷史數據
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                 {/* Position selector tabs - only show in view mode */}
                 {gtoSubTab === 'view' && (
                   <div className="grid grid-cols-4 gap-1.5">
                     {(tableSize === '9max' ? [
                       { key: 'utg', label: 'UTG 槍口', pct: '10%' },
                       { key: 'utg1', label: 'UTG+1', pct: '12%' },
                       { key: 'utg2', label: 'UTG+2', pct: '14%' },
                       { key: 'mp', label: 'MP 中位', pct: '16%' },
                       { key: 'hj', label: 'HJ 劫持', pct: '19%' },
                       { key: 'co', label: 'CO 關位', pct: '26%' },
                       { key: 'btn', label: 'BTN 莊家', pct: '45%' },
                       { key: 'sb', label: 'SB 小盲', pct: '48%' }
                     ] : [
                       { key: 'utg', label: 'UTG 槍口', pct: '15%' },
                       { key: 'co', label: 'CO 關位', pct: '26%' },
                       { key: 'btn', label: 'BTN 莊家', pct: '45%' },
                       { key: 'sb', label: 'SB 小盲', pct: '52%' }
                     ]).map(pos => (
                       <button
                         key={pos.key}
                         onClick={() => {
                           playPokerSound('click', isMuted);
                           setGtoPosition(pos.key);
                         }}
                         className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all border leading-tight ${
                           gtoPosition === pos.key
                             ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-extrabold shadow-sm shadow-emerald-500/5'
                             : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                         }`}
                       >
                         <div>{pos.label}</div>
                         <div className="text-[7.5px] sm:text-[8px] font-normal opacity-70">範圍 {pos.pct}</div>
                       </button>
                     ))}
                   </div>
                 )}

                {/* The 13x13 interactive matrix */}
                <div className="flex flex-col items-center">
                  <div className="grid grid-cols-13 gap-[2px] w-full max-w-[340px] aspect-square">
                    {GTO_RANKS.map((r1, rowIdx) => (
                      GTO_RANKS.map((r2, colIdx) => {
                        // Determine combo name
                        let combo = '';
                        let type = 'pair'; // 'pair', 'suited', 'offsuit'
                        if (rowIdx === colIdx) {
                          combo = `${r1}${r2}`;
                          type = 'pair';
                        } else if (rowIdx < colIdx) {
                          combo = `${r1}${r2}s`;
                          type = 'suited';
                        } else {
                          combo = `${r2}${r1}o`;
                          type = 'offsuit';
                        }

                        const active = isComboInGtoRange(combo, gtoPosition, tableSize);
                        
                        let bgStyle = 'bg-slate-950 text-slate-700 hover:bg-slate-850';
                        let borderStyle = '';
                        const isTargetHand = combo === quizCombo;

                        if (gtoSubTab === 'quiz') {
                          if (!quizSelectedAction) {
                            // Closed-book mode: hide colors
                            if (isTargetHand) {
                              bgStyle = 'bg-slate-900 text-white font-bold';
                              borderStyle = 'border-2 border-amber-400 animate-pulse scale-105 z-10';
                            } else {
                              bgStyle = 'bg-slate-950/40 text-slate-800 opacity-20';
                            }
                          } else {
                            // Answered mode: reveal colors and highlight target
                            if (active) {
                              bgStyle = type === 'pair'
                                ? 'bg-emerald-500 text-emerald-950 font-bold border border-emerald-400/30'
                                : type === 'suited'
                                  ? 'bg-teal-500/90 text-teal-950 border border-teal-400/30'
                                  : 'bg-cyan-500/90 text-cyan-950 border border-cyan-400/30';
                            } else {
                              bgStyle = 'bg-slate-950 text-slate-800';
                            }
                            if (isTargetHand) {
                              borderStyle = 'border-2 border-amber-400 scale-110 z-10 ring-4 ring-amber-400/20';
                            }
                          }
                        } else {
                          // Normal View Mode: show range colors
                          if (active) {
                            bgStyle = type === 'pair'
                              ? 'bg-emerald-500 text-emerald-950 border border-emerald-400/30 font-bold'
                              : type === 'suited'
                                ? 'bg-teal-500/90 text-teal-950 border border-teal-400/30'
                                : 'bg-cyan-500/90 text-cyan-950 border border-cyan-400/30';
                          } else {
                            bgStyle = 'bg-slate-950 text-slate-700 hover:bg-slate-850';
                          }
                        }

                        return (
                          <div
                            key={combo}
                            onMouseEnter={() => setHoveredGtoCombo(combo)}
                            onMouseLeave={() => setHoveredGtoCombo(null)}
                            className={`aspect-square rounded-[2px] flex items-center justify-center text-[8px] font-mono font-medium transition-all cursor-crosshair select-none relative group ${bgStyle} ${borderStyle}`}
                            title={`${combo}: ${active ? '推薦 RFI 加注開牌' : '推薦棄牌'}`}
                          >
                            <span className="scale-[0.85] sm:scale-100">{combo}</span>
                          </div>
                        );
                      })
                    ))}
                  </div>

                  {/* Range Info Footer */}
                  <div className="w-full max-w-[340px] mt-3 p-2.5 bg-slate-950/80 border border-slate-850 rounded-xl text-[10px] leading-normal flex items-center justify-between text-slate-400 font-mono">
                    <div>
                      <span className="font-bold text-slate-300">目前選定: </span>
                      <span className="text-emerald-400 font-bold uppercase">
                        {gtoSubTab === 'quiz' ? quizPosition.toUpperCase() : gtoPosition.toUpperCase()} RFI
                      </span>
                    </div>
                    <div>
                      {gtoSubTab === 'quiz' ? (
                        quizSelectedAction ? (
                          <div>
                            結果: <span className="text-white font-bold">{quizCombo}</span> sits in {
                              isComboInGtoRange(quizCombo, quizPosition, tableSize) ? '✅ OPEN RANGE' : '❌ FOLD RANGE'
                            }
                          </div>
                        ) : (
                          <span className="text-amber-400 animate-pulse font-bold">預估你的翻前手牌選擇</span>
                        )
                      ) : hoveredGtoCombo ? (
                        <div>
                          手牌: <span className="text-white font-bold">{hoveredGtoCombo}</span> ({
                            isComboInGtoRange(hoveredGtoCombo, gtoPosition, tableSize) 
                              ? '✅ 加注 2-2.5BB 開牌' 
                              : '❌ 直接棄牌 FOLD'
                          })
                        </div>
                      ) : (
                        <span className="text-slate-500">指針懸停儲存格看建議</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 text-[10px] text-slate-400 leading-relaxed space-y-1.5">
                  <p className="font-bold text-slate-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    GTO 翻前首進開牌指南：
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[9.5px]">
                    <li>在上游位置 (如 UTG) 應保持緊湊開牌；在下游位置 (如 BTN) 則可大幅拓寬搶奪盲注。</li>
                    <li><span className="text-emerald-400 font-bold">綠色</span>代表口袋對子 (Pairs)；<span className="text-teal-400 font-bold">青色</span>代表同花組合 (Suited)；<span className="text-cyan-400 font-bold">藍色</span>代表不同花組合 (Offsuit)。</li>
                    <li>本表適用於 100BB 籌碼深度的經典 GTO 六人桌開局指引。</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Interactive Custom Hand AI Coach Review Panel */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  實戰牌局自訂 AI 複盤
                </span>
                <span className="text-[9px] text-slate-500 font-mono">CUSTOM REVIEW</span>
              </div>
              <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                {/* Quick Presets Templates */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    ⚡ 快速載入實戰經典範本：
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        name: 'Ah Kc Preflop',
                        pocket: 'Ac Kc',
                        comm: '',
                        desc: 'BTN 玩家加注 2.5BB，我在 SB 持 A♣K♣ 3-bet 到 9BB，BTN 跟注。請分析雙方的 Preflop 範圍與後續戰術方向。'
                      },
                      {
                        name: 'QQ Flop Wet',
                        pocket: 'Qh Qd',
                        comm: 'Jh Th 8c',
                        desc: 'Hero 持 QQ 在 CO 加注 2.2BB 被 BB 跟注。Flop 為 J♥T♥8♣ 有同花順子聽牌，BB 過牌，Hero 下注 1.5BB，BB 突然 Check-Raise 到 6BB。此時應跟注、加注還是棄牌？'
                      },
                      {
                        name: 'AA River Catch',
                        pocket: 'Ad As',
                        comm: 'Kh 9d 2s 4c Jc',
                        desc: 'Hero 持 AA 在 UTG 加注 2.5BB，BTN 跟注。Flop/Turn 均下注半池並被跟注。River 開出 J♣ 完牌，Hero 過牌，BTN 突然超額下注 1.5 倍底池。分析對手詐唬與 Hero 抓雞決策。'
                      }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          playPokerSound('click', isMuted);
                          setCustomPocketCards(preset.pocket);
                          setCustomCommunityCards(preset.comm);
                          setCustomActionDescription(preset.desc);
                        }}
                        className="py-1 px-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-[9px] text-slate-300 font-medium text-center truncate transition-colors"
                        title={`載入 ${preset.name}`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                      <span>底牌 (Hole Cards)</span>
                      <button
                        type="button"
                        onClick={() => {
                          playPokerSound('click', isMuted);
                          setPickerMode(pickerMode === 'pocket' ? null : 'pocket');
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                          pickerMode === 'pocket'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {pickerMode === 'pocket' ? '關閉選卡' : '🎯 視覺選卡'}
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="例：Ah Kd"
                      value={customPocketCards}
                      onChange={(e) => setCustomPocketCards(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                      <span>公用牌 (Community)</span>
                      <button
                        type="button"
                        onClick={() => {
                          playPokerSound('click', isMuted);
                          setPickerMode(pickerMode === 'community' ? null : 'community');
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                          pickerMode === 'community'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {pickerMode === 'community' ? '關閉選卡' : '🎯 視覺選卡'}
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="例：Th 9h 2c"
                      value={customCommunityCards}
                      onChange={(e) => setCustomCommunityCards(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80"
                    />
                  </div>
                </div>

                {pickerMode && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 mb-2">
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        正在選擇 {pickerMode === 'pocket' ? '手牌底牌 (最多 2 張)' : '公共牌 (最多 5 張)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerMode(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        關閉 ✕
                      </button>
                    </div>

                    <div className="space-y-1">
                      {(['spades', 'hearts', 'diamonds', 'clubs'] as const).map(suit => {
                        const suitChar = { spades: 's', hearts: 'h', diamonds: 'd', clubs: 'c' }[suit];
                        const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit];
                        const suitColor = {
                          spades: 'text-slate-400 border-slate-850 hover:bg-slate-900',
                          hearts: 'text-rose-500 border-rose-950/20 hover:bg-rose-950/10',
                          diamonds: 'text-blue-500 border-blue-950/20 hover:bg-blue-950/10',
                          clubs: 'text-emerald-500 border-emerald-950/20 hover:bg-emerald-950/10'
                        }[suit];

                        const suitBgActive = {
                          spades: 'bg-slate-700 text-white border-slate-400',
                          hearts: 'bg-rose-600 text-white border-rose-400',
                          diamonds: 'bg-blue-600 text-white border-blue-400',
                          clubs: 'bg-emerald-600 text-white border-emerald-400'
                        }[suit];

                        const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

                        return (
                          <div key={suit} className="flex gap-1 items-center">
                            {/* Suit label */}
                            <div className="w-5 h-5 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                              <span className={suit === 'spades' ? 'text-slate-500' : suit === 'hearts' ? 'text-rose-500' : suit === 'diamonds' ? 'text-blue-500' : 'text-emerald-500'}>
                                {suitSymbol}
                              </span>
                            </div>
                            
                            <div className="flex gap-[3.5px] overflow-x-auto no-scrollbar py-0.5">
                              {ranks.map(rank => {
                                const cardStr = `${rank}${suitChar}`;
                                const inPocket = customPocketCards.split(/[\s,]+/).filter(Boolean).includes(cardStr);
                                const inComm = customCommunityCards.split(/[\s,]+/).filter(Boolean).includes(cardStr);
                                
                                const isSelected = pickerMode === 'pocket' ? inPocket : inComm;
                                const isUsedInOther = pickerMode === 'pocket' ? inComm : inPocket;
                                
                                return (
                                  <button
                                    key={cardStr}
                                    type="button"
                                    disabled={isUsedInOther}
                                    onClick={() => {
                                      playPokerSound('click', isMuted);
                                      if (pickerMode === 'pocket') {
                                        let current = customPocketCards.split(/[\s,]+/).filter(Boolean);
                                        if (current.includes(cardStr)) {
                                          current = current.filter(c => c !== cardStr);
                                        } else {
                                          if (current.length >= 2) {
                                            current = [current[0], cardStr];
                                          } else {
                                            current.push(cardStr);
                                          }
                                        }
                                        setCustomPocketCards(current.join(' '));
                                      } else {
                                        let current = customCommunityCards.split(/[\s,]+/).filter(Boolean);
                                        if (current.includes(cardStr)) {
                                          current = current.filter(c => c !== cardStr);
                                        } else {
                                          if (current.length < 5) {
                                            current.push(cardStr);
                                          } else {
                                            current = [...current.slice(1), cardStr];
                                          }
                                        }
                                        setCustomCommunityCards(current.join(' '));
                                      }
                                    }}
                                    className={`w-[26px] h-[26px] rounded flex flex-col items-center justify-center text-[9px] font-mono font-bold border transition-all shrink-0 select-none ${
                                      isSelected
                                        ? suitBgActive + ' shadow-sm scale-105 z-10'
                                        : isUsedInOther
                                          ? 'opacity-10 bg-slate-950/80 border-transparent cursor-not-allowed scale-90'
                                          : `bg-slate-900 ${suitColor}`
                                    }`}
                                  >
                                    <span>{rank}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1.5 border-t border-slate-850">
                      <span>* 專業四色撲克：♠黑 ♥紅 ♦藍 ♣綠，方便快速點選。</span>
                      <button
                        type="button"
                        onClick={() => {
                          playPokerSound('click', isMuted);
                          if (pickerMode === 'pocket') {
                            setCustomPocketCards('');
                          } else {
                            setCustomCommunityCards('');
                          }
                        }}
                        className="text-rose-500 hover:text-rose-400 font-bold"
                      >
                        清空此欄
                      </button>
                    </div>
                  </div>
                )}

                {/* Real-time Hand Strength Feedback */}
                {(() => {
                  const parsedHole = parseCards(customPocketCards);
                  const parsedComm = parseCards(customCommunityCards);
                  
                  if (parsedHole.length > 0) {
                    const analysis = evaluateHandStrength(parsedHole, parsedComm);
                    return (
                      <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-200">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                            即時牌力與聽牌分析 (Real-time Evaluation)
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-emerald-400 text-sm">{analysis.name}</span>
                            {analysis.draw && (
                              <span className="px-1.5 py-0.5 bg-emerald-950/45 text-emerald-400 border border-emerald-800/40 rounded text-[9px] font-bold">
                                {analysis.draw}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 bg-slate-900/60 p-1.5 rounded-lg border border-slate-850">
                          {parsedHole.map((c, idx) => (
                            <div key={`hole-${idx}`} className="scale-90">
                              <MiniCard card={c} />
                            </div>
                          ))}
                          {parsedComm.length > 0 && (
                            <div className="h-7 w-[1px] bg-slate-800 mx-1 self-center" />
                          )}
                          {parsedComm.map((c, idx) => (
                            <div key={`comm-${idx}`} className="scale-90">
                              <MiniCard card={c} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    牌局序列與對手動作說明
                  </label>
                  <textarea
                    placeholder="例：UTG 玩家加注 2.2BB，我在 Button 位置持 AKs 跟注。Flop 開出 T-9-2 帶同花聽牌，UTG 過牌，我下注 1.5BB，UTG 突然 Check-Raise 到 6BB..."
                    value={customActionDescription}
                    onChange={(e) => setCustomActionDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 resize-none"
                  />
                </div>

                <button
                  disabled={customIsAnalyzing || !customPocketCards.trim()}
                  onClick={triggerCustomHandAnalysis}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold uppercase tracking-widest text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {customIsAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>教練智慧拆解中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>送出 GTO AI 大師診斷</span>
                    </>
                  )}
                </button>

                {customAnalysisError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded leading-normal">
                    {customAnalysisError}
                  </div>
                )}

                {customAnalysisResult && (
                  <div className="mt-3 p-4 bg-slate-950 border border-slate-850 rounded-lg text-xs leading-relaxed text-slate-300 max-h-[250px] overflow-y-auto space-y-2 markdown-body">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest border-b border-slate-800 pb-1.5 flex items-center gap-1.5 font-mono">
                      <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse text-amber-400" />
                      GTO AI 智慧分析報告
                    </div>
                    <div className="markdown-body">
                      <Markdown>{customAnalysisResult}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reset stats button */}
            {history.length > 0 && (
              <button 
                onClick={resetAllStats}
                className="w-full py-2 bg-transparent hover:bg-rose-500/5 text-rose-500/60 hover:text-rose-500 text-[10px] uppercase tracking-widest font-mono rounded-lg border border-rose-500/10 hover:border-rose-500/20 transition-all flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                重設統計歷史數據
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  const scenario = filteredScenarios[scenarioIndex];
  
  if (!scenario) {
    return (
      <div className="h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
        <div className="text-emerald-500 mb-4 font-mono text-sm tracking-widest uppercase">Training Complete</div>
        <div className="text-6xl font-mono text-white mb-8">{totalScore}<span className="text-slate-600 text-3xl"> / {handsPlayed * 10}</span></div>
        <button 
          onClick={() => setSelectedDifficulty(null)}
          className="py-4 px-8 bg-white text-slate-950 font-bold uppercase tracking-widest rounded-xl flex items-center gap-2 transition-transform hover:scale-105"
        >
          返回首頁
        </button>
      </div>
    );
  }

  const step = scenario.steps[stepIndex];

  const handleAction = (action: ActionType) => {
    setSelectedAction(action);
    setSidebarTab('coach');
    const fb = step.feedbacks[action];
    if (fb) {
      setFeedback(fb);
      setTotalScore(prev => prev + fb.score);
      setHandsPlayed(prev => prev + 1);

      // Play correct / incorrect sound
      if (fb.score >= 8) {
        playPokerSound('correct', isMuted);
      } else {
        playPokerSound('incorrect', isMuted);
      }

      // Save to history list
      const newHistoryItem: HistoryItem = {
        scenarioId: scenario.id,
        category: getScenarioCategories(scenario),
        score: fb.score,
        judgment: fb.judgment,
        timestamp: Date.now()
      };
      const updatedHistory = [...history, newHistoryItem];
      setHistory(updatedHistory);
      try {
        localStorage.setItem('poker_training_history_v2', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error(e);
      }
    } else {
      playPokerSound('incorrect', isMuted);
      setFeedback({
        judgment: '錯誤',
        score: 0,
        bestAction: 'Fold',
        why: '此動作未定義。',
        conceptualError: '無',
        remember: '請選擇其他動作。',
        nextStepId: 'next_hand'
      });
    }
  };

  const handleNext = () => {
    const isLastScenario = scenarioIndex + 1 >= filteredScenarios.length;
    const isEndHand = feedback?.nextStepId === 'next_hand' || !feedback;

    if (isLastScenario && isEndHand) {
      playPokerSound('victory', isMuted);
      setScenarioIndex(prev => prev + 1);
      setStepIndex(0);
    } else {
      playPokerSound('click', isMuted);
      if (isEndHand) {
        setScenarioIndex(prev => prev + 1);
        setStepIndex(0);
      } else {
        const nextIdx = scenario.steps.findIndex(s => s.id === feedback.nextStepId);
        if (nextIdx !== -1) {
          setStepIndex(nextIdx);
        } else {
          setScenarioIndex(prev => prev + 1);
          setStepIndex(0);
        }
      }
    }
    setFeedback(null);
    setSelectedAction(null);
  };

  const renderAiContent = () => {
    return (
      <div className="space-y-4 h-full flex flex-col">
        {/* Switch Mode Toggle */}
        <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => {
              playPokerSound('click', isMuted);
              setAiMode('offline');
              localStorage.setItem('poker_ai_mode', 'offline');
              setAnalysisResult(null);
              setAnalysisError(null);
              setAiChatHistory([]);
            }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              aiMode === 'offline'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3 fill-current" />
            ⚡ 離線本機即時 (0s)
          </button>
          <button
            onClick={() => {
              playPokerSound('click', isMuted);
              setAiMode('online');
              localStorage.setItem('poker_ai_mode', 'online');
              setAnalysisResult(null);
              setAnalysisError(null);
              setAiChatHistory([]);
            }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              aiMode === 'online'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3 fill-current" />
            🌐 雲端 Gemini AI
          </button>
        </div>

        {/* Onboarding / Trigger State */}
        {!analysisResult && !isAnalyzing && !analysisError && (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-4 space-y-5 py-8">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 opacity-30 blur-sm animate-pulse"></div>
              <div className="relative w-16 h-16 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-slate-300">
                <Brain className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-200">
                {aiMode === 'offline' ? '本機離線對手心態分析' : 'Gemini AI 智能對手心態分析'}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-[250px] mx-auto">
                {aiMode === 'offline' 
                  ? '使用本機智慧撲克算力，即時對有效籌碼、下注尺寸、對手形象與牌面結構進行多維度心理剖析。'
                  : '藉由分析當前有效籌碼、下注大小、對手形象與牌面結構，模擬對手的心理意圖與手牌範圍。'}
              </p>
            </div>
            <button
              onClick={triggerAiAnalysis}
              className={`w-full py-3 active:scale-[0.98] transition-all text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 text-xs tracking-wider uppercase shadow-lg ${
                aiMode === 'offline'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              啟動 {aiMode === 'offline' ? '離線即時分析' : 'AI 智能分析'}
            </button>
          </div>
        )}

        {/* Analyzing/Loading State */}
        {isAnalyzing && !analysisResult && (
          <div className="flex-1 flex flex-col justify-center items-center py-12 text-center space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-emerald-400 animate-spin"></div>
              <Sparkles className="w-5 h-5 text-amber-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-300 font-bold">{loadingPhrase}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                {aiMode === 'offline' ? 'Powered by 本機離線撲克引擎' : 'Powered by Gemini 3.5 Flash'}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {analysisError && (
          <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-400">分析發生錯誤</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{analysisError}</p>
              </div>
            </div>
            <button
              onClick={triggerAiAnalysis}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              重新嘗試
            </button>
          </div>
        )}

        {/* Analysis Result (Markdown rendering) */}
        {analysisResult && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">
              <div className="prose prose-invert max-w-none text-xs leading-relaxed">
                <Markdown
                  components={{
                    h1: ({node, ...props}) => <h3 className="text-xs font-extrabold text-emerald-400 border-l-2 border-emerald-500 pl-2 mt-4 mb-2 uppercase tracking-wide" {...props} />,
                    h2: ({node, ...props}) => <h4 className="text-[11px] font-bold text-emerald-300 mt-3 mb-1 uppercase tracking-wider" {...props} />,
                    h3: ({node, ...props}) => <h5 className="text-[10px] font-bold text-slate-200 mt-2" {...props} />,
                    p: ({node, ...props}) => <p className="text-slate-300 mb-2 leading-relaxed" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 mb-2 text-slate-300" {...props} />,
                    li: ({node, ...props}) => <li className="text-slate-300" {...props} />,
                    strong: ({node, ...props}) => <strong className="text-emerald-400 font-extrabold" {...props} />,
                  }}
                >
                  {analysisResult}
                </Markdown>
              </div>

              {/* Q&A chat history */}
              {aiChatHistory.map((chatItem, idx) => (
                <div key={idx} className={`p-3 rounded-xl border space-y-1 ${
                  chatItem.role === 'user'
                    ? 'bg-slate-950/60 border-slate-800 text-slate-300 ml-6'
                    : 'bg-emerald-500/5 border-emerald-500/10 text-slate-200 mr-6'
                }`}>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    {chatItem.role === 'user' ? '你的追問' : 'AI 教練解答'}
                  </div>
                  {chatItem.role === 'user' ? (
                    <p className="text-xs text-slate-200 leading-relaxed">{chatItem.text}</p>
                  ) : (
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed">
                      <Markdown
                        components={{
                          h1: ({node, ...props}) => <h3 className="text-xs font-extrabold text-emerald-400 border-l-2 border-emerald-500 pl-2 mt-3 mb-2" {...props} />,
                          h2: ({node, ...props}) => <h4 className="text-[11px] font-bold text-emerald-300 mt-2 mb-1" {...props} />,
                          p: ({node, ...props}) => <p className="text-slate-300 mb-2 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 mb-2 text-slate-300" {...props} />,
                          li: ({node, ...props}) => <li className="text-slate-300" {...props} />,
                          strong: ({node, ...props}) => <strong className="text-emerald-400 font-bold" {...props} />,
                        }}
                      >
                        {chatItem.text}
                      </Markdown>
                    </div>
                  )}
                </div>
              ))}

              {/* Small thinking indicator inside chat stream */}
              {isAnalyzing && aiChatHistory.length > 0 && (
                <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/10 text-slate-200 mr-6 space-y-1.5 animate-pulse">
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">AI 教練解答</div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>正在深思熟慮中...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input box */}
            <div className="border-t border-slate-800 pt-3 mt-auto flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={e => setCustomQuestion(e.target.value)}
                placeholder="進一步提問：他是在詐唬嗎？"
                disabled={isAnalyzing}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customQuestion.trim()) {
                    triggerAiFollowUp();
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={triggerAiFollowUp}
                disabled={isAnalyzing || !customQuestion.trim()}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
              >
                送出
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGtoHudContent = () => {
    if (!scenario || !step) return null;
    const math = analyzeHandMath(scenario.holeCards, step.communityCards, step.potOdds);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
          <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            GTO 數學 HUD 輔助面版
          </h3>
          <span className="text-[9px] text-slate-500 font-mono">REALTIME ENGINE</span>
        </div>

        {/* 1. Draws & Outs Analyzer */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              聽牌補牌與擊中率
            </span>
            <span className="text-[9px] text-slate-500 font-mono">OUTS CALC</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">聽牌類型</span>
              <span className="text-xs font-bold text-slate-200">
                {math.drawDescription}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">關鍵補牌 (Outs)</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {math.hasDraw ? `${math.outs} 張` : '0 張'}
              </span>
            </div>

            {math.hasDraw && (
              <>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">下一街擊中率</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">{math.hitProbNext}%</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">到河牌擊中率</div>
                    <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{math.hitProbRiver}%</div>
                  </div>
                </div>

                {/* EV Recommendation */}
                <div className="p-3 rounded-lg text-xs leading-relaxed border mt-1 bg-slate-900/40 border-slate-800">
                  <div className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                    GTO 數學期望值對比
                  </div>
                  {(() => {
                    const currentOdds = math.potOdds || 25;
                    const activeEquity = step.street === 'Flop' ? math.hitProbRiver : math.hitProbNext;
                    
                    if (activeEquity >= currentOdds) {
                      return (
                        <p className="text-emerald-400/90 font-medium">
                          🟢 <strong className="font-extrabold text-emerald-400">正期望值 (EV &gt; 0)</strong>：您到河牌的擊中機率 ({activeEquity}%) 高於目前底池成敗比所需的直接勝率 ({currentOdds}%)。直接跟注或採取「半詐唬加注」具有絕佳數學支撐！
                        </p>
                      );
                    } else {
                      return (
                        <p className="text-amber-400/90 font-medium">
                          🟡 <strong className="font-extrabold text-amber-400">隱含賠率與主動棄牌率</strong>：您的直接擊中機率 ({activeEquity}%) 略低於直接跟注所需的直接勝率 ({currentOdds}%)。若要跟注，必須依賴後續街能贏得對手額外籌碼的「隱含賠率」，或進行「半詐唬加注」利用棄牌率獲勝。
                        </p>
                      );
                    }
                  })()}
                </div>
              </>
            )}

            {!math.hasDraw && (
              <p className="text-[11px] text-slate-500 leading-relaxed italic bg-slate-900/30 p-2.5 rounded border border-slate-900">
                當前牌面較為乾燥，沒有明顯的兩頭順或四張同花聽牌。建議您以「底牌成牌絕對強度 (Showdown Value)」或利用手中特定點數的「阻擋牌 (Blockers)」來擬定防守與進攻策略。
              </p>
            )}
          </div>
        </div>

        {/* 2. GTO Frequency Table */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              GTO 經典攻防數學
            </span>
            <span className="text-[9px] text-slate-500 font-mono">GTO MATRIX</span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-400">最小防禦頻率 (MDF)</span>
                <span className="text-[10px] font-mono text-slate-500">MDF = Pot / (Pot + Bet)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                當對手下注時，為了防止對手「隨便拿兩張牌純詐唬」就能自動獲利，您的整個手牌範圍必須跟注或加注的最少頻率：
              </p>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-center">
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">1/3 底池</div>
                  <div className="font-bold text-emerald-400 mt-0.5">75%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">1/2 底池</div>
                  <div className="font-bold text-emerald-400 mt-0.5">67%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">2/3 底池</div>
                  <div className="font-bold text-emerald-400 mt-0.5">60%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">100%底池</div>
                  <div className="font-bold text-emerald-400 mt-0.5">50%</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900 pt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-400">所需棄牌率 (Alpha / α)</span>
                <span className="text-[10px] font-mono text-slate-500">α = Bet / (Pot + Bet)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                當您下注「純詐唬」時，為了達到盈虧平衡點，對手所需棄牌的百分比下限：
              </p>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-center">
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">下注1/3</div>
                  <div className="font-bold text-amber-400 mt-0.5">25%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">下注1/2</div>
                  <div className="font-bold text-amber-400 mt-0.5">33%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">下注2/3</div>
                  <div className="font-bold text-amber-400 mt-0.5">40%</div>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                  <div className="text-slate-500">下注1.0</div>
                  <div className="font-bold text-amber-400 mt-0.5">50%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Deep Strategic Context (SPR & Position) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              環境戰略優勢
            </span>
            <span className="text-[9px] text-slate-500 font-mono">TACTICAL HUD</span>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            {/* Position Info */}
            <div className="flex gap-2.5 items-start p-2.5 rounded bg-slate-900/40 border border-slate-850">
              {(() => {
                const pos = scenario.position?.toUpperCase() || 'IP';
                const isOop = pos === 'SB' || pos === 'BB' || pos.includes('OOP');
                return (
                  <>
                    <span className="text-lg shrink-0 mt-0.5">{isOop ? '🔴' : '🟢'}</span>
                    <div>
                      <div className="font-bold text-slate-200">
                        位置：{pos} ({isOop ? '不利位置 OOP' : '有利位置 IP'})
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                        {isOop 
                          ? '您處於率先行動位置，面臨信息劣勢，防守範圍應更為緊湊，多過牌。'
                          : '您處於最後行動位置，擁有決策主動權與信息優勢，控池與施壓更加自如。'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* SPR Info */}
            {(() => {
              const sprVal = typeof step.spr === 'number' ? step.spr : parseFloat(step.spr || '10');
              let sprBadge = '';
              let sprDesc = '';
              if (sprVal >= 8) {
                sprBadge = '深籌碼戰略 (Deep SPR)';
                sprDesc = '深籌碼比下應積極累積底池，超強聽牌可以大膽全進。單對牌力面臨轉河高強度施壓應極度謹慎。';
              } else if (sprVal >= 3) {
                sprBadge = '過渡戰略 (Medium SPR)';
                sprDesc = '頂對與優質聽牌是打光籌碼的主力，應規劃好下注尺度以便在河牌全進。';
              } else {
                sprBadge = '套池承諾 (Low SPR)';
                sprDesc = '極低籌碼底池比，任何成牌或強聽牌遭遇進攻皆應打光籌碼全進，不可輕易棄牌。';
              }

              return (
                <div className="flex gap-2.5 items-start p-2.5 rounded bg-slate-900/40 border border-slate-850">
                  <span className="text-lg shrink-0 mt-0.5">⚡</span>
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1.5 flex-wrap">
                      <span>SPR 狀態：{step.spr || 'N/A'}</span>
                      <span className="text-[9px] px-1.5 py-0.25 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold font-sans">
                        {sprBadge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {sprDesc}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="lg:h-screen min-h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col lg:overflow-hidden">
      <header className="h-14 border-b border-slate-800 flex shrink-0 items-center justify-between px-4 sm:px-6 bg-slate-900">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => {
              playPokerSound('click', isMuted);
              setSelectedDifficulty(null);
            }}
            className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold shrink-0"
            title="返回主頁面"
          >
            ← 離開
          </button>
          <div className="h-4 w-px bg-slate-700 hidden xs:block"></div>
          <div className="text-[11px] sm:text-xs font-mono text-slate-400 uppercase tracking-wider shrink-0">
            #{scenarioIndex + 1} / {filteredScenarios.length}
          </div>
          <button 
            onClick={() => toggleStar(scenario.id)}
            className={`p-1.5 rounded-lg transition-all flex items-center justify-center border shrink-0 ${
              starredIds.includes(scenario.id) 
                ? 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 shadow-sm shadow-amber-500/5' 
                : 'text-slate-500 border-slate-800 bg-slate-950/40 hover:text-slate-300 hover:border-slate-700'
            }`}
            title={starredIds.includes(scenario.id) ? "取消收藏手牌" : "收藏手牌"}
          >
            <Star className={`w-3.5 h-3.5 ${starredIds.includes(scenario.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="flex gap-3 sm:gap-6 items-center">
          {/* Table Size Switcher */}
          <div className="flex items-center bg-slate-950/60 p-0.5 rounded-lg border border-slate-850 shrink-0">
            <button
              onClick={() => {
                playPokerSound('click', isMuted);
                setTableSize('9max');
                try { localStorage.setItem('poker_table_size', '9max'); } catch(e){}
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                tableSize === '9max'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="切換至 9 人桌 RFI 範圍與座位圖"
            >
              9人桌
            </button>
            <button
              onClick={() => {
                playPokerSound('click', isMuted);
                setTableSize('6max');
                try { localStorage.setItem('poker_table_size', '6max'); } catch(e){}
                if (['utg1', 'utg2', 'mp', 'hj'].includes(gtoPosition)) {
                  setGtoPosition('utg');
                }
                if (['utg1', 'utg2', 'mp', 'hj'].includes(quizPosition)) {
                  setQuizPosition('utg');
                }
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                tableSize === '6max'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="切換至 6 人桌 RFI 範圍與座位圖"
            >
              6人桌
            </button>
          </div>
          <button 
            onClick={toggleMute} 
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-900 hover:border-slate-700 text-slate-500 hover:text-white transition-all flex items-center justify-center shrink-0"
            title={isMuted ? "開啟音效" : "靜音模式"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">累計總分</div>
            <div className="text-xl font-mono text-emerald-400 leading-none">{totalScore}<span className="text-slate-600 text-sm"> / {handsPlayed * 10}</span></div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">當前難度</div>
            <div className="px-2 py-0.5 border border-amber-500/50 text-amber-500 text-[10px] rounded leading-none">{selectedDifficulty === 'All' ? '綜合' : selectedDifficulty}模式</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex lg:overflow-hidden flex-col lg:flex-row">
        <section className="flex-1 flex flex-col p-4 sm:p-6 gap-4 sm:gap-6 lg:overflow-y-auto">
          {/* 訓練單元答題足跡 */}
          <div className="flex items-center justify-between bg-slate-900/30 border border-slate-800/80 px-4 py-2.5 rounded-xl shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {filteredScenarios.map((scen, idx) => {
                const isCurrent = idx === scenarioIndex;
                const isPast = idx < scenarioIndex;
                
                let dotColor = "bg-slate-800 border-slate-700";
                let titleStr = `第 ${idx + 1} 手：未答`;

                if (isCurrent) {
                  dotColor = "bg-emerald-400 border-emerald-400 animate-pulse ring-2 ring-emerald-400/20";
                  titleStr = `第 ${idx + 1} 手：正在進行`;
                } else if (isPast) {
                  const pastRecord = [...history].reverse().find(h => h.scenarioId === scen.id);
                  if (pastRecord) {
                    if (pastRecord.score >= 8) {
                      dotColor = "bg-emerald-500 border-emerald-500";
                      titleStr = `第 ${idx + 1} 手：正確 (${pastRecord.score}分)`;
                    } else if (pastRecord.score >= 5) {
                      dotColor = "bg-amber-500 border-amber-500";
                      titleStr = `第 ${idx + 1} 手：可接受 (${pastRecord.score}分)`;
                    } else {
                      dotColor = "bg-rose-500 border-rose-500";
                      titleStr = `第 ${idx + 1} 手：錯誤 (${pastRecord.score}分)`;
                    }
                  } else {
                    dotColor = "bg-slate-700 border-slate-600";
                    titleStr = `第 ${idx + 1} 手：已答`;
                  }
                }

                return (
                  <div 
                    key={scen.id} 
                    className={`w-2.5 h-2.5 rounded-full border shrink-0 transition-all ${dotColor}`}
                    title={titleStr}
                  />
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold flex items-center gap-2.5 shrink-0 ml-4">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 優秀</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 折衷</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> 偏差</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 shrink-0">
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">類型</div>
              <div className="font-medium text-sm truncate">{scenario.type}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">盲注 / Ante</div>
              <div className="font-medium font-mono text-sm truncate">{scenario.blinds} {scenario.ante ? '(有)' : ''}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">位置</div>
              <div className="font-medium text-blue-400 italic text-sm truncate">{scenario.position}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">有效籌碼</div>
              <div className="font-medium font-mono text-sm truncate">{scenario.effectiveStack} <span className="text-xs text-slate-500">({scenario.userBB} BB)</span></div>
            </div>
            {scenario.villainProfile && (
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg col-span-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">對手風格</div>
                <div className="font-medium text-rose-400 text-sm truncate">{scenario.villainProfile}</div>
              </div>
            )}
            {scenario.heroImage && (
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg col-span-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1">你的形象</div>
                <div className="font-medium text-emerald-400 text-sm truncate">{scenario.heroImage}</div>
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-start gap-3 shrink-0">
            <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs text-slate-500 uppercase tracking-widest">{scenario.title}</div>
                  {scenario.category && (
                    <div className="flex gap-1 flex-wrap">
                      {scenario.category.map(cat => (
                        <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700 uppercase leading-none">{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Mobile-only Assist Triggers */}
                <div className="lg:hidden flex gap-1.5 items-center shrink-0">
                  <button
                    onClick={() => {
                      setSidebarTab('hud');
                      setShowMobileAiPanel(true);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg active:scale-95 transition-all"
                  >
                    <BarChart2 className="w-3 h-3 text-cyan-400" />
                    數學 HUD
                  </button>
                  <button
                    onClick={() => {
                      setSidebarTab('ai');
                      setShowMobileAiPanel(true);
                      triggerAiAnalysis();
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3 h-3 fill-current text-amber-400 animate-pulse" />
                    AI 讀心術
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
            </div>
          </div>

          <div className="flex-1 min-h-[460px] py-6 sm:py-8 bg-slate-950 border border-slate-900 rounded-3xl relative flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-2xl">
            {/* 3D Felt Bumper Ring */}
            <div className="absolute w-[92%] h-[82%] rounded-[110px] bg-gradient-to-b from-slate-800 to-slate-950 border-[10px] border-slate-900 shadow-[0_15px_35px_rgba(0,0,0,0.8)] flex items-center justify-center">
              <div className="absolute inset-1 rounded-[95px] bg-gradient-to-b from-emerald-800 to-emerald-950 border-[3px] border-emerald-900/50 shadow-[inset_0_12px_32px_rgba(0,0,0,0.65)] flex items-center justify-center">
                {/* Felt Inner Line */}
                <div className="absolute inset-[14%] rounded-[80px] border border-emerald-700/15 pointer-events-none"></div>
              </div>
            </div>

            {/* Center Board (Pot Size and Community Cards) */}
            <div className="absolute z-10 flex flex-col items-center gap-3">
              {/* Pot badge */}
              <div className="px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-full shadow-lg text-center flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">POT</span>
                <span className="text-sm font-mono font-bold text-amber-400">{step.potSize} BB</span>
              </div>

              {/* 5-slot Community Cards */}
              <div className="flex gap-1.5 sm:gap-2 scale-[0.85] sm:scale-100 bg-slate-950/30 p-1.5 rounded-xl border border-slate-800/10">
                {step.communityCards.length > 0 ? (
                  <>
                    {step.communityCards.map((c, i) => <CardUI key={i} card={c} size="lg" />)}
                    {Array.from({ length: 5 - step.communityCards.length }).map((_, i) => (
                      <div key={`hidden-${i}`} className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                    <div className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                    <div className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                    <div className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                    <div className="w-20 h-28 bg-slate-950/40 border border-emerald-800/20 border-dashed rounded-lg flex items-center justify-center text-emerald-800/40 text-lg font-bold">?</div>
                  </>
                )}
              </div>

              {/* Street & Math Badge */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] sm:text-xs font-black tracking-widest text-emerald-400 uppercase">
                  {step.street} - {step.street === 'Preflop' ? '翻牌前' : step.street === 'Flop' ? '翻牌圈' : step.street === 'Turn' ? '轉牌圈' : '河牌圈'}
                </span>
                {(step.spr || step.potOdds) && (
                  <div className="flex gap-2.5 text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                    {step.spr && <span>SPR: {step.spr}</span>}
                    {step.potOdds && <span>POT ODDS: {step.potOdds}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Seats around the Felt (Supports 6-Max / 9-Max) */}
            {(tableSize === '9max' ? NINE_MAX_SEATS : SIX_MAX_SEATS).map(seat => {
              const isH = isPositionMatch(seat.key, scenario.position, tableSize);
              const isFoldedState = isFolded(seat.key, scenario.preAction, step.description, scenario.position, step.street, tableSize);
              const actionInfo = parseSeatAction(seat.key, scenario.preAction, step.description, scenario.position, tableSize);
              
              // Is this seat the active opponent?
              const text = (scenario.preAction + " " + step.description).toLowerCase();
              const isOpponent = !isH && !isFoldedState && (
                text.includes(seat.key) || 
                (seat.key === 'hj' && text.includes('mp')) ||
                (seat.key === 'bb' && (text.includes('bb') || text.includes('大盲'))) ||
                (seat.key === 'sb' && (text.includes('sb') || text.includes('小盲'))) ||
                (seat.key === 'btn' && (text.includes('btn') || text.includes('莊家') || text.includes('button')))
              );

              // Border style and coloring
              let borderStyle = "border-slate-800 hover:border-slate-700";
              let bgStyle = "bg-slate-950/85";
              let opacityStyle = "opacity-100";
              let glowStyle = "";

              if (isH) {
                borderStyle = "border-emerald-500/80 ring-2 ring-emerald-500/20";
                bgStyle = "bg-emerald-950/90";
                glowStyle = "shadow-lg shadow-emerald-500/10";
              } else if (isOpponent) {
                borderStyle = "border-rose-500/80 ring-2 ring-rose-500/20 animate-pulse";
                bgStyle = "bg-rose-950/90";
                glowStyle = "shadow-lg shadow-rose-500/10";
              } else if (isFoldedState) {
                opacityStyle = "opacity-35";
                borderStyle = "border-slate-900";
                bgStyle = "bg-slate-950/40";
              }

              // Seat label name
              const seatName = isH ? "Hero (你)" : isOpponent ? "Villain (對手)" : `Seat (${seat.label.split(' ')[0]})`;

              // Color representing seat positions
              const posBgColor = seat.key === 'btn' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                (seat.key === 'sb' || seat.key === 'bb') ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                'bg-slate-800 text-slate-300 border border-slate-700';

              return (
                <React.Fragment key={seat.key}>
                  {/* Seat box */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: seat.top,
                      left: seat.left,
                    }}
                    className={`z-20 p-2 sm:p-2.5 rounded-2xl border ${borderStyle} ${bgStyle} ${glowStyle} ${opacityStyle} transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-[90px] sm:w-[110px] min-h-[65px] sm:min-h-[75px] shadow-xl`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-100 truncate max-w-[50px] sm:max-w-none">{seatName}</span>
                      <span className={`text-[7px] sm:text-[8px] font-extrabold px-1 sm:px-1.5 py-0.25 rounded-md font-mono ${posBgColor}`}>
                        {seat.key.toUpperCase()}
                      </span>
                    </div>

                    {/* Action text overlay */}
                    {actionInfo.actionText && !isFoldedState && (
                      <span className="text-[7.5px] sm:text-[8.5px] font-bold px-1.5 py-0.25 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-sm uppercase tracking-wide animate-pulse">
                        {actionInfo.actionText}
                      </span>
                    )}

                    {/* Seat Cards or Folded state */}
                    {!isFoldedState ? (
                      <div className="flex gap-0.5">
                        {isH ? (
                          scenario.holeCards.map((c, i) => <MiniCard key={i} card={c} />)
                        ) : (
                          <>
                            <MiniCard hidden />
                            <MiniCard hidden />
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-[7.5px] sm:text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">FOLDED</span>
                    )}
                  </div>

                  {/* Seat Bet / Chip Stacks near the table felt */}
                  {actionInfo.betText && !isFoldedState && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: seat.betTop,
                        left: seat.betLeft,
                      }}
                      className="z-20 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-slate-950/90 border border-slate-800 rounded-full shadow-lg text-[8px] sm:text-[9px] font-mono font-bold text-amber-400 transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
                    >
                      <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center text-[5px] text-slate-950 font-black">●</span>
                      <span>{actionInfo.betText}</span>
                    </div>
                  )}

                  {/* Dealer Button near BTN */}
                  {seat.key === 'btn' && seat.dealerTop && seat.dealerLeft && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: seat.dealerTop,
                        left: seat.dealerLeft,
                      }}
                      className="z-20 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-400 border border-amber-500 text-slate-950 font-black text-[8px] sm:text-[9px] flex items-center justify-center shadow-md transform -translate-x-1/2 -translate-y-1/2 select-none"
                      title="Dealer Button (D)"
                    >
                      D
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="shrink-0 flex flex-col gap-3">
            {feedback && (
              <>
                <button 
                  onClick={handleNext}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-slate-950 rounded-xl font-extrabold flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/10"
                >
                  <span>{feedback.nextStepId === 'next_hand' ? '下一手牌' : '下一街'}</span>
                  <span className="hidden md:inline-block text-[9px] px-1.5 py-0.5 bg-slate-950/20 text-slate-800 rounded border border-slate-950/10 font-mono font-bold ml-1">
                    [Space 鍵]
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* 手機端專屬：在下一街按鈕下方展示美觀精緻的反饋資訊 */}
                <div className="lg:hidden p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-500 uppercase tracking-widest">教練快速評語</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-extrabold px-2.5 py-1 rounded bg-slate-950 border border-slate-800 ${
                        feedback.judgment === '正確' ? 'text-emerald-400' : 
                        feedback.judgment === '錯誤' ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        {feedback.judgment}動作
                      </span>
                      <span className={`text-sm font-mono font-bold ${
                        feedback.score >= 8 ? 'text-emerald-400' : feedback.score >= 5 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {feedback.score}/10 分
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-widest">為什麼</div>
                      <p className="text-sm leading-relaxed text-slate-300 font-medium">
                        {feedback.why}
                      </p>
                    </div>

                    {feedback.conceptualError !== '無' && (
                      <div>
                        <div className="text-[10px] text-rose-500/80 uppercase mb-1 tracking-widest">觀念誤區</div>
                        <p className="text-sm leading-relaxed text-rose-200/80">
                          {feedback.conceptualError}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                      <div className="text-[10px] text-emerald-400 font-bold mb-0.5 uppercase tracking-widest">下次記住</div>
                      <p className="text-xs italic text-emerald-200/80 leading-relaxed">
                        「{feedback.remember}」
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Options grid (rendered in both states, but styled with color-coding when feedback is shown) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {step.options.map((opt, idx) => {
                const isSelected = selectedAction === opt;
                let btnStyle = "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:text-white";
                
                if (feedback) {
                  if (isSelected) {
                    if (feedback.judgment === '正確') {
                      btnStyle = "bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-lg shadow-emerald-500/10";
                    } else if (feedback.judgment === '錯誤') {
                      btnStyle = "bg-rose-500/20 text-rose-400 border-rose-500 shadow-lg shadow-rose-500/10";
                    } else {
                      btnStyle = "bg-amber-500/20 text-amber-400 border-amber-500 shadow-lg shadow-amber-500/10";
                    }
                  } else {
                    btnStyle = "bg-slate-900/40 text-slate-600 border-slate-800/60 opacity-45 cursor-not-allowed";
                  }
                }

                const bbSize = getOptionBBLabel(opt, step.potSize, scenario, step.description, scenario.preAction);

                return (
                  <button
                    key={opt}
                    disabled={feedback !== null}
                    onClick={() => handleAction(opt)}
                    className={`py-2.5 sm:py-3.5 px-3 rounded-xl border font-bold uppercase transition-all duration-200 relative group flex flex-col items-center justify-center gap-0.5 min-h-[58px] sm:min-h-[66px] ${btnStyle}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {!feedback && (
                        <span className="hidden md:inline-block text-[9px] px-1.5 py-0.5 bg-slate-950/60 text-slate-500 rounded border border-slate-800/80 mr-1 group-hover:text-white group-hover:border-slate-600 font-mono font-bold transition-colors">
                          {idx + 1}
                        </span>
                      )}
                      <span className="tracking-widest text-xs sm:text-[13px]">{opt}</span>
                    </div>
                    {bbSize && (
                      <span className="text-[11px] sm:text-xs font-mono font-black text-amber-400 group-hover:text-amber-300 transition-colors">
                        {bbSize}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="hidden lg:flex lg:w-96 border-l border-slate-800 bg-slate-900 flex-col shrink-0 overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 shrink-0">
            <button 
              onClick={() => {
                playPokerSound('click', isMuted);
                setSidebarTab('coach');
              }}
              className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 ${
                sidebarTab === 'coach' 
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700/50 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>教練即時反饋</span>
            </button>
            <button 
              onClick={() => {
                playPokerSound('click', isMuted);
                setSidebarTab('hud');
              }}
              className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 ${
                sidebarTab === 'hud' 
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>GTO 數學 HUD</span>
            </button>
            <button 
              onClick={() => {
                playPokerSound('click', isMuted);
                setSidebarTab('ai');
              }}
              className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 ${
                sidebarTab === 'ai' 
                  ? 'bg-slate-800 text-amber-400 border border-slate-700/50 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>AI 讀心術</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-5">
            {sidebarTab === 'coach' ? (
              feedback ? (
                <div className="space-y-6">
                  <h2 className="text-xs font-bold text-emerald-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    教練即時反饋
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-2 tracking-widest">判斷</div>
                      <div className={`text-2xl font-bold ${
                        feedback.judgment === '正確' ? 'text-emerald-500' : 
                        feedback.judgment === '錯誤' ? 'text-rose-500' : 'text-amber-500'
                      }`}>
                        {feedback.judgment}動作
                      </div>
                    </div>
                    
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
                      <div className="text-[10px] text-slate-600 mb-1 uppercase tracking-widest">評分</div>
                      <div className={`text-3xl ${feedback.score >= 8 ? 'text-emerald-400' : feedback.score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {feedback.score}<span className="text-slate-700 text-lg">/10</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-2 tracking-widest">為什麼</div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        {feedback.why}
                      </p>
                    </div>

                    {feedback.conceptualError !== '無' && (
                      <div>
                        <div className="text-xs text-rose-500/80 uppercase mb-2 tracking-widest">觀念誤區</div>
                        <p className="text-xs leading-relaxed text-rose-200/80">
                          {feedback.conceptualError}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div className="text-[10px] text-emerald-500 font-bold mb-1 uppercase tracking-widest">下次記住</div>
                      <p className="text-xs italic text-emerald-200/80 leading-relaxed">
                        「{feedback.remember}」
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col justify-center items-center text-slate-500 text-xs italic text-center py-24">
                  <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                    <span className="text-xl opacity-50">?</span>
                  </div>
                  等待你的決策...
                </div>
              )
            ) : sidebarTab === 'hud' ? (
              renderGtoHudContent()
            ) : (
              renderAiContent()
            )}
          </div>

          {feedback && (
            <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950/40">
              <button 
                onClick={handleNext}
                className="w-full py-3.5 bg-white text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 uppercase tracking-widest transition-transform hover:scale-[1.01] active:scale-[0.99] text-xs"
              >
                <span>{feedback.nextStepId === 'next_hand' ? '下一手牌' : '下一街'}</span>
                <span className="hidden md:inline-block text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded border border-slate-300 font-mono font-bold ml-1">
                  [Space 鍵]
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Mobile AI Panel Drawer */}
      {showMobileAiPanel && (
        <div className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col justify-end">
          {/* Backdrop Click Dismiss */}
          <div className="absolute inset-0 -z-10" onClick={() => setShowMobileAiPanel(false)}></div>
          
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/40">
              <div className="flex items-center gap-2 font-extrabold text-xs tracking-wider uppercase">
                {sidebarTab === 'ai' ? (
                  <>
                    <Brain className="w-4 h-4 text-amber-400" />
                    <span>Gemini AI 對手讀心術</span>
                  </>
                ) : sidebarTab === 'hud' ? (
                  <>
                    <BarChart2 className="w-4 h-4 text-cyan-400" />
                    <span>GTO 數學 HUD</span>
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>教練即時反饋</span>
                  </>
                )}
              </div>
              <button 
                onClick={() => setShowMobileAiPanel(false)}
                className="text-[11px] text-slate-400 hover:text-white bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-800 font-bold"
              >
                關閉
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {sidebarTab === 'ai' ? (
                renderAiContent()
              ) : sidebarTab === 'hud' ? (
                renderGtoHudContent()
              ) : (
                feedback ? (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-2 tracking-widest">判斷</div>
                        <div className={`text-2xl font-bold ${
                          feedback.judgment === '正確' ? 'text-emerald-500' : 
                          feedback.judgment === '錯誤' ? 'text-rose-500' : 'text-amber-500'
                        }`}>
                          {feedback.judgment}動作
                        </div>
                      </div>
                      
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
                        <div className="text-[10px] text-slate-600 mb-1 uppercase tracking-widest">評分</div>
                        <div className={`text-3xl ${feedback.score >= 8 ? 'text-emerald-400' : feedback.score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {feedback.score}<span className="text-slate-700 text-lg">/10</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-2 tracking-widest">為什麼</div>
                        <p className="text-xs leading-relaxed text-slate-300">
                          {feedback.why}
                        </p>
                      </div>

                      {feedback.conceptualError !== '無' && (
                        <div>
                          <div className="text-xs text-rose-500/80 uppercase mb-2 tracking-widest">觀念誤區</div>
                          <p className="text-xs leading-relaxed text-rose-200/80">
                            {feedback.conceptualError}
                          </p>
                        </div>
                      )}

                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <div className="text-[10px] text-emerald-500 font-bold mb-1 uppercase tracking-widest">下次記住</div>
                        <p className="text-xs italic text-emerald-200/80 leading-relaxed">
                          「{feedback.remember}」
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-slate-500 text-xs italic text-center py-24">
                    <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                      <span className="text-xl opacity-50">?</span>
                    </div>
                    等待你的決策...
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="h-8 shrink-0 bg-slate-950 border-t border-slate-900 flex items-center px-4 sm:px-6 justify-between text-[10px] text-slate-600 font-mono overflow-hidden">
        <div className="truncate">STATUS: TRAINING_MODE_ACTIVE</div>
        <div className="flex gap-2 sm:gap-4 shrink-0">
          <span className="hidden sm:inline">DIFFICULTY: {selectedDifficulty?.toUpperCase()}</span>
          <span>HAND: {scenarioIndex + 1}/{filteredScenarios.length}</span>
          <span>SYS: ONLINE</span>
        </div>
      </footer>
    </div>
  );
}

