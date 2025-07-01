from ghin.ghin import GHIN
from argparse import ArgumentParser
import json


def read_file(file_path):
    with open(file_path, "r") as f:
        return json.load(f)


def save_file(data):
    with open("output.json", "w") as f:
        json.dump(data, f, indent=4)


def main():
    # Create arguments to parse through for the CLI that include a tag for GHIN number
    parser = ArgumentParser()
    parser.add_argument(
        "--ghin-number",
        "-gn",
        help="GHIN number of the golfer to get handicap spread for",
    )
    # add argument to read in a file of golfers and handicaps
    parser.add_argument(
        "--file-import",
        "-f",
        help="File to import golfers and handicaps from. Should be a dictionary of golfer names (keys) and GHIN numbers (values)",
    )
    # add argument to not output to console but save to a file
    parser.add_argument(
        "--save-output",
        action="store_true",
        help="Save output to a file instead of printing to console",
    )

    parser.add_argument(
        "--hide-output",
        "-o",
        action="store_true",
        help="Hide output from console. Hiding output will automatically save the data too.",
    )

    cli_args = parser.parse_args()
    # check to see if file-import is an argument
    cli_args
    handicap_spreads = {}

    if file := cli_args.file_import:
        golfers = read_file(file)
        for golfer, ghin_num in golfers.items():
            g = GHIN(ghin_num)
            hs = g.get_handicap_spread()
            handicap_spreads[golfer] = hs
            # print(f"{golfer}:{g.ghin_number}: {g.handicap}")

    elif golfer := cli_args.ghin_number:
        g = GHIN(golfer)
        hs = g.get_handicap_spread()
        handicap_spreads["My Handicaps"] = hs

    if cli_args.save_output:
        save_file(handicap_spreads)

    if not cli_args.hide_output:
        g.format_handicap_spread(handicap_spreads)
        save_file(handicap_spreads)


if __name__ == "__main__":
    main()
