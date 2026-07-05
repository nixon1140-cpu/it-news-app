// articles テーブルへのダミーデータ投入スクリプト。
// 実行例:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "環境変数 SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const articles = [
  {
    title: "OpenAI、次世代モデル「GPT-6」を発表。推論コストを前世代比1/5に削減",
    url: "https://example.com/news/gpt-6-launch",
    summary:
      "OpenAIが新モデルGPT-6を発表\nAPI利用コストを大幅に削減し中小企業の導入障壁を低減\nマルチモーダル性能が大幅に向上し、動画理解にも対応",
    trend_diff:
      "前モデルGPT-5では推論コストの高さが企業導入のボトルネックだったが、GPT-6ではコスト構造が刷新され、本格的な業務利用が現実的な選択肢になった。",
    action_individual:
      "個人開発者は既存のGPT-5実装をGPT-6 APIに切り替えるコスト比較を今週中に行いましょう。無料枠でのプロトタイプ移行を試し、レスポンス品質とコストの両方を確認してください。",
    action_enterprise:
      "情報システム部門は既存のAI活用プロジェクトのAPIコスト見直しを実施し、GPT-6への移行によるTCO削減効果を算出してください。PoC予算を確保し、3ヶ月以内の移行計画を経営層に提案することを推奨します。",
    category: "AI",
    priority_label: "High",
    importance: 5,
    published_at: daysAgo(0),
  },
  {
    title: "AWS、生成AI専用インスタンス「Trn3」を発表。学習コストを大幅圧縮",
    url: "https://example.com/news/aws-trn3-instance",
    summary:
      "AWSが新型AI学習用インスタンスTrn3を発表\nNVIDIA非依存の独自チップにより学習コストを最大40%削減\nまずは米国リージョンから提供開始、日本展開は2026年後半予定",
    trend_diff:
      "従来のTrn2世代と比べてメモリ帯域が2倍に拡張され、大規模言語モデルのファインチューニングにかかる時間が短縮された点が最大の変化。",
    action_individual:
      "個人でモデルのファインチューニングを行っている場合、Trn3のプレビュー利用枠（無料トライアル）に申し込み、現在使用しているGPUインスタンスとのコスト比較を行いましょう。",
    action_enterprise:
      "クラウドコスト最適化の一環として、現行のAI学習基盤をTrn3へ移行した場合のコストシミュレーションをインフラ部門に依頼してください。ベンダーロックインのリスクも併せて評価することが重要です。",
    category: "クラウド",
    priority_label: "High",
    importance: 5,
    published_at: daysAgo(1),
  },
  {
    title: "Google Cloud、企業向けRAG構築サービス「Vertex RAG Studio」をベータ公開",
    url: "https://example.com/news/vertex-rag-studio-beta",
    summary:
      "Google CloudがRAGパイプラインをGUIで構築できるVertex RAG Studioをベータ公開\n社内ドキュメントの自動チャンク分割・埋め込み生成を標準サポート\n既存のBigQueryデータとのシームレスな連携が可能",
    trend_diff:
      "これまでRAG構築には専門的なエンジニアリングが必要だったが、本サービスにより非エンジニアでも社内データを使ったQAシステムを構築できるようになった点が大きな変化。",
    action_individual:
      "自分の学習用ノートや過去の資料を使ったRAGシステムをベータ版で試作し、ハンズオン経験を積んでおくとキャリア上のアピールポイントになります。",
    action_enterprise:
      "社内ナレッジ検索の効率化を検討している場合、まず限定部署でのPoCを実施し、既存の社内文書管理システムとの連携可否を確認してください。情報セキュリティ部門とのデータ取扱いレビューも並行して進めるべきです。",
    category: "クラウド",
    priority_label: "Mid",
    importance: 3,
    published_at: daysAgo(2),
  },
  {
    title: "Anthropic、Claudeの企業向け監査ログ機能を強化。SOC2 Type2対応を完了",
    url: "https://example.com/news/anthropic-audit-log-soc2",
    summary:
      "Claude for Enterpriseに詳細な操作監査ログ機能が追加\nSOC2 Type2準拠の認証を取得し、金融・医療業界での採用が進む見込み\nログのSIEM連携APIも同時提供開始",
    trend_diff:
      "従来は監査要件の厳しい業界での導入が難しかったが、コンプライアンス対応が整ったことで導入対象業界が拡大した。",
    action_individual:
      "現時点では個人利用への直接的な影響は小さいですが、勤務先がコンプライアンス要件の厳しい業界であれば、この情報を社内のAI導入検討チームに共有しておくと良いでしょう。",
    action_enterprise:
      "コンプライアンス部門と連携し、SOC2 Type2対応を要件としていた既存のAI導入保留案件を再評価してください。監査ログAPIのSIEM連携設計を情報システム部門に依頼することを推奨します。",
    category: "AI",
    priority_label: "Mid",
    importance: 3,
    published_at: daysAgo(3),
  },
  {
    title: "Microsoft Azure、リージョン間レイテンシを20%改善する新ネットワーク基盤を展開",
    url: "https://example.com/news/azure-network-latency-improvement",
    summary:
      "Azureがバックボーンネットワークを刷新しリージョン間通信を高速化\n主要リージョン間のレイテンシが平均20%改善\n追加コストなしで既存ユーザーにも自動適用",
    trend_diff:
      "リージョン間のデータ転送がボトルネックになっていたマルチリージョン構成のアプリケーションにとって、設定変更なしで性能改善が得られる点が変化点。",
    action_individual:
      "直接的なアクションは不要ですが、複数リージョンを利用しているアプリの応答速度が改善されているか、興味があれば一度ベンチマークを取ってみても良いでしょう。",
    action_enterprise:
      "マルチリージョン構成のシステムを運用している場合、改善後のレイテンシを計測し、SLA文書や顧客向けパフォーマンス報告の更新を検討してください。追加コストが発生しないため、特別な予算申請は不要です。",
    category: "クラウド",
    priority_label: "Low",
    importance: 1,
    published_at: daysAgo(4),
  },
];

const { data, error } = await supabase.from("articles").insert(articles).select("id, title");

if (error) {
  console.error("シード投入に失敗しました:", error.message);
  process.exit(1);
}

console.log(`${data.length}件の記事を投入しました。`);
data.forEach((row) => console.log(`- ${row.id}: ${row.title}`));
