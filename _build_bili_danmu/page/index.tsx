import { Navigation, NavigationStack, Path, useEffect, useState } from "scripting";
import {
  ConfigInput,
  buildAssFromXml,
  buildConfig,
  defaultConfigInput,
  fetchDanmuXmlByCid,
  fileStemFromPath,
  parseDenylist,
  replaceExt,
  resolveMeta,
  sanitizeFilename,
  saveAsAss,
  saveAsXml,
  saveTextFile,
  statusSummary,
} from "../class/danmu";
import { WebDavConfig } from "../class/webdav";
import { HomeView } from "./home";
import { SettingView } from "./setting";
import { WebDavBrowserView } from "./webdav";

const STORAGE_KEYS = {
  configInput: "bili_danmu_config_input",
  denylistText: "bili_danmu_denylist_text",
  webdavBaseUrl: "bili_danmu_webdav_base_url",
  webdavUsername: "bili_danmu_webdav_username",
  webdavStartPath: "bili_danmu_webdav_start_path",
  webdavUserAgent: "bili_danmu_webdav_user_agent",
  webdavPlayer: "bili_danmu_webdav_player",
  latestAssText: "bili_danmu_latest_ass_text",
  latestAssUpdatedAt: "bili_danmu_latest_ass_updated_at",
};

const LATEST_ASS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEYCHAIN_KEYS = {
  webdavPassword: "bili_danmu_webdav_password",
};
const LEGACY_PASSWORD_STORAGE_KEY = "bili_danmu_webdav_password";

type LastXmlState = {
  title: string;
  xml: string;
};

type LastAssState = {
  title: string;
  ass: string;
  total: number;
  converted: number;
  skippedByDeny: number;
};

function loadConfigInputFromStorage(): ConfigInput {
  const def = defaultConfigInput();
  const saved = Storage.get<Partial<ConfigInput>>(STORAGE_KEYS.configInput);
  if (!saved || typeof saved !== "object") return def;
  return {
    ...def,
    ...saved,
    bold: typeof saved.bold === "boolean" ? saved.bold : def.bold,
  };
}

function loadString(key: string, fallback: string): string {
  const v = Storage.get<string>(key);
  return typeof v === "string" ? v : fallback;
}

function loadNumber(key: string, fallback: number): number {
  const v = Storage.get<number>(key);
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function loadWebDavPassword(): string {
  try {
    const secure = Keychain.get(KEYCHAIN_KEYS.webdavPassword);
    if (typeof secure === "string") return secure;
  } catch (_) {}

  const legacy = loadString(LEGACY_PASSWORD_STORAGE_KEY, "");
  if (legacy) {
    try {
      Keychain.set(KEYCHAIN_KEYS.webdavPassword, legacy);
    } catch (_) {}
  }
  return legacy;
}

function saveWebDavPassword(value: string) {
  let keychainOk = false;
  try {
    if (value) {
      keychainOk = Keychain.set(KEYCHAIN_KEYS.webdavPassword, value) === true;
    } else {
      keychainOk = Keychain.remove(KEYCHAIN_KEYS.webdavPassword) === true;
    }
  } catch (_) {}

  // Fallback persistence: keeps password available on environments where Keychain write is unavailable.
  if (!keychainOk) {
    Storage.set(LEGACY_PASSWORD_STORAGE_KEY, value);
  } else if (!value) {
    Storage.set(LEGACY_PASSWORD_STORAGE_KEY, "");
  }
}

async function askOpenWebDavAfterAss(): Promise<boolean> {
  const dlg: any = Dialog as any;
  if (dlg && typeof dlg.confirm === "function") {
    try {
      const r = await dlg.confirm({
        title: "转换完成",
        message: "是否立即打开 WebDAV 视频播放？",
      });
      if (typeof r === "boolean") return r;
      if (r && typeof r.confirmed === "boolean") return r.confirmed;
      if (r && typeof r.value === "boolean") return r.value;
    } catch (_) {}
  }
  return false;
}

export function View() {
  const dismiss = Navigation.useDismiss();

  const [input, setInput] = useState("");
  const [status, setStatus] = useState("就绪：输入 B 站链接 / BV号 / ep号");
  const [loading, setLoading] = useState(false);
  const [configInput, setConfigInput] = useState<ConfigInput>(loadConfigInputFromStorage());
  const [denylistText, setDenylistText] = useState(loadString(STORAGE_KEYS.denylistText, ""));
  const [webdavBaseUrl, setWebdavBaseUrl] = useState(loadString(STORAGE_KEYS.webdavBaseUrl, ""));
  const [webdavUsername, setWebdavUsername] = useState(loadString(STORAGE_KEYS.webdavUsername, ""));
  const [webdavPassword, setWebdavPassword] = useState(loadWebDavPassword());
  const [webdavStartPath, setWebdavStartPath] = useState(loadString(STORAGE_KEYS.webdavStartPath, "/"));
  const [webdavUserAgent, setWebdavUserAgent] = useState(loadString(STORAGE_KEYS.webdavUserAgent, ""));
  const [webdavPlayer, setWebdavPlayer] = useState<"senplayer" | "infuse">(
    loadString(STORAGE_KEYS.webdavPlayer, "senplayer") === "infuse" ? "infuse" : "senplayer",
  );
  const [lastXml, setLastXml] = useState<LastXmlState | null>(null);
  const [lastAss, setLastAss] = useState<LastAssState | null>(null);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.configInput, configInput);
  }, [configInput]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.denylistText, denylistText);
  }, [denylistText]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.webdavBaseUrl, webdavBaseUrl);
  }, [webdavBaseUrl]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.webdavUsername, webdavUsername);
  }, [webdavUsername]);

  useEffect(() => {
    saveWebDavPassword(webdavPassword);
  }, [webdavPassword]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.webdavStartPath, webdavStartPath);
  }, [webdavStartPath]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.webdavUserAgent, webdavUserAgent);
  }, [webdavUserAgent]);

  useEffect(() => {
    Storage.set(STORAGE_KEYS.webdavPlayer, webdavPlayer);
  }, [webdavPlayer]);

  useEffect(() => {
    const updatedAt = loadNumber(STORAGE_KEYS.latestAssUpdatedAt, 0);
    const now = Date.now();
    if (updatedAt > 0 && now - updatedAt > LATEST_ASS_TTL_MS) {
      Storage.set(STORAGE_KEYS.latestAssText, "");
      Storage.set(STORAGE_KEYS.latestAssUpdatedAt, 0);
    }
  }, []);

  function getConfigAndDenylist() {
    return {
      cfg: buildConfig(configInput),
      denylist: parseDenylist(denylistText),
    };
  }

  async function openWebDavBrowser(sessionAssTextArg?: string) {
    if (!webdavBaseUrl.trim()) {
      setStatus("请先填写 WebDAV 服务器地址");
      return;
    }
    const cfg: WebDavConfig = {
      baseUrl: webdavBaseUrl.trim(),
      username: webdavUsername.trim(),
      password: webdavPassword,
      startPath: webdavStartPath.trim() || "/",
      userAgent: webdavUserAgent.trim(),
    };
    await Navigation.present({
      element: (
        <WebDavBrowserView
          config={cfg}
          player={webdavPlayer}
          sessionAssText={sessionAssTextArg ?? lastAss?.ass ?? loadString(STORAGE_KEYS.latestAssText, "")}
          onLog={(msg) => {
            setStatus(msg);
          }}
        />
      ),
    });
  }

  async function onDownloadXml() {
    if (loading) return;
    const raw = input.trim();
    if (!raw) {
      setStatus("请输入链接或 ID");
      return;
    }

    setLoading(true);
    try {
      const meta = await resolveMeta(raw);
      setStatus(`已获取 CID: ${meta.cid}\n正在拉取 XML...`);
      const xml = await fetchDanmuXmlByCid(meta.cid);
      setLastXml({ title: meta.title, xml });
      setStatus(`XML 获取完成（未保存）\n标题: ${meta.title}\n可点击“导出 XML 到文件”手动保存`);
    } catch (error: any) {
      setStatus(`失败: ${String(error?.message ?? error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadAss() {
    if (loading) return;
    const raw = input.trim();
    if (!raw) {
      setStatus("请输入链接或 ID");
      return;
    }

    setLoading(true);
    try {
      const { cfg, denylist } = getConfigAndDenylist();
      const meta = await resolveMeta(raw);
      setStatus(`已获取 CID: ${meta.cid}\n正在拉取 XML 并转换 ASS...`);
      const xml = await fetchDanmuXmlByCid(meta.cid);
      const built = buildAssFromXml(xml, sanitizeFilename(meta.title), cfg, denylist);
      setLastXml({ title: meta.title, xml });
      setLastAss({
        title: meta.title,
        ass: built.ass,
        total: built.total,
        converted: built.converted,
        skippedByDeny: built.skippedByDeny,
      });
      Storage.set(STORAGE_KEYS.latestAssText, built.ass);
      Storage.set(STORAGE_KEYS.latestAssUpdatedAt, Date.now());
      setStatus(`ASS 转换完成（未保存）\n标题: ${meta.title}\n弹幕总数: ${built.total}\n成功排布: ${built.converted}\n黑名单过滤: ${built.skippedByDeny}\n可点击“导出 ASS 到文件”手动保存`);

      const shouldOpen = await askOpenWebDavAfterAss();
      if (shouldOpen) {
        await openWebDavBrowser(built.ass);
      }
    } catch (error: any) {
      setStatus(`失败: ${String(error?.message ?? error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function onExportXml() {
    if (loading) return;
    if (!lastXml) {
      setStatus("当前没有可导出的 XML，请先点击“获取 XML（不保存）”");
      return;
    }
    setLoading(true);
    try {
      const dir = await DocumentPicker.pickDirectory();
      if (!dir) {
        setStatus("已取消导出 XML");
        return;
      }
      const path = Path.join(dir, `${sanitizeFilename(lastXml.title)}.xml`);
      await saveAsXml(path, lastXml.xml);
      setStatus(`XML 导出完成\n路径: ${path}`);
    } catch (error: any) {
      setStatus(`导出 XML 失败: ${String(error?.message ?? error)}`);
    } finally {
      try {
        DocumentPicker.stopAcessingSecurityScopedResources();
      } catch (_) {}
      setLoading(false);
    }
  }

  async function onExportAss() {
    if (loading) return;
    if (!lastAss) {
      setStatus("当前没有可导出的 ASS，请先点击“转换 ASS（不保存）”");
      return;
    }
    setLoading(true);
    try {
      const dir = await DocumentPicker.pickDirectory();
      if (!dir) {
        setStatus("已取消导出 ASS");
        return;
      }
      const path = Path.join(dir, `${sanitizeFilename(lastAss.title)}.ass`);
      await saveTextFile(path, lastAss.ass);
      setStatus(`ASS 导出完成\n路径: ${path}`);
    } catch (error: any) {
      setStatus(`导出 ASS 失败: ${String(error?.message ?? error)}`);
    } finally {
      try {
        DocumentPicker.stopAcessingSecurityScopedResources();
      } catch (_) {}
      setLoading(false);
    }
  }

  async function onPickLocalXmlAndConvert() {
    if (loading) return;
    setLoading(true);
    try {
      const { cfg, denylist } = getConfigAndDenylist();
      const files = await DocumentPicker.pickFiles();
      const xmlPath = files && files.length > 0 ? files[0] : null;
      if (!xmlPath) {
        setStatus("已取消选择本地 XML");
        return;
      }
      if (!xmlPath.toLowerCase().endsWith(".xml")) {
        throw new Error("请选择 .xml 文件");
      }

      setStatus(`正在读取本地 XML...\n${xmlPath}`);
      const xml = await FileManager.readAsString(xmlPath);
      const assPath = replaceExt(xmlPath, ".ass");
      const title = fileStemFromPath(xmlPath);
      const result = await saveAsAss(assPath, xml, title, cfg, denylist);
      setStatus(`本地转换完成\nXML: ${xmlPath}\nASS: ${assPath}\n弹幕总数: ${result.total}\n成功排布: ${result.converted}\n黑名单过滤: ${result.skippedByDeny}`);
    } catch (error: any) {
      setStatus(`失败: ${String(error?.message ?? error)}`);
    } finally {
      try {
        DocumentPicker.stopAcessingSecurityScopedResources();
      } catch (_) {}
      setLoading(false);
    }
  }

  async function onBatchConvertDirectory() {
    if (loading) return;
    setLoading(true);
    try {
      const { cfg, denylist } = getConfigAndDenylist();
      const dir = await DocumentPicker.pickDirectory();
      if (!dir) {
        setStatus("已取消目录选择");
        return;
      }

      setStatus(`正在扫描目录...\n${dir}`);
      const entries = await FileManager.readDirectory(dir, true);
      const xmlFiles = entries
        .map((p) => (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) ? p : Path.join(dir, p)))
        .filter((p) => p.toLowerCase().endsWith(".xml"));

      if (xmlFiles.length === 0) {
        setStatus("目录中没有找到 XML 文件");
        return;
      }

      let ok = 0;
      let fail = 0;
      let totalDanmu = 0;
      let convertedDanmu = 0;

      for (let i = 0; i < xmlFiles.length; i += 1) {
        const xmlPath = xmlFiles[i];
        setStatus(`批量转换中 ${i + 1}/${xmlFiles.length}\n${xmlPath}`);
        try {
          const xml = await FileManager.readAsString(xmlPath);
          const assPath = replaceExt(xmlPath, ".ass");
          const title = fileStemFromPath(xmlPath);
          const result = await saveAsAss(assPath, xml, title, cfg, denylist);
          ok += 1;
          totalDanmu += result.total;
          convertedDanmu += result.converted;
        } catch (_) {
          fail += 1;
        }
      }

      setStatus(`批量完成\n目录: ${dir}\nXML 数量: ${xmlFiles.length}\n成功: ${ok}\n失败: ${fail}\n总弹幕: ${totalDanmu}\n成功排布: ${convertedDanmu}`);
    } catch (error: any) {
      setStatus(`失败: ${String(error?.message ?? error)}`);
    } finally {
      try {
        DocumentPicker.stopAcessingSecurityScopedResources();
      } catch (_) {}
      setLoading(false);
    }
  }

  function onClear() {
    if (loading) return;
    setInput("");
    setStatus("已清空，等待输入");
  }

  function onClearCache() {
    if (loading) return;
    Storage.set(STORAGE_KEYS.latestAssText, "");
    Storage.set(STORAGE_KEYS.latestAssUpdatedAt, 0);
    setLastXml(null);
    setLastAss(null);
    setStatus("缓存已清理：已清空 ASS 缓存与本次转换状态");
  }

  async function onOpenSettings() {
    await Navigation.present({
      element: (
        <SettingView
          configInput={configInput}
          setConfigInput={setConfigInput}
          denylistText={denylistText}
          setDenylistText={setDenylistText}
        />
      ),
    });
  }

  async function onOpenWebDavBrowser() {
    await openWebDavBrowser();
  }

  return (
    <NavigationStack>
      <HomeView
        input={input}
        setInput={setInput}
        status={status}
        loading={loading}
        configSummary={statusSummary(configInput, denylistText)}
        onDownloadXml={onDownloadXml}
        onDownloadAss={onDownloadAss}
        onExportXml={onExportXml}
        onExportAss={onExportAss}
        onPickLocalXmlAndConvert={onPickLocalXmlAndConvert}
        onBatchConvertDirectory={onBatchConvertDirectory}
        onOpenSettings={onOpenSettings}
        webdavBaseUrl={webdavBaseUrl}
        setWebdavBaseUrl={setWebdavBaseUrl}
        webdavUsername={webdavUsername}
        setWebdavUsername={setWebdavUsername}
        webdavPassword={webdavPassword}
        setWebdavPassword={setWebdavPassword}
        webdavStartPath={webdavStartPath}
        setWebdavStartPath={setWebdavStartPath}
        webdavUserAgent={webdavUserAgent}
        setWebdavUserAgent={setWebdavUserAgent}
        webdavPlayer={webdavPlayer}
        setWebdavPlayer={setWebdavPlayer}
        onOpenWebDavBrowser={onOpenWebDavBrowser}
        onClearCache={onClearCache}
        onClear={onClear}
        onDismiss={dismiss}
      />
    </NavigationStack>
  );
}

