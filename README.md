# B站弹幕工具箱 (BiliDanmu Toolkit)

一个用于 iOS `Scripting` App 的 B 站弹幕工具脚本：
- 在线获取 B 站弹幕 XML
- 将 XML 转换为 ASS
- 本地 XML 批量转 ASS
- WebDAV 浏览与播放器唤起（SenPlayer / Infuse）

## 功能

- 在线输入 `BV / ep / 视频链接` 获取弹幕
- `XML` 与 `ASS` 分离操作（可单独使用）
- ASS 可视化参数配置（分辨率、字号、透明度、滚动区域等）
- 黑名单关键词过滤
- WebDAV 视频浏览与播放
  - 直接播放（无字幕）
  - 使用刚转换的 ASS 播放
  - 选择本地 ASS 播放

## 环境要求

- iOS + `Scripting` App（建议 `2.4.7+`）
- 可选：WebDAV 服务（用于远程视频与字幕链接）
- 可选：SenPlayer / Infuse

## 导入使用

1. 在 Scripting 中导入 `.scripting` 包。
2. 打开脚本后，在首页输入 BV/ep/链接。
3. 按需使用：
   - `获取 XML（不保存）`
   - `转换 ASS（不保存）`
   - `导出 XML/ASS 到文件`
4. 如需 WebDAV 播放：填写 WebDAV 参数后打开浏览器选择视频。

## 打包说明

本项目打包时需确保压缩包内部路径为正斜杠 `/`（例如 `page/index.tsx`），否则在 Scripting 中可能导入后看不到代码。

## 目录结构

```text
_build_bili_danmu/
  index.tsx
  script.json
  class/
    danmu.ts
    webdav.ts
  page/
    index.tsx
    home.tsx
    setting.tsx
    webdav.tsx
```

## 说明

- WebDAV 密码已做持久化处理。
- 播放操作已加互斥锁，避免连点导致重复上传/重复唤起。


## 致谢与参考

- ASS 转换逻辑与参数设计参考项目：https://github.com/gwy15/danmu2ass

## License

MIT


