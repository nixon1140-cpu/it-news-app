"""dedupe_articles.py のテスト（rapidfuzz のみ使用、ネットワークなし）。"""

import json

import pytest
from rapidfuzz import fuzz

from dedupe_articles import find_duplicate_groups

# 100文字の 'a' に k 文字だけ別の文字を混ぜると、fuzz.ratio は 100 - 2k になる想定の組。
BASE = "a" * 100


def _with_changes(k: int) -> str:
    return "a" * (100 - k) + "b" * k


@pytest.mark.parametrize(
    "changes, expected_score, is_duplicate",
    [
        (9, 91.0, True),
        (10, 90.0, True),  # しきい値ちょうどは重複扱い
        (11, 89.0, False),
    ],
)
def test_threshold_boundary_89_90_91(changes, expected_score, is_duplicate):
    other = _with_changes(changes)
    # 前提（テストデータが狙いの類似度になっていること）を先に確認する。
    assert fuzz.ratio(BASE, other) == expected_score

    groups = find_duplicate_groups([BASE, other], threshold=90.0)

    assert groups == ([[0, 1]] if is_duplicate else [])


def test_unrelated_titles_are_not_grouped():
    titles = ["OpenAI、ChatGPTの利用範囲を家庭向けに拡大する", "DuckDB v2の新機能まとめ"]
    assert find_duplicate_groups(titles, threshold=90.0) == []


def test_empty_titles_are_ignored():
    assert find_duplicate_groups(["", "", BASE], threshold=90.0) == []


def test_groups_are_transitive():
    titles = [BASE, _with_changes(9), "zzz", _with_changes(9)]
    assert find_duplicate_groups(titles, threshold=90.0) == [[0, 1, 3]]


def test_main_outputs_duplicate_groups_json(run_script):
    items = [{"title": BASE}, {"title": "unrelated"}, {"title": _with_changes(10)}]
    result = run_script("dedupe_articles.py", json.dumps(items))

    assert result.returncode == 0
    assert json.loads(result.stdout.decode("utf-8")) == {"duplicate_groups": [[0, 2]]}


@pytest.mark.parametrize(
    "stdin",
    ["", "   ", "not json", '{"title": "not an array"}'],
    ids=["empty", "blank", "invalid-json", "not-array"],
)
def test_main_failure_exits_with_1_and_no_stdout(run_script, stdin):
    # 失敗時は終了コード1・標準出力なし。呼び出し側(crawler.ts)がこれを見て重複除去をスキップし、
    # 全件を除外しない（crawler.ts側の挙動はこのテストの範囲外）。
    result = run_script("dedupe_articles.py", stdin)

    assert result.returncode == 1
    assert result.stdout == b""
    assert result.stderr != b""
