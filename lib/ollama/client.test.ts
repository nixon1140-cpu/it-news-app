import { describe, expect, it } from "vitest";

import { extractJson } from "./client";

// extractJsonは「JSON本体らしき部分を文字列として抜き出す」だけの関数であり、
// JSON.parse自体は行わない（呼び出し側のcrawler.tsが後段でJSON.parseする）。
// このテストは現状の実装動作をそのまま固定するためのものであり、
// 仕様変更・バグ修正は行わない（発見した気になる挙動は残課題として報告する）。
describe("extractJson", () => {
  it("正常なJSON文字列はそのまま返す", () => {
    const input = '{"title":"foo","summary":"bar"}';
    expect(extractJson(input)).toBe(input);
  });

  it("```json フェンス付きの場合、フェンスを除去して中身を返す", () => {
    const input = '```json\n{"title":"foo"}\n```';
    expect(extractJson(input)).toBe('{"title":"foo"}');
  });

  it("言語指定なしの``` フェンスでも中身を返す", () => {
    const input = '```\n{"title":"foo"}\n```';
    expect(extractJson(input)).toBe('{"title":"foo"}');
  });

  it("前後に説明文が付随する場合、最初の{から最後の}までを抜き出す", () => {
    const input = 'Here is the JSON:\n{"title":"foo"}\nHope this helps.';
    expect(extractJson(input)).toBe('{"title":"foo"}');
  });

  it("閉じ括弧が無い（パース不能な）場合、フェンス除去も範囲抽出もできず全文をtrimして返す", () => {
    const input = 'prefix { "a": 1';
    expect(extractJson(input)).toBe('prefix { "a": 1');
  });

  it("波括弧を含まない文字列は全文をtrimして返す", () => {
    const input = "  not json at all  ";
    expect(extractJson(input)).toBe("not json at all");
  });

  it("空文字を渡すと空文字を返す", () => {
    expect(extractJson("")).toBe("");
  });

  it("入れ子の括弧は最外の{}を壊さずに抜き出す", () => {
    const input = 'Result: {"a":{"b":{"c":1}},"list":[{"x":1},{"y":2}]} done';
    const json = extractJson(input);
    expect(json).toBe('{"a":{"b":{"c":1}},"list":[{"x":1},{"y":2}]}');
    expect(JSON.parse(json)).toEqual({ a: { b: { c: 1 } }, list: [{ x: 1 }, { y: 2 }] });
  });

  // extractJson自体は例外を投げず、文字列を返すだけ。不正JSON・空文字が例外になるのは
  // 呼び出し側（crawler.ts / trends route）が後段で行うJSON.parseの時点であり、その流れを固定する。
  it("不正JSONを返した場合、後段のJSON.parseで例外になる", () => {
    expect(() => JSON.parse(extractJson('{"title": "foo",}'))).toThrow(SyntaxError);
    expect(() => JSON.parse(extractJson("not json at all"))).toThrow(SyntaxError);
  });

  it("空文字を返した場合、後段のJSON.parseで例外になる", () => {
    expect(() => JSON.parse(extractJson(""))).toThrow(SyntaxError);
  });

  // 型定義上はstringのみを受け付けるが、実行時にnull/undefinedが渡された場合の
  // 実際の挙動（TypeErrorをスローする）をそのまま固定する。
  // NOTE: これはLLM応答が空/欠落した場合にクラッシュする経路になり得るため、
  // 潜在的な改善余地として残課題に記載する（本ステップでは修正しない）。
  it("nullを渡すとTypeErrorをスローする（現状の実装動作）", () => {
    expect(() => extractJson(null as unknown as string)).toThrow(TypeError);
  });

  it("undefinedを渡すとTypeErrorをスローする（現状の実装動作）", () => {
    expect(() => extractJson(undefined as unknown as string)).toThrow(TypeError);
  });
});
