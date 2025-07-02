import json

from ghin.ghin import GHIN

### Multiple golfers
# with open("g.json", "r") as f:
with open("golfers.json", "r") as f:
    golfers = json.load(f)

handicap_spreads = {}
for golfer, ghin_num in golfers.items():
    try:
        g = GHIN(ghin_num)
    except Exception as e:
        print(f"Error getting handicap spread for {golfer}: {e}")
        continue
    hs = g.get_handicap_spread()
    handicap_spreads[golfer] = hs
    print(f"{golfer}:{g.ghin_number}: {g.handicap} {hs}")

g.format_handicap_spread(handicap_spreads)
