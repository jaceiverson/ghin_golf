import datetime as dt
import json
import sys

sys.path.append("src")

from dotenv import load_dotenv
from ghin.ghin import GHIN
from rich import print

load_dotenv()

### Single golfer
g = GHIN(8803041)

hs = g.get_handicap_spread()
g.format_handicap_spread({"jace": hs})

### Multiple golfers
with open("golfers.json", "r") as f:
    golfers = json.load(f)

handicap_spreads = {}
for golfer, ghin_num in golfers.items():
    g = GHIN(ghin_num)
    hs = g.get_handicap_spread()
    handicap_spreads[golfer] = hs
    print(f"{golfer}:{g.ghin_number}: {g.handicap}")

with open(f"raw_handicap_spreads{dt.datetime.now().isoformat()}.json", "w") as f:
    json.dump(handicap_spreads, f, indent=4)

g.format_handicap_spread(handicap_spreads)
anon_hs = {f"golfer_{i}": hs for i, hs in enumerate(handicap_spreads.values())}
g.format_handicap_spread(anon_hs)
