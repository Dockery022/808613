import { useState, useEffect, useRef } from "react";
import { PLAYERS, Player, Position } from "./data";

export type GamePhase = "mode-select" | "drafting" | "lineup-review" | "simulating" | "results";
export type GameMode = "draft" | "memory";

export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

export function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export function generateDraftChoices(position: Position, excludeIds: string[]): Player[] {
  const eligible = PLAYERS.filter(p => p.position === position && !excludeIds.includes(p.id));
  return shuffleArray(eligible).slice(0, 3);
}

export function calculateTeamRating(roster: Player[]): number {
  if (roster.length === 0) return 0;
  
  const avg = roster.reduce((sum, p) => sum + p.rating, 0) / roster.length;
  
  // Chemistry bonus: players from the same era
  const eras = roster.map(p => p.era);
  const uniqueEras = new Set(eras).size;
  const chemistryBonus = Math.max(0, (5 - uniqueEras) * 1.5);
  
  return Math.min(99, Math.round(avg + chemistryBonus));
}

export type GameResult = {
  gameNumber: number;
  opponent: string;
  won: boolean;
  score: string;
  milestone?: string;
};

const OPPONENTS = [
  "Kentucky", "Duke", "North Carolina", "Syracuse", "Virginia",
  "Memphis", "Cincinnati", "Connecticut", "Indiana", "Marquette",
  "Villanova", "Georgetown", "Notre Dame", "Michigan State", "Kansas",
  "UCLA", "Florida State", "Miami", "Pittsburgh", "Wake Forest"
];

export function simulateSeason(teamRating: number): GameResult[] {
  const results: GameResult[] = [];
  let wins = 0;
  let losses = 0;
  
  // rating 50 = ~10% win chance vs avg team
  // rating 75 = ~50% win chance
  // rating 95+ = ~95% win chance
  const baseWinProb = Math.max(0.1, Math.min(0.98, (teamRating - 50) / 45));
  
  for (let i = 1; i <= 36; i++) {
    const opponent = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)];
    // slight variance per game
    const gameVariance = (Math.random() * 0.2) - 0.1; 
    const won = Math.random() < (baseWinProb + gameVariance);
    
    if (won) wins++;
    else losses++;
    
    let milestone;
    if (wins === 20 && losses === 0) milestone = "20-0 — on a roll!";
    else if (i === 30 && losses === 0) milestone = "Heading into March undefeated!";
    else if (i === 36 && losses === 0) milestone = "36-0 — PERFECT REGULAR SEASON!";
    
    // Generate believable scores
    const myScore = Math.floor(Math.random() * 25) + (won ? 75 : 60);
    const oppScore = Math.floor(Math.random() * 25) + (won ? 55 : 75);
    
    results.push({
      gameNumber: i,
      opponent,
      won,
      score: `${Math.max(myScore, oppScore)}-${Math.min(myScore, oppScore)}`,
      milestone
    });
  }
  
  // Post-season logic (games 37-42) if making tournament
  if (wins >= 20) {
    const rounds = ["Round of 64", "Round of 32", "Sweet 16", "Elite Eight", "Final Four", "National Championship"];
    for (let r = 0; r < rounds.length; r++) {
      // competition gets harder
      const tourneyDifficulty = r * 0.05;
      const gameVariance = (Math.random() * 0.2) - 0.1;
      const won = Math.random() < (baseWinProb - tourneyDifficulty + gameVariance);
      
      const myScore = Math.floor(Math.random() * 20) + (won ? 75 : 65);
      const oppScore = Math.floor(Math.random() * 20) + (won ? 60 : 75);
      
      if (won) {
        wins++;
        results.push({
          gameNumber: 36 + r + 1,
          opponent: rounds[r],
          won: true,
          score: `${Math.max(myScore, oppScore)}-${Math.min(myScore, oppScore)}`,
          milestone: r === 5 ? "NATIONAL CHAMPIONS!" : `Advanced to ${rounds[r === 4 ? 5 : r + 1]}`
        });
      } else {
        losses++;
        results.push({
          gameNumber: 36 + r + 1,
          opponent: rounds[r],
          won: false,
          score: `${Math.min(myScore, oppScore)}-${Math.max(myScore, oppScore)}`,
          milestone: `Eliminated in ${rounds[r]}`
        });
        break; // tournament over
      }
    }
  }
  
  return results;
}
