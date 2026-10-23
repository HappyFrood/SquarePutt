import { GreenSurface, readPutt } from '../src/lib/green';
import { simulatePutt, flatDistanceFt, solveIdealStroke, speedForFlatDistanceMph, HOLE_RADIUS_M } from '../src/lib/physicsEngine';

const flat = new GreenSurface('flat', 1, 10);
console.log('--- Flat roll distance vs measured (Cklguy flat-green data, stimp unknown) ---');
const measured: [number, number][] = [[3.27,4],[5.01,9],[7.16,19],[9.01,30],[11.86,52],[14.74,80]];
for (const [mph, ft] of measured) {
  const row = [9,10,11,12].map(s => {
    const r = simulatePutt({ surface: flat, stimp: s, ball: { x: 0, z: -40 } }, { ballSpeedMph: mph, hlaDeg: 0 }, { ignoreCup: true });
    return `st${s}:${r.pathLengthFt.toFixed(1)}`;
  }).join('  ');
  console.log(`${mph} mph  measured ${ft} ft  | ${row} | analytic st10 ${flatDistanceFt(mph,10).toFixed(1)}`);
}
console.log('ft/mph^2 at stimp 10:', flatDistanceFt(1,10).toFixed(3), ' stimp 11:', flatDistanceFt(1,11).toFixed(3));
console.log('Speed for 10/20/30/50 ft @ stimp 11:', [10,20,30,50].map(d=>speedForFlatDistanceMph(d,11).toFixed(2)).join(', '));
const r10 = simulatePutt({ surface: flat, stimp: 11, ball: { x: 0, z: -3 } }, { ballSpeedMph: speedForFlatDistanceMph(11.4, 11), hlaDeg: 0 });
console.log(`10ft straight putt dying 17in past: holed=${r10.isHoled} entry=${r10.cupEntrySpeedMps?.toFixed(2)}m/s skid=${r10.skidDistanceIn.toFixed(1)}in (${r10.skidTimeMs}ms) dur=${r10.durationS.toFixed(2)}s`);

console.log('--- Capture: dead-centre max speed ---');
for (const mph of [2.5, 3.4, 3.6, 3.8, 4.5]) {
  // start close so the ball arrives at about launch speed after skid
  const r = simulatePutt({ surface: flat, stimp: 11, ball: { x: 0, z: -0.3 } }, { ballSpeedMph: mph, hlaDeg: 0, backspinRpm: -999 });
  console.log(`${mph} mph -> entry ${r.cupEntrySpeedMps?.toFixed(2)} m/s holed=${r.isHoled} lip=${r.lipOut}`);
}
console.log('--- Edge entry (ball center 4cm off line, 6ft putt) ---');
for (const mph of [2.2, 2.6, 3.0]) {
  const D = 1.83;
  const hla = Math.atan(0.04 / D) * 180 / Math.PI;
  const r = simulatePutt({ surface: flat, stimp: 11, ball: { x: 0, z: -D } }, { ballSpeedMph: mph, hlaDeg: hla });
  console.log(`${mph} mph holed=${r.isHoled} lipOut=${r.lipOut} leave=${r.leaveFt.toFixed(2)}ft entry=${r.cupEntrySpeedMps?.toFixed(2)}`);
}

console.log('--- Green slope statistics (play area) ---');
for (const d of ['mild','medium','hard'] as const) {
  const maxes: number[] = []; const holes: number[] = []; const arch: Record<string, number> = {};
  for (let seed = 1; seed <= 200; seed++) {
    const g = new GreenSurface(d, seed, 11);
    maxes.push(g.descriptor.maxSlopeDeg); holes.push(g.descriptor.holeSlopePct);
    arch[g.archetype] = (arch[g.archetype]||0)+1;
    // true max slope in play area
  }
  let trueMax = 0; const g = new GreenSurface(d, 7, 11);
  for (let x=-16;x<=16;x+=0.25) for (let z=-16;z<=16;z+=0.25) if (x*x+z*z<256) trueMax=Math.max(trueMax, g.slopePct(x,z));
  console.log(`${d}: target max ${Math.min(...maxes).toFixed(2)}-${Math.max(...maxes).toFixed(2)} deg, hole slope ${Math.min(...holes).toFixed(2)}-${Math.max(...holes).toFixed(2)}%, seed7 abs max ${(Math.atan(trueMax/100)*180/Math.PI).toFixed(2)} deg`, arch);
}

console.log('--- Ideal-line solver on sloped greens ---');
let fails = 0; let n = 0; let made = 0;
const t0 = Date.now();
for (const d of ['mild','medium','hard'] as const) for (let seed = 1; seed <= 15; seed++) for (const ft of [6, 15, 30]) {
  const g = new GreenSurface(d, seed, 11);
  const ang = (seed * 1.7) % (Math.PI*2);
  const D = ft * 0.3048;
  const ball = { x: Math.sin(ang)*D, z: -Math.cos(ang)*D };
  const setup = { surface: g, stimp: 11, ball };
  const ideal = solveIdealStroke(setup);
  const r = simulatePutt(setup, { ballSpeedMph: ideal.ballSpeedMph, hlaDeg: ideal.hlaDeg });
  n++; if (!ideal.converged) fails++; if (r.isHoled) made++;
  if (seed <= 2) { const rd = readPutt(g, ball); console.log(`${d} s${seed} ${ft}ft: aim ${ideal.aimOffsetIn.toFixed(1)}in, ${ideal.ballSpeedMph.toFixed(2)}mph (flat ${speedForFlatDistanceMph(ft+1.4,11).toFixed(2)}), holed=${r.isHoled}, read: ${rd.slopeLabel} ${rd.elevationChangeIn.toFixed(1)}in, ${rd.breakLabel} ${rd.sideSlopePct.toFixed(2)}%`); }
}
console.log(`solver: ${n-fails}/${n} converged, ${made}/${n} holed, avg ${( (Date.now()-t0)/n).toFixed(0)} ms/solve`);
console.log('hole radius', HOLE_RADIUS_M);
