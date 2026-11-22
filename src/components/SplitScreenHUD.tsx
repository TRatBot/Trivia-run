import React from 'react';
import { Pause, Usb, Volume2, VolumeX } from 'lucide-react';
import { getCharacterById } from '../game/data';
import {
  CharacterId,
  CustomCharacterAsset,
  HudPlayerSnapshot,
  HudSnapshot,
  PlayerId,
} from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';

interface SplitScreenHUDProps {
  hud: HudSnapshot;
  customAssets: Partial<Record<CharacterId, CustomCharacterAsset>>;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenArduino: () => void;
  onTriviaAnswer: (playerId: PlayerId, choiceIndex: 0 | 1 | 2) => void;
}

export const SplitScreenHUD: React.FC<SplitScreenHUDProps> = ({
  hud,
  customAssets,
  muted,
  onToggleMute,
  onPause,
  onOpenArduino,
  onTriviaAnswer,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      {/* Vertical Center Seam dividing P1 (Left) and P2 (Right) */}
      <div
        className="fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-[#d9a441]/85 shadow-[0_0_12px_rgba(18,12,6,0.9)]"
        aria-hidden="true"
      />

      {/* Top-Center Compact Utility Icon Cluster */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-[#1b130c]/95 border border-[#d9a441]/60 rounded-lg p-1 pointer-events-auto shadow-lg">
        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          title="Mute / Unmute (M)"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-8 h-8 flex items-center justify-center rounded text-[#f8f1e4] hover:bg-[#322316] cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#f87171]" /> : <Volume2 className="w-4 h-4 text-[#fde047]" />}
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause race"
          title="Pause (Esc or P)"
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="w-8 h-8 flex items-center justify-center rounded text-[#f8f1e4] hover:bg-[#322316] cursor-pointer"
        >
          <Pause className="w-4 h-4 text-[#f8f1e4]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Arduino controller settings"
          title="Arduino Setup"
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenArduino();
          }}
          className="w-8 h-8 flex items-center justify-center rounded text-[#f8f1e4] hover:bg-[#322316] cursor-pointer"
        >
          <Usb className="w-4 h-4 text-[#2dd4bf]" />
        </button>
      </div>

      {/* Left & Right Independent Player Viewport HUDs */}
      <div className="grid grid-cols-2 w-full h-full">
        {([0, 1] as PlayerId[]).map((pId) => {
          const otherId: PlayerId = pId === 0 ? 1 : 0;
          const isLeading = hud.players[pId].displayDistance >= hud.players[otherId].displayDistance;
          const isTied = hud.players[pId].displayDistance === hud.players[otherId].displayDistance;
          return (
            <PlayerPaneHUD
              key={pId}
              player={hud.players[pId]}
              customAsset={customAssets[hud.players[pId].characterId]}
              rankLabel={isTied ? 'TIED' : isLeading ? '1ST' : '2ND'}
              triviaTriggers={hud.triviaTriggers}
              onTriviaAnswer={onTriviaAnswer}
            />
          );
        })}
      </div>
    </div>
  );
};

interface PlayerPaneHUDProps {
  player: HudPlayerSnapshot;
  customAsset?: CustomCharacterAsset;
  rankLabel: '1ST' | '2ND' | 'TIED';
  triviaTriggers: number[];
  onTriviaAnswer: (playerId: PlayerId, choiceIndex: 0 | 1 | 2) => void;
}

const PlayerPaneHUD: React.FC<PlayerPaneHUDProps> = ({
  player,
  customAsset,
  rankLabel,
  triviaTriggers,
  onTriviaAnswer,
}) => {
  const isLeft = player.id === 0;
  const charDef = getCharacterById(player.characterId);
  const moveHint = isLeft
    ? 'A / D Lanes · W Jump · S Select'
    : '← / → Lanes · ↑ Jump · ↓ / Enter Select';

  return (
    <div
      className="relative h-full flex flex-col justify-between p-2 sm:p-4"
      data-testid={`player-hud-${player.id}`}
    >
      {/* Top Perimeter Status Cluster (responsive: sits below utility bar on narrow mobile, beside it on desktop) */}
      <div className={`flex flex-col gap-1.5 pt-11 md:pt-0 ${isLeft ? 'md:pr-16' : 'md:pl-16'}`}>
        <div className="bg-[#1b130c]/92 border border-[#d9a441]/55 rounded-lg px-2.5 sm:px-3.5 py-2 sm:py-2.5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div
                className="w-6 h-6 sm:w-7 sm:h-7 rounded overflow-hidden shrink-0 border"
                style={{ borderColor: player.primaryHex }}
              >
                <CharacterPortrait
                  character={charDef}
                  customAsset={customAsset}
                  fit="cover"
                  focus="top"
                  className="w-full h-full"
                />
              </div>
              <span className="font-display text-xs sm:text-sm font-bold text-[#fff5e1] truncate">
                P{player.id + 1} · {charDef.name}
                <span className="hidden lg:inline"> · {charDef.title}</span>
              </span>
              <span
                className={`font-mono-num text-[11px] sm:text-xs font-bold shrink-0 ${
                  rankLabel === '1ST' ? 'text-[#facc15]' : 'text-[#cbb694]'
                }`}
              >
                · {rankLabel}
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-[#d6c3a3] hidden lg:inline shrink-0">
                · {Math.min(player.nextTriviaIndex, triviaTriggers.length)}/{triviaTriggers.length} Riddles
              </span>
            </div>

            <div className="flex items-baseline justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
              <div className="text-left sm:text-right whitespace-nowrap">
                <span className="font-mono-num text-sm sm:text-xl font-bold text-[#facc15]">
                  {player.displayDistance.toLocaleString()}
                </span>
                <span className="font-mono-num text-[10px] sm:text-xs text-[#cbb694] ml-0.5 sm:ml-1">
                  / {player.targetDisplayMeters.toLocaleString()} m
                </span>
              </div>

              <div
                className={`font-mono-num text-xs sm:text-sm font-bold whitespace-nowrap ${
                  player.isSlowed ? 'text-[#f87171]' : 'text-[#5eead4]'
                }`}
              >
                {player.speed.toFixed(1)} m/s
              </div>
            </div>
          </div>

          {/* 3,000 m Progress Bar with Trivia Monster Milestone Ticks */}
          <div className="relative mt-2 h-2.5 bg-[#0f0a06] rounded-sm overflow-hidden border border-[#5e472d]">
            <div
              className="h-full transition-transform duration-100 origin-left"
              style={{
                width: '100%',
                transform: `scaleX(${Math.max(0.01, player.progress)})`,
                backgroundColor: player.isSlowed ? '#ef4444' : player.primaryHex,
              }}
            />
            {triviaTriggers.map((m) => {
              const pct = (m / player.targetDisplayMeters) * 100;
              return (
                <div
                  key={m}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#fde047]/80"
                  style={{ left: `${pct}%` }}
                  aria-hidden="true"
                />
              );
            })}
          </div>

          {/* Speed Penalty Recovery Indicator (only shown during 2.0s recovery after obstacle or broken-path hit) */}
          {player.isSlowed && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-[#fca5a5]">
              <span>Hazard Hit · Recovering to {player.baseSpeed.toFixed(1)} m/s</span>
              <span className="font-mono-num">
                {Math.round(player.slowRecoveryFraction * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Non-blocking Ancient Monster Praise Banner on Correct Answer */}
        {player.praiseBanner && !player.activeTrivia && (
          <div
            role="status"
            className="bg-[#0e352e]/95 border border-[#2dd4bf] rounded-lg px-4 py-2.5 shadow-xl"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5eead4]">
              {player.praiseBanner.monsterName} cheers
            </div>
            <p className="text-sm font-semibold text-[#f0fdfa] leading-snug mt-0.5">
              “{player.praiseBanner.line}”
            </p>
          </div>
        )}
      </div>

      {/* Per-Player Trivia Monster Encounter Panel (ONLY on this paused player's half!) */}
      {player.activeTrivia && (
        <div
          role="dialog"
          aria-label={`Player ${player.id + 1} trivia monster encounter`}
          data-testid={`trivia-panel-${player.id}`}
          className="pointer-events-auto mx-auto w-full max-w-[540px] bg-[#1b120b]/96 border-2 border-[#eab308] rounded-xl p-5 shadow-[0_14px_40px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#fde68a] mb-1.5">
            <span>{player.activeTrivia.monster.name} blocks thy path!</span>
            <span className="font-mono-num">
              Riddle {player.activeTrivia.encounterIndex + 1} / {triviaTriggers.length} ·{' '}
              {player.activeTrivia.triggerDisplayMeters.toLocaleString()} m
            </span>
          </div>

          <h3 className="text-lg font-bold text-[#fff8eb] leading-snug mb-4">
            {player.activeTrivia.question.prompt}
          </h3>

          {player.activeTrivia.outcome === 'asking' ? (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                {player.activeTrivia.question.choices.map((choice, idx) => {
                  const selected = player.activeTrivia!.selectedChoice === idx;
                  const choiceIdx = idx as 0 | 1 | 2;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onTriviaAnswer(player.id, choiceIdx)}
                      className={`px-3 py-3 rounded-lg border-2 text-sm font-bold text-center transition-transform cursor-pointer ${
                        selected
                          ? 'bg-[#eab308] text-[#1a1108] border-[#fef08a] scale-[1.03]'
                          : 'bg-[#2a1d13] text-[#f5ead6] border-[#6b5134] hover:border-[#d9a441]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-center text-[#d6c3a3]">
                {isLeft
                  ? 'A / D highlight choice · S or F confirm'
                  : '← / → highlight choice · ↓ or Enter confirm'}
              </p>
            </>
          ) : (
            <div className="bg-[#3b1515]/95 border border-[#f87171] rounded-lg p-3.5 text-center">
              <p className="text-sm font-semibold text-[#fecaca]">
                “{player.activeTrivia.quip}”
              </p>
              <p className="text-xs text-[#fde68a] mt-1.5">
                Correct answer:{' '}
                <strong className="text-white">
                  {
                    player.activeTrivia.question.choices[
                      player.activeTrivia.question.correctIndex
                    ]
                  }
                </strong>
              </p>
              <div className="mt-2.5 font-mono-num text-2xl font-bold text-[#fca5a5]">
                Resuming in {player.activeTrivia.penaltyRemaining.toFixed(1)}s
              </div>
              <div className="mt-2 h-2 bg-[#1c0a0a] rounded overflow-hidden">
                <div
                  className="h-full bg-[#ef4444] origin-left transition-transform duration-100"
                  style={{
                    width: '100%',
                    transform: `scaleX(${Math.max(
                      0,
                      player.activeTrivia.penaltyRemaining / 5.0,
                    )})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Crisp High-Contrast Bottom Control Hint per Player */}
      <div className="flex justify-center">
        <span className="px-3.5 py-1 rounded bg-[#16100a]/85 border border-[#d9a441]/35 text-xs font-semibold text-[#fff5e1] tracking-wide">
          {moveHint}
        </span>
      </div>
    </div>
  );
};
