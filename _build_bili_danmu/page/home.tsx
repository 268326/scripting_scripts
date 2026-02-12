import { Button, List, Menu, Section, SecureField, Text, TextField } from "scripting";

export type AssDeliveryMode = "auto" | "local_httpserver" | "webdav_upload";

export function HomeView({
  input,
  setInput,
  status,
  loading,
  configSummary,
  onDownloadXml,
  onDownloadAss,
  onExportXml,
  onExportAss,
  onPickLocalXmlAndConvert,
  onBatchConvertDirectory,
  onOpenSettings,
  webdavBaseUrl,
  setWebdavBaseUrl,
  webdavUsername,
  setWebdavUsername,
  webdavPassword,
  setWebdavPassword,
  webdavStartPath,
  setWebdavStartPath,
  webdavUserAgent,
  setWebdavUserAgent,
  webdavPlayer,
  setWebdavPlayer,
  assDeliveryMode,
  setAssDeliveryMode,
  onOpenWebDavBrowser,
  onClearCache,
  onClear,
  onDismiss,
}: {
  input: string;
  setInput: (v: string) => void;
  status: string;
  loading: boolean;
  configSummary: string;
  onDownloadXml: () => Promise<void>;
  onDownloadAss: () => Promise<void>;
  onExportXml: () => Promise<void>;
  onExportAss: () => Promise<void>;
  onPickLocalXmlAndConvert: () => Promise<void>;
  onBatchConvertDirectory: () => Promise<void>;
  onOpenSettings: () => Promise<void>;
  webdavBaseUrl: string;
  setWebdavBaseUrl: (v: string) => void;
  webdavUsername: string;
  setWebdavUsername: (v: string) => void;
  webdavPassword: string;
  setWebdavPassword: (v: string) => void;
  webdavStartPath: string;
  setWebdavStartPath: (v: string) => void;
  webdavUserAgent: string;
  setWebdavUserAgent: (v: string) => void;
  webdavPlayer: "senplayer" | "infuse";
  setWebdavPlayer: (v: "senplayer" | "infuse") => void;
  assDeliveryMode: AssDeliveryMode;
  setAssDeliveryMode: (v: AssDeliveryMode) => void;
  onOpenWebDavBrowser: () => Promise<void>;
  onClearCache: () => void;
  onClear: () => void;
  onDismiss: () => void;
}) {
  return (
    <List
      navigationTitle={"B站弹幕下载 / 转ASS / WebDAV视频播放"}
      toolbar={{
        topBarLeading: <Button title={"退出"} systemImage={"xmark"} action={onDismiss} />,
        topBarTrailing: <Button title={"设置"} systemImage={"gearshape"} action={onOpenSettings} />,
      }}
    >
      <Section title={"说明"}>
        <Text>支持 ASS 转字幕并结合 WebDAV 视频播放（可带 ASS 字幕）。</Text>
      </Section>
      <Section title={"在线输入"}>
        <TextField
          title={"链接 / BV / ep"}
          value={input}
          onChanged={setInput}
          prompt={"例如: https://www.bilibili.com/video/BV... 或 ep123456"}
          axis={"vertical"}
        />
      </Section>
      <Section title={"在线下载"}>
        <Button title={loading ? "处理中..." : "获取 XML（不保存）"} action={onDownloadXml} />
        <Button title={loading ? "处理中..." : "转换 ASS（不保存）"} action={onDownloadAss} />
      </Section>
      <Section title={"导出（手动保存）"}>
        <Button title={loading ? "处理中..." : "导出 XML 到文件"} action={onExportXml} />
        <Button title={loading ? "处理中..." : "导出 ASS 到文件"} action={onExportAss} />
      </Section>
      <Section title={"本地转换"}>
        <Button title={loading ? "处理中..." : "选择 XML 转 ASS"} action={onPickLocalXmlAndConvert} />
        <Button title={loading ? "处理中..." : "目录批量转 ASS"} action={onBatchConvertDirectory} />
      </Section>
      <Section title={"当前设置"}>
        <Text>{configSummary}</Text>
        <Button title={"打开设置页"} systemImage={"slider.horizontal.3"} action={onOpenSettings} />
      </Section>
      <Section title={"WebDAV 连接"}>
        <TextField title={"服务器地址"} value={webdavBaseUrl} onChanged={setWebdavBaseUrl} prompt={"例如: https://example.com/dav"} />
        <TextField title={"用户名"} value={webdavUsername} onChanged={setWebdavUsername} />
        <SecureField title={"WebDAV Password"} value={webdavPassword} onChanged={setWebdavPassword} />
        <TextField title={"起始目录"} value={webdavStartPath} onChanged={setWebdavStartPath} prompt={"例如: /Movies"} />
        <TextField title={"User-Agent(可选)"} value={webdavUserAgent} onChanged={setWebdavUserAgent} />
        <Menu title={`播放器: ${webdavPlayer === "infuse" ? "Infuse" : "SenPlayer"}`}>
          <Button title={"SenPlayer"} action={() => setWebdavPlayer("senplayer")} />
          <Button title={"Infuse"} action={() => setWebdavPlayer("infuse")} />
        </Menu>
        <Menu
          title={`ASS 字幕来源: ${
            assDeliveryMode === "auto"
              ? "智能模式"
              : assDeliveryMode === "local_httpserver"
                ? "本地 HttpServer"
                : "WebDAV 上传"
          }`}
        >
          <Button title={"智能模式（会员优先本地，自动回退通用）"} action={() => setAssDeliveryMode("auto")} />
          <Button title={"本地 HttpServer（会员）"} action={() => setAssDeliveryMode("local_httpserver")} />
          <Button title={"WebDAV 上传（通用）"} action={() => setAssDeliveryMode("webdav_upload")} />
        </Menu>
        <Button title={loading ? "处理中..." : "打开 WebDAV 浏览器"} action={onOpenWebDavBrowser} />
      </Section>
      <Section>
        <Button title={"清理缓存（ASS缓存/状态）"} action={onClearCache} />
        <Button title={"清空输入"} action={onClear} />
      </Section>
      <Section title={"状态"}>
        <Text>{status}</Text>
      </Section>
    </List>
  );
}

