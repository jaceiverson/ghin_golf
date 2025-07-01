import json

from ghin.ghin import GHIN

g = GHIN()
with open("raw_handicap_spreads.json", "r") as f:
    handicap_spreads = json.load(f)
g.format_handicap_spread(handicap_spreads)
