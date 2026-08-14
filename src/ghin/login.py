import datetime as dt
import os

import requests
from dotenv import load_dotenv

load_dotenv()

GHIN_LOGIN_URL = "https://api2.ghin.com/api/v1/golfer_login.json"


def fetch_ghin_token(email_or_ghin: str, password: str) -> str:
    """
    Log in to GHIN directly via its login API - no browser required. This is
    the same request ghin.com's own frontend makes when you submit the login
    form; it returns a golfer_user_token that's used as the `Bearer` token on
    every other GHIN API call.
    """
    response = requests.post(
        GHIN_LOGIN_URL,
        json={
            "user": {
                "email_or_ghin": email_or_ghin,
                "password": password,
                "remember_me": True,
            },
            "token": "GHINcom",
            "source": "GHINcom",
        },
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=10,
    )
    if response.status_code != 200:
        # GHIN returns a 400 with a structured error body on bad credentials
        # rather than raising at the transport level, so surface its message
        # instead of a generic HTTPError.
        try:
            detail = response.json()["errors"]["digital_profile"][0]["top_line"]
        except (KeyError, IndexError, ValueError):
            detail = response.text
        raise RuntimeError(f"GHIN login failed ({response.status_code}): {detail}")

    return response.json()["golfer_user"]["golfer_user_token"]


def save_cookie_to_env(cookie: str) -> None:
    """
    Save the cookie to my .env file
    and override the current env value
    """
    with open(".env", "a") as f:
        f.write(f"AUTH_COOKIE={cookie}\n")
    os.environ["AUTH_TOKEN"] = cookie


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
    cookie = fetch_ghin_token(os.environ["GHIN_NUMBER"], os.environ["GHIN_LOGIN_PWD"])
    save_cookie_to_env(cookie)
    save_last_pulled_time()
    return cookie
