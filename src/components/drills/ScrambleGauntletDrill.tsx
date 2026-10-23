'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PuttingShotData, SlopeDifficulty } from '@/lib/types';
import { calculateStrokesGained, calculateCepInches } from '@/lib/calculations';
import { updateDrillBests } from '@/lib/storage';
import { Shuffle, Trophy, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface ScrambleGauntletDrillProps {
  currentShot: PuttingShotData | null;
  onSetEnvironment: (params: {
    targetDistanceFt: number;
    slopeDifficulty: SlopeDifficulty;
    terrainSeed: number;
  }) => void;
}

export const ScrambleGauntletDrill: React.FC<ScrambleGauntletDrillProps> = ({
  currentShot,
  onSetEnvironment,
}) => {
  const TOTAL_HOLES = 9;
  const [holeNumber, setHoleNumber] = useState(1);
  const [currentDistanceFt, setCurrentDistanceFt] = useState(12.0);
  const [currentSlope, setCurrentSlope] = useState<SlopeDifficulty>('medium');

  const [totalStrokesGained, setTotalStrokesGained] = useState(0.0);
  const [deviations, setDeviations] = useState<{ xInches: number; zInches: number }[]>([]);
  const [scorecard, setScorecard] = useState<
    {
      hole: number;
      distanceFt: number;
      slope: SlopeDifficulty;
      isHoled: boolean;
      insideGimme: boolean;
      missDistanceFt: number;
      sg: number;
    }[]
  >([]);
  const [, setLastShotId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Dynamic gimme radius scales with distance:
  // e.g. 6ft -> 1.5ft gimme, 20ft -> 2.5ft gimme, 40ft -> 3.8ft gimme
  const gimmeRadiusFt = Number(
    Math.min(3.8, Math.max(1.5, currentDistanceFt * 0.1 + 0.8)).toFixed(1)
  );

  // Generate a new random hole (distance 6ft to 40ft, slope mild to hard)
  const generateHole = useCallback(() => {
    const slopes: SlopeDifficulty[] = ['mild', 'medium', 'hard'];
    const randomDist = Number((6 + Math.random() * 32).toFixed(1));
    const randomSlope = slopes[Math.floor(Math.random() * slopes.length)];
    const seed = Math.floor(Math.random() * 99999);

    setCurrentDistanceFt(randomDist);
    setCurrentSlope(randomSlope);

    onSetEnvironment({
      targetDistanceFt: randomDist,
      slopeDifficulty: randomSlope,
      terrainSeed: seed,
    });
  }, [onSetEnvironment]);

  // Initialize first hole
  useEffect(() => {
    const timer = setTimeout(() => {
      generateHole();
    }, 0);
    return () => clearTimeout(timer);
  }, [generateHole]);

  // Process shot in the Gauntlet
  useEffect(() => {
    if (!currentShot) return;
    const timer = setTimeout(() => {
      setLastShotId((prevId) => {
        if (prevId === currentShot.id || isCompleted) return prevId;

        // Compute remaining distance to hole
        const lateralFt = (currentShot.lateralErrorInches || 0) / 12;
        const distanceErrorFt = currentShot.distanceErrorFt || 0;
        const missDistanceFt = Math.sqrt(lateralFt * lateralFt + distanceErrorFt * distanceErrorFt);

        const isHoled = currentShot.isHoled;
        const insideGimme = isHoled || missDistanceFt <= gimmeRadiusFt;

        // Calculate Strokes Gained: Putting
        const sg = calculateStrokesGained({
          startDistanceFt: currentDistanceFt,
          isHoled,
          remainingDistanceFt: isHoled ? 0 : missDistanceFt,
        });

        const newTotalSg = Number((totalStrokesGained + sg).toFixed(2));
        setTotalStrokesGained(newTotalSg);

        // Record 2D deviation for CEP
        const dev = {
          xInches: currentShot.lateralErrorInches,
          zInches: currentShot.distanceErrorFt * 12,
        };
        const updatedDevs = [...deviations, dev];
        setDeviations(updatedDevs);

        // Record on scorecard
        const entry = {
          hole: holeNumber,
          distanceFt: currentDistanceFt,
          slope: currentSlope,
          isHoled,
          insideGimme,
          missDistanceFt: Number(missDistanceFt.toFixed(1)),
          sg,
        };
        setScorecard((prev) => [...prev, entry]);

        if (holeNumber < TOTAL_HOLES) {
          setHoleNumber((prev) => prev + 1);
          generateHole();
        } else {
          setIsCompleted(true);
          const cep = calculateCepInches(updatedDevs);
          updateDrillBests({
            scrambleGauntlet: {
              highestStrokesGained: newTotalSg,
              lowestCepInches: cep,
              lastUpdated: Date.now(),
            },
          });
        }
        return currentShot.id;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    currentShot,
    isCompleted,
    holeNumber,
    currentDistanceFt,
    gimmeRadiusFt,
    currentSlope,
    totalStrokesGained,
    deviations,
    generateHole,
  ]);

  const restartGauntlet = () => {
    setHoleNumber(1);
    setTotalStrokesGained(0);
    setDeviations([]);
    setScorecard([]);
    setIsCompleted(false);
    generateHole();
  };

  const cepInches = calculateCepInches(deviations);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="sp-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-slate-100">
              The Scramble (Gauntlet Challenge)
            </h2>
            <span className="sp-badge-green">RANDOM PUTTS</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            9-Hole Gauntlet with randomized distance (6-40ft) and slope undulations. 1 putt per hole — test your adaptability and read!
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400">Hole Progress:</span>
          <span className="sp-mono font-bold text-emerald-400 text-sm">
            {holeNumber} / {TOTAL_HOLES}
          </span>
        </div>
      </div>

      {/* Gauntlet Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Hole & Distance */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Current Hole</span>
            <span className="capitalize text-emerald-400 font-semibold">{currentSlope} break</span>
          </div>
          <div className="my-2">
            <span className="sp-mono text-4xl font-black text-slate-100">
              {currentDistanceFt.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 ml-1">FT</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Gimme Circle: <strong className="text-sky-300">±{gimmeRadiusFt} ft</strong>
          </div>
        </div>

        {/* Strokes Gained: Putting */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Strokes Gained</span>
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span
              className={`sp-mono text-3xl font-black ${
                totalStrokesGained >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {totalStrokesGained >= 0
                ? `+${totalStrokesGained.toFixed(2)}`
                : totalStrokesGained.toFixed(2)}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              vs. PGA Tour Baseline
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            {totalStrokesGained > 0.5 ? 'Elite Putting' : 'Tour Average'}
          </div>
        </div>

        {/* CEP (Circular Error Probable) */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Dispersion (CEP)</span>
            <span className="text-xs text-purple-400 font-bold">50% Rad</span>
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-purple-400">
              {cepInches.toFixed(1)}″
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Median Miss Radius
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            PGA Tour 20ft: ~22″
          </div>
        </div>

        {/* Gimme / Make Success Rate */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Gimme Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-sky-400">
              {scorecard.length > 0
                ? `${Math.round(
                    (scorecard.filter((h) => h.insideGimme).length / scorecard.length) * 100
                  )}%`
                : '0%'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {scorecard.filter((h) => h.insideGimme).length} / {scorecard.length} on target
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            Holed: {scorecard.filter((h) => h.isHoled).length}
          </div>
        </div>
      </div>

      {/* Scorecard Table */}
      <div className="sp-card p-4">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">
          Gauntlet Scorecard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                <th className="pb-2 pl-2">Hole</th>
                <th className="pb-2">Distance</th>
                <th className="pb-2">Slope</th>
                <th className="pb-2">Remaining</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 pr-2 text-right">Strokes Gained</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {scorecard.map((h) => (
                <tr key={h.hole} className="hover:bg-slate-800/30">
                  <td className="py-2 pl-2 text-slate-400">#{h.hole}</td>
                  <td className="py-2 text-slate-200">{h.distanceFt} ft</td>
                  <td className="py-2 capitalize text-slate-400">{h.slope}</td>
                  <td className="py-2 text-slate-300">
                    {h.isHoled ? '0.0 ft' : `${h.missDistanceFt} ft`}
                  </td>
                  <td className="py-2">
                    {h.isHoled ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> HOLED
                      </span>
                    ) : h.insideGimme ? (
                      <span className="text-sky-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> GIMME
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> MISSED GIMME
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right font-bold ${
                      h.sg >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {h.sg >= 0 ? `+${h.sg.toFixed(2)}` : h.sg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="sp-card p-5 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Gauntlet Challenge Completed!</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Final Strokes Gained:{' '}
              <strong className="text-emerald-400">
                {totalStrokesGained >= 0
                  ? `+${totalStrokesGained.toFixed(2)}`
                  : totalStrokesGained.toFixed(2)}
              </strong>{' '}
              | Median Miss: <strong className="text-purple-300">{cepInches.toFixed(1)}″</strong>
            </p>
          </div>
          <button onClick={restartGauntlet} className="sp-btn-primary">
            <RotateCcw className="w-4 h-4 mr-1" />
            <span>Play Again</span>
          </button>
        </div>
      )}
    </div>
  );
};
