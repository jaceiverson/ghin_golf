import datetime as dt

import matplotlib.pyplot as plt
import pandas as pd

from ghin.util import get_low_handicap_value, get_lowest_differentials, get_played_date


def plot_handicap_history(handicap_history: dict) -> None:
    """
    Plot the handicap history of a golfer.
    handicap_history is the output of the GHIN.get_handicap_history() method.
    """
    handicap_vals = [
        {
            "date": dt.datetime.strptime(x["RevDate"], "%Y-%m-%dT%H:%M:%S").date(),
            "value": float(x["Value"]),
        }
        for x in handicap_history["handicap_revisions"]
        if float(x["Value"]) < 30
    ]
    # print(handicap_vals)

    # Create the handicap plot
    plt.figure(figsize=(12, 6))
    pd.DataFrame(handicap_vals).plot(
        x="date", y="value", ax=plt.gca(), title="Handicap Over Time"
    )
    plt.show()


def plot_low_handicap_over_time(handicap_history: dict) -> None:
    """
    Plot the low handicap history of a golfer.
    handicap_history is the output of the GHIN.get_handicap_history() method.
    """
    low_handicap_vals = [
        {
            "date": dt.datetime.strptime(x["RevDate"], "%Y-%m-%dT%H:%M:%S").date(),
            "value": get_low_handicap_value(x["LowHIDisplay"]),
        }
        for x in handicap_history["handicap_revisions"]
    ]
    # print(low_handicap_vals)
    # Create the handicap plot
    plt.figure(figsize=(12, 6))
    pd.DataFrame(low_handicap_vals).plot(
        x="date", y="value", ax=plt.gca(), title="Low Handicap Over Time"
    )
    plt.show()


def plot_scores_over_time(all_scores: dict) -> None:
    """
    Plot the scores over time for a golfer.
    all_scores is the output of the GHIN.get_scores_history() method.
    """
    score_vals = [
        {
            "date": get_played_date(x["played_at"]).date(),
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
    # print(df_scores.shape)
    df_scores.sort_values(by="date", inplace=True)

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


def plot_differentials_over_time(all_scores: dict, handicap: float) -> None:
    """
    Plot the scoring differentials over time for a golfer.
    all_scores is the output of the GHIN.get_scores_history() method.
    handicap is the current handicap of the golfer.
    """
    score_vals = [
        {
            "date": get_played_date(x["played_at"]).date(),
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
    df_scores.sort_values(by="date", inplace=True)
    df_scores.reset_index(drop=True, inplace=True)
    df_scores["rolling_average"] = df_scores["differential"].rolling(window=20).mean()
    df_scores["rolling_handicap"] = (
        df_scores["differential"]
        .rolling(window=20)
        .apply(lambda x: get_lowest_differentials(x))
    )
    df_scores["current_handicap"] = handicap

    # Separate data for 9-hole and 18-hole scores
    scores_9 = df_scores[df_scores["number_of_holes"] == 9]
    scores_18 = df_scores[df_scores["number_of_holes"] == 18]

    plt.figure(figsize=(12, 6))
    plt.plot(
        scores_9["date"],
        scores_9["differential"],
        "o-",
        label="9 Holes",
        color="blue",
        alpha=0.7,
    )
    plt.plot(
        scores_18["date"],
        scores_18["differential"],
        "s-",
        label="18 Holes",
        color="red",
        alpha=0.7,
    )
    plt.plot(
        scores_9["date"],
        scores_9["rolling_handicap"],
        "o-",
        label="Rolling Handicap",
        color="green",
        alpha=0.7,
    )
    plt.plot(
        df_scores["date"],
        df_scores["current_handicap"],
        label="Current Handicap",
        color="purple",
    )

    plt.xlabel("Date")
    plt.ylabel("Differential")
    plt.title("Golf Differentials Over Time by Number of Holes")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()
