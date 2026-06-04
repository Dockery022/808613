import { useEffect, useState } from "react";
import { GamePhase, POSITIONS, generateDraftChoices, simulateSeason, calculateTeamRating, GameResult } from "@/lib/game-logic";
import { Player, Position } from "@/lib/data";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Share, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function GameContainer() {
  const [phase, setPhase] = useState<GamePhase>("mode-select");
  const [mode, setMode] = useState<"draft" | "memory">("draft");
  
  const [draftOrder, setDraftOrder] = useState<Position[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roster, setRoster] = useState<Player[]>([]);
  const [currentChoices, setCurrentChoices] = useState<Player[]>([]);
  
  const [simResults, setSimResults] = useState<GameResult[]>([]);
  
  const { toast } = useToast();

  const startDraft = (selectedMode: "draft" | "memory") => {
    setMode(selectedMode);
    const order = [...POSITIONS].sort(() => Math.random() - 0.5);
    setDraftOrder(order);
    setRoster([]);
    setCurrentRound(0);
    setCurrentChoices(generateDraftChoices(order[0], []));
    setPhase("drafting");
  };

  const handlePick = (player: Player) => {
    const newRoster = [...roster, player];
    setRoster(newRoster);
    
    if (currentRound + 1 < 5) {
      setCurrentRound(prev => prev + 1);
      setCurrentChoices(generateDraftChoices(draftOrder[currentRound + 1], newRoster.map(p => p.id)));
    } else {
      setPhase("lineup-review");
    }
  };

  const startSimulation = () => {
    setPhase("simulating");
    const rating = calculateTeamRating(roster);
    const results = simulateSeason(rating);
    setSimResults(results);
  };

  const resetGame = () => {
    setPhase("mode-select");
    setRoster([]);
    setCurrentRound(0);
    setSimResults([]);
  };

  const copyResults = () => {
    const finalGame = simResults[simResults.length - 1];
    const wins = simResults.filter(g => g.won).length;
    const losses = simResults.filter(g => !g.won).length;
    
    const text = `🏀 UofL Cards: Can You Go Undefeated?\n\nMy All-Time Squad went ${wins}-${losses}!\n${finalGame.milestone || ""}\n\nRating: ${calculateTeamRating(roster)}\n\nPlay at: [your-url-here]`;
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard!",
      description: "Share your results with other fans.",
    });
  };

  return (
    <div className="min-h-dvh bg-black text-white selection:bg-cardinal selection:text-white flex flex-col font-sans overflow-x-hidden">
      
      {/* Header */}
      <header className="py-4 px-6 border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cardinal rounded-full flex items-center justify-center font-black text-white shadow-[0_0_10px_rgba(173,0,0,0.8)]">
            U
          </div>
          <h1 className="font-black text-xl tracking-tighter uppercase text-white">
            UofL <span className="text-cardinal">Cards</span>
          </h1>
        </div>
        {phase !== "mode-select" && (
          <Button variant="ghost" size="sm" onClick={resetGame} className="text-white/60 hover:text-white">
            <RotateCcw className="w-4 h-4 mr-2" /> Restart
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-6xl mx-auto p-4 md:p-8 relative">
        <AnimatePresence mode="wait">
          {phase === "mode-select" && (
            <motion.div 
              key="mode-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
            >
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter drop-shadow-lg">
                  Can You Go <br/><span className="text-cardinal">Undefeated?</span>
                </h2>
                <p className="text-lg text-white/60 max-w-md mx-auto">
                  Draft your all-time Louisville Cardinals starting five and simulate a season against college basketball's elite.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                <button 
                  onClick={() => startDraft("draft")}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left hover:border-cardinal hover:bg-cardinal/10 transition-all duration-500"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-cardinal/20 rounded-full blur-3xl group-hover:bg-cardinal/40 transition-all" />
                  <h3 className="text-2xl font-bold mb-2">Draft Mode</h3>
                  <p className="text-sm text-white/60">Build your team round by round. See stats, compare players, and make the perfect pick.</p>
                </button>
                
                <button 
                  onClick={() => startDraft("memory")}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left hover:border-gold hover:bg-gold/10 transition-all duration-500"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-gold/20 rounded-full blur-3xl group-hover:bg-gold/40 transition-all" />
                  <h3 className="text-2xl font-bold mb-2 text-gold">Memory Mode</h3>
                  <p className="text-sm text-white/60">True fans only. Player stats and ratings are hidden until your lineup is locked.</p>
                </button>
              </div>
            </motion.div>
          )}

          {phase === "drafting" && (
            <motion.div
              key="drafting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8"
            >
              <div className="w-full max-w-md space-y-2 text-center">
                <div className="flex justify-between text-sm font-bold uppercase tracking-wider text-white/60">
                  <span>Round {currentRound + 1} of 5</span>
                  <span>Position: <span className="text-cardinal">{draftOrder[currentRound]}</span></span>
                </div>
                <Progress value={(currentRound / 5) * 100} className="h-2 bg-white/10 [&>div]:bg-cardinal" />
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight text-center">
                Select your <span className="text-cardinal">{draftOrder[currentRound]}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl justify-items-center">
                {currentChoices.map((player) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex justify-center"
                  >
                    <PlayerCard 
                      player={player} 
                      onClick={() => handlePick(player)}
                      hideStats={mode === "memory"}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "lineup-review" && (
            <motion.div
              key="lineup-review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Your Squad is Set</h2>
                <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-6 py-3">
                  <span className="text-white/60 font-bold uppercase tracking-wider text-sm">Team Rating</span>
                  <span className="text-3xl font-black text-gold">{calculateTeamRating(roster)}</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full">
                {roster.map((player, idx) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <PlayerCard player={player} hideStats={false} className="scale-90 md:scale-100" />
                  </motion.div>
                ))}
              </div>

              <Button 
                onClick={startSimulation}
                size="lg"
                className="bg-cardinal hover:bg-red-700 text-white font-black text-xl px-12 py-8 rounded-full shadow-[0_0_30px_rgba(173,0,0,0.4)] hover:scale-105 transition-all uppercase tracking-wider"
              >
                Simulate Season
              </Button>
            </motion.div>
          )}

          {phase === "simulating" && (
            <SimulationTicker results={simResults} onComplete={() => setPhase("results")} />
          )}

          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8 text-center"
            >
              {(() => {
                const wins = simResults.filter(g => g.won).length;
                const losses = simResults.filter(g => !g.won).length;
                const finalGame = simResults[simResults.length - 1];
                
                return (
                  <>
                    <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">
                      {wins}<span className="text-cardinal">-</span>{losses}
                    </h2>
                    
                    <div className="bg-cardinal/20 border border-cardinal/50 rounded-xl px-8 py-4">
                      <p className="text-2xl font-bold text-gold uppercase tracking-widest">
                        {finalGame.milestone || "Season Complete"}
                      </p>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <Button onClick={copyResults} variant="outline" className="bg-white/5 border-white/20 hover:bg-white/10">
                        <Share className="w-4 h-4 mr-2" /> Share Results
                      </Button>
                      <Button onClick={resetGame} className="bg-cardinal hover:bg-red-700 text-white">
                        <Play className="w-4 h-4 mr-2" /> Play Again
                      </Button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SimulationTicker({ results, onComplete }: { results: GameResult[], onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < results.length) {
      const timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 100); // Fast ticker speed
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, results.length, onComplete]);

  const visibleResults = results.slice(Math.max(0, currentIndex - 8), currentIndex);
  const currentWins = results.slice(0, currentIndex).filter(g => g.won).length;
  const currentLosses = results.slice(0, currentIndex).filter(g => !g.won).length;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto"
    >
      <div className="text-5xl font-black font-mono mb-12 tracking-tighter">
        <span className="text-white">{currentWins}</span>
        <span className="text-white/30 mx-2">-</span>
        <span className="text-cardinal">{currentLosses}</span>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-6 font-mono text-sm h-[400px] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black z-10" />
        <div className="flex flex-col justify-end h-full space-y-2 relative z-0">
          {visibleResults.map((game, i) => (
            <motion.div 
              key={game.gameNumber}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center py-2 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-4">
                <span className="text-white/40 w-16">GM {game.gameNumber}</span>
                <span className={cn("font-bold", game.won ? "text-white" : "text-white/60")}>
                  vs {game.opponent}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn("font-bold", game.won ? "text-green-500" : "text-cardinal")}>
                  {game.won ? "W" : "L"}
                </span>
                <span className="text-white/80 w-16 text-right">{game.score}</span>
              </div>
            </motion.div>
          ))}
          {currentIndex < results.length && (
            <div className="flex items-center gap-2 text-white/40 py-2 animate-pulse">
              <span>Simulating game {currentIndex + 1}...</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
