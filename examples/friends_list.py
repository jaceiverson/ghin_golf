from dotenv import load_dotenv

from ghin.ghin import GHIN

load_dotenv()

if __name__ == "__main__":
    ### Single golfer
    # # jace
    g = GHIN(1104482)

    g.compare_friends(save=True)
