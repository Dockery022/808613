import { useState, useMemo, useEffect } from "react";
import {
  GamePhase,
  getRandomEra,
  getPlayersForEra,
  simulateSeason,
  calculateTeamRating,
  GameResult,
  generateJerseyQuiz,
  countPlayersForEra,
  JerseyQuestion,
  rankSeason,
} from "@/lib/game-logic";
import { Player, Position, ERA_LABELS } from "@/lib/data";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Share, Play, Search, ChevronDown, Moon, Sun } from "lucide-react";
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
                <div className="w-10 h-10 md:w-20 md:h-20 rounded-lg md:rounded-xl bg-cardinal border-2 border-cardinal shadow-[0_0_20px_rgba(173,0,0,0.5)] flex flex-col items-center justify-center">
                  <span className="text-[8px] md:text-[10px] font-black text-white/60 uppercase tracking-wider">{pos}</span>
                  <span className="text-[9px] md:text-base font-black text-white leading-tight text-center px-0.5 line-clamp-2">
                    {player.name.split(" ").slice(-1)[0]}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="w-10 h-10 md:w-20 md:h-20 rounded-lg md:rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-white/3">
                <span className="text-white/40 font-black text-xs md:text-lg">{pos}</span>
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

  const [spinsLeft, setSpinsLeft] = useState(2);
  const [simResults, setSimResults] = useState<GameResult[]>([]);
  const [reviewTab, setReviewTab] = useState<"stats" | "gamelog">("stats");

  // Jersey Guesser state
  const [quizQuestions, setQuizQuestions] = useState<JerseyQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizPicked, setQuizPicked] = useState<string | null>(null); // picked jersey number
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizEra, setQuizEra] = useState<string>("all");
  const [quizSubMode, setQuizSubMode] = useState<"multiple" | "type">("multiple");
  const [quizTypeInput, setQuizTypeInput] = useState("");
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };
  const { toast } = useToast();

  const filledPositions = roster.map(p => p.position);

  const startDraft = (selectedMode: "draft" | "memory") => {
    setMode(selectedMode);
    setRoster([]);
    setDraftedIds([]);
    setUsedEras([]);
    setSpinsLeft(2);
    const era = getRandomEra([], []);
    setCurrentEra(era);
    setUsedEras([era]);
    setPosFilter("All");
    setSearch("");
    setSortBy("ppg");
    setPhase("drafting");
  };

  const handleSpin = () => {
    if (spinsLeft <= 0) return;
    const newEra = getRandomEra(filledPositions, [currentEra]);
    setCurrentEra(newEra);
    setUsedEras(prev => [...prev, newEra]);
    setSpinsLeft(prev => prev - 1);
    setPosFilter("All");
    setSearch("");
  };

  const startJerseySetup = () => setPhase("jersey-era");

  const selectJerseyEra = (era: string) => {
    setQuizEra(era);
    setPhase("jersey-mode");
  };

  const selectJerseyMode = (mode: "multiple" | "type") => {
    setQuizSubMode(mode);
    const qs = generateJerseyQuiz(quizEra, 10);
    setQuizQuestions(qs);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizPicked(null);
    setQuizTypeInput("");
    setQuizAnswered(false);
    setPhase("jersey-quiz");
  };

  const handleQuizPick = (number: string) => {
    if (quizAnswered) return;
    const correct = quizQuestions[quizIndex].player.jerseyNumber;
    setQuizPicked(number);
    setQuizAnswered(true);
    if (number === correct) setQuizScore(s => s + 1);
  };

  const handleTypeSubmit = () => {
    if (quizAnswered || !quizTypeInput.trim()) return;
    const correct = quizQuestions[quizIndex].player.jerseyNumber;
    const isCorrect = quizTypeInput.trim() === correct;
    setQuizPicked(isCorrect ? correct : "__wrong__");
    setQuizAnswered(true);
    if (isCorrect) setQuizScore(s => s + 1);
  };

  const advanceQuiz = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      setPhase("jersey-results");
    } else {
      setQuizIndex(i => i + 1);
      setQuizPicked(null);
      setQuizTypeInput("");
      setQuizAnswered(false);
    }
  };

  const eraPlayers = useMemo(() => {
    return getPlayersForEra(currentEra, draftedIds);
  }, [currentEra, draftedIds]);

  const filteredPlayers = useMemo(() => {
    const positions = POS_FILTER_MAP[posFilter];
    return eraPlayers
      .filter(p => positions.includes(p.position))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aFilled = filledPositions.includes(a.position) ? 1 : 0;
        const bFilled = filledPositions.includes(b.position) ? 1 : 0;
        if (aFilled !== bFilled) return aFilled - bFilled;
        return b[sortBy] - a[sortBy];
      });
  }, [eraPlayers, posFilter, search, sortBy, filledPositions]);

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
    <div className={cn(
      "min-h-dvh text-zinc-900 dark:text-white selection:bg-cardinal selection:text-white flex flex-col font-sans overflow-x-hidden pb-14",
      isDark ? "bg-zinc-950" : "bg-white"
    )}>

      {/* Header */}
      <header className="py-4 px-6 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="font-black text-xl tracking-tighter uppercase text-zinc-900 dark:text-white">
            Cardinal <span className="text-cardinal">Basketball</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {phase !== "mode-select" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetGame}
              data-testid="button-restart"
              className="text-zinc-500 hover:text-zinc-900 dark:text-white/60 dark:hover:text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Restart
            </Button>
          )}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
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
                <div className="w-44 h-44 mx-auto rounded-full border-4 border-[#AD0000] bg-transparent dark:bg-white flex items-center justify-center">
                  <img
                    src="/logo-1912.png"
                    alt="The 1912 Society"
                    className="w-36 h-36 object-contain dark:mix-blend-multiply"
                  />
                </div>
                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
                  Can You Go <br /><span className="text-cardinal">Undefeated?</span>
                </h2>
                <p className="text-lg text-zinc-500 dark:text-white/60 max-w-md mx-auto">
                  Draft your all-time Louisville Cardinals starting five and simulate a season against college basketball's elite.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
                <button
                  data-testid="button-draft-mode"
                  onClick={() => startDraft("draft")}
                  className="group relative overflow-hidden rounded-2xl border border-cardinal/40 bg-zinc-900 p-6 text-left hover:border-cardinal hover:bg-zinc-800 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-cardinal/30 rounded-full blur-3xl group-hover:bg-cardinal/50 transition-all" />
                  <h3 className="text-xl font-bold mb-2 text-white">Draft Mode</h3>
                  <p className="text-sm text-white/60">Build your team era by era. See stats, filter by position, and make the perfect pick.</p>
                </button>
                <button
                  data-testid="button-memory-mode"
                  onClick={() => startDraft("memory")}
                  className="group relative overflow-hidden rounded-2xl border border-gold/40 bg-zinc-900 p-6 text-left hover:border-gold hover:bg-zinc-800 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-gold/30 rounded-full blur-3xl group-hover:bg-gold/50 transition-all" />
                  <h3 className="text-xl font-bold mb-2 text-gold">Memory Mode</h3>
                  <p className="text-sm text-white/60">True fans only. Player stats and ratings are hidden until your lineup is locked.</p>
                </button>
                <button
                  data-testid="button-jersey-mode"
                  onClick={startJerseySetup}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-zinc-900 p-6 text-left hover:border-white/50 hover:bg-zinc-800 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                  <div className="text-2xl mb-2">#</div>
                  <h3 className="text-xl font-bold mb-2 text-white">Jersey Guesser</h3>
                  <p className="text-sm text-white/60">See the player — guess the number. How well do you know Cardinals history?</p>
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
              className="flex-1 flex flex-col md:flex-row h-[calc(100dvh-65px)] bg-white dark:bg-zinc-900"
            >
              {/* LEFT: Player list */}
              <div className="flex flex-col flex-1 min-w-0 border-r border-zinc-200 dark:border-white/10 overflow-hidden">

                {/* Era + round strip */}
                <div className="px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="bg-cardinal/20 text-cardinal border border-cardinal/40 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"
                      data-testid="text-current-era"
                    >
                      {currentEra}
                    </span>
                    <span className="text-zinc-500 dark:text-white/50 text-sm font-bold hidden sm:inline">
                      {ERA_LABELS[currentEra]}
                    </span>
                    <button
                      onClick={handleSpin}
                      disabled={spinsLeft <= 0}
                      title={spinsLeft > 0 ? `Spin for a new era (${spinsLeft} left)` : "No spins left"}
                      className={cn(
                        "flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border transition-all",
                        spinsLeft > 0
                          ? "bg-gold/10 text-gold border-gold/40 hover:bg-gold/20 cursor-pointer"
                          : "bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-white/20 border-zinc-200 dark:border-white/10 cursor-not-allowed opacity-50"
                      )}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span>{spinsLeft}</span>
                    </button>
                  </div>
                  <span className="text-zinc-400 dark:text-white/30 text-xs font-bold uppercase tracking-widest shrink-0">
                    Pick {roster.length + 1} of 5
                  </span>
                </div>

                {/* Filters row */}
                <div className="px-5 py-3 flex items-center gap-2 border-b border-zinc-200 dark:border-white/10 shrink-0">
                  {/* Position pills */}
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 rounded-lg p-0.5">
                    {(["All", "G", "F", "C"] as PosFilter[]).map(f => (
                      <button
                        key={f}
                        data-testid={`filter-pos-${f}`}
                        onClick={() => setPosFilter(f)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-bold transition-all",
                          posFilter === f ? "bg-cardinal text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-white/50 dark:hover:text-white"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-white/30" />
                    <input
                      data-testid="input-search"
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
                    />
                  </div>

                  {/* Sort dropdown */}
                  <div className="relative">
                    <button
                      data-testid="button-sort"
                      onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-all"
                    >
                      {sortBy.toUpperCase()}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#0d1520] border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden min-w-[90px]">
                        {STAT_COLS.map(s => (
                          <button
                            key={s.key}
                            data-testid={`sort-${s.key}`}
                            onClick={() => { setSortBy(s.key); setSortOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm font-bold transition-all",
                              sortBy === s.key ? "text-cardinal bg-cardinal/10 dark:text-white dark:bg-cardinal/20" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5"
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
                <div className="px-5 py-2 text-xs text-zinc-400 dark:text-white/30 font-medium shrink-0">
                  {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} available
                </div>

                {/* Player rows */}
                <div className="flex-1 overflow-y-auto px-3 pb-20 md:pb-4 space-y-2">
                  {filteredPlayers.length === 0 ? (
                    <div className="py-16 text-center text-zinc-400 dark:text-white/20 font-bold uppercase tracking-wider text-sm">
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
                          "group w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                          "bg-white dark:bg-zinc-800/60",
                          "border-zinc-200 dark:border-zinc-700",
                          "shadow-[0_3px_0_0] shadow-zinc-300 dark:shadow-zinc-900",
                          positionFilled
                            ? "opacity-35 cursor-not-allowed"
                            : "cursor-pointer hover:translate-y-[-1px] hover:shadow-[0_4px_0_0] hover:shadow-cardinal/50 hover:border-cardinal/50 active:translate-y-[2px] active:shadow-none"
                        )}
                      >
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-sm md:text-base truncate", positionFilled ? "text-zinc-400 dark:text-white/60" : "text-zinc-900 dark:text-white group-hover:text-cardinal transition-colors")}>
                              {player.name}
                            </span>
                            {positionFilled && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-white/30 shrink-0">Position filled</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-cardinal text-xs font-black">{player.position}</span>
                            <span className="text-zinc-300 dark:text-white/20 text-xs">·</span>
                            <span className="text-zinc-500 dark:text-white/40 text-xs truncate">{player.eraLabel} · {player.era}</span>
                          </div>
                        </div>

                        {/* Stats */}
                        {mode === "draft" ? (
                          <div className="hidden sm:flex items-center gap-4 shrink-0">
                            {STAT_COLS.map(s => (
                              <div key={s.key} className="text-center w-9">
                                <div className={cn(
                                  "text-sm font-bold tabular-nums leading-tight",
                                  s.key === sortBy ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-white/50"
                                )}>
                                  {player[s.key].toFixed(1)}
                                </div>
                                <div className="text-[9px] text-zinc-400 dark:text-white/25 uppercase tracking-wider">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-white/20 italic hidden sm:block shrink-0">Hidden</span>
                        )}
                      </motion.button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Court diagram — always visible; stacks above player list on mobile */}
              <div className="flex order-first md:order-last items-center justify-center bg-gray-100 dark:bg-[#080e18] shrink-0
                              w-full border-b border-zinc-200 dark:border-white/10 p-3
                              md:w-[360px] lg:w-[420px] md:border-b-0 md:border-l md:p-6 md:items-start">
                {/* aspect-ratio wrapper: width drives height to keep court proportions */}
                <div className="relative w-[180px] sm:w-[220px] md:w-full aspect-[400/520]">
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
              className="flex-1 flex flex-col items-center justify-center space-y-8 md:space-y-12 p-4 md:p-8 bg-white dark:bg-zinc-900"
            >
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Your Squad is Set</h2>
                <div className="inline-flex items-center gap-4 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full px-6 py-3">
                  <span className="text-zinc-500 dark:text-white/60 font-bold uppercase tracking-wider text-sm">Team Rating</span>
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
              className="flex-1 flex flex-col items-center bg-white dark:bg-zinc-900 overflow-y-auto pb-10"
            >
              {(() => {
                const wins = simResults.filter(g => g.won).length;
                const losses = simResults.filter(g => !g.won).length;
                const finalGame = simResults[simResults.length - 1];
                const rank = rankSeason(wins);

                const percentileLabel =
                  rank.percentile >= 95 ? "All-Time Great" :
                  rank.percentile >= 80 ? "Elite Season" :
                  rank.percentile >= 60 ? "Strong Season" :
                  rank.percentile >= 40 ? "Average Season" :
                  rank.percentile >= 20 ? "Below Average" :
                  "Rough Year";

                const percentileColor =
                  rank.percentile >= 80 ? "text-gold" :
                  rank.percentile >= 50 ? "text-green-400" :
                  rank.percentile >= 25 ? "text-zinc-400" :
                  "text-red-400";

                return (
                  <div className="w-full max-w-lg mx-auto px-6 pt-8 space-y-6">
                    {/* Big record */}
                    <div className="text-center space-y-3">
                      <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white drop-shadow-2xl" data-testid="text-final-record">
                        {wins}<span className="text-cardinal">-</span>{losses}
                      </h2>
                      <div className="bg-cardinal/20 border border-cardinal/50 rounded-xl px-6 py-3 inline-block">
                        <p className="text-base md:text-xl font-bold text-gold uppercase tracking-widest" data-testid="text-result-milestone">
                          {finalGame.milestone || "Season Complete"}
                        </p>
                      </div>
                    </div>

                    {/* Historical rank panel */}
                    <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center gap-2">
                        <div className="w-1.5 h-4 rounded-full bg-cardinal" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-white/40">
                          Program History Ranking
                        </span>
                      </div>

                      {/* Rank headline */}
                      <div className="px-5 py-5 flex items-center justify-between gap-4">
                        <div>
                          <div className={cn("text-3xl font-black tabular-nums", percentileColor)}>
                            #{rank.rank} <span className="text-base font-bold text-zinc-400 dark:text-white/30">of {rank.total}</span>
                          </div>
                          <div className="text-sm text-zinc-500 dark:text-white/50 mt-0.5">
                            Better than <span className="font-bold text-zinc-700 dark:text-white/80">{rank.betterThan}</span> of {rank.total} UofL seasons
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-sm font-black uppercase tracking-wider", percentileColor)}>
                            {percentileLabel}
                          </div>
                          <div className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">
                            {rank.percentile}th percentile
                          </div>
                        </div>
                      </div>

                      {/* Percentile bar */}
                      <div className="px-5 pb-4">
                        <div className="h-2 w-full bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              rank.percentile >= 80 ? "bg-gold" :
                              rank.percentile >= 50 ? "bg-green-500" :
                              rank.percentile >= 25 ? "bg-zinc-400" : "bg-red-500"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${rank.percentile}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-white/20 mt-1 font-medium">
                          <span>Worst</span><span>Best</span>
                        </div>
                      </div>

                      {/* Closest historical seasons */}
                      <div className="border-t border-zinc-200 dark:border-white/10">
                        <div className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-white/30">
                          Comparable Seasons
                        </div>
                        {rank.closestSeasons.map((s, i) => (
                          <div
                            key={s.season}
                            className={cn(
                              "flex items-center px-5 py-3 gap-4",
                              i < rank.closestSeasons.length - 1 && "border-b border-zinc-100 dark:border-white/5"
                            )}
                          >
                            <div className="w-7 h-7 rounded-lg bg-cardinal/10 border border-cardinal/20 flex items-center justify-center text-cardinal text-[10px] font-black shrink-0">
                              {s.wins}W
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-zinc-800 dark:text-white leading-tight">
                                {s.season}
                                {s.champion && <span className="ml-2 text-[10px] font-black text-gold bg-gold/10 border border-gold/30 rounded px-1.5 py-0.5 uppercase">🏆 Champs</span>}
                                {s.finalFour && !s.champion && <span className="ml-2 text-[10px] font-black text-orange-400 bg-orange-400/10 border border-orange-400/30 rounded px-1.5 py-0.5 uppercase">Final Four</span>}
                              </div>
                              <div className="text-xs text-zinc-400 dark:text-white/30 truncate">
                                {s.record} · {s.postseason || s.conference}
                              </div>
                            </div>
                            <div className={cn(
                              "text-xs font-black tabular-nums shrink-0",
                              s.wins > wins ? "text-red-400" : s.wins < wins ? "text-green-400" : "text-zinc-400 dark:text-white/40"
                            )}>
                              {s.wins > wins ? `−${s.wins - wins}W` : s.wins < wins ? `+${wins - s.wins}W` : "Same"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => { setReviewTab("stats"); setPhase("season-review"); }}
                        variant="outline"
                        className="flex-1 bg-zinc-100 border-zinc-300 hover:bg-zinc-200 dark:bg-white/5 dark:border-white/20 dark:hover:bg-white/10"
                      >
                        <Search className="w-4 h-4 mr-2" /> Review Season
                      </Button>
                      <Button
                        data-testid="button-play-again"
                        onClick={resetGame}
                        className="flex-1 bg-cardinal hover:bg-red-700 text-white"
                      >
                        <Play className="w-4 h-4 mr-2" /> Play Again
                      </Button>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        data-testid="button-share"
                        onClick={copyResults}
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white/60 text-xs"
                      >
                        <Share className="w-3 h-3 mr-1.5" /> Share Results
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ── SEASON REVIEW ── */}
          {phase === "season-review" && (() => {
            const wins = simResults.filter(g => g.won).length;
            const losses = simResults.filter(g => !g.won).length;
            const finalGame = simResults[simResults.length - 1];
            const regularSeason = simResults.filter(g => g.gameNumber <= 36);
            const tourney = simResults.filter(g => g.gameNumber > 36);

            return (
              <motion.div
                key="season-review"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden"
              >
                {/* Sub-header */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
                  <button
                    onClick={() => setPhase("results")}
                    className="text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm font-bold flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                      {wins}<span className="text-cardinal">-</span>{losses}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-white/30 ml-2">· {finalGame.milestone || "Season Complete"}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900">
                  {(["stats", "gamelog"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReviewTab(tab)}
                      className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors",
                        reviewTab === tab
                          ? "text-cardinal border-b-2 border-cardinal"
                          : "text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60"
                      )}
                    >
                      {tab === "stats" ? "Player Stats" : "Game Log"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto">
                  {reviewTab === "stats" && (
                    <div className="p-4 space-y-3 max-w-lg mx-auto">
                      {roster.map(player => (
                        <div
                          key={player.id}
                          className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden"
                        >
                          {/* Player header */}
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-white/10">
                            <div className="w-9 h-9 rounded-xl bg-cardinal/10 border border-cardinal/20 flex items-center justify-center text-cardinal font-black text-sm shrink-0">
                              #{player.jerseyNumber}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-zinc-900 dark:text-white text-sm leading-tight truncate">{player.name}</div>
                              <div className="text-[10px] text-zinc-400 dark:text-white/30 uppercase tracking-widest">{player.position} · {player.eraLabel}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg font-black text-cardinal tabular-nums">{player.rating}</div>
                              <div className="text-[10px] text-zinc-400 dark:text-white/30 uppercase tracking-widest">OVR</div>
                            </div>
                          </div>
                          {/* Stat grid */}
                          <div className="grid grid-cols-5 divide-x divide-zinc-200 dark:divide-white/10">
                            {[
                              { label: "PPG", value: player.ppg.toFixed(1) },
                              { label: "RPG", value: player.rpg.toFixed(1) },
                              { label: "APG", value: player.apg.toFixed(1) },
                              { label: "SPG", value: player.spg.toFixed(1) },
                              { label: "BPG", value: player.bpg.toFixed(1) },
                            ].map(stat => (
                              <div key={stat.label} className="flex flex-col items-center py-3">
                                <div className="text-sm font-black text-zinc-800 dark:text-white tabular-nums">{stat.value}</div>
                                <div className="text-[10px] text-zinc-400 dark:text-white/30 uppercase tracking-wider font-bold mt-0.5">{stat.label}</div>
                              </div>
                            ))}
                          </div>
                          {/* Accolades */}
                          {player.accolades && (
                            <div className="px-4 py-2 border-t border-zinc-200 dark:border-white/10">
                              <p className="text-[11px] text-zinc-400 dark:text-white/30 italic leading-snug">{player.accolades}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {reviewTab === "gamelog" && (
                    <div className="max-w-lg mx-auto divide-y divide-zinc-100 dark:divide-white/5">
                      {/* Regular season header */}
                      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800/60">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-white/30">
                          Regular Season ({regularSeason.filter(g => g.won).length}-{regularSeason.filter(g => !g.won).length})
                        </span>
                      </div>
                      {regularSeason.map(game => (
                        <div key={game.gameNumber} className="flex items-center px-4 py-3 gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0",
                            game.won
                              ? "bg-green-500/10 text-green-500 border border-green-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          )}>
                            {game.won ? "W" : "L"}
                          </div>
                          <div className="w-6 text-center text-[10px] text-zinc-400 dark:text-white/20 font-bold tabular-nums shrink-0">
                            {game.gameNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-zinc-800 dark:text-white leading-tight truncate">
                              vs {game.opponent}
                            </div>
                            {game.milestone && (
                              <div className="text-[10px] text-gold font-bold mt-0.5">{game.milestone}</div>
                            )}
                          </div>
                          <div className={cn(
                            "text-sm font-black tabular-nums shrink-0",
                            game.won ? "text-green-500" : "text-red-400"
                          )}>
                            {game.score}
                          </div>
                        </div>
                      ))}

                      {/* Tournament section */}
                      {tourney.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800/60">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-white/30">
                              NCAA Tournament ({tourney.filter(g => g.won).length}-{tourney.filter(g => !g.won).length})
                            </span>
                          </div>
                          {tourney.map(game => (
                            <div key={game.gameNumber} className="flex items-center px-4 py-3 gap-3">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0",
                                game.won
                                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              )}>
                                {game.won ? "W" : "L"}
                              </div>
                              <div className="w-6 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-zinc-800 dark:text-white leading-tight truncate">
                                  {game.opponent}
                                </div>
                                {game.milestone && (
                                  <div className="text-[10px] text-gold font-bold mt-0.5">{game.milestone}</div>
                                )}
                              </div>
                              <div className={cn(
                                "text-sm font-black tabular-nums shrink-0",
                                game.won ? "text-green-500" : "text-red-400"
                              )}>
                                {game.score}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* ── JERSEY ERA SELECT ── */}
          {phase === "jersey-era" && (
            <motion.div
              key="jersey-era"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 overflow-y-auto pb-20"
            >
              <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 bg-cardinal/20 border border-cardinal/40 text-cardinal text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                    # Jersey Guesser
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
                    Pick an <span className="text-cardinal">Era</span>
                  </h2>
                  <p className="text-zinc-500 dark:text-white/50 text-sm">Choose a coaching era or test your knowledge of all-time Cardinals.</p>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-zinc-200 dark:divide-white/10">
                  {[
                    { era: "all", label: "All-Time", sub: "All eras combined", color: "bg-cardinal" },
                    { era: "hickman", label: "The Hickman Era",  sub: "Peck Hickman · 1944–1967",     color: "bg-stone-700" },
                    { era: "early",  label: "The Dromo Era",    sub: "John Dromo · 1967–1971",       color: "bg-red-800" },
                    { era: "crum",   label: "The Crum Dynasty", sub: "Denny Crum · 1971–2001",        color: "bg-amber-600" },
                    { era: "pitino", label: "The Pitino Era",   sub: "Rick Pitino · 2001–2018",       color: "bg-emerald-700" },
                    { era: "modern", label: "The Modern Era",   sub: "Mack / Payne / Kelsey · 2018–present", color: "bg-blue-700" },
                  ].map(({ era, label, sub, color }) => {
                    const count = countPlayersForEra(era);
                    if (count === 0) return null;
                    return (
                      <button
                        key={era}
                        onClick={() => selectJerseyEra(era)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors group"
                      >
                        <div className={cn("w-1.5 h-10 rounded-full shrink-0", color)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white text-sm">{label}</div>
                          <div className="text-xs text-zinc-500 dark:text-white/40">{sub} · {count} player{count !== 1 ? "s" : ""}</div>
                        </div>
                        <svg className="w-4 h-4 text-zinc-400 dark:text-white/30 group-hover:text-cardinal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
                <button onClick={resetGame} className="text-sm text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70 transition-colors">
                  ← Back to Main Menu
                </button>
              </div>
            </motion.div>
          )}

          {/* ── JERSEY MODE SELECT ── */}
          {phase === "jersey-mode" && (
            <motion.div
              key="jersey-mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 pb-20"
            >
              <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 bg-cardinal/20 border border-cardinal/40 text-cardinal text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                    # {quizEra === "all" ? "All-Time" : ERA_LABELS[quizEra] ?? quizEra}
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
                    Guess the <span className="text-cardinal">Number</span>
                  </h2>
                  <p className="text-zinc-500 dark:text-white/50 text-sm">
                    {countPlayersForEra(quizEra)} players available · 10 rounds
                  </p>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-zinc-200 dark:divide-white/10">
                  <p className="px-5 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-white/30">Choose Mode</p>
                  <button
                    onClick={() => selectJerseyMode("multiple")}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cardinal/20 border border-cardinal/40 flex items-center justify-center text-cardinal font-black text-xs shrink-0">AB</div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 dark:text-white">Multiple Choice</div>
                      <div className="text-xs text-zinc-500 dark:text-white/40">Pick from 4 options</div>
                    </div>
                    <svg className="w-4 h-4 text-zinc-400 dark:text-white/30 group-hover:text-cardinal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => selectJerseyMode("type")}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-black text-xs shrink-0">##</div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 dark:text-white">Type It In</div>
                      <div className="text-xs text-zinc-500 dark:text-white/40">Enter the jersey number</div>
                    </div>
                    <svg className="w-4 h-4 text-zinc-400 dark:text-white/30 group-hover:text-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <button onClick={() => setPhase("jersey-era")} className="text-sm text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70 transition-colors">
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* ── JERSEY QUIZ ── */}
          {phase === "jersey-quiz" && quizQuestions.length > 0 && (() => {
            const q = quizQuestions[quizIndex];
            const correct = q.player.jerseyNumber;
            const isAnswered = quizAnswered;
            const wasCorrect = isAnswered && quizPicked === correct;
            return (
              <motion.div
                key="jersey-quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col bg-white dark:bg-zinc-950 pb-20"
              >
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cardinal" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-white/50">
                      {quizEra === "all" ? "All-Time" : ERA_LABELS[quizEra] ?? quizEra}
                    </span>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-white/50">
                    Round <span className="text-zinc-900 dark:text-white">{quizIndex + 1}</span> of {quizQuestions.length}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex gap-1 px-5 pb-4 shrink-0">
                  {quizQuestions.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < quizIndex ? "bg-cardinal" : i === quizIndex ? "bg-cardinal/60" : "bg-zinc-200 dark:bg-white/10"
                      )}
                    />
                  ))}
                </div>

                {/* Score */}
                <div className="text-center pb-4 shrink-0">
                  <div className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-white/40">Score</div>
                  <div className="text-3xl font-black text-zinc-900 dark:text-white">{quizScore}</div>
                </div>

                {/* Player card */}
                <div className="mx-5 mb-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 text-center shrink-0">
                  <div className="text-xs text-zinc-400 dark:text-white/40 font-bold uppercase tracking-widest mb-2">{q.player.era}</div>
                  <div className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white mb-1">{q.player.name}</div>
                  <div className="text-sm font-bold text-zinc-500 dark:text-white/50">{q.player.position}</div>
                  {isAnswered && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black",
                        wasCorrect
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                          : "bg-cardinal/20 border border-cardinal/40 text-cardinal"
                      )}
                    >
                      {wasCorrect ? "✓ Correct!" : `✗ It was #${correct}`}
                    </motion.div>
                  )}
                </div>

                {/* Answer area */}
                <div className="flex-1 flex flex-col justify-center px-5 space-y-4">
                  {quizSubMode === "multiple" ? (
                    <div className="grid grid-cols-2 gap-3">
                      {q.choices.map(num => {
                        const isCorrectChoice = num === correct;
                        const isPicked = quizPicked === num;
                        return (
                          <button
                            key={num}
                            onClick={() => handleQuizPick(num)}
                            disabled={isAnswered}
                            className={cn(
                              "rounded-xl border py-5 text-xl font-black transition-all",
                              !isAnswered && "hover:border-cardinal hover:bg-cardinal/10 cursor-pointer",
                              !isAnswered && "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white",
                              isAnswered && isCorrectChoice && "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
                              isAnswered && isPicked && !isCorrectChoice && "bg-cardinal/20 border-cardinal/50 text-cardinal",
                              isAnswered && !isPicked && !isCorrectChoice && "opacity-40 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-white/40"
                            )}
                          >
                            #{num}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={quizTypeInput}
                          onChange={e => setQuizTypeInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleTypeSubmit()}
                          disabled={isAnswered}
                          placeholder="##"
                          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-5 py-4 text-2xl font-black text-center text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-white/20 focus:outline-none focus:border-cardinal disabled:opacity-50"
                        />
                        <button
                          onClick={handleTypeSubmit}
                          disabled={isAnswered || !quizTypeInput.trim()}
                          className="bg-cardinal hover:bg-red-700 disabled:opacity-40 text-white font-black px-6 rounded-xl transition-colors text-sm uppercase tracking-wider"
                        >
                          Go
                        </button>
                      </div>
                      <p className="text-center text-xs text-zinc-400 dark:text-white/30">Enter the jersey number (0–99)</p>
                    </div>
                  )}

                  {/* Next / Skip */}
                  {isAnswered ? (
                    <button
                      onClick={advanceQuiz}
                      className="w-full bg-cardinal hover:bg-red-700 text-white font-black py-3 rounded-xl transition-colors uppercase tracking-wider text-sm"
                    >
                      {quizIndex + 1 >= quizQuestions.length ? "See Results →" : "Next →"}
                    </button>
                  ) : (
                    <button
                      onClick={advanceQuiz}
                      className="text-center text-sm text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/60 transition-colors"
                    >
                      Skip this player →
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* ── JERSEY RESULTS ── */}
          {phase === "jersey-results" && (
            <motion.div
              key="jersey-results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-zinc-950 pb-20 space-y-6"
            >
              {(() => {
                const pct = quizScore / quizQuestions.length;
                const { grade, msg } =
                  pct === 1    ? { grade: "10/10", msg: "Perfect! You're a Cardinals legend." } :
                  pct >= 0.8   ? { grade: `${quizScore}/10`, msg: "Diehard fan. Respect." } :
                  pct >= 0.6   ? { grade: `${quizScore}/10`, msg: "Solid Cardinals knowledge." } :
                  pct >= 0.4   ? { grade: `${quizScore}/10`, msg: "Not bad — keep watching!" } :
                                 { grade: `${quizScore}/10`, msg: "Time to hit the record books." };
                return (
                  <>
                    <div className="inline-flex items-center gap-2 bg-cardinal/20 border border-cardinal/40 text-cardinal text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                      # Jersey Guesser — {quizEra === "all" ? "All-Time" : ERA_LABELS[quizEra] ?? quizEra}
                    </div>
                    <div>
                      <div className="text-7xl md:text-9xl font-black text-zinc-900 dark:text-white tracking-tighter">{grade}</div>
                      <p className="text-xl text-gold font-bold mt-2">{msg}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <Button
                        onClick={() => selectJerseyMode(quizSubMode)}
                        className="bg-cardinal hover:bg-red-700 text-white"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                      </Button>
                      <Button
                        onClick={resetGame}
                        variant="outline"
                        className="bg-zinc-100 border-zinc-300 hover:bg-zinc-200 dark:bg-white/5 dark:border-white/20 dark:hover:bg-white/10"
                      >
                        ← Main Menu
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
      <footer className="fixed bottom-0 inset-x-0 z-50 bg-zinc-950/90 backdrop-blur-md border-t border-white/10 flex flex-col items-center justify-center gap-1 py-2">
        <div className="flex items-center gap-8">
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
          <a href="https://givebutter.com/the-twenty2-scholarship-campaign-guan0r" target="_blank" rel="noopener noreferrer" aria-label="Givebutter" className="text-white/50 hover:text-[#F5A623] transition-colors flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 21.593c-.317-.094-6.5-2.838-6.5-8.093 0-2.485 1.813-4.5 4-4.5.959 0 1.875.37 2.5.96.625-.59 1.541-.96 2.5-.96 2.187 0 4 2.015 4 4.5 0 5.255-6.183 7.999-6.5 8.093zM17 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
            </svg>
            <span className="text-xs font-black uppercase tracking-wider">Givebutter</span>
          </a>
        </div>
        <p className="text-[10px] text-white/30 text-center px-4">
          This is an independent project and is not affiliated with, endorsed by, or sponsored by the University of Louisville.
        </p>
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
