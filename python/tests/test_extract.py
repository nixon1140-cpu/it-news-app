"""extract_article.py のテスト。保存済みHTMLを標準入力に渡す（ネットワークなし）。"""

import json

from conftest import FIXTURES_DIR


def test_extracts_title_and_text_from_saved_html(run_script):
    html = (FIXTURES_DIR / "article.html").read_text(encoding="utf-8")
    result = run_script("extract_article.py", html)

    assert result.returncode == 0
    parsed = json.loads(result.stdout.decode("utf-8"))
    assert "ローカルLLM" in parsed["title"]
    assert "要約" in parsed["text"]
    # ナビゲーションやフッターは本文に入らない。
    assert "Copyright" not in parsed["text"]
    assert set(parsed) == {"title", "text", "date"}


def test_empty_input_exits_with_1(run_script):
    result = run_script("extract_article.py", "   \n")

    assert result.returncode == 1
    assert result.stdout == b""
    assert b"Empty HTML" in result.stderr


def test_page_without_body_text_exits_with_1(run_script):
    html = (FIXTURES_DIR / "no_body.html").read_text(encoding="utf-8")
    result = run_script("extract_article.py", html)

    assert result.returncode == 1
    assert result.stdout == b""
    assert result.stderr != b""
