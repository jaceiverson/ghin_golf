import datetime as dt
import os
import statistics
from typing import Optional, Union

import requests
from rich import print
from rich.table import Table

from .header import get_headers


class GHIN:
    """Class for interacting with the GHIN API"""

    def __init__(self, ghin_number: Union[int, str] = None) -> None:
        """Initialize the GHIN class"""
        self.score_limit: int = 25
        self.from_date_played: Optional[str] = None
        self.to_date_played: Optional[str] = None
        self.last_20: Optional[dict] = None

        self.ghin_number = self._process_ghin_number_input(ghin_number)
        self.handicap = self._get_live_handicap()

        self.base_url = f"https://api2.ghin.com/api/v1/golfers/{self.ghin_number}/scores.json?source=GHINcom"
        self.scores_url = "https://api2.ghin.com/api/v1/scores.json?source=GHINcom"

    @staticmethod
    def _process_ghin_number_input(ghin_number: Union[int, str]) -> str:
        """Process the GHIN number input and return a string"""
        if ghin_number is None:
            ghin_number = os.environ.get("GHIN_NUMBER")

        if ghin_number is None:
            raise ValueError(
                "GHIN number must be provided as an argument or as an environment variable"
            )

        return str(ghin_number)

    def set_start_date(self, from_date_played: Optional[str] = None) -> None:
        """Set the from_date_played attribute"""
        self.from_date_played = from_date_played

    def set_end_date(self, to_date_played: Optional[str] = None) -> None:
        """Set the to_date_played attribute"""
        self.to_date_played = to_date_played

    def set_score_limit(self, score_limit: int = 25) -> None:
        """Set the score_limit attribute"""
        self.score_limit = score_limit

    def get_request_params(self, offset: str = "0") -> dict:
        """Return the request parameters for the GHIN API"""
        return {
            "golfer_id": self.ghin_number,
            "offset": offset,
            "limit": self.score_limit,
            "from_date_played": self.from_date_played,
            "to_date_played": self.to_date_played,
            "statuses": "Validated",
        }

    def _make_request(self, url: str, params: Optional[dict] = None) -> dict:
        """Make a request to the GHIN API and return the response as a dict"""
        if params is None:
            params = {}
        response = requests.get(url, params=params, headers=get_headers())
        if response.ok and "error" not in response.json():
            return response.json()
        else:
            raise ValueError(response.json()["error"])

    def _get_live_handicap(self) -> float:
        """Return the current handicap for the GHIN number"""
        url = f"https://api2.ghin.com/api/v1/golfers/{self.ghin_number}/handicap_history.json?revCount=0&date_begin={dt.date.today().isoformat()}&date_end={dt.date.today().isoformat()}&source=GHINcom"
        response = self._make_request(url, self.get_request_params())
        return float(response["handicap_revisions"][0]["Display"])

    def get_last_20_scores(self) -> dict:
        """Return the last 20 scores for the GHIN number"""
        self.set_start_date()
        self.set_end_date()
        self.set_score_limit(20)
        params = self.get_request_params()
        self.last_20 = self._make_request(self.base_url, params)
        return self.last_20

    def get_range_of_scores(self, start_date: dt.date, end_date: dt.date) -> dict:
        """Return the last (upto) 100 scores for the GHIN number within the date range"""
        self.set_start_date(start_date)
        self.set_end_date(end_date)
        self.set_score_limit(20)
        params = self.get_request_params()
        return self._make_request(self.scores_url, params)

    def get_handicap_spread(self) -> dict:
        """Return the best 8, worst 8, and all 20 handicap values"""
        if self.last_20 is None:
            self.get_last_20_scores()
        differential = [
            x["differential"] for x in self.last_20["revision_scores"]["scores"]
        ]
        differential.sort()
        worst_8_handicap = round(sum(differential[-8:]) / 8, 1)
        all_20_handicap = round(sum(differential) / 20, 1)
        return {
            "best_8_handicap": self.handicap,
            "worst_8_handicap": worst_8_handicap,
            "all_20_handicap": all_20_handicap,
            "drop_4_high_and_low_handicap": round(sum(differential[4:-4]) / 12, 1),
            "handicap_std_dev": round(statistics.stdev(differential), 1),
            "differential_range": round(differential[-1] - differential[0], 1),
        }

    @staticmethod
    def format_handicap_spread(handicap_spreads: dict) -> str:
        """formats the dictionary of handicap spread into a nice string
        and outputs it using rich print"""
        # Create a table
        table = Table(title="Alt Handicap Calculations")
        table.add_column("Golfer", style="bold")
        table.add_column("Best 8", style="bold")
        table.add_column("All 20", style="bold")
        table.add_column("Worst 8", style="bold")
        table.add_column("Drop 4 High&Low", style="bold")
        table.add_column("Range", style="bold")
        table.add_column("Std Dev", style="bold")

        # sort the handicaps by actual value
        sorted_handicap_spreads = dict(
            sorted(
                handicap_spreads.items(), key=lambda item: item[1]["best_8_handicap"]
            )
        )
        for golfer, handicap_spread in sorted_handicap_spreads.items():
            table.add_row(
                golfer,
                f"[green]{str(handicap_spread['best_8_handicap'])}",
                str(handicap_spread["all_20_handicap"]),
                f"[red]{str(handicap_spread['worst_8_handicap'])}",
                f"[yellow]{str(handicap_spread['drop_4_high_and_low_handicap'])}",
                str(handicap_spread["differential_range"]),
                str(handicap_spread["handicap_std_dev"]),
            )

        # Print the table
        print(table)
