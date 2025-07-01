import os

from dotenv import load_dotenv

load_dotenv(override=True)


def get_headers():
    return {
        "authority": "api2.ghin.com",
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.5",
        "authorization": f"Bearer {os.getenv('AUTH_COOKIE')}",
        "origin": "https://www.ghin.com",
        "referer": "https://www.ghin.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    }
