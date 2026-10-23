import { GreenSurface } from '../src/lib/green';
// Planarity: mean resultant length of downhill unit vectors within 9 m of the hole (1 = a tilted plane).
// Also: share of the area whose fall direction differs >60° from the dominant one.
for (const d of ['mild', 'medium', 'hard'] as const) {
  let R = 0, off = 0, n = 0, maxDeg = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = new GreenSurface(d, seed, 11);
    let sx = 0, sz = 0, c = 0; const dirs: number[] = [];
    for (let x = -9; x <= 9; x += 0.5) for (let z = -9; z <= 9; z += 0.5) {
      if (x * x + z * z > 81) continue;
      const gr = g.gradient(x, z); const m = Math.hypot(gr.dhdx, gr.dhdz);
      if (m < 1e-6) continue;
      sx += gr.dhdx / m; sz += gr.dhdz / m; c++; dirs.push(Math.atan2(gr.dhdz, gr.dhdx));
      maxDeg = Math.max(maxDeg, Math.atan(m) * 180 / Math.PI);
    }
    const r = Math.hypot(sx, sz) / c; R += r;
    const mean = Math.atan2(sz, sx);
    off += dirs.filter(a => Math.abs(Math.atan2(Math.sin(a - mean), Math.cos(a - mean))) > Math.PI / 3).length / c;
    n++;
  }
  console.log(`${d}: planarity ${(R / n).toFixed(2)}  area falling >60° off main direction ${((off / n) * 100).toFixed(0)}%  max slope seen ${maxDeg.toFixed(2)}°`);
}
