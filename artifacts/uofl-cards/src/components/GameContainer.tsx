import { useState, useMemo, useEffect } from "react";
import {
  GamePhase,
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
import { RotateCcw, Share, Play, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type PosFilter = "All" | "G" | "F" | "C";
type SortKey = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "rating";

const POS_FILTER_MAP: Record<PosFilter, Position[]> = {
  All: ["PG", "SG", "SF", "PF", "C"],
  G: ["PG", "SG"],
  F: ["SF", "PF"],
  C: ["C"],
};

const STAT_COLS: { key: SortKey; label: string }[] = [
  { key: "ppg", label: "PPG" },
  { key: "rpg", label: "RPG" },
  { key: "apg", label: "APG" },
  { key: "spg", label: "SPG" },
  { key: "bpg", label: "BPG" },
];

// Court slot positions as % of court container (left%, top%)
const COURT_SLOTS: Record<Position, { left: string; top: string }> = {
  C:  { left: "38%", top: "14%" },
  PF: { left: "62%", top: "14%" },
  SF: { left: "10%", top: "48%" },
  SG: { left: "72%", top: "48%" },
  PG: { left: "42%", top: "72%" },
};

function CourtDiagram({ roster }: { roster: Player[] }) {
  const filled: Record<string, Player> = {};
  roster.forEach(p => { filled[p.position] = p; });

  return (
    <div className="relative w-full h-full select-none">
      {/* Court SVG */}
      <svg
        viewBox="0 0 400 520"
        className="absolute inset-0 w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Court floor */}
        <rect width="400" height="520" rx="8" fill="#0d1520" />

        {/* Outer boundary */}
        <rect x="10" y="10" width="380" height="500" rx="6" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Paint / key */}
        <rect x="130" y="10" width="140" height="180" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Free throw circle */}
        <circle cx="200" cy="190" r="60" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Free throw line */}
        <line x1="130" y1="190" x2="270" y2="190" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Basket backboard */}
        <line x1="160" y1="28" x2="240" y2="28" stroke="#1e3a5f" strokeWidth="2" />

        {/* Basket circle */}
        <circle cx="200" cy="38" r="14" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Three-point arc */}
        <path
          d="M 40 10 Q 40 340 200 340 Q 360 340 360 10"
          stroke="#1e3a5f"
          strokeWidth="1.5"
        />

        {/* Center court line */}
        <line x1="10" y1="430" x2="390" y2="430" stroke="#1e3a5f" strokeWidth="1" strokeDasharray="6 4" />

        {/* Center circle */}
        <circle cx="200" cy="470" r="50" stroke="#1e3a5f" strokeWidth="1.5" />
      </svg>

      {/* Position slots overlaid on court */}
      {(Object.entries(COURT_SLOTS) as [Position, { left: string; top: string }][]).map(([pos, coords]) => {
        const player = filled[pos];
        return (
          <motion.div
            key={pos}
            style={{ left: coords.left, top: coords.top, transform: "translate(-50%, -50%)" }}
            className="absolute"
            initial={false}
            animate={player ? { scale: 1 } : { scale: 1 }}
          >
            {player ? (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-cardinal border-2 border-cardinal shadow-[0_0_20px_rgba(173,0,0,0.5)] flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-wider">{pos}</span>
                  <span className="text-sm md:text-base font-black text-white leading-tight text-center px-1 line-clamp-2">
                    {player.name.split(" ").slice(-1)[0]}
                  </span>
                </div>
                <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider">{player.era}</span>
              </motion.div>
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-white/3">
                <span className="text-white/40 font-black text-base md:text-lg">{pos}</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function GameContainer() {
  const [phase, setPhase] = useState<GamePhase>("mode-select");
  const [mode, setMode] = useState<"draft" | "memory">("draft");

  const [currentEra, setCurrentEra] = useState<string>("");
  const [usedEras, setUsedEras] = useState<string[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [draftedIds, setDraftedIds] = useState<string[]>([]);

  const [posFilter, setPosFilter] = useState<PosFilter>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("ppg");
  const [sortOpen, setSortOpen] = useState(false);

  const [simResults, setSimResults] = useState<GameResult[]>([]);
  const { toast } = useToast();

  const filledPositions = roster.map(p => p.position);

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
    return getPlayersForEra(currentEra, draftedIds);
  }, [currentEra, draftedIds]);

  const filteredPlayers = useMemo(() => {
    const positions = POS_FILTER_MAP[posFilter];
    return eraPlayers
      .filter(p => positions.includes(p.position))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [eraPlayers, posFilter, search, sortBy]);

  const handlePick = (player: Player) => {
    if (filledPositions.includes(player.position)) return;
    const newRoster = [...roster, player];
    const newDraftedIds = [...draftedIds, player.id];
    const newFilled = newRoster.map(p => p.position);

    setRoster(newRoster);
    setDraftedIds(newDraftedIds);

    if (newRoster.length >= 5) {
      setTimeout(() => setPhase("lineup-review"), 400);
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

  return (
    <div className="min-h-dvh bg-zinc-900 text-white selection:bg-cardinal selection:text-white flex flex-col font-sans overflow-x-hidden pb-14">

      {/* Header */}
      <header className="py-4 px-6 border-b border-white/10 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="font-black text-xl tracking-tighter uppercase text-white">
            Cardinal <span className="text-cardinal">Basketball</span>
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

      <main className="flex-1 flex flex-col w-full relative">
        <AnimatePresence mode="wait">

          {/* ── MODE SELECT ── */}
          {phase === "mode-select" && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-12 p-8 max-w-4xl mx-auto w-full"
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

          {/* ── DRAFTING ── */}
          {phase === "drafting" && (
            <motion.div
              key="drafting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col md:flex-row h-[calc(100dvh-65px)]"
            >
              {/* LEFT: Player list */}
              <div className="flex flex-col flex-1 min-w-0 border-r border-white/10 overflow-hidden">

                {/* Era + round strip */}
                <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="bg-cardinal/20 text-cardinal border border-cardinal/40 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"
                      data-testid="text-current-era"
                    >
                      {currentEra}
                    </span>
                    <span className="text-white/50 text-sm font-bold hidden sm:inline">
                      {ERA_LABELS[currentEra]}
                    </span>
                  </div>
                  <span className="text-white/30 text-xs font-bold uppercase tracking-widest shrink-0">
                    Pick {roster.length + 1} of 5
                  </span>
                </div>

                {/* Filters row */}
                <div className="px-5 py-3 flex items-center gap-2 border-b border-white/10 shrink-0">
                  {/* Position pills */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                    {(["All", "G", "F", "C"] as PosFilter[]).map(f => (
                      <button
                        key={f}
                        data-testid={`filter-pos-${f}`}
                        onClick={() => setPosFilter(f)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-bold transition-all",
                          posFilter === f ? "bg-cardinal text-white" : "text-white/50 hover:text-white"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input
                      data-testid="input-search"
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  {/* Sort dropdown */}
                  <div className="relative">
                    <button
                      data-testid="button-sort"
                      onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white/70 hover:text-white transition-all"
                    >
                      {sortBy.toUpperCase()}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-[#0d1520] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden min-w-[90px]">
                        {STAT_COLS.map(s => (
                          <button
                            key={s.key}
                            data-testid={`sort-${s.key}`}
                            onClick={() => { setSortBy(s.key); setSortOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm font-bold transition-all",
                              sortBy === s.key ? "text-white bg-cardinal/20" : "text-white/50 hover:text-white hover:bg-white/5"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Player count */}
                <div className="px-5 py-2 text-xs text-white/30 font-medium shrink-0">
                  {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} available
                </div>

                {/* Player rows */}
                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
                  {filteredPlayers.length === 0 ? (
                    <div className="py-16 text-center text-white/20 font-bold uppercase tracking-wider text-sm">
                      No players match
                    </div>
                  ) : (
                    filteredPlayers.map((player, i) => {
                      const positionFilled = filledPositions.includes(player.position);
                      return (
                      <motion.button
                        key={player.id}
                        data-testid={`player-row-${player.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        onClick={() => handlePick(player)}
                        disabled={positionFilled}
                        className={cn(
                          "group w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent transition-all text-left",
                          positionFilled
                            ? "opacity-35 cursor-not-allowed"
                            : "hover:bg-cardinal/10 hover:border-cardinal/30 cursor-pointer"
                        )}
                      >
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-sm md:text-base truncate", positionFilled ? "text-white/60" : "text-white group-hover:text-cardinal transition-colors")}>
                              {player.name}
                            </span>
                            {positionFilled && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/30 shrink-0">Position filled</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-cardinal text-xs font-black">{player.position}</span>
                            <span className="text-white/20 text-xs">·</span>
                            <span className="text-white/40 text-xs truncate">{player.eraLabel} · {player.era}</span>
                          </div>
                        </div>

                        {/* Stats */}
                        {mode === "draft" ? (
                          <div className="hidden sm:flex items-center gap-4 shrink-0">
                            {STAT_COLS.map(s => (
                              <div key={s.key} className="text-center w-9">
                                <div className={cn(
                                  "text-sm font-bold tabular-nums leading-tight",
                                  s.key === sortBy ? "text-white" : "text-white/50"
                                )}>
                                  {player[s.key].toFixed(1)}
                                </div>
                                <div className="text-[9px] text-white/25 uppercase tracking-wider">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-white/20 italic hidden sm:block shrink-0">Hidden</span>
                        )}
                      </motion.button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Court diagram */}
              <div className="hidden md:flex flex-col items-center justify-center bg-[#080e18] w-[360px] lg:w-[420px] shrink-0 p-6">
                <div className="w-full aspect-[400/520] relative">
                  <CourtDiagram roster={roster} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── LINEUP REVIEW ── */}
          {phase === "lineup-review" && (
            <motion.div
              key="lineup-review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-12 p-8"
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

          {/* ── SIMULATING ── */}
          {phase === "simulating" && (
            <SimulationTicker results={simResults} onComplete={() => setPhase("results")} />
          )}

          {/* ── RESULTS ── */}
          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8 text-center p-8"
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

      {/* ── FOOTER ── */}
      <footer className="fixed bottom-0 inset-x-0 z-50 bg-zinc-950/90 backdrop-blur-md border-t border-white/10 h-14 flex items-center justify-center gap-8">
        <a href="https://x.com/The1912Society" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="text-white/50 hover:text-white transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zM17.083 19.77l1.586-2.092L6.087 4.27H4.461l12.622 15.5z"/>
          </svg>
        </a>
        <a href="https://www.launchpass.com/the1912society" target="_blank" rel="noopener noreferrer" aria-label="Join on LaunchPass" className="text-white/50 hover:text-[#5865F2] transition-colors flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
          </svg>
          <span className="text-xs font-black uppercase tracking-wider">Discord</span>
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Givebutter" className="text-white/50 hover:text-[#F5A623] transition-colors flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 21.593c-.317-.094-6.5-2.838-6.5-8.093 0-2.485 1.813-4.5 4-4.5.959 0 1.875.37 2.5.96.625-.59 1.541-.96 2.5-.96 2.187 0 4 2.015 4 4.5 0 5.255-6.183 7.999-6.5 8.093zM17 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
          </svg>
          <span className="text-xs font-black uppercase tracking-wider">Givebutter</span>
        </a>
      </footer>
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
      className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto p-8"
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
