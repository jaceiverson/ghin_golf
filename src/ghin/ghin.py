import datetime as dt
import json
import os
import statistics
from typing import Optional, Union

import requests
import tqdm
from rich import print

from ghin.header import get_headers
from ghin.tables import format_handicap_spread
from ghin.util import get_differential_distribution, get_low_handicap_value


class GHIN:
    """Class for interacting with the GHIN API"""

    def __init__(self, ghin_number: Union[int, str] = None) -> None:
        """Initialize the GHIN class"""
        self.score_limit: int = 25
        self.from_date_played: Optional[str] = None
        self.to_date_played: Optional[str] = None
        self.last_20: Optional[dict] = None

        self.ghin_number = self._process_ghin_number_input(ghin_number)
        self.ghin_account_info = self._get_ghin_account_information()
        self.display_name = (
            f"{self.ghin_account_info['golfers'][0]['first_name']} "
            f"{self.ghin_account_info['golfers'][0]['last_name']}"
        )
        self.ghin_start_date = (
            dt.datetime.strptime(
                self.ghin_account_info["golfers"][0]["created_at"],
                "%Y-%m-%dT%H:%M:%S.%fZ",
            )
            .date()
            .isoformat()
        )
        self.low_handicap_date = self.ghin_account_info["golfers"][0]["low_hi_date"]
        self.low_handicap = get_low_handicap_value(
            self.ghin_account_info["golfers"][0]["low_hi_display"]
        )
        self.handicap = self._get_live_handicap()
        if self.low_handicap == "-":
            self.low_handicap = self.handicap
            self.low_handicap_date = dt.date.today().isoformat()

        self.base_url = f"https://api2.ghin.com/api/v1/golfers/{self.ghin_number}/scores.json?source=GHINcom"
        self.scores_url = "https://api2.ghin.com/api/v1/scores.json?source=GHINcom"

        # get the last 20 scored rounds
        # this will set the value for the following attributes:
        # last_20_scored_rounds, total_scores, highest_score, lowest_score, average_score
        self.last_20_scored_rounds = None
        self.total_scores = None
        self.highest_score = None
        self.lowest_score = None
        self.average_score = None
        self.get_scores_history()

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
        elif "error" in response.json():
            raise ValueError(response.json()["error"])
        elif "errors" in response.json():
            raise ValueError(response.json()["errors"])
        else:
            raise ValueError(response.text)

    def _get_ghin_account_information(self) -> str:
        """get the date you created the ghin account"""
        url = f"https://api2.ghin.com/api/v1/golfers/search.json?golfer_id={self.ghin_number}&page=1&per_page=100&source=GHINcom"
        response = self._make_request(url, self.get_request_params())
        return response

    def _get_live_handicap(self) -> float:
        """Return the current handicap for the GHIN number"""
        url = f"https://api2.ghin.com/api/v1/golfers/{self.ghin_number}/handicap_history.json?revCount=0&date_begin={dt.date.today().isoformat()}&date_end={dt.date.today().isoformat()}&source=GHINcom"
        response = self._make_request(url, self.get_request_params())
        display_handicap = response["handicap_revisions"][0]["Display"]
        if "+" in display_handicap:
            # if the handicap is a plus, we need to convert it to a float
            return float(display_handicap.replace("+", "-"))
        return float(display_handicap)

    def get_followed_golfers(self) -> list:
        """return list from the golfers you follow"""
        url = f"https://api2.ghin.com/api/v1/followed_golfers/{self.ghin_number}.json?source=GHINcom"
        response = self._make_request(url)
        return response.get("golfers", [])

    def get_handicap_history(self) -> dict:
        """Return the handicap history for the GHIN number"""
        url = f"https://api2.ghin.com/api/v1/golfers/{self.ghin_number}/handicap_history.json?revCount=0&date_begin={self.ghin_start_date}&date_end={dt.date.today().isoformat()}&source=GHINcom"
        response = self._make_request(url, self.get_request_params())
        return response

    def get_scores_history(self, num_of_scores_to_pull: int = 20) -> dict:
        """return the scores history for the GHIN number"""
        offset_value = 0
        max_scores_per_page = min(num_of_scores_to_pull, 25)
        responses = {"scores": []}
        while len(responses["scores"]) < num_of_scores_to_pull:
            url = (
                "https://api2.ghin.com/api/v1/scores.json?"
                f"golfer_id={self.ghin_number}"
                f"&offset={offset_value}&limit={max_scores_per_page}"
                "&source=GHINcom"
            )
            response = self._make_request(url)
            responses["scores"].extend(response["scores"])
            offset_value += max_scores_per_page
            if response.get("total_count") < num_of_scores_to_pull:
                break
        # save some of the stats from the API response
        self.total_scores = response.get("total_count")
        self.highest_score = response.get("highest_score")
        self.lowest_score = response.get("lowest_score")
        self.average_score = response.get("average")
        self.last_20_scored_rounds = responses
        return responses

    def compare_friends(self, save: bool) -> None:
        """
        Method to compare you and your friend's handicaps in tables
        """
        friend_data = self.get_followed_golfers()
        if not friend_data:
            print("[red]No followed golfers found.[/red]")
            return
        my_spread = self.get_handicap_spread()
        spread_data = {
            self.display_name: my_spread,
        }
        friend_spreads = self.group_handicap_spreads(friend_data)
        spread_data.update(friend_spreads)
        format_handicap_spread(spread_data)
        if save:
            with open("outputs/friend_handicap_spreads.json", "w") as f:
                json.dump(spread_data, f, indent=4)

    @staticmethod
    def next_four_rounds_to_fall_off(
        differential: list, highest_scored_round: float
    ) -> list:
        """
        return a list of emojis
        green checkmarks if the round is a scoring one
        red x if the round is a non-scoring one
        """
        return [
            f"[green]{float(x):.1f}[/green]"
            if x <= highest_scored_round
            else f"[red]{float(x):.1f}[/red]"
            for x in differential
        ]

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
        if self.last_20_scored_rounds is None:
            self.get_scores_history()
        differential = [
            x.get("scaled_up_differential") or x.get("differential")
            for x in self.last_20_scored_rounds["scores"]
        ]
        # before sorting on differential, get the average of the most recent 8 rounds
        most_recent_eight = round(sum(differential[:8]) / 8, 1)
        most_recent_four = round(sum(differential[:4]) / 4, 1)
        # get the rounds that is "falling off"
        falling_off_rounds = differential[-4:][::-1]
        # now we can sort the differential to get the other metrics
        differential.sort()
        worst_8_handicap = round(sum(differential[-8:]) / 8, 1)
        all_20_handicap = round(sum(differential) / len(differential), 1)
        drop_4_high_and_low_handicap = round(sum(differential[4:-4]) / 12, 1)
        # alternative metrics
        extraordinary_round_score = get_differential_distribution(
            differential[:8], self.handicap
        )
        next_four_rounds_to_fall_off = self.next_four_rounds_to_fall_off(
            falling_off_rounds, differential[7]
        )
        worst_potential_handicap = (
            f"[yellow]{round(sum(differential[1:9]) / 8, 1)}[/yellow]"
            if falling_off_rounds[0] <= differential[7]
            else f"[green]{self.handicap}[/green]"
        )

        return {
            "best_8_handicap": self.handicap,
            "worst_8_handicap": worst_8_handicap,
            "last_8_rounds": most_recent_eight,
            "last_4_rounds": most_recent_four,
            "all_20_handicap": all_20_handicap,
            "drop_4_high_and_low_handicap": drop_4_high_and_low_handicap,
            "handicap_std_dev": round(statistics.stdev(differential), 1),
            "differential_range": round(differential[-1] - differential[0], 1),
            "carry_percentage": extraordinary_round_score,
            "worst_scored_differential": differential[7],
            "worst_potential_handicap": worst_potential_handicap,
            "next_4_rounds_to_fall_off": next_four_rounds_to_fall_off,
            "low_handicap": self.low_handicap,
            "low_handicap_date": self.low_handicap_date,
            "total_scores": self.total_scores,
            "highest_score": self.highest_score,
            "lowest_score": self.lowest_score,
            "average_score": self.average_score,
        }

    def group_handicap_spreads(self, list_of_golfers: list) -> dict:
        """Return a dictionary of handicap spreads for a list of golfers"""
        handicap_spreads = {}
        pbar = tqdm.tqdm(list_of_golfers, desc="Processing golfers")
        for golfer in pbar:
            display_name = f"{golfer['first_name']} {golfer['last_name']}"
            pbar.set_description(f"Processing {display_name}")
            try:
                g = GHIN(golfer["id"])
            except Exception as e:
                print(
                    f"[red]ERROR[/red] getting handicap spread for {golfer['id']}: {e}"
                )
                continue
            hs = g.get_handicap_spread()
            handicap_spreads[display_name] = hs
        return handicap_spreads

    @staticmethod
    def table_of_golfers(file_path: str, anonymize: bool = False):
        """
        Table of golfers and their handicap spreads
        """
        with open(file_path, "r") as f:
            golfers = json.load(f)

        handicap_spreads = {}
        pbar = tqdm.tqdm(golfers.items(), desc="Processing golfers")
        for golfer, ghin_num in pbar:
            pbar.set_description(f"Processing {golfer}")
            try:
                g = GHIN(ghin_num)
            except Exception as e:
                print(f"[red]ERROR[/red] getting handicap spread for {golfer}: {e}")
                continue
            hs = g.get_handicap_spread()
            handicap_spreads[golfer] = hs
            # print(f"{golfer}:{g.ghin_number}: {g.handicap} {hs}")

        if anonymize:
            handicap_spreads = {
                f"golfer_{i}": hs for i, hs in enumerate(handicap_spreads.values())
            }
        format_handicap_spread(handicap_spreads)

        with open("outputs/output.json", "w") as f:
            json.dump(handicap_spreads, f)
