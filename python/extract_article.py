"""記事HTMLから本文・タイトル・公開日を抽出し、JSONを標準出力に返す。

Node.js側（src/scripts/crawler.ts）から child_process.execFile 経由で
呼び出される想定。HTML文字列は標準入力（UTF-8）から受け取る。

使い方:
    echo "<html>...</html>" | python extract_article.py [--url https://example.com/article]

出力（成功時、標準出力に1行のJSON）:
    {"title": "...", "text": "...", "date": "..." | null}

失敗時は標準エラーにメッセージを出力し、終了コード1で終了する
（呼び出し側はこれを検知して既存のTypeScript実装にフォールバックすること）。
"""

import argparse
import json
import sys

import trafilatura

# Windows環境ではコンソールのコードページ（cp932等）依存でstdout/stderrへの
# 日本語出力が文字化けするため、呼び出し元（Node.js側）とのやり取りをUTF-8に固定する。
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract article body from HTML via trafilatura.")
    parser.add_argument("--url", default=None, help="抽出対象記事の元URL（メタデータ解決のヒント、省略可）")
    args = parser.parse_args()

    html = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    if not html.strip():
        print("Empty HTML input on stdin.", file=sys.stderr)
        return 1

    extracted_json = trafilatura.extract(
        html,
        url=args.url,
        output_format="json",
        with_metadata=True,
        favor_precision=True,
    )

    if not extracted_json:
        print("trafilatura failed to extract article content.", file=sys.stderr)
        return 1

    parsed = json.loads(extracted_json)
    result = {
        "title": parsed.get("title"),
        "text": parsed.get("text"),
        "date": parsed.get("date"),
    }

    if not result["text"]:
        print("trafilatura extracted no body text.", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
