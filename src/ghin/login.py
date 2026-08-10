import datetime as dt
import json
import os
import time

from dotenv import load_dotenv
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options

load_dotenv()


def process_browser_log_entry(entry):
    response = json.loads(entry["message"])["message"]
    return response


def get_driver() -> Chrome:
    options = Options()
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    return Chrome(options)


def get_cookie(driver: Chrome, starting_url: str, request_url: str) -> None:
    driver.get(starting_url)
    time.sleep(2)  # wait for all the data to arrive.
    browser_log = driver.get_log("performance")
    events = [process_browser_log_entry(entry) for entry in browser_log]
    request_events = [event for event in events if "Network.request" in event["method"]]
    api_request_event = [
        event
        for event in request_events
        if request_url in event["params"].get("request", {}).get("url", {})
        and "Authorization" in event["params"].get("request", {}).get("headers", {})
    ]
    auth_bearer = api_request_event[0]["params"]["request"]["headers"]["Authorization"]
    bears, cookie = auth_bearer.split("Bearer ")
    return cookie


def save_cookie_to_env(cookie: str) -> None:
    """
    Save the cookie to my .env file
    and override the current env value
    """
    with open(".env", "a") as f:
        f.write(f"AUTH_COOKIE={cookie}\n")
    os.environ["AUTH_TOKEN"] = cookie


def login_to_ghin(driver: Chrome, login_url: str) -> None:
    # pull up the page
    driver.get(login_url)
    # wait for page to load
    time.sleep(2)
    # find the login elements
    email_input = driver.find_element("xpath", '//*[@id="emailOrGhin"]')
    password_input = driver.find_element("xpath", '//*[@id="password"]')
    cookie_popup_x_button = driver.find_element(
        "xpath", '//*[@id="onetrust-close-btn-container"]/button'
    )
    submit_button = driver.find_element(
        "xpath",
        '//*[@id="main-content"]/section/div[2]/div/div[1]/div/div[7]/div/button',
    )
    # input username and password
    cookie_popup_x_button.click()
    email_input.send_keys(os.environ["GHIN_NUMBER"])
    password_input.send_keys(os.environ["GHIN_LOGIN_PWD"])
    submit_button.click()
    # submit
    return driver


def save_last_pulled_time() -> None:
    with open("last_pulled_time.txt", "w") as f:
        f.write(str(dt.datetime.now()))


def get_last_pulled_time() -> dt.datetime:
    try:
        with open("last_pulled_time.txt", "r") as f:
            last_pulled_time = f.read()
            return dt.datetime.fromisoformat(last_pulled_time)
    except FileNotFoundError:
        return None


def process_to_get_ghin_cookie() -> None | str:
    last_pulled = get_last_pulled_time()
    # if we have pulled the cookie in the last 2 hours
    # don't pull it again
    if last_pulled is None:
        print("NO FILE")
        # if the last pulled time is less than 2 hours ago
    elif dt.datetime.now() - last_pulled < dt.timedelta(hours=2):
        # print("PULLED RECENTLY")
        return None
    first_url = "https://www.ghin.com/login/"
    api_url_to_find = "https://api2.ghin.com/api/v1/"
    driver = get_driver()
    driver = login_to_ghin(driver, first_url)
    time.sleep(2)  # wait for the login to complete
    cookie = get_cookie(driver, first_url, api_url_to_find)
    save_cookie_to_env(cookie)
    save_last_pulled_time()
    return cookie
