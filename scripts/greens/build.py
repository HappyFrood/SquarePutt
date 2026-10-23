"""Build SquarePutt real-green library entries for one course from OSM outlines + USGS 3DEP elevation."""
import json, sys, io, base64, math, urllib.request, urllib.parse
import numpy as np, tifffile
from pyproj import Transformer
from shapely.geometry import Polygon, Point
from scipy.ndimage import gaussian_filter

SVC = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
RES = 0.5          # m per cell
MARGIN = 9.0       # m of surrounds kept around the green
SMOOTH = 0.6       # m, gaussian sigma to remove lidar noise
PIN_EDGE = 3.5     # m minimum from green edge
PIN_MAX_SLOPE = 3.0  # % at the hole
PIN_SEP = 4.5      # m between pins
RATE_R = 7.0       # m radius of the putting area used to rate a pin
NPINS = 7

key, course_name, keep_n = sys.argv[1], sys.argv[2], int(sys.argv[3])
src_note = sys.argv[4] if len(sys.argv) > 4 else "USGS 3DEP lidar (1 m)"
osm = json.load(open("osm_full.json"))[key]

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "SquarePutt/2"}), timeout=120).read()

courses = [Polygon([(p["lon"], p["lat"]) for p in e["geometry"]]) for e in osm
           if e.get("tags", {}).get("leisure") == "golf_course" and course_name.lower() in e["tags"].get("name", "").lower() and "geometry" in e]
greens = [e for e in osm if e.get("tags", {}).get("golf") == "green" and "geometry" in e and len(e["geometry"]) > 6]
if courses:
    greens = [g for g in greens if any(c.contains(Point(np.mean([p["lon"] for p in g["geometry"]]), np.mean([p["lat"] for p in g["geometry"]]))) for c in courses)]

lon0 = np.mean([p["lon"] for g in greens for p in g["geometry"]])
epsg = 32600 + int((lon0 + 180) // 6) + 1
tr = Transformer.from_crs(4326, epsg, always_xy=True)

cands = []
for g in greens:
    tags = g.get("tags", {})
    if any(w in (tags.get("name", "") + tags.get("description", "")).lower() for w in ("practice", "putting")):
        continue
    xy = np.array([tr.transform(p["lon"], p["lat"]) for p in g["geometry"]])
    poly = Polygon(xy)
    if not poly.is_valid or not (380 <= poly.area <= 1150):
        continue
    cands.append((g, xy, poly))
print(f"{key}: {len(greens)} greens in course, {len(cands)} candidates", flush=True)

results = []
# prefer greens tagged with a hole number (main course)
    
cands.sort(key=lambda t: 0 if (t[0].get('tags', {}).get('ref') or '').isdigit() else 1)
for g, xy, poly in cands[: keep_n * 3]:
    c = poly.centroid
    minx, miny, maxx, maxy = poly.bounds
    minx, miny, maxx, maxy = minx - MARGIN, miny - MARGIN, maxx + MARGIN, maxy + MARGIN
    nx, ny = int((maxx - minx) / RES), int((maxy - miny) / RES)
    maxx, maxy = minx + nx * RES, miny + ny * RES
    url = SVC + "/exportImage?" + urllib.parse.urlencode({"bbox": f"{minx},{miny},{maxx},{maxy}", "bboxSR": epsg, "imageSR": epsg,
          "size": f"{nx},{ny}", "format": "tiff", "pixelType": "F32", "interpolation": "RSP_BilinearInterpolation", "f": "image"})
    try:
        z = tifffile.imread(io.BytesIO(get(url))).astype(np.float64)
    except Exception as e:
        print("  fetch failed", e, flush=True); continue
    if z.shape != (ny, nx) or np.any(z < -1000) or np.any(~np.isfinite(z)):
        print("  bad raster", z.shape, flush=True); continue
    z = np.flipud(z)  # row 0 = south
    z = gaussian_filter(z, SMOOTH / RES, mode="nearest")
    # local frame: origin at green centroid, x east, y north
    ox, oy = minx - c.x, miny - c.y
    gy, gx = np.gradient(z, RES)
    slope = np.hypot(gx, gy) * 100
    xs = ox + (np.arange(nx) + 0.5) * RES
    ys = oy + (np.arange(ny) + 0.5) * RES
    X, Y = np.meshgrid(xs, ys)
    lpoly = Polygon(xy - [c.x, c.y])
    inside = np.array([lpoly.contains(Point(px, py)) for px, py in zip(X.ravel(), Y.ravel())]).reshape(ny, nx)
    core = lpoly.buffer(-PIN_EDGE)
    interior = lpoly.buffer(-2.5)  # OSM outlines often include part of the surrounding bank
    inner = np.array([interior.contains(Point(px, py)) for px, py in zip(X.ravel(), Y.ravel())]).reshape(ny, nx) if not interior.is_empty else inside
    med = float(np.median(slope[inner])) if inner.any() else 99
    if med > 3.5:
        print(f"  skip {g['id']}: median slope {med:.1f}% is not a putting surface (or outline misaligned)", flush=True); continue
    if core.is_empty:
        continue
    # pin candidates
    k = max(1, int(round(0.75 / RES)))
    from scipy.ndimage import uniform_filter
    slope_hole = uniform_filter(slope, size=2 * k + 1)
    cand = [(X[j, i], Y[j, i], slope_hole[j, i]) for j in range(0, ny, 2) for i in range(0, nx, 2)
            if slope_hole[j, i] <= PIN_MAX_SLOPE and core.contains(Point(X[j, i], Y[j, i]))]
    if len(cand) < 4:
        print("  too few fair pin spots", flush=True); continue
    rng = np.random.default_rng(len(results) + 7)
    pins = [cand[rng.integers(len(cand))]]
    while len(pins) < NPINS:
        dmin = [min(math.hypot(a[0] - p[0], a[1] - p[1]) for p in pins) for a in cand]
        best = int(np.argmax(dmin))
        if dmin[best] < PIN_SEP: break
        pins.append(cand[best])
    edge = np.array(lpoly.exterior.coords)
    pin_out = []
    for px, py, sh in pins:
        disc = inner & ((X - px) ** 2 + (Y - py) ** 2 <= RATE_R ** 2)
        s = slope[disc]
        p90 = float(np.percentile(s, 90))
        rating = "mild" if p90 <= 2.2 else "medium" if p90 <= 3.2 else "hard"
        far = float(np.max(np.hypot(edge[:, 0] - px, edge[:, 1] - py))) * 3.28084
        pin_out.append({"x": round(px, 2), "y": round(py, 2), "rating": rating, "p90SlopePct": round(p90, 2),
                        "meanSlopePct": round(float(s.mean()), 2), "holeSlopePct": round(float(sh), 2), "longestPuttFt": round(far)})
    zrel = z - z[inside].mean()
    simple = lpoly.simplify(0.25)
    results.append({
        "id": f"{key}-{g.get('tags', {}).get('ref') or g['id']}",
        "course": key, "hole": g.get("tags", {}).get("ref"), "osmId": g["id"],
        "areaM2": round(lpoly.area), "cell": RES, "nx": nx, "ny": ny, "x0": round(ox, 3), "y0": round(oy, 3),
        "heightsMm": base64.b64encode(np.clip(np.round(zrel * 1000), -32767, 32767).astype("<i2").tobytes()).decode(),
        "outline": [[round(a, 2), round(b, 2)] for a, b in simple.exterior.coords],
        "reliefCm": round(float(np.ptp(z[inside])) * 100, 1),
        "p90SlopePct": round(float(np.percentile(slope[inner], 90)), 2),
        "medianSlopePct": round(med, 2),
        "pins": pin_out, "source": src_note,
    })
    print(f"  green {results[-1]['id']}: {lpoly.area:.0f} m², relief {results[-1]['reliefCm']} cm, p90 {results[-1]['p90SlopePct']}%, pins {[p['rating'][0] for p in pin_out]}", flush=True)

# keep a varied subset: spread across steepness
results.sort(key=lambda r: r["p90SlopePct"])
if len(results) > keep_n:
    idx = np.unique(np.round(np.linspace(0, len(results) - 1, keep_n)).astype(int))
    results = [results[i] for i in idx]
json.dump(results, open(f"lib_{key}.json", "w"))
print(f"{key}: kept {len(results)} greens", flush=True)
