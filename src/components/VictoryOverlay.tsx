import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { getCharacterById } from '../game/data';
import { CharacterId, CustomCharacterAsset, HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';

interface VictoryOverlayProps {
  hud: HudSnapshot;
  customAssets: Partial<Record<CharacterId, CustomCharacterAsset>>;
  onRaceAgain: () => void;
  onReturnTitle: () => void;
}

const DANCE_MOVES = [
  'Sun-Step Twirl',
  'Temple Groove Wave',
  'Golden Star Jump',
  'Champion Shimmy',
];

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  hud,
  customAssets,
  onRaceAgain,
  onReturnTitle,
}) => {
  const winnerIdx = hud.winnerId ?? 0;
  const winner = hud.players[winnerIdx];
  const winnerChar = getCharacterById(winner.characterId);
  const customAsset = customAssets[winner.characterId];
  const countdownRatio = Math.max(0, hud.celebrationTimer / Math.max(1, hud.celebrationDuration));

  const [moveIndex, setMoveIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setMoveIndex((prev) => (prev + 1) % DANCE_MOVES.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  const isStarJump = moveIndex === 2;
  const isTwirl = moveIndex === 0;

  return (
    <div
      role="dialog"
      aria-label="Race Victory Celebration"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#140d07]/58 px-6"
    >
      <div className="w-full max-w-[740px] bg-[#1b130c]/96 border-2 border-[#eab308] rounded-xl p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.88)]">
        {/* Header + Animated Victory Dance Stage */}
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-5 items-center text-left">
          {/* Choreographed Victory Dance Showcase Stage */}
          <div
            data-testid="victory-dance-stage"
            className="relative h-[242px] rounded-xl overflow-hidden bg-gradient-to-b from-[#2b1f10] via-[#23190d] to-[#140e08] border border-[#d9a441]/60 flex flex-col items-center justify-end pb-2.5"
          >
            {/* Rotating Sunburst Rays behind the dancing champion */}
            <motion.svg
              viewBox="0 0 200 200"
              className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              aria-hidden="true"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <polygon
                  key={i}
                  points="100,100 92,4 108,4"
                  fill={i % 2 === 0 ? '#facc15' : winnerChar.primaryHex}
                  transform={`rotate(${i * 30} 100 100)`}
                />
              ))}
            </motion.svg>

            {/* Floating celebratory musical notes & gold confetti sparkles */}
            <motion.span
              className="absolute top-2.5 left-3.5 text-[#fde047] text-lg font-bold pointer-events-none"
              animate={{ y: [0, -8, 0], rotate: [-10, 12, -10], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              ♪
            </motion.span>
            <motion.span
              className="absolute top-4 right-4 text-[#5eead4] text-lg font-bold pointer-events-none"
              animate={{ y: [0, -10, 0], rotate: [12, -12, 12], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              aria-hidden="true"
            >
              ♫
            </motion.span>
            <motion.span
              className="absolute top-12 left-5 w-2 h-2 rotate-45 bg-[#f97316] pointer-events-none"
              animate={{ y: [0, -12, 2], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="absolute top-11 right-5 w-2 h-2 rotate-45 bg-[#facc15] pointer-events-none"
              animate={{ y: [0, -14, 2], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              aria-hidden="true"
            />

            {/* Dancing Winning Character Portrait inside Ornate Golden Relic Frame */}
            <div className="relative z-10 flex items-end justify-center h-[176px]">
              <motion.div
                className="w-[106px] h-[162px] rounded-lg overflow-hidden border-2 shadow-[0_12px_24px_rgba(0,0,0,0.75)] bg-[#140d08]"
                style={{ borderColor: '#facc15' }}
                animate={{
                  y: isStarJump ? [0, -18, 0] : [0, -12, 0, -8, 0],
                  rotate: isTwirl ? [0, -9, 9, -6, 0] : [-5, 5, -5],
                  scaleX: [1, 0.94, 1.06, 0.97, 1],
                  scaleY: [1, 1.06, 0.94, 1.04, 1],
                }}
                transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CharacterPortrait
                  character={winnerChar}
                  customAsset={customAsset}
                  alt={`${winnerChar.name} performing victory dance`}
                  fit="cover"
                  focus="top"
                  className="w-full h-full"
                />
              </motion.div>
            </div>

            {/* Carved Golden Victory Pedestal */}
            <div className="relative z-0 w-36 h-4 -mt-2 rounded-full bg-gradient-to-r from-[#92400e] via-[#facc15] to-[#92400e] border border-[#fef08a]/80 shadow-md" />
            <div className="relative z-10 mt-1.5 text-[11px] font-bold tracking-wider uppercase text-[#fde68a]">
              {DANCE_MOVES[moveIndex]}
            </div>
          </div>

          {/* Winner Title & Side-by-Side Race Summary */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#eab308]/20 border border-[#facc15] shrink-0">
                <Trophy className="w-5 h-5 text-[#facc15]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#fff8eb] leading-tight">
                  Player {winnerIdx + 1} Wins!
                </h2>
                <p className="text-sm font-semibold text-[#fde68a]">
                  {winner.characterName} reached 3,000 m in{' '}
                  <span className="font-mono-num">{hud.elapsedRaceTime.toFixed(1)}s</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {hud.players.map((p) => {
                const isWin = p.id === winnerIdx;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3.5 border ${
                      isWin
                        ? 'bg-[#2a1f10] border-[#facc15]'
                        : 'bg-[#21170f] border-[#5c452d]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="font-display text-xs font-bold text-[#fff5e1] truncate">
                        P{p.id + 1} · {p.characterName}
                      </span>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          isWin ? 'text-[#facc15]' : 'text-[#cbb694]'
                        }`}
                      >
                        {isWin ? '1st' : '2nd'}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-[#dfd0b8] font-mono-num">
                      <div className="flex justify-between">
                        <span className="font-sans text-[#b9a585]">Distance</span>
                        <span>{p.displayDistance.toLocaleString()} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-[#b9a585]">Riddles</span>
                        <span>
                          {p.triviaCorrectCount} / {p.triviaTotalCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-[#b9a585]">Hits</span>
                        <span>{p.obstaclesHitCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Auto-return to main screen countdown */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-[#d6c3a3] mb-1.5">
            <span>Returning to main screen automatically…</span>
            <span className="font-mono-num font-bold text-[#fde68a]">
              {Math.ceil(hud.celebrationTimer)}s
            </span>
          </div>
          <div className="h-2 bg-[#0e0905] rounded overflow-hidden border border-[#5e472d]">
            <div
              className="h-full bg-[#eab308] origin-left transition-transform duration-100"
              style={{ width: '100%', transform: `scaleX(${countdownRatio})` }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            data-start="true"
            onClick={onRaceAgain}
            className="px-6 py-2.5 text-sm font-bold text-[#1a1108] bg-[#eab308] hover:bg-[#facc15] rounded-md border border-[#fef08a] cursor-pointer whitespace-nowrap"
          >
            Choose Runners Again
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-6 py-2.5 text-sm font-semibold text-[#f8f1e4] bg-[#2a1d13] hover:bg-[#3a281a] border border-[#d9a441]/55 rounded-md cursor-pointer whitespace-nowrap"
          >
            Main Screen Now
          </button>
        </div>
      </div>
    </div>
  );
};
