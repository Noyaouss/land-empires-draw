// Upload to the private art repo through the GitHub contents API. The key goes only to api.github.com.
export const REPO = "Noyaouss/land-empires-art";
export const API = "https://api.github.com";
export type Result = "ok" | "auth" | "retry";

const url = (path: string) => `${API}/repos/${REPO}/contents/${path}`;
const headers = (key: string) => ({ Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json" });

function base64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function putFile(key: string, path: string, bytes: Uint8Array, message: string): Promise<Result> {
  try {
    const old = await fetch(`${url(path)}?ref=main`, { headers: headers(key) });
    if (old.status === 401 || old.status === 403) return "auth";
    // A private repo also answers 404 to a bad key; the PUT below tells the two apart.
    if (!old.ok && old.status !== 404) return "retry";
    const sha = old.ok ? ((await old.json()) as { sha?: string }).sha : undefined;
    const body = { message, content: base64(bytes), branch: "main", ...(sha ? { sha } : {}) };
    const r = await fetch(url(path), { method: "PUT", headers: headers(key), body: JSON.stringify(body) });
    if (r.ok) return "ok";
    if (r.status === 401 || r.status === 403 || r.status === 404) return "auth";
    return "retry";
  } catch {
    return "retry";
  }
}

export async function fetchCategories(key: string): Promise<unknown | "auth" | "retry"> {
  try {
    const r = await fetch(`${url("categories.json")}?ref=main`, { headers: headers(key) });
    if (r.status === 401 || r.status === 403 || r.status === 404) return "auth";
    if (!r.ok) return "retry";
    const { content } = (await r.json()) as { content: string };
    const text = new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
    return JSON.parse(text);
  } catch {
    return "retry";
  }
}
