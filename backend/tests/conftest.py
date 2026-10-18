import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oh-field-guide.preview.emergentagent.com").rstrip("/")
BRIDGE_TOKEN = os.environ.get("AI_BRIDGE_TOKEN", "ohg-bridge-7f3k9q2m")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def bridge_token():
    return BRIDGE_TOKEN


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
