import os

from dotenv import load_dotenv

from ghin.ghin import GHIN
from ghin.graphs import (
    plot_differentials_over_time,
    plot_handicap_history,
    plot_low_handicap_over_time,
    plot_scores_over_time,
)
from ghin.tables import format_handicap_spread

load_dotenv()

if __name__ == "__main__":
    # Single golfer read from .env GHIN_NUMBER
    # g = GHIN(save_outputs=True)
    ghin_number = os.environ.get("GHIN_NUMBER")
    g = GHIN(save_outputs=True, data_dir=f"outputs/{ghin_number}/")

    # alternative handicaps
    hs = g.get_handicap_spread()
    format_handicap_spread({g.display_name: hs})
    # graphs
    if False:
        handicap_history = g.get_handicap_history()
        score_history = g.get_scores_history()
        plot_handicap_history(handicap_history)
        plot_low_handicap_over_time(handicap_history)
        plot_scores_over_time(score_history)
        plot_differentials_over_time(score_history, g.handicap)
