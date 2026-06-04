import { Player } from "@/lib/data";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  selected?: boolean;
  hideStats?: boolean;
  className?: string;
}

export function PlayerCard({ player, onClick, selected, hideStats, className }: PlayerCardProps) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.05, y: -5 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        "relative w-full max-w-[280px] aspect-[2.5/3.5] rounded-xl overflow-hidden cursor-pointer",
        "border-4 transition-colors duration-300",
        selected ? "border-gold shadow-[0_0_20px_rgba(201,168,76,0.6)]" : "border-cardinal hover:border-gold/50",
        "bg-black flex flex-col",
        className
      )}
    >
      {/* Background Texture / Style */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #AD0000 0%, transparent 70%)' }} />
      
      {/* Top Banner */}
      <div className="bg-cardinal text-white px-3 py-2 flex justify-between items-center z-10 border-b-2 border-white/20">
        <span className="font-bold text-sm tracking-wider uppercase">{player.position}</span>
        <span className="font-bold text-sm text-gold">{player.era}</span>
      </div>

      {/* Main Image Area (Typographic fallback) */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4">
        <div className="text-[5rem] leading-none font-bold text-white/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          {player.jerseyNumber}
        </div>
        <h2 className="text-2xl font-black text-white text-center uppercase tracking-tighter leading-tight drop-shadow-md">
          {player.name}
        </h2>
      </div>

      {/* Stats Area */}
      <div className="bg-gradient-to-t from-black via-black to-transparent pt-8 pb-4 px-4 z-10">
        {!hideStats ? (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-gray-300 font-mono">
              <div className="flex flex-col items-center">
                <span className="text-white font-bold text-lg">{player.ppg.toFixed(1)}</span>
                <span>PPG</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-white font-bold text-lg">{player.rpg.toFixed(1)}</span>
                <span>RPG</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-white font-bold text-lg">{player.apg.toFixed(1)}</span>
                <span>APG</span>
              </div>
            </div>
            <div className="h-px w-full bg-white/10 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gold/80 font-bold truncate pr-2">{player.accolades}</span>
              <div className="bg-cardinal text-white rounded-full w-10 h-10 flex items-center justify-center font-black shadow-lg border border-gold shrink-0">
                {player.rating}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <span className="text-gold font-bold text-lg tracking-widest uppercase">? ? ?</span>
          </div>
        )}
      </div>

      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />
    </motion.div>
  );
}
