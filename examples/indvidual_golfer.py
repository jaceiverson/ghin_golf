from dotenv import load_dotenv

from ghin.ghin import GHIN
from ghin.tables import (
    format_handicap_spread,
    plot_differentials_over_time,
    plot_handicap_history,
    plot_low_handicap_over_time,
    plot_scores_over_time,
)

load_dotenv()

if __name__ == "__main__":
    ### Single golfer
    # # jace
    g = GHIN(1104482)

    # alternative handicaps
    hs = g.get_handicap_spread()
    format_handicap_spread({"jace": hs})
    # graphs
    handicap_history = g.get_handicap_history()
    score_history = g.get_scores_history()
    plot_handicap_history(handicap_history)
    plot_low_handicap_over_time(handicap_history)
    plot_scores_over_time(score_history)
    plot_differentials_over_time(score_history, g.handicap)
