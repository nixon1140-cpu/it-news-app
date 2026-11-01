"""pytest 共通設定。python/ 直下のスクリプトを import / subprocess で呼べるようにする。"""

import subprocess
import sys
from pathlib import Path

import pytest

PYTHON_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

sys.path.insert(0, str(PYTHON_DIR))


@pytest.fixture
def run_script():
    """スクリプトを標準入力つきで実行する（ネットワークは使わない）。"""

    def _run(script: str, stdin: str | bytes, *args: str) -> subprocess.CompletedProcess:
        data = stdin.encode("utf-8") if isinstance(stdin, str) else stdin
        return subprocess.run(
            [sys.executable, str(PYTHON_DIR / script), *args],
            input=data,
            capture_output=True,
            timeout=60,
        )

    return _run
