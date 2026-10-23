import json, numpy as np, os
names = {"augusta": "Augusta National", "hazeltine": "Hazeltine National", "cog-hill": "Cog Hill", "tpc-sawgrass": "TPC Sawgrass", "pinehurst": "Pinehurst No. 2"}
greens = []
for k in names:
    for g in json.load(open(f"lib_{k}.json")):
        g["courseName"] = names[k]; greens.append(g)
p90 = np.array([p["p90SlopePct"] for g in greens for p in g["pins"]])
t1, t2 = np.percentile(p90, [33.3, 66.7])
t1, t2 = round(float(t1), 1), round(float(t2), 1)
for g in greens:
    for p in g["pins"]:
        p["rating"] = "mild" if p["p90SlopePct"] <= t1 else "medium" if p["p90SlopePct"] <= t2 else "hard"
    n = sum(1 for x in greens if x["course"] == g["course"] and x is not g and greens.index(x) < greens.index(g))
    g["label"] = f"{g['courseName']} — hole {g['hole']}" if (g.get("hole") or "").isdigit() else f"{g['courseName']} — green {n + 1}"
lib = {
  "version": 1,
  "generated": "2026-10-23",
  "about": "Real putting greens. Outlines: OpenStreetMap contributors (ODbL). Elevation: USGS 3DEP (public domain), smoothed 0.6 m. Heights in mm relative to the green's mean, row 0 = south edge, x = east, y = north, metres from the green centroid.",
  "ratingThresholds": {"mildMaxP90SlopePct": t1, "mediumMaxP90SlopePct": t2, "note": "Pin rating = 90th-percentile slope within 7 m of the hole on the green interior; thresholds are tertiles over all pins."},
  "greens": greens,
}
os.makedirs(os.path.expanduser("~/mnt/SquarePutt/public/greens"), exist_ok=True)
json.dump(lib, open(os.path.expanduser("~/mnt/SquarePutt/public/greens/library.json"), "w"), separators=(",", ":"))
from collections import Counter
print("thresholds", t1, t2, "| greens", len(greens), "| pins", len(p90), Counter(p["rating"] for g in greens for p in g["pins"]))
for g in greens: print(f"  {g['label']:<34} {g['areaM2']} m²  relief {g['reliefCm']} cm  pins {''.join(p['rating'][0] for p in g['pins'])}")
print(os.path.getsize(os.path.expanduser('~/mnt/SquarePutt/public/greens/library.json'))//1024, "KB")
