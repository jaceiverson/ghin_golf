import json

from rich import print

from ghin.tables import format_handicap_spread

if __name__ == "__main__":
    # need to run the graphs_and_tables.py first to get this file
    with open("outputs/output.json", "r") as f:
        data = json.load(f)

    # print(data)
    format_handicap_spread(data)
