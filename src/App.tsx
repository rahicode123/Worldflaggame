/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Trophy, Timer, ArrowLeft, Languages, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { countries, Country } from './data/countries';
import { translations } from './translations';

type Language = 'en' | 'bn';
type Screen = 'home' | 'quiz' | 'result';

interface QuizState {
  continent: string;
  questions: Country[];
  currentIndex: number;
  score: number;
  answers: { country: Country; isCorrect: boolean }[];
}

// Simple sound generator using Web Audio API for offline support
const playSound = (type: 'correct' | 'wrong' | 'success') => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'correct') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } else if (type === 'wrong') {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, now);
    oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === 'success') {
    // Arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }
};

const continentImages: Record<string, string> = {
  Africa: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=600&q=80',
  Asia: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80',
  Europe: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=600&q=80',
  'North America': 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=600&q=80',
  'South America': 'https://images.unsplash.com/photo-1518182170546-07661fd94144?auto=format&fit=crop&w=600&q=80',
  Oceania: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?auto=format&fit=crop&w=600&q=80',
};

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [screen, setScreen] = useState<Screen>('home');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [progress, setProgress] = useState<Record<string, string[]>>({}); // continent -> list of correct country codes

  const t = translations[lang];

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('flag_game_progress');
    if (saved) {
      try {
        setProgress(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load progress', e);
      }
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = (continent: string, countryCodes: string[]) => {
    const newProgress = {
      ...progress,
      [continent]: Array.from(new Set([...(progress[continent] || []), ...countryCodes]))
    };
    setProgress(newProgress);
    localStorage.setItem('flag_game_progress', JSON.stringify(newProgress));
  };

  const startQuiz = (continent: string) => {
    const continentCountries = countries.filter(c => c.continent === continent);
    const correctInContinent = progress[continent] || [];
    
    // Prioritize countries not yet guessed correctly
    const unvisited = continentCountries.filter(c => !correctInContinent.includes(c.code));
    const pool = unvisited.length >= 10 ? unvisited : continentCountries;
    
    // Shuffle and pick 10
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    
    setQuiz({
      continent,
      questions: shuffled,
      currentIndex: 0,
      score: 0,
      answers: []
    });
    setScreen('quiz');
    setTimeLeft(60);
    setIsAnswered(false);
    setSelectedOption(null);
  };

  const nextQuestion = useCallback(() => {
    setQuiz(currentQuiz => {
      if (!currentQuiz) return null;

      if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
        setTimeLeft(60);
        setIsAnswered(false);
        setSelectedOption(null);
        return {
          ...currentQuiz,
          currentIndex: currentQuiz.currentIndex + 1
        };
      } else {
        // Quiz finished
        const correctOnes = currentQuiz.answers.filter(a => a.isCorrect).map(a => a.country.code);
        saveProgress(currentQuiz.continent, correctOnes);
        setScreen('result');
        if (currentQuiz.score === currentQuiz.questions.length) {
          playSound('success');
        }
        return currentQuiz;
      }
    });
  }, [progress]);

  // Timer effect
  useEffect(() => {
    if (screen !== 'quiz' || isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswer(null); // Time's up
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [screen, isAnswered]);

  const handleAnswer = (countryCode: string | null) => {
    if (isAnswered || !quiz) return;

    const currentCountry = quiz.questions[quiz.currentIndex];
    const isCorrect = countryCode === currentCountry.code;

    setIsAnswered(true);
    setSelectedOption(countryCode);

    setQuiz(prev => {
      if (!prev) return null;
      const newAnswers = [...prev.answers, { country: currentCountry, isCorrect }];
      const newScore = newAnswers.filter(a => a.isCorrect).length;
      
      return {
        ...prev,
        score: newScore,
        answers: newAnswers
      };
    });

    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('wrong');
    }

    // Wait a bit before next question
    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const options = useMemo(() => {
    if (!quiz) return [];
    const current = quiz.questions[quiz.currentIndex];
    const continentCountries = countries.filter(c => c.continent === quiz.continent && c.code !== current.code);
    const wrongOptions = [...continentCountries]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    return [current, ...wrongOptions].sort(() => Math.random() - 0.5);
  }, [quiz?.currentIndex, quiz?.continent]);

  const continentStats = useMemo(() => {
    const stats: Record<string, { total: number; correct: number }> = {};
    const continents = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
    
    continents.forEach(cont => {
      stats[cont] = {
        total: countries.filter(c => c.continent === cont).length,
        correct: (progress[cont] || []).length
      };
    });
    return stats;
  }, [progress]);

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-blue-950 to-black text-white font-sans selection:bg-blue-400">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Globe className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        </div>
        <button 
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-all border border-white/10"
        >
          <Languages className="w-4 h-4" />
          <span className="text-sm font-medium">{lang === 'en' ? 'বাংলা' : 'English'}</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">{t.selectContinent}</h2>
                <p className="text-blue-300/60">Test your knowledge of world flags</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.entries(continentStats) as [string, { total: number; correct: number }][]).map(([name, stats]) => (
                  <motion.button
                    key={name}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => startQuiz(name)}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden text-left hover:bg-white/10 transition-all group relative"
                  >
                    <div className="h-40 w-full relative overflow-hidden">
                      <img 
                        src={continentImages[name]} 
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${name}/600/400`;
                        }}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
                      <h3 className="absolute bottom-4 left-6 text-xl font-bold">{(t.continents as any)[name]}</h3>
                    </div>
                    
                    <div className="p-6 space-y-3">
                      <div className="space-y-2 relative z-10">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-300/70">{t.countries}</span>
                          <span className="font-mono">{stats.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-300/70">{t.correct}</span>
                          <span className="font-mono text-emerald-400">{stats.correct}</span>
                        </div>
                        <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(stats.correct / stats.total) * 100}%` }}
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 'quiz' && quiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                <button 
                  onClick={() => setScreen('home')}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-blue-500/30 px-3 py-1 rounded-lg">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="font-mono font-bold">{quiz.score}</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${timeLeft < 10 ? 'bg-red-500/50 animate-pulse' : 'bg-white/10'}`}>
                    <Timer className="w-4 h-4" />
                    <span className="font-mono font-bold">{timeLeft}{t.seconds}</span>
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {t.question} {quiz.currentIndex + 1}/10
                </div>
              </div>

              <div className="text-center space-y-8 py-8">
                <motion.h2 
                  key={quiz.currentIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-bold tracking-wide"
                >
                  {quiz.questions[quiz.currentIndex].name.bn} - {quiz.questions[quiz.currentIndex].name.en}
                </motion.h2>

                <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-2xl mx-auto">
                  {options.map((option, idx) => {
                    const isCorrect = option.code === quiz.questions[quiz.currentIndex].code;
                    const isSelected = selectedOption === option.code;
                    
                    let bgColor = "bg-white/10 hover:bg-white/20";
                    if (isAnswered) {
                      if (isCorrect) bgColor = "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]";
                      else if (isSelected) bgColor = "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]";
                      else bgColor = "bg-white/5 opacity-50";
                    }

                    return (
                      <motion.button
                        key={`${quiz.currentIndex}-${idx}`}
                        whileHover={!isAnswered ? { scale: 1.05 } : {}}
                        whileTap={!isAnswered ? { scale: 0.95 } : {}}
                        onClick={() => handleAnswer(option.code)}
                        disabled={isAnswered}
                        className={`${bgColor} aspect-video rounded-xl p-2 transition-all border border-white/10 flex items-center justify-center overflow-hidden relative group`}
                      >
                        <img 
                          src={`https://flagcdn.com/w320/${option.code}.png`}
                          alt="Flag"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {isAnswered && isCorrect && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-white drop-shadow-lg" />
                          </div>
                        )}
                        {isAnswered && isSelected && !isCorrect && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <XCircle className="w-12 h-12 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'result' && quiz && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-12"
            >
              <div className="relative inline-block">
                {quiz.score === 10 && (
                  <>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -inset-12 pointer-events-none"
                    >
                      <Sparkles className="w-full h-full text-yellow-400" />
                    </motion.div>
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: 45 }}
                      animate={{ scale: [1, 1.3, 1], opacity: [0, 0.8, 0], rotate: 45 }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                      className="absolute -inset-16 pointer-events-none"
                    >
                      <Sparkles className="w-full h-full text-blue-300" />
                    </motion.div>
                  </>
                )}
                <div className="text-8xl mb-4 relative z-10">
                  {quiz.score === 10 ? '🥳' : quiz.score >= 7 ? '😊' : '😔'}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-blue-300/60 uppercase tracking-widest text-sm font-bold">{t.score}</p>
                <h2 className="text-7xl font-black tracking-tighter">
                  {quiz.score}/10
                </h2>
                {quiz.score === 10 && (
                  <motion.p 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-2xl text-yellow-400 font-bold uppercase tracking-widest"
                  >
                    {t.perfect}
                  </motion.p>
                )}
                <p className="text-xl text-blue-200 italic">
                  {quiz.score === 10 ? t.excellent : t.motivational}
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                {quiz.answers.map((ans, i) => (
                  <div 
                    key={i}
                    className={`aspect-square rounded-lg flex items-center justify-center ${ans.isCorrect ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}
                  >
                    <img 
                      src={`https://flagcdn.com/w80/${ans.country.code}.png`}
                      alt="Flag"
                      className="w-8 h-8 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <button
                  onClick={() => startQuiz(quiz.continent)}
                  className="bg-white text-blue-700 px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  {t.playAgain}
                </button>
                <button
                  onClick={() => setScreen('home')}
                  className="bg-blue-500/30 border border-white/20 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-500/40 transition-colors"
                >
                  {t.home}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-8 text-center text-blue-300/50 text-sm">
        &copy; {new Date().getFullYear()} {t.title} • Offline Ready
      </footer>
    </div>
  );
}
