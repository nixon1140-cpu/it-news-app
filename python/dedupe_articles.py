"""記事タイトルのあいまい一致により重複候補をグループ化し、JSONで返す。

Node.js側（src/scripts/crawler.ts）から child_process.execFile 経由で
呼び出される想定。入力は標準入力から受け取るJSON配列
（[{"title": "...", "url": "..."}, ...]、クロール結果の記事一覧の順序）。

使い方:
    echo '[{"title":"A"},{"title":"B"}]' | python dedupe_articles.py [--threshold 90]

出力（標準出力に1行のJSON）:
    {"duplicate_groups": [[0, 3], [5, 7, 8]]}
    （各内側配列は、入力配列における重複記事のインデックスの組。
      呼び出し側は各グループの先頭以外を除外する想定）

失敗時は標準エラーにメッセージを出力し、終了コード1で終了する
（呼び出し側はこれを検知して重複除去をスキップし、全件をそのまま
扱うことでクロール全体を失敗させないこと）。
"""

import argparse
import json
import sys

from rapidfuzz import fuzz, process

# Windows環境ではコンソールのコードページ（cp932等）依存でstdout/stderrへの
# 日本語出力が文字化けするため、呼び出し元（Node.js側）とのやり取りをUTF-8に固定する。
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def find_duplicate_groups(titles: list[str], threshold: float) -> list[list[int]]:
    n = len(titles)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i, title in enumerate(titles):
        if not title:
            continue
        # i より後ろの候補のみと比較し、しきい値以上のものをすべて同じグループに結合する。
        candidates = {idx: t for idx, t in enumerate(titles) if idx > i and t}
        if not candidates:
            continue
        matches = process.extract(
            title,
            candidates,
            scorer=fuzz.ratio,
            score_cutoff=threshold,
            limit=None,
        )
        for _match_title, _score, idx in matches:
            union(i, idx)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        root = find(i)
        groups.setdefault(root, []).append(i)

    return [members for members in groups.values() if len(members) > 1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Find near-duplicate article titles via rapidfuzz.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=90.0,
        help="重複と判定するあいまい一致スコアのしきい値（0-100、既定値90）",
    )
    args = parser.parse_args()

    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    if not raw.strip():
        print("Empty JSON input on stdin.", file=sys.stderr)
        return 1

    try:
        items = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON input: {exc}", file=sys.stderr)
        return 1

    if not isinstance(items, list):
        print("Input must be a JSON array.", file=sys.stderr)
        return 1

    titles = [str(item.get("title", "")) for item in items]
    duplicate_groups = find_duplicate_groups(titles, args.threshold)

    print(json.dumps({"duplicate_groups": duplicate_groups}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
