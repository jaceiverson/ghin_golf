class GHIN {
  constructor(ghin_number = null) {
    this.score_limit = 25;
    this.from_date_played = null;
    this.to_date_played = null;
    this.last_20 = null;

    this.ghin_number = this._processGhinNumberInput(ghin_number);
    this.handicap = this._getLiveHandicap();

    this.base_url = `https://api2.ghin.com/api/v1/golfers/${this.ghin_number}/scores.json?source=GHINcom`;
    this.scores_url = "https://api2.ghin.com/api/v1/scores.json?source=GHINcom";
  }

  _processGhinNumberInput(ghin_number) {
    if (ghin_number === null) {
      // You can handle retrieving this from environment variables or other sources here
      throw new Error(
        "GHIN number must be provided as an argument or as an environment variable"
      );
    }
    return String(ghin_number);
  }

  _makeRequest(url, params = {}) {
    // You'll need to handle making HTTP requests in a Chrome Extension context
    // You might want to use the fetch API or other relevant methods
  }

  _getLiveHandicap() {
    const today = new Date().toISOString();
    const url = `https://api2.ghin.com/api/v1/golfers/${this.ghin_number}/handicap_history.json?revCount=0&date_begin=${today}&date_end=${today}&source=GHINcom`;
    const response = this._makeRequest(url, this.getRequestParams());
    return parseFloat(response.handicap_revisions[0].Display);
  }

  getRequestParams(offset = "0") {
    return {
      golfer_id: this.ghin_number,
      offset,
      limit: this.score_limit,
      from_date_played: this.from_date_played,
      to_date_played: this.to_date_played,
      statuses: "Validated",
    };
  }

  setStartDate(from_date_played) {
    this.from_date_played = from_date_played;
  }

  setEndDate(to_date_played) {
    this.to_date_played = to_date_played;
  }

  setScoreLimit(score_limit = 25) {
    this.score_limit = score_limit;
  }

  getLast20Scores() {
    this.setStartDate();
    this.setEndDate();
    this.setScoreLimit(20);
    const params = this.getRequestParams();
    this.last_20 = this._makeRequest(this.base_url, params);
    return this.last_20;
  }

  getRangeOfScores(start_date, end_date) {
    this.setStartDate(start_date);
    this.setEndDate(end_date);
    this.setScoreLimit(20);
    const params = this.getRequestParams();
    return this._makeRequest(this.scores_url, params);
  }

  getHandicapSpread() {
    if (this.last_20 === null) {
      this.getLast20Scores();
    }
    const differential = this.last_20.revision_scores.scores.map(
      (x) => x.differential
    );
    differential.sort();
    const worst_8_handicap = parseFloat(
      (differential.slice(-8).reduce((a, b) => a + b, 0) / 8).toFixed(1)
    );
    const all_20_handicap = parseFloat(
      (differential.reduce((a, b) => a + b, 0) / 20).toFixed(1)
    );
    return {
      best_8_handicap: this.handicap,
      worst_8_handicap,
      all_20_handicap,
      drop_4_high_and_low_handicap: parseFloat(
        (differential.slice(4, -4).reduce((a, b) => a + b, 0) / 12).toFixed(1)
      ),
      handicap_std_dev: parseFloat(statistics.stdev(differential).toFixed(1)),
      differential_range: parseFloat(
        (differential[differential.length - 1] - differential[0]).toFixed(1)
      ),
    };
  }

  static formatHandicapSpread(handicap_spreads) {
    // You'll need to find a suitable way to format and display this data in your extension
    console.log(handicap_spreads);
  }
}

// funciton to get the bearer token to make the requests
function getUserTokenFromLocalStorage() {
  // Check if localStorage is supported in the current browser
  if (typeof localStorage !== "undefined") {
    // Get the JSON string from localStorage
    const authStateString = localStorage.getItem("persist:authState");

    // Parse the JSON string to an object
    const authStateObject = JSON.parse(authStateString);

    // Check if the authStateObject contains the userToken property
    if (authStateObject && authStateObject.userToken) {
      // Return the userToken value
      return authStateObject.userToken;
    } else {
      // Return null or a default value if userToken is not found
      return null;
    }
  } else {
    // Handle the case where localStorage is not supported
    console.error("localStorage is not supported in this browser.");
    return null;
  }
}

// Define a function to set dot positions
function setDotPositions(whitePosition, yellowPosition) {
  document.documentElement.style.setProperty(
    "--dot-position-white",
    whitePosition
  );
  document.documentElement.style.setProperty(
    "--dot-position-yellow",
    yellowPosition
  );
}

// Example: Open a new tab with a chart when the extension icon is clicked
document
  .getElementById("showChartButton")
  .addEventListener("click", function () {
    chrome.tabs.create({ url: "chart.html" });
  });
