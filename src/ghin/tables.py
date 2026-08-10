from rich import print
from rich.align import Align
from rich.table import Table


def _colorize_consistency_score(consistency_score) -> str:
    """colors a consistency score percentage: <50% red, <75% yellow, else green"""
    consistency_value = float(str(consistency_score).rstrip("%"))
    if consistency_value < 50:
        color = "red"
    elif consistency_value < 75:
        color = "yellow"
    else:
        color = "green"
    return f"[{color}]{consistency_score}"


def _colorize_worst_potential_handicap(
    worst_potential_handicap, best_8_handicap
) -> str:
    """colors the worst potential handicap based on the size of the change from
    the current (best 8) handicap: no change is green, a change under 1 is
    yellow, and a change of 1 or more is red"""
    change = worst_potential_handicap - best_8_handicap
    if change == 0:
        color = "green"
    elif change < 1:
        color = "yellow"
    else:
        color = "red"
    return f"[{color}]{worst_potential_handicap}"


def _build_alternative_handicaps_table(sorted_handicap_spreads: dict) -> Table:
    table = Table(title="Alternative Handicaps", caption_justify="center")
    table.add_column("Golfer", style="bold")
    table.add_column("Best 8", style="bold")
    table.add_column("Worst 8", style="bold")
    table.add_column("Last 8", style="bold")
    table.add_column("Last 4", style="bold")
    table.add_column("All 20", style="bold")
    table.add_column("Drop 4HL", style="bold")

    for golfer, handicap_spread in sorted_handicap_spreads.items():
        table.add_row(
            golfer,
            f"[green]{str(handicap_spread['best_8_handicap'])}",
            f"[red]{str(handicap_spread['worst_8_handicap'])}",
            f"[yellow]{str(handicap_spread['last_8_rounds'])}",
            f"[yellow]{str(handicap_spread['last_4_rounds'])}",
            f"[yellow]{str(handicap_spread['all_20_handicap'])}",
            f"[yellow]{str(handicap_spread['drop_4_high_and_low_handicap'])}",
        )
    return table


def _build_statistics_table(sorted_handicap_spreads: dict) -> Table:
    statistics_table = Table(title="Statistics", caption_justify="center")
    statistics_table.add_column("Golfer", style="bold")
    statistics_table.add_column("Range", style="bold")
    statistics_table.add_column("Std Dev", style="bold")
    statistics_table.add_column("Consistency Score", style="bold")
    statistics_table.add_column("Carry%", style="bold")

    for golfer, handicap_spread in sorted_handicap_spreads.items():
        statistics_table.add_row(
            golfer,
            str(handicap_spread["differential_range"]),
            str(handicap_spread["handicap_std_dev"]),
            _colorize_consistency_score(
                handicap_spread["consistency_score_best_8_all_20"]
            ),
            # read explanation in utils as to why we use 7 here
            f"[{'red' if handicap_spread['carry_percentage'] > 0.5 else 'green'}]{handicap_spread['carry_percentage'] * 100:.1f}% ({int(handicap_spread['carry_percentage'] * 7)}/7)",
        )
    return statistics_table


def _build_next_round_helpers_table(sorted_handicap_spreads: dict) -> Table:
    next_table = Table(title="Next Round Helpers", caption_justify="center")
    next_table.add_column("Golfer", style="bold")
    next_table.add_column("8th Scored", style="bold")
    next_table.add_column(
        "Score Fall Off",
        style="bold",
        justify="center",
    )
    next_table.add_column("Worst Potential Handicap", style="bold")
    next_table.add_column("To Lower by .5", style="bold")
    next_table.add_column("To Lower by 1", style="bold")

    for golfer, handicap_spread in sorted_handicap_spreads.items():
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
            *[
                f"[{'green' if round_['is_scoring'] else 'red'}]{round_['value']:.1f}"
                for round_ in handicap_spread["next_4_rounds_to_fall_off"]
            ]
        )
        falloff_table = Align.left(falloff_table, pad=True)
        next_table.add_row(
            golfer,
            f"[yellow]{handicap_spread['worst_scored_differential']}",
            falloff_table,
            _colorize_worst_potential_handicap(
                handicap_spread["worst_potential_handicap"],
                handicap_spread["best_8_handicap"],
            ),
            f"[cyan]{handicap_spread['differential_to_lower_by_point_five']}",
            f"[cyan]{handicap_spread['differential_to_lower_by_one']}",
        )
    return next_table


def _build_historical_table(sorted_handicap_spreads: dict) -> Table:
    historical_table = Table(title="Historical Values", caption_justify="center")
    historical_table.add_column("Golfer", style="bold")
    historical_table.add_column("Low Handicap", style="bold")
    historical_table.add_column("Low Date", style="bold")
    historical_table.add_column("Total Scores", style="bold")
    historical_table.add_column("Highest Score", style="bold")
    historical_table.add_column("Lowest Score", style="bold")
    historical_table.add_column("Average Score", style="bold")

    for golfer, handicap_spread in sorted_handicap_spreads.items():
        historical_table.add_row(
            golfer,
            f"[green]{str(handicap_spread['low_handicap'])}",
            f"[green]{str(handicap_spread['low_handicap_date'])}",
            f"[green]{str(handicap_spread['total_scores'])}",
            str(handicap_spread["highest_score"]),
            str(handicap_spread["lowest_score"]),
            str(handicap_spread["average_score"]),
        )
    return historical_table


def format_handicap_spread(handicap_spreads: dict) -> str:
    """formats the dictionary of handicap spread into a nice string
    and outputs it using rich print"""
    # sort the handicaps by actual value
    sorted_handicap_spreads = dict(
        sorted(handicap_spreads.items(), key=lambda item: item[1]["best_8_handicap"])
    )

    print(_build_alternative_handicaps_table(sorted_handicap_spreads))
    print(_build_statistics_table(sorted_handicap_spreads))
    print(_build_next_round_helpers_table(sorted_handicap_spreads))
    print(_build_historical_table(sorted_handicap_spreads))

    for golfer, handicap_spread in sorted_handicap_spreads.items():
        format_scoring_differentials(
            handicap_spread["base_differentials"],
            handicap_spread["scaled_differentials"],
            handicap_spread["scaled_differences"],
            handicap_spread["adjusted_differentials"],
            handicap_spread["number_of_holes"],
            handicap_spread["pcc"],
            handicap_spread["course_names"],
            handicap_spread["played_dates"],
            handicap_spread["tee_set_sides"],
            handicap_spread["best_8_handicap"],
            golfer,
        )


def _colorize_scoring_differential(differential, handicap: float) -> str:
    """colors a scoring differential relative to the handicap: within .5 of the
    handicap (inclusive) is yellow, clearly lower is green, clearly higher is
    red. a missing (None) differential is shown as a plain dash"""
    if differential is None:
        return "-"
    if abs(differential - handicap) <= 0.5:
        color = "yellow"
    elif differential < handicap:
        color = "green"
    else:
        color = "red"
    return f"[{color}]{differential}"


_TEE_SET_SIDE_LABELS = {"F9": "Front", "B9": "Back"}


def format_scoring_differentials(
    base_differentials: list,
    scaled_differentials: list,
    scaled_differences: list,
    adjusted_differentials: list,
    number_of_holes: list,
    pcc: list,
    course_names: list,
    played_dates: list,
    tee_set_sides: list,
    handicap: float,
    golfer: str = None,
) -> None:
    """
    Formats all 20 scoring differentials into a rich table and prints it, one
    row per round with a column for each differential type plus date played,
    holes played, side of the course, PCC, and course. base_differentials,
    scaled_differentials, scaled_differences, adjusted_differentials,
    number_of_holes, pcc, course_names, played_dates, and tee_set_sides are
    the like-named values returned by GHIN.get_handicap_spread(), each
    time-ordered and the same length. scaled_differences shows how much a
    9-hole round's differential was scaled up to its 18-hole equivalent
    (None for 18-hole rounds, which aren't scaled). Rounds are ranked
    best-to-worst by the adjusted differential, falling back to scaled or
    base when a round doesn't have one, the differential columns are colored
    relative to the handicap, and a dividing line marks the boundary between
    the 8 scoring rounds and the 12 non-scoring ones.
    """
    effective_differentials = [
        a or s or b
        for a, s, b in zip(
            adjusted_differentials, scaled_differentials, base_differentials
        )
    ]
    ranked_indexes = sorted(
        range(len(effective_differentials)), key=lambda i: effective_differentials[i]
    )

    title = f"Scoring Differentials ({golfer})" if golfer else "Scoring Differentials"
    table = Table(title=title, caption_justify="center")
    table.add_column("Round", style="bold")
    table.add_column("Date", style="bold")
    table.add_column("Holes", style="bold")
    table.add_column("Side", style="bold")
    table.add_column("Course", style="bold")
    table.add_column("PCC", style="bold")
    table.add_column("Base", style="bold")
    table.add_column("Scaled", style="bold")
    table.add_column("Scaled Diff", style="bold")
    table.add_column("Adjusted", style="bold")

    for rank, i in enumerate(ranked_indexes, start=1):
        scaled_difference = scaled_differences[i]
        table.add_row(
            str(rank),
            str(played_dates[i]),
            str(number_of_holes[i]),
            _TEE_SET_SIDE_LABELS.get(tee_set_sides[i], "-"),
            str(course_names[i]),
            str(pcc[i]),
            _colorize_scoring_differential(base_differentials[i], handicap),
            _colorize_scoring_differential(scaled_differentials[i], handicap),
            "-" if scaled_difference is None else f"+{scaled_difference}",
            _colorize_scoring_differential(adjusted_differentials[i], handicap),
            end_section=(rank == 8),
        )

    print(table)
