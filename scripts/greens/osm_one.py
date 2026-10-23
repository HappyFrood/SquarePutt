import json, urllib.request, urllib.parse, sys
key, name = sys.argv[1], sys.argv[2]
out = json.load(open("osm_full.json"))
q = f'[out:json][timeout:100];nwr["leisure"="golf_course"]["name"~"{name}"]({sys.argv[3]})->.c;.c out geom tags;.c map_to_area->.a;way(area.a)["golf"="green"];out geom tags;'
req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "SquarePutt/2 (green import)"})
d = json.load(urllib.request.urlopen(req, timeout=150))
out[key] = d["elements"]
json.dump(out, open("osm_full.json", "w"))
print(key, "greens", sum(1 for e in d["elements"] if e.get("tags",{}).get("golf")=="green"), "course ways", sum(1 for e in d["elements"] if e.get("tags",{}).get("leisure")=="golf_course"))
