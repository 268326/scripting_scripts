import { fetch, Path } from "scripting";

export type DanmuMeta = {
  cid: string;
  title: string;
};

type DanmuType = "float" | "top" | "bottom" | "reverse";

type DanmuItem = {
  timelineS: number;
  content: string;
  type: DanmuType;
  fontsize: number;
  rgb: [number, number, number];
};

type Lane = {
  lastShootTime: number;
  lastLength: number;
};

type Collision =
  | { kind: "separate"; closestDis: number }
  | { kind: "notEnoughTime"; closestDis: number }
  | { kind: "collide"; timeNeeded: number };

export type AssConfig = {
  duration: number;
  width: number;
  height: number;
  font: string;
  fontSize: number;
  widthRatio: number;
  horizontalGap: number;
  laneSize: number;
  floatPercentage: number;
  alpha: number;
  bold: boolean;
  outline: number;
  timeOffset: number;
};

export type ConfigInput = {
  width: string;
  height: string;
  font: string;
  fontSize: string;
  duration: string;
  laneSize: string;
  widthRatio: string;
  horizontalGap: string;
  floatPercentage: string;
  alpha: string;
  outline: string;
  timeOffset: string;
  bold: boolean;
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
};

export const DEFAULT_CONFIG: AssConfig = {
  duration: 15,
  width: 1920,
  height: 1080,
  font: "PingFang SC",
  fontSize: 56,
  widthRatio: 1.2,
  horizontalGap: 20,
  laneSize: 32,
  floatPercentage: 0.2,
  alpha: 0.7,
  bold: true,
  outline: 0.8,
  timeOffset: 0,
};

export const CLI_DEFAULT_CONFIG: AssConfig = {
  duration: 15,
  width: 1920,
  height: 1080,
  font: "PingFang SC",
  fontSize: 56,
  widthRatio: 1.2,
  horizontalGap: 20,
  laneSize: 32,
  floatPercentage: 0.2,
  alpha: 0.7,
  bold: true,
  outline: 0.8,
  timeOffset: 0,
};

export const WEBUI_DEFAULT_CONFIG: AssConfig = {
  duration: 10,
  width: 1920,
  height: 1080,
  font: "PingFang SC",
  fontSize: 56,
  widthRatio: 1.2,
  horizontalGap: 20,
  laneSize: 46,
  floatPercentage: 0.2,
  alpha: 0.7,
  bold: true,
  outline: 0.8,
  timeOffset: 0,
};

export function defaultConfigInput(): ConfigInput {
  return configToInput(DEFAULT_CONFIG);
}

export function configToInput(cfg: AssConfig): ConfigInput {
  return {
    width: String(cfg.width),
    height: String(cfg.height),
    font: cfg.font,
    fontSize: String(cfg.fontSize),
    duration: String(cfg.duration),
    laneSize: String(cfg.laneSize),
    widthRatio: String(cfg.widthRatio),
    horizontalGap: String(cfg.horizontalGap),
    floatPercentage: String(cfg.floatPercentage),
    alpha: String(cfg.alpha),
    outline: String(cfg.outline),
    timeOffset: String(cfg.timeOffset),
    bold: cfg.bold,
  };
}

export function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/[\\/*?:"<>|]/g, "").trim();
  return cleaned.length > 0 ? cleaned : `bilibili_danmu_${Date.now()}`;
}

export function replaceExt(path: string, ext: string): string {
  if (/\.[^./\\]+$/.test(path)) {
    return path.replace(/\.[^./\\]+$/, ext);
  }
  return `${path}${ext}`;
}

export function fileStemFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop() || "untitled";
  return name.replace(/\.xml$/i, "").replace(/\.[^./]+$/, "");
}

export function parseInput(raw: string): { bvId?: string; epId?: string } {
  const bvMatch = raw.match(/(BV[0-9A-Za-z]+)/i);
  if (bvMatch) {
    return { bvId: bvMatch[1] };
  }

  const epMatch = raw.match(/ep(\d+)/i);
  if (epMatch) {
    return { epId: epMatch[1] };
  }

  return {};
}

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

function parseXmlType(typeNum: number): DanmuType | null {
  if (typeNum === 1) return "float";
  if (typeNum === 4) return "bottom";
  if (typeNum === 5) return "top";
  if (typeNum === 6) return "reverse";
  return null;
}

function parseRgb(rgbNum: number): [number, number, number] {
  if ((rgbNum >>> 24) === 0) {
    return [(rgbNum >>> 16) & 0xff, (rgbNum >>> 8) & 0xff, rgbNum & 0xff];
  }
  if (rgbNum <= 255255255) {
    const k = 1000;
    return [((Math.floor(rgbNum / k / k)) % k) & 0xff, ((Math.floor(rgbNum / k)) % k) & 0xff, (rgbNum % k) & 0xff];
  }
  throw new Error(`颜色解析失败: ${rgbNum}`);
}

function parseDanmuPAttr(pAttr: string): DanmuItem | null {
  const parts = pAttr.split(",");
  if (parts.length < 4) {
    return null;
  }

  const timelineS = Number(parts[0]);
  const typeNum = Number(parts[1]);
  const fontsize = Number(parts[2]);
  const rgbNum = Number(parts[3]);

  if (!Number.isFinite(timelineS) || !Number.isFinite(typeNum) || !Number.isFinite(fontsize) || !Number.isFinite(rgbNum)) {
    return null;
  }

  const type = parseXmlType(typeNum);
  if (!type) {
    return null;
  }

  return {
    timelineS,
    content: "",
    type,
    fontsize,
    rgb: parseRgb(rgbNum),
  };
}

function parseDanmusFromXml(xml: string): DanmuItem[] {
  const list: DanmuItem[] = [];
  const reg = /<d\s+[^>]*p="([^"]+)"[^>]*>([\s\S]*?)<\/d>/g;
  let m: RegExpExecArray | null = null;

  while ((m = reg.exec(xml)) !== null) {
    const parsed = parseDanmuPAttr(m[1]);
    if (!parsed) {
      continue;
    }
    parsed.content = decodeXmlEntities(m[2]);
    list.push(parsed);
  }

  return list;
}

function danmuLength(d: DanmuItem, cfg: AssConfig): number {
  let weighted = 0;
  for (const ch of d.content) {
    weighted += ch.charCodeAt(0) < 128 ? 2 : 3;
  }
  return ((cfg.fontSize * weighted) / 3) * cfg.widthRatio;
}

function laneAvailableFor(lane: Lane, other: DanmuItem, cfg: AssConfig): Collision {
  const t = cfg.duration;
  const w = cfg.width;
  const gap = cfg.horizontalGap;

  const t1 = lane.lastShootTime;
  const t2 = other.timelineS;
  const l1 = lane.lastLength;
  const l2 = danmuLength(other, cfg);

  const v1 = (w + l1) / t;
  const v2 = (w + l2) / t;

  const deltaT = t2 - t1;
  const deltaX = v1 * deltaT - l1;

  if (deltaX < gap) {
    if (l2 <= l1) {
      return { kind: "collide", timeNeeded: (gap - deltaX) / v1 };
    }
    return { kind: "collide", timeNeeded: (t - (w - gap) / v2) - deltaT };
  }

  if (l2 <= l1) {
    return { kind: "separate", closestDis: deltaX - gap };
  }

  const pos = v2 * (t - deltaT);
  if (pos < w - gap) {
    return { kind: "notEnoughTime", closestDis: (w - gap) - pos };
  }
  return { kind: "collide", timeNeeded: (pos - (w - gap)) / v2 };
}

function formatAssTime(seconds: number): string {
  const secFloor = Math.floor(seconds);
  const hour = Math.floor(secFloor / 3600);
  const minutes = Math.floor((secFloor % 3600) / 60);
  const left = seconds - hour * 3600 - minutes * 60;
  return `${hour}:${String(minutes).padStart(2, "0")}:${left.toFixed(2).padStart(5, "0")}`;
}

function escapeAssText(text: string): string {
  return text.trim().replace(/\n/g, "\\N");
}

function alphaToAssOpacity(alpha: number): number {
  const clamped = Math.max(0, Math.min(1, alpha));
  return 255 - Math.floor(clamped * 255);
}

function assStyles(cfg: AssConfig): string {
  const a = alphaToAssOpacity(cfg.alpha).toString(16).padStart(2, "0");
  const bold = cfg.bold ? 1 : 0;
  const style = `Style: Float,${cfg.font},${cfg.fontSize},&H${a}FFFFFF,&H00FFFFFF,&H${a}000000,&H00000000,${bold},0,0,0,100,100,0.00,0.00,1,${cfg.outline},0,7,0,0,0,1`;
  return `${style}\n${style.replace("Style: Float", "Style: Bottom")}\n${style.replace("Style: Float", "Style: Top")}`;
}

export function parseDenylist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function convertXmlToAss(xml: string, title: string, cfg: AssConfig, denylist: string[]): { ass: string; total: number; converted: number; skippedByDeny: number } {
  const danmus = parseDanmusFromXml(xml)
    .map((d) => {
      if (d.type !== "float") {
        d.type = "float";
      }
      d.timelineS += cfg.timeOffset;
      return d;
    })
    .filter((d) => d.timelineS >= 0)
    .sort((a, b) => a.timelineS - b.timelineS);

  const lanesCount = Math.max(1, Math.floor((cfg.floatPercentage * cfg.height) / cfg.laneSize));
  const lanes: Array<Lane | null> = Array.from({ length: lanesCount }, () => null);

  const events: string[] = [];
  let converted = 0;
  let skippedByDeny = 0;

  for (const danmu of danmus) {
    if (denylist.some((k) => danmu.content.includes(k))) {
      skippedByDeny += 1;
      continue;
    }

    let placed = false;
    const collisions: Array<{ laneIdx: number; timeNeeded: number }> = [];

    for (let i = 0; i < lanes.length; i += 1) {
      const lane = lanes[i];
      if (!lane) {
        const y = i * cfg.laneSize;
        const l = danmuLength(danmu, cfg);
        lanes[i] = { lastShootTime: danmu.timelineS, lastLength: l };

        const [r, g, b] = danmu.rgb;
        events.push(
          `Dialogue: 2,${formatAssTime(danmu.timelineS)},${formatAssTime(danmu.timelineS + cfg.duration)},Float,,0,0,0,,{\\move(${cfg.width}, ${y}, ${-Math.floor(l)}, ${y})\\c&H${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}&}${escapeAssText(danmu.content)}`,
        );
        converted += 1;
        placed = true;
        break;
      }

      const col = laneAvailableFor(lane, danmu, cfg);
      if (col.kind === "separate" || col.kind === "notEnoughTime") {
        const y = i * cfg.laneSize;
        const l = danmuLength(danmu, cfg);
        lanes[i] = { lastShootTime: danmu.timelineS, lastLength: l };

        const [r, g, b] = danmu.rgb;
        events.push(
          `Dialogue: 2,${formatAssTime(danmu.timelineS)},${formatAssTime(danmu.timelineS + cfg.duration)},Float,,0,0,0,,{\\move(${cfg.width}, ${y}, ${-Math.floor(l)}, ${y})\\c&H${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}&}${escapeAssText(danmu.content)}`,
        );
        converted += 1;
        placed = true;
        break;
      }

      collisions.push({ laneIdx: i, timeNeeded: col.timeNeeded });
    }

    if (!placed && collisions.length > 0) {
      collisions.sort((a, b) => a.timeNeeded - b.timeNeeded);
      const best = collisions[0];
      if (best.timeNeeded < 1) {
        const shifted: DanmuItem = { ...danmu, timelineS: danmu.timelineS + best.timeNeeded + 0.01 };
        const y = best.laneIdx * cfg.laneSize;
        const l = danmuLength(shifted, cfg);
        lanes[best.laneIdx] = { lastShootTime: shifted.timelineS, lastLength: l };

        const [r, g, b] = shifted.rgb;
        events.push(
          `Dialogue: 2,${formatAssTime(shifted.timelineS)},${formatAssTime(shifted.timelineS + cfg.duration)},Float,,0,0,0,,{\\move(${cfg.width}, ${y}, ${-Math.floor(l)}, ${y})\\c&H${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}&}${escapeAssText(shifted.content)}`,
        );
        converted += 1;
      }
    }
  }

  const ass = `[Script Info]\n; Script generated by danmu2ass-scripting\nTitle: ${title}\nScriptType: v4.00+\nPlayResX: ${cfg.width}\nPlayResY: ${cfg.height}\nAspect Ratio: ${cfg.width}:${cfg.height}\nCollisions: Normal\nWrapStyle: 2\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.601\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${assStyles(cfg)}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join("\n")}`;

  return { ass, total: danmus.length, converted, skippedByDeny };
}

export function buildAssFromXml(
  xml: string,
  title: string,
  cfg: AssConfig,
  denylist: string[],
): { ass: string; total: number; converted: number; skippedByDeny: number } {
  return convertXmlToAss(xml, title, cfg, denylist);
}

function parseNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildConfig(input: ConfigInput): AssConfig {
  return {
    width: Math.max(1, Math.floor(parseNumber(input.width, DEFAULT_CONFIG.width))),
    height: Math.max(1, Math.floor(parseNumber(input.height, DEFAULT_CONFIG.height))),
    font: (input.font || DEFAULT_CONFIG.font).trim() || DEFAULT_CONFIG.font,
    fontSize: Math.max(1, Math.floor(parseNumber(input.fontSize, DEFAULT_CONFIG.fontSize))),
    duration: Math.max(0.1, parseNumber(input.duration, DEFAULT_CONFIG.duration)),
    laneSize: Math.max(1, Math.floor(parseNumber(input.laneSize, DEFAULT_CONFIG.laneSize))),
    widthRatio: Math.max(0.1, parseNumber(input.widthRatio, DEFAULT_CONFIG.widthRatio)),
    horizontalGap: Math.max(0, parseNumber(input.horizontalGap, DEFAULT_CONFIG.horizontalGap)),
    floatPercentage: Math.max(0, Math.min(1, parseNumber(input.floatPercentage, DEFAULT_CONFIG.floatPercentage))),
    alpha: Math.max(0, Math.min(1, parseNumber(input.alpha, DEFAULT_CONFIG.alpha))),
    outline: Math.max(0, parseNumber(input.outline, DEFAULT_CONFIG.outline)),
    timeOffset: parseNumber(input.timeOffset, DEFAULT_CONFIG.timeOffset),
    bold: input.bold,
  };
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: HEADERS,
    timeout: 20,
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  return await response.json();
}

async function fetchByBv(bvId: string): Promise<DanmuMeta> {
  const data = await getJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`);
  if (!data || data.code !== 0 || !data.data) {
    throw new Error(`获取 BV 数据失败: ${JSON.stringify(data)}`);
  }
  return { cid: String(data.data.cid), title: String(data.data.title) };
}

async function fetchByEp(epId: string): Promise<DanmuMeta> {
  const data = await getJson(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`);
  if (!data || data.code !== 0 || !data.result) {
    throw new Error(`获取 EP 数据失败: ${JSON.stringify(data)}`);
  }
  const episodes = Array.isArray(data.result.episodes) ? data.result.episodes : [];
  const target = episodes.find((item: any) => String(item.id) === String(epId));
  if (!target) {
    throw new Error("未在番剧列表中找到对应 EP");
  }
  return {
    cid: String(target.cid),
    title: `${String(data.result.title ?? "")} - ${String(target.title ?? "")} - ${String(target.long_title ?? "")}`,
  };
}

export async function resolveMeta(raw: string): Promise<DanmuMeta> {
  const parsed = parseInput(raw);
  if (!parsed.bvId && !parsed.epId) {
    throw new Error("无法识别 BV 或 ep，请检查输入");
  }
  return parsed.bvId ? await fetchByBv(parsed.bvId) : await fetchByEp(parsed.epId!);
}

export async function fetchDanmuXmlByCid(cid: string): Promise<string> {
  const response = await fetch(`https://comment.bilibili.com/${cid}.xml`, {
    headers: HEADERS,
    timeout: 30,
  });
  if (!response.ok) {
    throw new Error(`下载弹幕失败: ${response.status}`);
  }
  return await response.text();
}

export async function saveAsXml(path: string, xml: string): Promise<void> {
  const xmlData = Data.fromRawString(xml, "utf-8");
  if (!xmlData) {
    throw new Error("弹幕 XML 编码失败");
  }
  await FileManager.writeAsData(path, xmlData);
}

export async function saveAsAss(path: string, xml: string, title: string, cfg: AssConfig, denylist: string[]): Promise<{ total: number; converted: number; skippedByDeny: number }> {
  const result = convertXmlToAss(xml, sanitizeFilename(title), cfg, denylist);
  const assData = Data.fromRawString(result.ass, "utf-8");
  if (!assData) {
    throw new Error("ASS 编码失败");
  }
  await FileManager.writeAsData(path, assData);
  return {
    total: result.total,
    converted: result.converted,
    skippedByDeny: result.skippedByDeny,
  };
}

export async function saveTextFile(path: string, text: string): Promise<void> {
  const data = Data.fromRawString(text, "utf-8");
  if (!data) {
    throw new Error("文本编码失败");
  }
  await FileManager.writeAsData(path, data);
}

export function statusSummary(configInput: ConfigInput, denylistText: string): string {
  const cfg = buildConfig(configInput);
  const denyCnt = parseDenylist(denylistText).length;
  return `${cfg.width}x${cfg.height} | ${cfg.font} ${cfg.fontSize}px | ${cfg.duration}s | 黑名单 ${denyCnt}`;
}

export function xmlPathInDocuments(title: string): string {
  return Path.join(FileManager.documentsDirectory, "bili_danmu_latest.xml");
}

export function assPathInDocuments(title: string): string {
  return Path.join(FileManager.documentsDirectory, "bili_danmu_latest.ass");
}
