import datetime as dt

import numpy as np
import pandas as pd
from dotenv import load_dotenv

load_dotenv()


def get_played_date(string_value: str) -> dt.datetime:
    try:
        return dt.datetime.strptime(string_value, "%Y-%m-%d")
    except ValueError:
        return dt.datetime.strptime(string_value, "%Y-%m")


def get_last_years_date(years_back: int = 1) -> str:
    """Return the date of the last year in isoformat"""
    return (dt.date.today() - dt.timedelta(days=365 * years_back)).isoformat()


def get_lowest_differentials(data_series: pd.Series) -> pd.Series:
    """Get the lowest 8 differentials from a data series"""
    return np.mean(sorted(data_series)[:8])


def get_differential_distribution(differentials: list, handicap: float) -> float:
    """
    Return the differential distribution for the GHIN number
    how many scoring differentials (low 8) are above the handicap
    """
    above_handicap = sum(1 for x in differentials if x > handicap)
    return above_handicap / 8


def will_next_score_affect_handicap(
    falling_off_round: float, differential: list
) -> bool:
    """
    calculate if your next scored round will affect your handicap
    if your next round to fall off (20 scores ago) is one of your scoring
    rounds, then it will affect your handicap, we can check this by using
    the sorted list of differentials and checking if the falling off round
    is one of the first 8 rounds. We do need to check to make sure we don't have
    repeats for the 9th best round.
    """
    if falling_off_round <= differential[7] and differential[7] < differential[8]:
        return True
    return False


def get_low_handicap_value(string_value: str) -> float:
    """the good golfers get a plus, but in our charts it is really a minus"""
    try:
        return float(string_value.replace("+", "-"))
    except ValueError:
        return None
