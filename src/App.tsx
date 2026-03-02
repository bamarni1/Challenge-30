import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Timer, Users, User, ArrowRight, RotateCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from './soundUtils';

type GameState = 'lobby' | 'waiting' | 'starting' | 'playing' | 'round_end' | 'finished' | 'disconnected';

interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  lastAnswer?: number;
}

interface Question {
  question: string;
  options: string[];
  answer: number;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [name, setName] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(11);
  const [timer, setTimer] = useState(30);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const connect = (mode: 'multiplayer' | 'practice' = 'multiplayer') => {
    if (!name.trim()) return;
    sounds.playSelect();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = ws;
    setSocket(ws);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name, mode }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'init':
          setMyId(data.id);
          break;
        case 'waiting':
          setGameState('waiting');
          break;
        case 'match_found':
          sounds.playTransition();
          setPlayers(data.players.map((p: any) => ({ ...p, score: 0 })));
          setGameState('starting');
          break;
        case 'question':
          sounds.playTransition();
          setCurrentQuestion(data.question);
          setQuestionIndex(data.index);
          setTotalQuestions(data.total);
          setTimer(data.timer);
          setSelectedAnswer(null);
          setCorrectAnswer(null);
          setAnsweredPlayers(new Set());
          setGameState('playing');
          break;
        case 'timer':
          if (data.value <= 10 && data.value > 3) {
            sounds.playTick();
          } else if (data.value <= 3 && data.value > 0) {
            sounds.playHurry();
          }
          setTimer(data.value);
          break;
        case 'player_answered':
          setAnsweredPlayers(prev => new Set(prev).add(data.playerId));
          break;
        case 'round_end':
          sounds.playTransition();
          setCorrectAnswer(data.correctAnswer);
          
          if (selectedAnswer === data.correctAnswer) {
            sounds.playCorrect();
          } else if (selectedAnswer !== null) {
            sounds.playIncorrect();
          }
          
          setPlayers(prev => prev.map(p => {
            const serverPlayer = data.scores.find((sp: any) => sp.id === p.id);
            return serverPlayer ? { ...p, score: serverPlayer.score, lastAnswer: serverPlayer.lastAnswer } : p;
          }));
          setGameState('round_end');
          break;
        case 'game_over':
          sounds.playTransition();
          setPlayers(data.scores);
          setGameState('finished');
          if (data.leaderboard) setLeaderboard(data.leaderboard);
          if (data.scores[0].score > (data.scores[1]?.score || 0)) {
             confetti({
               particleCount: 150,
               spread: 70,
               origin: { y: 0.6 }
             });
          }
          break;
        case 'leaderboard':
          setLeaderboard(data.leaderboard);
          break;
        case 'opponent_disconnected':
          sounds.playIncorrect(); // Use incorrect sound for disconnection
          setGameState('disconnected');
          break;
      }
    };

    ws.onclose = () => {
      if (gameState !== 'finished' && gameState !== 'lobby') {
        setGameState('disconnected');
      }
    };
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || gameState !== 'playing') return;
    sounds.playSelect();
    setSelectedAnswer(index);
    socket?.send(JSON.stringify({ type: 'answer', answer: index }));
  };

  const reset = () => {
    sounds.playSelect();
    if (socketRef.current) socketRef.current.close();
    setGameState('lobby');
    setPlayers([]);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setCorrectAnswer(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30 overflow-y-auto flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            x: [0, -40, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" 
        />
      </div>

      <AnimatePresence mode="wait">
        {gameState === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#151619] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10"
          >
            <div className="flex flex-col items-center text-center mb-6 md:mb-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30">
                <Trophy className="w-8 h-8 md:w-10 md:h-10 text-emerald-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">تەحەدیا ٣٠ چرکان</h1>
              <p className="text-white/50 text-xs md:text-sm">پێزانینێن خۆ یێن تەپا پێ تاقی بکە دگەل هەڤالێن خۆ</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40 ml-1">ناڤێ تە</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ناڤێ خۆ بنڤیسە..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-emerald-500/50 transition-colors text-right"
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <motion.button
                  onClick={() => connect('multiplayer')}
                  disabled={!name.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                  تەحەدیا هەڤالان
                  <Users className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => connect('practice')}
                  disabled={!name.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                  یاریا ب تنێ (تاقیکردن)
                  <User className="w-5 h-5" />
                </motion.button>
              </div>

              {leaderboard.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    باشترین یاریزانێن حەفتیێ
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-white/20'}`}>
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium text-white/80">{entry.name}</span>
                        </div>
                        <span className="text-sm font-mono font-bold text-emerald-500">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'waiting' && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 z-10"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto" />
              <div className="absolute inset-0 blur-xl bg-emerald-500/20 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">ل هیڤیا یاریزانەکێ دی...</h2>
              <p className="text-white/40">دێ یاری دەستپێکەت هەر کو یاریزانەک هاتە دناڤ یاریێ دا</p>
            </div>
          </motion.div>
        )}

        {gameState === 'starting' && (
          <motion.div
            key="starting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-8 z-10"
          >
            <div className="flex items-center justify-center gap-8">
              {players.map((p, i) => (
                <div key={p.id} className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center relative">
                    <User className="w-12 h-12 text-white/40" />
                    <div className="absolute -bottom-2 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      یاریزان {i + 1}
                    </div>
                  </div>
                  <span className="font-bold text-xl">{p.name}</span>
                </div>
              ))}
            </div>
            <div className="text-5xl font-black italic text-emerald-500 animate-bounce">
              دێ دەستپێکەین!
            </div>
          </motion.div>
        )}

        {(gameState === 'playing' || gameState === 'round_end') && currentQuestion && (
          <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-4 gap-6 z-10">
            {/* Left Sidebar: Players */}
            <div className="lg:col-span-1 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 md:p-4 rounded-2xl border transition-all flex-shrink-0 w-40 lg:w-full ${
                    answeredPlayers.has(p.id) ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {p.id === myId ? 'تۆ' : 'یاریزان'}
                    </span>
                    {answeredPlayers.has(p.id) && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-emerald-500" />
                      </motion.div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm md:text-lg font-bold truncate">{p.name}</div>
                    <motion.div 
                      key={p.score}
                      initial={{ scale: 1.2, color: '#10b981' }}
                      animate={{ scale: 1, color: '#34d399' }}
                      className="text-base md:text-xl font-mono font-bold"
                    >
                      {p.score}
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>

            {/* Middle: Question Area */}
            <div className="lg:col-span-3 space-y-4 md:space-y-6">
              <div className="bg-[#151619] border border-white/10 rounded-3xl p-5 md:p-8 relative overflow-hidden">
                {/* Timer Bar */}
                <div className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-1000" style={{ width: `${(timer / 30) * 100}%` }} />
                
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <div className="flex items-center gap-2 text-white/40 font-mono text-xs md:text-sm">
                    <span className="text-emerald-500 font-bold">{questionIndex + 1}</span>
                    <span>/</span>
                    <span>{totalQuestions}</span>
                  </div>
                  {gameState === 'round_end' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="text-emerald-400 font-bold text-[10px] md:text-sm"
                    >
                      بەرسڤا ڕاست هاتە دیارکرن...
                    </motion.div>
                  )}
                  <motion.div 
                    animate={timer < 10 ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5, repeat: timer < 10 ? Infinity : 0 }}
                    className={`flex items-center gap-2 font-mono text-lg md:text-xl ${timer < 10 ? 'text-red-500' : 'text-white'}`}
                  >
                    <Timer className="w-4 h-4 md:w-5 md:h-5" />
                    {timer} چرکە
                  </motion.div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={questionIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.4, ease: "circOut" }}
                  >
                    <h2 className="text-xl md:text-3xl font-bold leading-tight mb-8 md:mb-12 text-right" dir="rtl">
                      {currentQuestion.question}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {currentQuestion.options.map((option, idx) => {
                        let statusClass = "bg-white/5 border-white/10 hover:bg-white/10";
                        if (gameState === 'round_end') {
                          if (idx === correctAnswer) statusClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                          else if (idx === selectedAnswer && idx !== correctAnswer) statusClass = "bg-red-500/20 border-red-500 text-red-400";
                          else statusClass = "bg-white/5 border-white/10 opacity-40";
                        } else if (selectedAnswer === idx) {
                          statusClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-400";
                        }

                        return (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={gameState === 'playing' && selectedAnswer === null ? { scale: 1.02 } : {}}
                            whileTap={gameState === 'playing' && selectedAnswer === null ? { scale: 0.98 } : {}}
                            onClick={() => handleAnswer(idx)}
                            disabled={selectedAnswer !== null || gameState === 'round_end'}
                            className={`p-4 md:p-6 rounded-2xl border text-right font-bold transition-all flex items-center justify-between group ${statusClass}`}
                            dir="rtl"
                          >
                            <span className="text-sm md:text-lg">{option}</span>
                            <div className="flex items-center gap-2 md:gap-3">
                              {gameState === 'round_end' && idx === correctAnswer && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                                </motion.div>
                              )}
                              {gameState === 'round_end' && idx === selectedAnswer && idx !== correctAnswer && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                                </motion.div>
                              )}
                              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] md:text-xs font-mono group-hover:border-emerald-500/50 transition-colors">
                                {String.fromCharCode(65 + idx)}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-[#151619] border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl z-10 text-center"
          >
            <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-2xl md:text-4xl font-black mb-6 md:mb-8 italic uppercase tracking-tighter">ئەنجامێن دوماهیێ</h2>
            
            <div className="space-y-3 md:space-y-4 mb-8 md:mb-12">
              {players.sort((a, b) => b.score - a.score).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-4 md:p-6 rounded-2xl border ${
                    i === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <span className="text-xl md:text-2xl font-black text-white/20 italic">#{i + 1}</span>
                    <span className="text-lg md:text-xl font-bold">{p.name}</span>
                  </div>
                  <span className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">{p.score}</span>
                </div>
              ))}
            </div>

            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 md:px-12 py-3 md:py-4 bg-white text-black font-black rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-2 mx-auto text-sm md:text-base"
            >
              <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
              دووبارە دەستپێبکە
            </motion.button>
          </motion.div>
        )}

        {gameState === 'disconnected' && (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-6 z-10"
          >
            <XCircle className="w-20 h-20 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">پەیوەندی پچڕا!</h2>
              <p className="text-white/40">ببورە، یاریزانێ دی یان پەیوەندیا تە پچڕا.</p>
            </div>
            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              ڤەگەڕە سەرەتا
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
