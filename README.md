# GHIN Handicap Alternative Metrics and Calculations
Handicap can be confusing to explain even if you understand what it is. It also may not be the best metric by which you know how your golf game is trending. This repo is designed to help you (and your golf group) get a better idea of how you are playing, and where your handicap is going.

This repo has two parts:
- **[GHIN-sights](chrome-extension/)** — a Chrome extension that shows these alternative handicap tables, streaks, and charts right in a side panel while you browse GHIN.com, using your own logged-in session. This is the actively maintained, ready-to-use version.
- **A Python library** (the rest of this repo) — the original scripts and calculations these ideas came from, run from the terminal with `rich`-rendered tables. Still a work in progress.

## Chrome Extension (GHIN-sights)
The extension is the easiest way to get these tables without any setup - no auth token, no `.env` file, just your existing GHIN.com login.

- **Alternative Handicaps, Next Round Helpers, Scoring Differentials, Charts, and Raw Data** tabs, all scoped to whichever golfer (yourself or someone you follow) you pick from the dropdown
- Streaks, a consistency score, and a "Carry:Drag" ratio not shown anywhere in the GHIN app itself
- A **Definitions** tab explaining every metric, with matching hover tooltips throughout the tables
- Works entirely from data your browser already has access to - nothing is sent anywhere outside your own machine

To install it before it's live on the Chrome Web Store:
1. Go to `chrome://extensions`, enable **Developer mode** (top right)
2. Click **Load unpacked** and select the [`chrome-extension/`](chrome-extension/) folder
3. Open a ghin.com page and browse around - the side panel icon will light up once it's captured some data

See [`chrome-extension/documentation/`](chrome-extension/documentation/) for notes on how some of the less obvious formulas (9-hole scaling, the consistency score) were derived and validated.

## Python library
The Python side of this repo is where these calculations were first built out, and where new metrics still get prototyped before making their way into the extension. It's less polished than the extension - expect rough edges.

### Getting started
There are a few basic steps to get started:
1. install all the requirements found in the `requirements.txt` file
2. find you [authentication token](README.md#authentication)
3. replace the GHIN number in [`individual_golfer.py`](examples/indvidual_golfer.py) with your GHIN number and run it

Next steps would be to add some of your friends GHIN numbers to the [`golfers.json`](inputs/golfers.json) file and run the [`graphs_and_tables.py`](examples/graphs_and_tables.py) file. 

### Authentication
The easiest way: set `GHIN_NUMBER` and `GHIN_LOGIN_PWD` (your GHIN login credentials) as environment variables - in a `.env` file, `export ...`, or however you normally do it. The library logs in to GHIN directly (plain `requests`, no browser) and writes the resulting token to `AUTH_COOKIE` for you, refreshing it automatically every couple of hours.

If you'd rather not store your password, you can get the token manually instead: sign in to the GHIN web portal and open your browser's network developer tools. Find a request with `.json` in it - you should see some that start with `search.json?` and `check_trial.json?`. Click on the `Headers` section of that request, scroll to `Request Headers`, and find the `Authorization` header. You'll see a value that starts with `Bearer`; copy the part *after* `Bearer ` (you don't need the word `Bearer` itself) and save it as an environment variable named `AUTH_COOKIE`. This token expires periodically, so you'll need to repeat this manually from time to time - the automated login above doesn't have that problem.

### Running the code and outputs
We use `rich` to render really nice looking table outputs in the terminal. To get an idea of possible outputs you can run any of the examples. 


### Definitions

#### General Definitions
There are some general definitions we need to know before we get started that will help you understand the data.

| Term   | Definition |
|--------|------------|
| **Posted** | Any entered score in the GHIN app |
| **Scored** | The top 8 differentials from your posted scores. Scored rounds are determined from the last 20 rounds. |
| **Score** | Number of strokes you took on the golf course |
| **Differential** | Calculated based on the course rating and your score, handicap is a derivative of differential | 

#### Example
I play my local course and shoot 89 on a par 72. I go to my GHIN app and post my score. It tells me that my round differential is 18. Also, because this is the first time I have broken 90 it is likely that my round today will be a scoring round. 

#### Differential Numbers Table
When you run the [`graphs_and_tables.py`](examples/graphs_and_tables.py) file you will get a table output of you and your friends. The column names are shorted so we wanted to provide a full description of what each column represents here. There are 3 tables outputted. The first is alternative handicaps and all metrics are calculated using differentials from your last 20 rounds. The second table is some custom metrics that will help you get a better idea of what your next round needs to look like to maintain or better your current handicap. And the third table shows historical data from your GHIN account. You will find the definitions separated into the 3 sections

#### Table 1 -- Differential Data and Alternative Handicap Calculations
| Column Name         | Description |
|----------------|-------------|
| **Best 8**     | Average of your best 8 differentials; this is your displayed handicap in the GHIN app |
| **Worse 8**    | Average of your worst 8 differentials; the inverse of your display handicap |
| **Last 8**     | Average of the most recent 8 posted differentials |
| **Last 4**     | Average of the most recent 4 posted differentials |
| **All 20**     | Average of all 20 most recent posted differentials |
| **Drop 4HL**   | Average of the middle 12 posted differentials (drop the worst 4 and best 4) |
| **Range**      | Difference between your highest and lowest posted differentials |
| **Std Dev**    | Standard deviation of all posted differentials |

#### Table 2 -- Next Round Helpers

| Column Name                 | Description |
|------------------------|-------------|
| **Carry %**            | Percentage of scored rounds that are above your display handicap. Higher = likely increase; lower = likely decrease |
| **8th Scored**         | The highest scored differential. If your next round is lower, your handicap may go down |
| **Score Fall Off**     | Your least recent posted scores of 20. Next score will remove these. Green = scored, Red = non-scored |
| **Worst Potential Handicap** | Your handicap if your next score is not a scoring round and the falling-off score *is* a scored round |

#### Table 3 -- Historical Values
| Column Name                 | Description |
|------------------------|-------------|
| **Low Handicap**                | Your lowest handicap ever |
| **Low Date**           | The date you achieved your lowest handicap ever |
| **Total Scores**       | How many posted scores you have in GHIN all time |
| **High Score**         | Highest posted total round score (18 holes only, not a differential) |
| **Low Score**          | Lowest posted total round score (18 holes only, not a differential) |
| **Average Score**      | Average posted total round score (18 holes only, not a differential) |
#### Table Screenshot
<img width="753" height="681" alt="Image" src="https://github.com/user-attachments/assets/74761d5f-74d4-400b-b727-bc667fc90064" />

### Charts
##### Differentials Overtime, on number of holes played with active handicap
<img width="1179" height="571" alt="Image" src="https://github.com/user-attachments/assets/5c11d747-d149-48f1-bea5-6dc2096439a8" />

##### Low Handicap overtime
<img width="1175" height="582" alt="Image" src="https://github.com/user-attachments/assets/0fbe1727-42e8-48b4-9577-0fd4e17e8a1d" />

