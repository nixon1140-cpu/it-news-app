@echo off
:: アプリのフォルダに移動（※過去のエラー履歴からパスを推測して設定している）
cd C:\Users\okina\it-news-app

echo Collecting IT News via Gemini...
:: 1. クローラーを実行して最新ニュースを取得（終わるまで待つ）
call npm run crawl

echo Starting server and opening browser...
:: 2. Next.jsのローカルサーバーを裏側（最小化状態）で起動
start /min cmd /c "npm run dev"

:: 3. サーバーが立ち上がるまで5秒間だけ待機
timeout /t 5 /nobreak >nul

:: 4. いつものブラウザでアプリの画面を自動で開く
start http://localhost:3000