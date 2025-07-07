from dotenv import load_dotenv

from ghin.ghin import GHIN
from ghin.util import (
    plot_differentials_over_time,
    plot_handicap_history,
    plot_low_handicap_over_time,
    plot_scores_over_time,
)

load_dotenv()

if __name__ == "__main__":
    ### Single golfer
    # jace
    g = GHIN(1104482)

    # alternative handicaps
    hs = g.get_handicap_spread()
    g.format_handicap_spread({"jace": hs})
    # # graphs
    plot_handicap_history(g)
    plot_low_handicap_over_time(g)
    plot_scores_over_time(g)
    # plot_differentials_over_time(g, 100)
    plot_differentials_over_time(g, 20)
