import { describe, expect, it, vi } from "vitest";

import { OllamaConnectionError, OllamaHttpError } from "./client";
import { OllamaModelNotFoundError, waitForOllamaReady } from "./health";

const MODEL = "gemma4:e4b-it-q4_K_M";
const tagsResponse = (names: string[]) =>
  new Response(JSON.stringify({ models: names.map((name) => ({ name })) }), { status: 200 });
const generateResponse = () => new Response(JSON.stringify({ response: "{}" }), { status: 200 });

// URLで /api/tags と /api/generate を振り分けるfetchのモックを作る。
function makeFetch(tags: () => Response | Promise<Response>, generate: () => Response = generateResponse) {
  return vi.fn(async (url: unknown, _init?: RequestInit) =>
    String(url).endsWith("/api/tags") ? tags() : generate()
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("waitForOllamaReady", () => {
  it("すぐ応答し、モデルがあれば待たずに試し生成まで成功する", async () => {
    const fetchImpl = makeFetch(() => tagsResponse([MODEL]));
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(waitForOllamaReady(MODEL, { fetchImpl, sleepImpl: sleep })).resolves.toBeUndefined();
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("起動待ち: 数回失敗してから応答すれば成功する（5秒間隔）", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(() => {
      calls++;
      if (calls < 3) throw new TypeError("fetch failed");
      return tagsResponse([MODEL]);
    });
    const sleep = vi.fn(async (_ms: number) => {});

    await waitForOllamaReady(MODEL, { fetchImpl, sleepImpl: sleep });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5000, 5000]);
  });

  it("上限まで応答がなければ OllamaConnectionError（120秒÷5秒=24回確認）", async () => {
    const fetchImpl = makeFetch(() => {
      throw new TypeError("fetch failed");
    });
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(waitForOllamaReady(MODEL, { fetchImpl, sleepImpl: sleep })).rejects.toBeInstanceOf(
      OllamaConnectionError
    );
    expect(fetchImpl).toHaveBeenCalledTimes(24);
    expect(sleep).toHaveBeenCalledTimes(23);
  });

  it("モデルが入っていなければ OllamaModelNotFoundError（試し生成はしない）", async () => {
    const fetchImpl = makeFetch(() => tagsResponse(["other:latest"]));

    await expect(
      waitForOllamaReady(MODEL, { fetchImpl, sleepImpl: async () => {} })
    ).rejects.toBeInstanceOf(OllamaModelNotFoundError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("試し生成が4xxで失敗したら OllamaHttpError をそのまま投げる", async () => {
    const fetchImpl = makeFetch(
      () => tagsResponse([MODEL]),
      () => new Response("{}", { status: 404, statusText: "Not Found" })
    );

    await expect(
      waitForOllamaReady(MODEL, { fetchImpl, sleepImpl: async () => {} })
    ).rejects.toBeInstanceOf(OllamaHttpError);
  });
});

describe("checkOllama", () => {
  it("状態を ok / model_missing / unreachable で返す", async () => {
    const { checkOllama } = await import("./health");
    expect(await checkOllama(MODEL, makeFetch(() => tagsResponse([MODEL])))).toBe("ok");
    expect(await checkOllama(MODEL, makeFetch(() => tagsResponse(["x"])))).toBe("model_missing");
    expect(
      await checkOllama(
        MODEL,
        makeFetch(() => {
          throw new TypeError("fetch failed");
        })
      )
    ).toBe("unreachable");
  });
});
