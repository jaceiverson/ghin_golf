import json

from rich import print

from ghin.ghin import GHIN

if __name__ == "__main__":
    # need to run the graphs_and_tables.py first to get this file
    with open("outputs/output.json", "r") as f:
        data = json.load(f)

    # print(data)
    GHIN.format_handicap_spread(data)
