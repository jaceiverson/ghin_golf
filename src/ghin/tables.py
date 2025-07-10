import datetime as dt

import matplotlib.pyplot as plt
import pandas as pd
from rich import print
from rich.align import Align
from rich.table import Table

from ghin.util import get_low_handicap_value, get_lowest_differentials, get_played_date


def format_handicap_spread(handicap_spreads: dict) -> str:
    """formats the dictionary of handicap spread into a nice string
    and outputs it using rich print"""
    # Create a table
    table = Table(title="Alternative Handicaps", caption_justify="center")
    table.add_column("Golfer", style="bold")
    table.add_column("Best 8", style="bold")
    table.add_column("Worst 8", style="bold")
    table.add_column("Last 8", style="bold")
    table.add_column("Last 4", style="bold")
    table.add_column("All 20", style="bold")
    table.add_column("Drop 4HL", style="bold")
    table.add_column("Range", style="bold")
    table.add_column("Std Dev", style="bold")

    next_table = Table(title="Next Round Helpers", caption_justify="center")
    next_table.add_column("Golfer", style="bold")
    next_table.add_column("Carry%", style="bold")
    next_table.add_column("8th Scored", style="bold")
    next_table.add_column(
        "Score Fall Off",
        style="bold",
        justify="center",
    )

    next_table.add_column("Worst Potential Handicap", style="bold")

    historical_table = Table(title="Historical Values", caption_justify="center")
    historical_table.add_column("Golfer", style="bold")
    historical_table.add_column("Low Handicap", style="bold")
    historical_table.add_column("Low Date", style="bold")
    historical_table.add_column("Total Scores", style="bold")
    historical_table.add_column("Highest Score", style="bold")
    historical_table.add_column("Lowest Score", style="bold")
    historical_table.add_column("Average Score", style="bold")

    # sort the handicaps by actual value
    sorted_handicap_spreads = dict(
        sorted(handicap_spreads.items(), key=lambda item: item[1]["best_8_handicap"])
    )
    for golfer, handicap_spread in sorted_handicap_spreads.items():
        table.add_row(
            golfer,
            f"[green]{str(handicap_spread['best_8_handicap'])}",
            f"[red]{str(handicap_spread['worst_8_handicap'])}",
            f"[yellow]{str(handicap_spread['last_8_rounds'])}",
            f"[yellow]{str(handicap_spread['last_4_rounds'])}",
            f"[yellow]{str(handicap_spread['all_20_handicap'])}",
            f"[yellow]{str(handicap_spread['drop_4_high_and_low_handicap'])}",
            str(handicap_spread["differential_range"]),
            str(handicap_spread["handicap_std_dev"]),
        )
        falloff_table = Table(
            padding=(0, 0, 0, 0),
            show_edge=False,
            show_lines=True,
            width=30,
            show_header=False,
        )
        for i in range(4):
            falloff_table.add_column(
                f"{i + 1}", style="bold", width=10, justify="center"
            )
        falloff_table.add_row(
            f"{handicap_spread['next_4_rounds_to_fall_off'][0]}",
            f"{handicap_spread['next_4_rounds_to_fall_off'][1]}",
            f"{handicap_spread['next_4_rounds_to_fall_off'][2]}",
            f"{handicap_spread['next_4_rounds_to_fall_off'][3]}",
        )
        falloff_table = Align.left(falloff_table, pad=True)
        next_table.add_row(
            golfer,
            f"[{'red' if handicap_spread['carry_percentage'] > 0.5 else 'green'}]{handicap_spread['carry_percentage'] * 100:.1f}%",
            f"[yellow]{handicap_spread['worst_scored_differential']}",
            falloff_table,
            f"[yellow]{str(handicap_spread['worst_potential_handicap'])}",
        )
        historical_table.add_row(
            golfer,
            f"[green]{str(handicap_spread['low_handicap'])}",
            f"[green]{str(handicap_spread['low_handicap_date'])}",
            f"[green]{str(handicap_spread['total_scores'])}",
            str(handicap_spread["highest_score"]),
            str(handicap_spread["lowest_score"]),
            str(handicap_spread["average_score"]),
        )

    # Print the tables
    print(table)
    print(next_table)
    print(historical_table)


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
