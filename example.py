import datetime as dt
import json
import sys

sys.path.append("src")

from dotenv import load_dotenv
from rich import print

from ghin.ghin import GHIN

load_dotenv()

### Single golfer
# jace
g = GHIN(1104482)
# paden
g = GHIN(1367387)

# remuda
course = 14062
course_details = g.get_course_details(course)
course_handicaps = g.get_course_handicaps(course)
print(course_details)
print(course_handicaps)

all_hist = g.get_handicap_history()
all_scores = g.get_scores_history()
handicap_vals = [
    {
        "date": dt.datetime.strptime(x["RevDate"], "%Y-%m-%dT%H:%M:%S").date(),
        "value": float(x["Value"]),
    }
    for x in all_hist["handicap_revisions"]
]
print(handicap_vals)
score_vals = [
    {
        "date": dt.datetime.strptime(x["played_at"], "%Y-%m-%d").date(),
        "number_of_holes": x["number_of_holes"],
        "score": x["adjusted_gross_score"],
        "score_to_par": int(x["adjusted_gross_score"]) + int(x["course_handicap"]),
        # "differential": x["differential"],
        # "scaled_up_differential_9_holes": x["adjusted_scaled_up_differential"],
        "differential": x.get("scaled_up_differential") or x.get("differential"),
    }
    for x in all_scores["scores"]
]
# debugging
v = []
for x in all_scores["scores"]:
    try:
        v.append(
            {
                "date": dt.datetime.strptime(x["played_at"], "%Y-%m-%d").date(),
                "number_of_holes": x["number_of_holes"],
                "score": x["adjusted_gross_score"],
                "score_to_par": int(x["adjusted_gross_score"])
                + int(x["course_handicap"]),
                # "differential": x["differential"],
                # "scaled_up_differential_9_holes": x["adjusted_scaled_up_differential"],
                "differential": x.get("scaled_up_differential")
                or x.get("differential"),
            }
        )
    except Exception as e:
        print(e)
        print(x)
        continue
print(v)
print(score_vals)
import matplotlib.pyplot as plt
import pandas as pd

# Create the handicap plot
plt.figure(figsize=(12, 6))
pd.DataFrame(handicap_vals).plot(
    x="date", y="value", ax=plt.gca(), title="Handicap Over Time"
)
plt.show()

# Create separate lines for different hole counts
df_scores = pd.DataFrame(score_vals)

# Separate data for 9-hole and 18-hole scores
scores_9 = df_scores[df_scores["number_of_holes"] == 9]
scores_18 = df_scores[df_scores["number_of_holes"] == 18]

plt.figure(figsize=(12, 6))
plt.plot(
    scores_9["date"], scores_9["score"], "o-", label="9 Holes", color="blue", alpha=0.7
)
plt.plot(
    scores_18["date"],
    scores_18["score"],
    "s-",
    label="18 Holes",
    color="red",
    alpha=0.7,
)

plt.xlabel("Date")
plt.ylabel("Score")
plt.title("Golf Scores Over Time by Number of Holes")
plt.legend()
plt.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()


for x in all_hist["handicap_revisions"]:
    print(x["RevDate"], x["Display"], x["Value"], x["LowHI"])

account = g._get_ghin_account_information()

hs = g.get_handicap_spread()
g.format_handicap_spread({"brig": hs})

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
