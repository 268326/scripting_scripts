import { Button, Link, List, Navigation, NavigationStack, Section, Text, useEffect, useState } from "scripting";
import { WebDavConfig, WebDavEntry, buildRemoteFileUrl, isVideoEntry, listWebDavDirectory, openInInfuse, openInSenPlayer, parentPath, uploadTextToWebDav } from "../class/webdav";

const LATEST_ASS_STORAGE_KEY = "bili_danmu_latest_ass_text";

export function WebDavBrowserView({
  config,
  player,
  sessionAssText,
  onLog,
}: {
  config: WebDavConfig;
  player: "senplayer" | "infuse";
  sessionAssText: string;
  onLog: (msg: string) => void;
}) {
  const dismiss = Navigation.useDismiss();
  const [currentPath, setCurrentPath] = useState(config.startPath || "/");
  const [entries, setEntries] = useState<WebDavEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [status, setStatus] = useState("准备连接 WebDAV");
  const [selectedVideo, setSelectedVideo] = useState<WebDavEntry | null>(null);
  const [lastScheme, setLastScheme] = useState("");

  async function refresh(targetPath?: string) {
    if (loading || actionBusy) return;
    const p = targetPath ?? currentPath;
    setLoading(true);
    setStatus(`读取目录: ${p}`);
    try {
      const list = await listWebDavDirectory(config, p);
      setCurrentPath(p);
      setEntries(list);
      setSelectedVideo(null);
      setStatus(`目录加载完成: ${p}\n条目: ${list.length}`);
    } catch (error: any) {
      setStatus(`目录加载失败: ${String(error?.message ?? error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function openPlayer(video: WebDavEntry, subtitleUrl?: string, subtitleName?: string) {
    try {
      const videoUrl = buildRemoteFileUrl(config, video.path);
      const opener = player === "infuse" ? openInInfuse : openInSenPlayer;
      const { ok, scheme } = await opener({
        videoUrl,
        subtitleUrl,
        name: video.name,
        userAgent: config.userAgent || undefined,
      });
      setLastScheme(scheme);
      const playerName = player === "infuse" ? "Infuse" : "SenPlayer";
      const msg = ok
        ? `已唤起 ${playerName}\n视频: ${video.name}${subtitleName ? `\n字幕: ${subtitleName}` : ""}`
        : `当前环境无法自动唤起，请点下方“打开 ${playerName}”`;
      setStatus(msg);
      onLog(msg);
    } catch (error: any) {
      const msg = `播放失败: ${String(error?.message ?? error)}`;
      setStatus(msg);
      onLog(msg);
    }
  }

  async function runPlayAction(task: () => Promise<void>) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await task();
    } finally {
      setActionBusy(false);
    }
  }

  function getLatestAssText(): string {
    const propText = (sessionAssText || "").trim();
    if (propText) return propText;
    const saved = Storage.get<string>(LATEST_ASS_STORAGE_KEY);
    return typeof saved === "string" ? saved.trim() : "";
  }

  function videoDirectoryPath(videoPath: string): string {
    const normalized = (videoPath || "/").replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    if (idx <= 0) return "/";
    return normalized.slice(0, idx);
  }

  function videoStem(videoName: string): string {
    return videoName.replace(/\.[^./]+$/, "");
  }

  async function uploadAssAndPlay(video: WebDavEntry, assText: string, assNameHint: string) {
    const dir = videoDirectoryPath(video.path);
    const stem = videoStem(video.name);
    const remoteAssPath = `${dir}/${stem}.bili_danmu.ass`.replace(/\/+/g, "/");
    setStatus(`上传 ASS 到 WebDAV（覆盖同名字幕）...\n${remoteAssPath}`);
    await uploadTextToWebDav(config, remoteAssPath, assText, "text/plain; charset=utf-8");
    const subUrl = buildRemoteFileUrl(config, remoteAssPath);
    const displayName = assNameHint || remoteAssPath.split("/").pop() || "字幕";
    await openPlayer(video, subUrl, displayName);
  }

  async function onPlayWithLatestScriptAss(video: WebDavEntry) {
    try {
      const text = getLatestAssText();
      if (!text) {
        throw new Error("当前没有“刚下载的ASS”，请先回首页执行一次“转换 ASS（不保存）”");
      }
      await uploadAssAndPlay(video, text, "latest");
    } catch (error: any) {
      const msg = `使用刚下载 ASS 播放失败: ${String(error?.message ?? error)}`;
      setStatus(msg);
      onLog(msg);
    }
  }

  async function pickLocalAssText(): Promise<{ name: string; text: string } | null> {
    const files = await DocumentPicker.pickFiles();
    const path = files && files.length > 0 ? files[0] : null;
    if (!path) return null;
    if (!path.toLowerCase().endsWith(".ass")) {
      throw new Error("请选择 .ass 文件");
    }
    const text = await FileManager.readAsString(path);
    const name = path.split(/[\\/]/).pop() || "picked.ass";
    return { name, text };
  }

  async function onPlayWithPickedAss(video: WebDavEntry) {
    try {
      const picked = await pickLocalAssText();
      if (!picked) {
        setStatus("已取消选择本地 ASS");
        return;
      }
      await uploadAssAndPlay(video, picked.text, picked.name);
    } catch (error: any) {
      const msg = `选择本地 ASS 播放失败: ${String(error?.message ?? error)}`;
      setStatus(msg);
      onLog(msg);
    } finally {
      try {
        DocumentPicker.stopAcessingSecurityScopedResources();
      } catch (_) {}
    }
  }

  const videoOptions = entries.filter((e) => isVideoEntry(e));

  useEffect(() => {
    refresh(currentPath);
  }, []);

  return (
    <NavigationStack>
      <List
        navigationTitle={`WebDAV 播放 (${player === "infuse" ? "Infuse" : "SenPlayer"})`}
        toolbar={{
          topBarLeading: <Button title={"返回"} systemImage={"chevron.left"} action={dismiss} />,
          topBarTrailing: <Button title={loading || actionBusy ? "处理中..." : "刷新"} systemImage={"arrow.clockwise"} action={() => refresh(currentPath)} />,
        }}
      >
        <Section title={"当前目录"}>
          <Text>{currentPath}</Text>
          <Button title={"返回上级"} action={() => refresh(parentPath(currentPath))} />
        </Section>

        <Section title={"目录"}>
          {entries.filter((e) => e.isDirectory).map((dir) => (
            <Button key={dir.path} title={`📁 ${dir.name}`} action={() => refresh(dir.path)} />
          ))}
          {entries.filter((e) => e.isDirectory).length === 0 ? <Text>无子目录</Text> : null}
        </Section>

        <Section title={"视频文件"}>
          {videoOptions.map((file) => (
            <Button
              key={file.path}
              title={`🎬 ${file.name}${selectedVideo?.path === file.path ? " (已选中)" : ""}`}
              action={() => {
                setSelectedVideo(file);
                setStatus(`已选择视频: ${file.name}`);
              }}
            />
          ))}
          {videoOptions.length === 0 ? <Text>当前目录没有常见视频文件</Text> : null}
        </Section>

        <Section title={"播放操作"}>
          <Text>{selectedVideo ? `当前视频: ${selectedVideo.name}` : "先从上方选择一个视频文件"}</Text>
          <Button
            title={loading || actionBusy ? "处理中..." : "直接播放（无字幕）"}
            action={() => {
              if (actionBusy) return;
              if (!selectedVideo) {
                setStatus("请先选择一个视频文件");
                return;
              }
              runPlayAction(async () => {
                await openPlayer(selectedVideo);
              });
            }}
          />

          <Button
            title={loading || actionBusy ? "处理中..." : "使用刚下载的 ASS 播放"}
            action={() => {
              if (actionBusy) return;
              if (!selectedVideo) {
                setStatus("请先选择一个视频文件");
                return;
              }
              runPlayAction(async () => {
                await onPlayWithLatestScriptAss(selectedVideo);
              });
            }}
          />

          <Button
            title={loading || actionBusy ? "处理中..." : "选择本地 ASS 并播放"}
            action={() => {
              if (actionBusy) return;
              if (!selectedVideo) {
                setStatus("请先选择一个视频文件");
                return;
              }
              runPlayAction(async () => {
                await onPlayWithPickedAss(selectedVideo);
              });
            }}
          />
        </Section>

        <Section title={"手动打开"}>
          <Text>如果系统不支持自动唤起，可点下面链接直接打开。</Text>
          {lastScheme ? <Link url={lastScheme}>{`打开 ${player === "infuse" ? "Infuse" : "SenPlayer"}`}</Link> : <Text>先执行一次播放操作以生成链接</Text>}
        </Section>

        <Section title={"状态"}>
          <Text>{status}</Text>
        </Section>
      </List>
    </NavigationStack>
  );
}
