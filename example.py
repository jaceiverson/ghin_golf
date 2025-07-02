import datetime as dt
import json

import matplotlib.pyplot as plt
import pandas as pd
from dotenv import load_dotenv
from rich import print

from ghin.ghin import GHIN

load_dotenv()

### Single golfer
# jace
g = GHIN(1104482)
# paden
# g = GHIN(1367387)

# remuda
course = 14062


def get_low_handicap_value(string_value: str) -> float:
    try:
        return float(string_value)
    except ValueError:
        return None


def plot_handicap_history(ghin_object: GHIN):
    all_hist = ghin_object.get_handicap_history()
    handicap_vals = [
        {
            "date": dt.datetime.strptime(x["RevDate"], "%Y-%m-%dT%H:%M:%S").date(),
            "value": float(x["Value"]),
        }
        for x in all_hist["handicap_revisions"]
    ]
    print(handicap_vals)

    # Create the handicap plot
    plt.figure(figsize=(12, 6))
    pd.DataFrame(handicap_vals).plot(
        x="date", y="value", ax=plt.gca(), title="Handicap Over Time"
    )
    plt.show()


def plot_scores_over_time(ghin_object: GHIN):
    all_scores = ghin_object.get_scores_history()
    score_vals = [
        {
            "date": dt.datetime.strptime(x["played_at"], "%Y-%m-%d").date(),
            "number_of_holes": x["number_of_holes"],
            "score": x["adjusted_gross_score"],
            # "score_to_par": int(x["adjusted_gross_score"]) + int(x["course_handicap"]),
            # "differential": x["differential"],
            # "scaled_up_differential_9_holes": x["adjusted_scaled_up_differential"],
            "differential": x.get("scaled_up_differential") or x.get("differential"),
        }
        for x in all_scores["scores"]
    ]
    # Create separate lines for different hole counts
    df_scores = pd.DataFrame(score_vals)

    # Separate data for 9-hole and 18-hole scores
    scores_9 = df_scores[df_scores["number_of_holes"] == 9]
    scores_18 = df_scores[df_scores["number_of_holes"] == 18]

    plt.figure(figsize=(12, 6))
    plt.plot(
        scores_9["date"],
        scores_9["score"],
        "o-",
        label="9 Holes",
        color="blue",
        alpha=0.7,
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


def plot_low_handicap_over_time(ghin_object: GHIN):
    all_hist = ghin_object.get_handicap_history()
    low_handicap_vals = [
        {
            "date": dt.datetime.strptime(x["RevDate"], "%Y-%m-%dT%H:%M:%S").date(),
            "value": get_low_handicap_value(x["LowHIDisplay"]),
        }
        for x in all_hist["handicap_revisions"]
    ]
    print(low_handicap_vals)
    # Create the handicap plot
    plt.figure(figsize=(12, 6))
    pd.DataFrame(low_handicap_vals).plot(
        x="date", y="value", ax=plt.gca(), title="Low Handicap Over Time"
    )
    plt.show()


def table_of_golfers(file_path: str, anonymize: bool = False):
    """Table of golfers and their handicap spreads"""
    with open(file_path, "r") as f:
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

    if anonymize:
        handicap_spreads = {
            f"golfer_{i}": hs for i, hs in enumerate(handicap_spreads.values())
        }
    g.format_handicap_spread(handicap_spreads)


def course_details(ghin_object: GHIN, course_id: str):
    course_details_data = ghin_object.get_course_details(course_id)
    course_handicaps_data = ghin_object.get_course_handicaps(course_id)
    print(course_details_data)
    print(course_handicaps_data)


plot_handicap_history(g)
plot_scores_over_time(g)
plot_low_handicap_over_time(g)
table_of_golfers("golfers.json")
course_details(g, course)
