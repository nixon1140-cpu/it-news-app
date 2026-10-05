import { describe, expect, it, vi } from "vitest";

import {
  generateJson,
  OllamaConnectionError,
  OllamaHttpError,
  OllamaTimeoutError,
} from "./client";

const okResponse = (response: string) =>
  new Response(JSON.stringify({ response }), { status: 200 });
const statusResponse = (status: number) => new Response("{}", { status, statusText: "ERR" });
const noSleep = vi.fn(async (_ms: number) => {});

describe("generateJson", () => {
  it("正常系: responseを返し、keep_alive・model・formatをリクエストに含める", async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => okResponse('{"a":1}'));
    const result = await generateJson("hi", { fetchImpl, sleepImpl: noSleep });

    expect(result).toBe('{"a":1}');
    const sent = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.keep_alive).toBe("30m");
    expect(sent.model).toBe("gemma4:e4b-it-q4_K_M");
    expect(sent.format).toBe("json");
    expect(sent.stream).toBe(false);
  });

  it("5xxは再試行し、成功すれば結果を返す", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(500))
      .mockResolvedValueOnce(okResponse("ok"));
    const sleep = vi.fn(async (_ms: number) => {});

    expect(await generateJson("hi", { fetchImpl, sleepImpl: sleep })).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("5xxが続くと3回試行して OllamaHttpError を投げる（待機は2秒→4秒）", async () => {
    const fetchImpl = vi.fn(async () => statusResponse(503));
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(generateJson("hi", { fetchImpl, sleepImpl: sleep })).rejects.toBeInstanceOf(
      OllamaHttpError
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000]);
  });

  it("4xxは再試行せず即座に失敗する", async () => {
    const fetchImpl = vi.fn(async () => statusResponse(404));

    await expect(
      generateJson("hi", { fetchImpl, sleepImpl: noSleep })
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("接続エラーは再試行し、続けば OllamaConnectionError を投げる", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      generateJson("hi", { fetchImpl, sleepImpl: noSleep })
    ).rejects.toBeInstanceOf(OllamaConnectionError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("タイムアウトは再試行せず OllamaTimeoutError を投げる", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    ) as unknown as typeof fetch;

    await expect(
      generateJson("hi", { fetchImpl, sleepImpl: noSleep, timeoutMs: 20 })
    ).rejects.toBeInstanceOf(OllamaTimeoutError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
