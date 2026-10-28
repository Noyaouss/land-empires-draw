import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCategories, putFile } from "../src/github";

const KEY = "github_pat_SECRET123";
type Call = { url: string; init?: RequestInit };

function mockFetch(responses: (Response | Error)[]): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r || r instanceof Error) throw r ?? new Error("no response");
    return r;
  }));
  return calls;
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

afterEach(() => vi.unstubAllGlobals());

describe("putFile", () => {
  it("creates a new file on the art repo only", async () => {
    const calls = mockFetch([new Response("", { status: 404 }), json({}, 201)]);
    expect(await putFile(KEY, "items/trees/oak.png", new Uint8Array([1, 2, 3]), "art: trees/oak")).toBe("ok");
    for (const c of calls) expect(c.url.startsWith("https://api.github.com/repos/Noyaouss/land-empires-art/contents/")).toBe(true);
    expect(calls[1].url).toBe("https://api.github.com/repos/Noyaouss/land-empires-art/contents/items/trees/oak.png");
    const body = JSON.parse(calls[1].init!.body as string);
    expect(body).toEqual({ message: "art: trees/oak", content: "AQID", branch: "main" });
    expect((calls[1].init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  it("sends the old file id when replacing", async () => {
    const calls = mockFetch([json({ sha: "abc" }), json({})]);
    expect(await putFile(KEY, "items/trees/oak.png", new Uint8Array([1]), "m")).toBe("ok");
    expect(JSON.parse(calls[1].init!.body as string).sha).toBe("abc");
  });

  it("reports a bad key", async () => {
    mockFetch([new Response("", { status: 401 })]);
    expect(await putFile(KEY, "items/a/b.png", new Uint8Array(), "m")).toBe("auth");
    mockFetch([new Response("", { status: 404 }), new Response("", { status: 403 })]);
    expect(await putFile(KEY, "items/a/b.png", new Uint8Array(), "m")).toBe("auth");
  });

  it("retries later on network errors, server errors and conflicts", async () => {
    mockFetch([new TypeError("Failed to fetch")]);
    expect(await putFile(KEY, "items/a/b.png", new Uint8Array(), "m")).toBe("retry");
    mockFetch([new Response("", { status: 404 }), new Response("", { status: 502 })]);
    expect(await putFile(KEY, "items/a/b.png", new Uint8Array(), "m")).toBe("retry");
    mockFetch([new Response("", { status: 404 }), new Response("", { status: 409 })]);
    expect(await putFile(KEY, "items/a/b.png", new Uint8Array(), "m")).toBe("retry");
  });
});

describe("fetchCategories", () => {
  it("reads categories.json from the art repo", async () => {
    const file = { categories: [{ id: "x", name: "X", sizes: [{ name: "s", w: 16, h: 16 }] }] };
    const calls = mockFetch([json({ content: btoa(JSON.stringify(file)) })]);
    expect(await fetchCategories(KEY)).toEqual(file);
    expect(calls[0].url).toBe("https://api.github.com/repos/Noyaouss/land-empires-art/contents/categories.json?ref=main");
  });

  it("reports a bad key or no network", async () => {
    mockFetch([new Response("", { status: 404 })]);
    expect(await fetchCategories(KEY)).toBe("auth");
    mockFetch([new TypeError("offline")]);
    expect(await fetchCategories(KEY)).toBe("retry");
  });
});
