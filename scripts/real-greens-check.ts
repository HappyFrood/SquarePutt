import { readFileSync } from 'node:fs';
import { GreenLibrary, RealGreenSurface, placeBallOnGreen } from '../src/lib/realGreens';
import { solveIdealStroke, simulatePutt } from '../src/lib/physicsEngine';
import { readPutt } from '../src/lib/green';
const lib: GreenLibrary = JSON.parse(readFileSync('public/greens/library.json', 'utf8'));
let n = 0, conv = 0, holed = 0, short = 0, t = 0;
const byRating: Record<string, { aim: number[]; side: number[] }> = { mild: { aim: [], side: [] }, medium: { aim: [], side: [] }, hard: { aim: [], side: [] } };
for (const g of lib.greens) g.pins.forEach((p, i) => {
  const s = new RealGreenSurface(g, i, 11, 1);
  for (const ft of [6, 15, 30]) {
    const ball = placeBallOnGreen(s, ft, (i * 1.3 + ft) % 6.28);
    const d = Math.hypot(ball.x, ball.z) * 3.28084;
    if (d < ft - 0.5) short++;
    const t0 = performance.now();
    const ideal = solveIdealStroke({ surface: s, stimp: 11, ball });
    t += performance.now() - t0;
    const r = simulatePutt({ surface: s, stimp: 11, ball }, { ballSpeedMph: ideal.ballSpeedMph, hlaDeg: ideal.hlaDeg });
    n++; if (ideal.converged) conv++; if (r.isHoled) holed++;
    byRating[p.rating].aim.push(Math.abs(ideal.aimOffsetIn) / ft);
    byRating[p.rating].side.push(Math.abs(readPutt(s, ball).sideSlopePct));
  }
});
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`putts ${n}: solver converged ${conv}, ideal stroke holed ${holed}, shortened (green too small) ${short}, avg solve ${(t / n).toFixed(0)} ms`);
for (const [k, v] of Object.entries(byRating)) console.log(`${k}: avg aim offset ${avg(v.aim).toFixed(2)} in per ft of putt, avg cross-slope ${avg(v.side).toFixed(2)}%`);
