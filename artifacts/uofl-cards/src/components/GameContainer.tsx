import { useState, useMemo } from "react";
import {
  GamePhase,
  POSITIONS,
  getRandomEra,
  getPlayersForEra,
  simulateSeason,
  calculateTeamRating,
  GameResult,
} from "@/lib/game-logic";
import { Player, Position, ERA_LABELS } from "@/lib/data";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Share, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type PosFilter = "All" | "G" | "F" | "C";

const POS_FILTER_MAP: Record<PosFilter, Position[]> = {
  All: ["PG", "SG", "SF", "PF", "C"],
  G: ["PG", "SG"],
  F: ["SF", "PF"],
  C: ["C"],
};

export function GameContainer() {
  const [phase, setPhase] = useState<GamePhase>("mode-select");
  const [mode, setMode] = useState<"draft" | "memory">("draft");

  const [currentEra, setCurrentEra] = useState<string>("");
  const [usedEras, setUsedEras] = useState<string[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [draftedIds, setDraftedIds] = useState<string[]>([]);

  const [posFilter, setPosFilter] = useState<PosFilter>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"ppg" | "rpg" | "apg" | "spg" | "bpg" | "rating">("ppg");

  const [simResults, setSimResults] = useState<GameResult[]>([]);

  const { toast } = useToast();

  const filledPositions = roster.map(p => p.position);
  const round = roster.length;

  const startDraft = (selectedMode: "draft" | "memory") => {
    setMode(selectedMode);
    setRoster([]);
    setDraftedIds([]);
    setUsedEras([]);
    const era = getRandomEra([], []);
    setCurrentEra(era);
    setUsedEras([era]);
    setPosFilter("All");
    setSearch("");
    setSortBy("ppg");
    setPhase("drafting");
  };

  const eraPlayers = useMemo(() => {
    return getPlayersForEra(currentEra, filledPositions, draftedIds);
  }, [currentEra, filledPositions, draftedIds]);

  const filteredPlayers = useMemo(() => {
    const positions = POS_FILTER_MAP[posFilter];
    return eraPlayers
      .filter(p => positions.includes(p.position))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [eraPlayers, posFilter, search, sortBy]);

  const handlePick = (player: Player) => {
    const newRoster = [...roster, player];
    const newDraftedIds = [...draftedIds, player.id];
    const newFilled = newRoster.map(p => p.position);

    setRoster(newRoster);
    setDraftedIds(newDraftedIds);

    if (newRoster.length >= 5) {
      setPhase("lineup-review");
    } else {
      const nextEra = getRandomEra(newFilled, [...usedEras]);
      setUsedEras(prev => [...prev, nextEra]);
      setCurrentEra(nextEra);
      setPosFilter("All");
      setSearch("");
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
    setDraftedIds([]);
    setUsedEras([]);
    setCurrentEra("");
    setSimResults([]);
  };

  const copyResults = () => {
    const wins = simResults.filter(g => g.won).length;
    const losses = simResults.filter(g => !g.won).length;
    const finalGame = simResults[simResults.length - 1];
    const text = `UofL Cards: Can You Go Undefeated?\n\nMy All-Time Squad went ${wins}-${losses}!\n${finalGame.milestone || ""}\n\nRating: ${calculateTeamRating(roster)}\n\nPlay at uofl-cards.replit.app`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!", description: "Share your results with other fans." });
  };

  const STAT_COLS: { key: "ppg" | "rpg" | "apg" | "spg" | "bpg"; label: string }[] = [
    { key: "ppg", label: "PPG" },
    { key: "rpg", label: "RPG" },
    { key: "apg", label: "APG" },
    { key: "spg", label: "SPG" },
    { key: "bpg", label: "BPG" },
  ];

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
          <Button
            variant="ghost"
            size="sm"
            onClick={resetGame}
            data-testid="button-restart"
            className="text-white/60 hover:text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Restart
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-6xl mx-auto p-4 md:p-8 relative">
        <AnimatePresence mode="wait">

          {/* MODE SELECT */}
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
                  Can You Go <br /><span className="text-cardinal">Undefeated?</span>
                </h2>
                <p className="text-lg text-white/60 max-w-md mx-auto">
                  Draft your all-time Louisville Cardinals starting five and simulate a season against college basketball's elite.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                <button
                  data-testid="button-draft-mode"
                  onClick={() => startDraft("draft")}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left hover:border-cardinal hover:bg-cardinal/10 transition-all duration-500"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-cardinal/20 rounded-full blur-3xl group-hover:bg-cardinal/40 transition-all" />
                  <h3 className="text-2xl font-bold mb-2">Draft Mode</h3>
                  <p className="text-sm text-white/60">Build your team era by era. See stats, filter by position, and make the perfect pick.</p>
                </button>

                <button
                  data-testid="button-memory-mode"
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

          {/* DRAFTING */}
          {phase === "drafting" && (
            <motion.div
              key={`drafting-${currentEra}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-6"
            >
              {/* Era header + progress */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-1">
                    Round {round + 1} of 5
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="bg-cardinal text-white text-sm font-black px-3 py-1 rounded-full uppercase tracking-wider" data-testid="text-current-era">
                      {currentEra}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                      {ERA_LABELS[currentEra]}
                    </h2>
                  </div>
                </div>

                {/* Filled positions indicator */}
                <div className="flex items-center gap-2">
                  {(["PG", "SG", "SF", "PF", "C"] as Position[]).map(pos => {
                    const filled = filledPositions.includes(pos);
                    const player = roster.find(p => p.position === pos);
                    return (
                      <div
                        key={pos}
                        data-testid={`slot-${pos}`}
                        title={player?.name}
                        className={cn(
                          "w-10 h-10 rounded-lg border flex flex-col items-center justify-center text-xs font-black transition-all",
                          filled
                            ? "border-cardinal bg-cardinal/20 text-cardinal"
                            : "border-white/20 text-white/30"
                        )}
                      >
                        {pos}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Position filter */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                  {(["All", "G", "F", "C"] as PosFilter[]).map(f => (
                    <button
                      key={f}
                      data-testid={`filter-pos-${f}`}
                      onClick={() => setPosFilter(f)}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                        posFilter === f
                          ? "bg-cardinal text-white"
                          : "text-white/50 hover:text-white"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    data-testid="input-search"
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 ml-auto">
                  {STAT_COLS.map(s => (
                    <button
                      key={s.key}
                      data-testid={`sort-${s.key}`}
                      onClick={() => setSortBy(s.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                        sortBy === s.key
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player count */}
              <p className="text-white/40 text-sm -mt-2">
                {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} available
              </p>

              {/* Player list */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[50vh] pr-1">
                {filteredPlayers.length === 0 ? (
                  <div className="py-12 text-center text-white/30 font-bold uppercase tracking-wider text-sm">
                    No players available for this era and filter
                  </div>
                ) : (
                  filteredPlayers.map((player, i) => (
                    <motion.button
                      key={player.id}
                      data-testid={`player-row-${player.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handlePick(player)}
                      className="group flex items-center gap-4 w-full px-4 py-3 rounded-xl border border-white/5 bg-white/3 hover:bg-cardinal/10 hover:border-cardinal/50 transition-all text-left"
                    >
                      {/* Name + position + era */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-cardinal transition-colors truncate">
                            {player.name}
                          </span>
                          <span className="text-cardinal text-xs font-black shrink-0">
                            {player.position}
                          </span>
                        </div>
                        <div className="text-xs text-white/40 mt-0.5 truncate">
                          {player.eraLabel} · {player.era}
                          {mode === "draft" && (
                            <span className="ml-2 text-gold font-bold">
                              #{player.jerseyNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      {mode === "draft" ? (
                        <div className="hidden sm:flex items-center gap-5 shrink-0">
                          {STAT_COLS.map(s => (
                            <div key={s.key} className="text-center w-10">
                              <div className={cn(
                                "text-sm font-bold tabular-nums",
                                s.key === sortBy ? "text-white" : "text-white/60"
                              )}>
                                {player[s.key].toFixed(1)}
                              </div>
                              <div className="text-[10px] text-white/30 uppercase">{s.label}</div>
                            </div>
                          ))}
                          <div className="text-center w-10">
                            <div className="text-sm font-bold tabular-nums text-gold">
                              {player.rating}
                            </div>
                            <div className="text-[10px] text-white/30 uppercase">RTG</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-white/20 font-bold italic shrink-0 hidden sm:block">
                          Stats hidden
                        </div>
                      )}

                      {/* Pick button */}
                      <div className="shrink-0 text-xs font-black uppercase tracking-wider text-white/20 group-hover:text-cardinal transition-colors">
                        Pick
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* LINEUP REVIEW */}
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
                  <span className="text-3xl font-black text-gold" data-testid="text-team-rating">{calculateTeamRating(roster)}</span>
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
                data-testid="button-simulate"
                onClick={startSimulation}
                size="lg"
                className="bg-cardinal hover:bg-red-700 text-white font-black text-xl px-12 py-8 rounded-full shadow-[0_0_30px_rgba(173,0,0,0.4)] hover:scale-105 transition-all uppercase tracking-wider"
              >
                Simulate Season
              </Button>
            </motion.div>
          )}

          {/* SIMULATING */}
          {phase === "simulating" && (
            <SimulationTicker results={simResults} onComplete={() => setPhase("results")} />
          )}

          {/* RESULTS */}
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
                    <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white drop-shadow-2xl" data-testid="text-final-record">
                      {wins}<span className="text-cardinal">-</span>{losses}
                    </h2>

                    <div className="bg-cardinal/20 border border-cardinal/50 rounded-xl px-8 py-4">
                      <p className="text-2xl font-bold text-gold uppercase tracking-widest" data-testid="text-result-milestone">
                        {finalGame.milestone || "Season Complete"}
                      </p>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <Button
                        data-testid="button-share"
                        onClick={copyResults}
                        variant="outline"
                        className="bg-white/5 border-white/20 hover:bg-white/10"
                      >
                        <Share className="w-4 h-4 mr-2" /> Share Results
                      </Button>
                      <Button
                        data-testid="button-play-again"
                        onClick={resetGame}
                        className="bg-cardinal hover:bg-red-700 text-white"
                      >
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

function SimulationTicker({ results, onComplete }: { results: GameResult[]; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < results.length) {
      const timer = setTimeout(() => setCurrentIndex(prev => prev + 1), 100);
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
      <div className="text-5xl font-black font-mono mb-12 tracking-tighter" data-testid="text-sim-record">
        <span className="text-white">{currentWins}</span>
        <span className="text-white/30 mx-2">-</span>
        <span className="text-cardinal">{currentLosses}</span>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-6 font-mono text-sm h-[400px] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black z-10" />
        <div className="flex flex-col justify-end h-full space-y-2 relative z-0">
          {visibleResults.map(game => (
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
                {game.milestone && (
                  <span className="text-gold text-xs font-bold hidden md:block">{game.milestone}</span>
                )}
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

