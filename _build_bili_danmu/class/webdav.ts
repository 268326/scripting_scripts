import { fetch } from "scripting";

export type WebDavConfig = {
  baseUrl: string;
  username: string;
  password: string;
  startPath: string;
  userAgent: string;
};

export type WebDavEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
};

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".flv",
  ".wmv",
  ".m4v",
  ".ts",
  ".webm",
];

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function ensureLeadingSlash(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeDir(path: string): string {
  const v = ensureLeadingSlash(path).replace(/\/+/g, "/");
  if (v === "/") return "/";
  return v.replace(/\/+$/, "");
}

function joinPath(base: string, next: string): string {
  const a = normalizeDir(base);
  const b = normalizeDir(next);
  if (b === "/") return a;
  if (a === "/") return b;
  return `${a}${b}`;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      return encodeURIComponent(safeDecodeURIComponent(segment));
    })
    .join("/");
}

function dirname(path: string): string {
  const p = normalizeDir(path);
  if (p === "/") return "/";
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return "/";
  return p.slice(0, idx);
}

function basename(path: string): string {
  const p = normalizeDir(path);
  if (p === "/") return "/";
  const idx = p.lastIndexOf("/");
  return p.slice(idx + 1);
}

function splitBaseUrl(rawBaseUrl: string): { prefix: string; basePath: string } {
  const cleaned = rawBaseUrl.trim().replace(/\/+$/, "");
  const match = cleaned.match(/^(https?:\/\/)([^/]+)(\/.*)?$/i);
  if (!match) {
    throw new Error("WebDAV 地址格式错误，请使用 http(s)://host/path");
  }
  const scheme = match[1];
  const host = match[2];
  const path = normalizeDir(match[3] || "/");
  return {
    prefix: `${scheme}${host}`,
    basePath: path,
  };
}

function stripAuth(host: string): string {
  const idx = host.lastIndexOf("@");
  return idx >= 0 ? host.slice(idx + 1) : host;
}

function addAuthToBaseUrl(baseUrl: string, username: string, password: string): string {
  if (!username) return baseUrl;
  const cleaned = baseUrl.trim();
  const match = cleaned.match(/^(https?:\/\/)([^/]+)(\/.*)?$/i);
  if (!match) return cleaned;
  const scheme = match[1];
  const host = stripAuth(match[2]);
  const path = match[3] || "";
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password || "");
  return `${scheme}${user}:${pass}@${host}${path}`;
}

function requestBaseUrl(config: WebDavConfig): string {
  return addAuthToBaseUrl(config.baseUrl, config.username, config.password);
}

function normalizeHrefPath(href: string): string {
  const decoded = safeDecodeURIComponent(decodeXmlEntities(href).trim());
  const noQuery = decoded.split("?")[0].split("#")[0];
  const abs = noQuery.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  const path = abs ? abs[1] || "/" : noQuery;
  return ensureLeadingSlash(path);
}

function toRelativePath(config: WebDavConfig, hrefPath: string): string {
  const { basePath } = splitBaseUrl(requestBaseUrl(config));
  const fullPath = normalizeDir(hrefPath);
  const base = normalizeDir(basePath);
  if (base === "/") return fullPath;
  if (fullPath === base) return "/";
  if (fullPath.startsWith(`${base}/`)) {
    return ensureLeadingSlash(fullPath.slice(base.length));
  }
  return fullPath;
}

function remotePathToRequestUrl(config: WebDavConfig, remotePath: string): string {
  const reqBase = requestBaseUrl(config);
  const { prefix, basePath } = splitBaseUrl(reqBase);
  const fullPath = joinPath(basePath, remotePath);
  return `${prefix}${encodePathSegments(fullPath)}`;
}

function isVideoFile(path: string): boolean {
  const p = path.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => p.endsWith(ext));
}

export function parentPath(path: string): string {
  return dirname(path);
}

export function isVideoEntry(entry: WebDavEntry): boolean {
  return !entry.isDirectory && isVideoFile(entry.name);
}

export function isAssEntry(entry: WebDavEntry): boolean {
  return !entry.isDirectory && entry.name.toLowerCase().endsWith(".ass");
}

export function buildRemoteFileUrl(config: WebDavConfig, remotePath: string): string {
  return remotePathToRequestUrl(config, remotePath);
}

export async function listWebDavDirectory(config: WebDavConfig, remotePath: string): Promise<WebDavEntry[]> {
  const url = remotePathToRequestUrl(config, remotePath);
  const body =
    `<?xml version="1.0" encoding="utf-8" ?>` +
    `<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>`;

  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
      "User-Agent": config.userAgent || "BiliDanmuScripting/1.0",
    },
    body,
    timeout: 30,
  });

  if (!response.ok && response.status !== 207) {
    throw new Error(`WebDAV 目录读取失败: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const blocks = xml.match(/<(?:d:)?response[\s\S]*?<\/(?:d:)?response>/gi) || [];
  const current = normalizeDir(remotePath);
  const entries: WebDavEntry[] = [];

  for (const block of blocks) {
    const hrefMatch = block.match(/<(?:d:)?href[^>]*>([\s\S]*?)<\/(?:d:)?href>/i);
    if (!hrefMatch) continue;

    const hrefPath = normalizeHrefPath(hrefMatch[1]);
    const relPath = normalizeDir(toRelativePath(config, hrefPath));
    if (relPath === current) continue;
    if (current !== "/" && !relPath.startsWith(`${current}/`)) continue;
    const maybeDirectChild = relPath.slice(current === "/" ? 1 : current.length + 1);
    if (!maybeDirectChild || maybeDirectChild.includes("/")) continue;

    const isDirectory = /<(?:d:)?collection\b/i.test(block);
    const name = basename(relPath);
    if (!name || name === "/") continue;

    const sizeMatch = block.match(/<(?:d:)?getcontentlength[^>]*>(\d+)<\/(?:d:)?getcontentlength>/i);
    const size = sizeMatch ? Number(sizeMatch[1]) : undefined;

    entries.push({
      name,
      path: relPath,
      isDirectory,
      size,
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function uploadTextToWebDav(
  config: WebDavConfig,
  remotePath: string,
  content: string,
  contentType: string = "text/plain; charset=utf-8",
): Promise<void> {
  const url = remotePathToRequestUrl(config, remotePath);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "User-Agent": config.userAgent || "BiliDanmuScripting/1.0",
    },
    body: content,
    timeout: 30,
  });
  if (!response.ok) {
    throw new Error(`上传失败: HTTP ${response.status}`);
  }
}

export async function openInSenPlayer(args: {
  videoUrl: string;
  subtitleUrl?: string;
  name?: string;
  userAgent?: string;
}): Promise<{ ok: boolean; scheme: string }> {
  const scheme = buildSenPlayerPlayScheme(args);
  const ok = await tryOpenURLScheme(scheme);
  return { ok, scheme };
}

export async function openInInfuse(args: {
  videoUrl: string;
  subtitleUrl?: string;
  name?: string;
  userAgent?: string;
}): Promise<{ ok: boolean; scheme: string }> {
  const scheme = buildInfusePlayScheme(args);
  const ok = await tryOpenURLScheme(scheme);
  return { ok, scheme };
}

export function buildSenPlayerPlayScheme(args: {
  videoUrl: string;
  subtitleUrl?: string;
  name?: string;
  userAgent?: string;
}): string {
  const query: string[] = [];
  query.push(`url=${encodeURIComponent(args.videoUrl)}`);
  if (args.subtitleUrl) query.push(`sub=${encodeURIComponent(args.subtitleUrl)}`);
  if (args.name) query.push(`name=${encodeURIComponent(args.name)}`);
  if (args.userAgent) query.push(`User-Agent=${encodeURIComponent(args.userAgent)}`);
  return `SenPlayer://x-callback-url/play?${query.join("&")}`;
}

export function buildInfusePlayScheme(args: {
  videoUrl: string;
  subtitleUrl?: string;
}): string {
  const query: string[] = [];
  query.push(`url=${encodeURIComponent(args.videoUrl)}`);
  if (args.subtitleUrl) query.push(`sub=${encodeURIComponent(args.subtitleUrl)}`);
  return `infuse://x-callback-url/play?${query.join("&")}`;
}

export function localPathToFileUrl(path: string): string {
  if (/^file:\/\//i.test(path)) return path;
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

export async function tryOpenURLScheme(scheme: string): Promise<boolean> {
  const g: any = globalThis as any;
  const openers = [
    g?.Safari?.openURL,
    g?.App?.openURL,
    g?.System?.openURL,
    g?.Device?.openURL,
    g?.openURL,
  ].filter((fn) => typeof fn === "function");

  for (const fn of openers) {
    try {
      const ok = await fn(scheme);
      if (ok === undefined || ok === true) return true;
    } catch (_) {}
  }
  return false;
}
