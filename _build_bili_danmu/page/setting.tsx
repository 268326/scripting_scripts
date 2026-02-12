import { Button, List, Menu, Navigation, NavigationStack, Section, Text, TextField, Toggle, useState } from "scripting";
import {
  CLI_DEFAULT_CONFIG,
  ConfigInput,
  configToInput,
} from "../class/danmu";

function marked(label: string, selected: boolean): string {
  return selected ? `✓ ${label}` : label;
}

function same(v: string, x: string): boolean {
  return String(v) === String(x);
}

type OptionItem = {
  label: string;
  value: string;
  note?: string;
};

type ResolutionOption = {
  label: string;
  width: string;
  height: string;
  note?: string;
};

export function SettingView({
  configInput,
  setConfigInput,
  denylistText,
  setDenylistText,
}: {
  configInput: ConfigInput;
  setConfigInput: (value: ConfigInput) => void;
  denylistText: string;
  setDenylistText: (value: string) => void;
}) {
  const dismiss = Navigation.useDismiss();
  const [appliedAt, setAppliedAt] = useState("");
  const [applyNote, setApplyNote] = useState("");
  const [draft, setDraft] = useState<ConfigInput>(configInput);
  const [draftDenylist, setDraftDenylist] = useState(denylistText);

  function setField<K extends keyof ConfigInput>(key: K, value: ConfigInput[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setConfigInput(next);
  }

  function setFields(patch: Partial<ConfigInput>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    setConfigInput(next);
  }

  function setDenylist(value: string) {
    setDraftDenylist(value);
    setDenylistText(value);
  }

  function applyRecommended() {
    const next = configToInput(CLI_DEFAULT_CONFIG);
    setDraft(next);
    setConfigInput(next);
    setAppliedAt(new Date().toLocaleTimeString());
    setApplyNote("已应用默认参数");
  }

  const resolutionOptions: ResolutionOption[] = [
    { label: "1920 x 1080", width: "1920", height: "1080" },
    { label: "1280 x 720", width: "1280", height: "720" },
    { label: "2560 x 1440", width: "2560", height: "1440" },
    { label: "3840 x 2160", width: "3840", height: "2160" },
    { label: "854 x 480", width: "854", height: "480" },
    { label: "640 x 360", width: "640", height: "360" },
  ];

  const fontOptions: OptionItem[] = [
    { label: "苹方", value: "PingFang SC" },
    { label: "黑体", value: "黑体" },
    { label: "微软雅黑", value: "微软雅黑" },
    { label: "宋体", value: "宋体" },
    { label: "等线", value: "等线" },
  ];

  const fontSizeOptions: OptionItem[] = [
    { label: "25", value: "25" },
    { label: "30", value: "30" },
    { label: "36", value: "36" },
    { label: "42", value: "42" },
    { label: "48", value: "48" },
    { label: "50", value: "50" },
    { label: "56", value: "56" },
    { label: "64", value: "64" },
  ];

  const durationOptions: OptionItem[] = [
    { label: "8", value: "8" },
    { label: "10", value: "10" },
    { label: "12", value: "12" },
    { label: "15", value: "15" },
    { label: "18", value: "18" },
  ];

  const laneSizeOptions: OptionItem[] = [
    { label: "28", value: "28" },
    { label: "32", value: "32" },
    { label: "40", value: "40" },
    { label: "46", value: "46" },
    { label: "54", value: "54" },
  ];

  const widthRatioOptions: OptionItem[] = [
    { label: "1.0", value: "1.0" },
    { label: "1.1", value: "1.1" },
    { label: "1.2", value: "1.2" },
    { label: "1.3", value: "1.3" },
    { label: "1.4", value: "1.4" },
  ];

  const horizontalGapOptions: OptionItem[] = [
    { label: "10", value: "10" },
    { label: "15", value: "15" },
    { label: "20", value: "20" },
    { label: "25", value: "25" },
    { label: "30", value: "30" },
  ];

  const floatPercentageOptions: OptionItem[] = [
    { label: "0.2 (20%)", value: "0.2" },
    { label: "0.3 (30%)", value: "0.3" },
    { label: "0.4 (40%)", value: "0.4" },
    { label: "0.5 (50%)", value: "0.5" },
    { label: "0.6 (60%)", value: "0.6" },
    { label: "0.7 (70%)", value: "0.7" },
    { label: "0.8 (80%)", value: "0.8" },
  ];

  const alphaOptions: OptionItem[] = [
    { label: "0.5 (50%)", value: "0.5" },
    { label: "0.6 (60%)", value: "0.6" },
    { label: "0.7 (70%)", value: "0.7" },
    { label: "0.8 (80%)", value: "0.8" },
    { label: "0.9 (90%)", value: "0.9" },
  ];

  const outlineOptions: OptionItem[] = [
    { label: "0.4", value: "0.4" },
    { label: "0.6", value: "0.6" },
    { label: "0.8", value: "0.8" },
    { label: "1.0", value: "1.0" },
    { label: "1.2", value: "1.2" },
  ];

  const timeOffsetOptions: OptionItem[] = [
    { label: "-1.0", value: "-1.0" },
    { label: "-0.5", value: "-0.5" },
    { label: "0", value: "0" },
    { label: "0.5", value: "0.5" },
    { label: "1.0", value: "1.0" },
  ];

  return (
    <NavigationStack>
      <List
        navigationTitle={"转换设置"}
        toolbar={{
          topBarLeading: <Button title={"返回"} systemImage={"chevron.left"} action={dismiss} />,
        }}
      >
        <Section title={"推荐参数"}>
          <Text>应用默认参数（默认分辨率 1080P）。</Text>
          <Button title={"应用默认参数"} systemImage={"checkmark.circle"} action={applyRecommended} />
          <Text>上次应用: {appliedAt || "未应用"}</Text>
          <Text>{applyNote || "提示：分辨率建议按视频分辨率选择（1080P/720P）"}</Text>
        </Section>

        <Section title={"参数点选（像下拉菜单）"}>
          <Text>可直接点选常用值，也可以在下方手动微调。</Text>
          <Menu title={`分辨率: ${draft.width}x${draft.height}`}>
            {resolutionOptions.map((item) => (
              <Button
                key={`${item.width}x${item.height}`}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.width, item.width) && same(draft.height, item.height))}
                action={() => setFields({ width: item.width, height: item.height })}
              />
            ))}
          </Menu>

          <Menu title={`字体: ${draft.font}`}>
            {fontOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.font, item.value))}
                action={() => setField("font", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`字号: ${draft.fontSize}`}>
            {fontSizeOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.fontSize, item.value))}
                action={() => setField("fontSize", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`时长(秒): ${draft.duration}`}>
            {durationOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.duration, item.value) || same(draft.duration, `${item.value}.0`))}
                action={() => setField("duration", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`行高: ${draft.laneSize}`}>
            {laneSizeOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.laneSize, item.value))}
                action={() => setField("laneSize", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`宽度系数: ${draft.widthRatio}`}>
            {widthRatioOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.widthRatio, item.value))}
                action={() => setField("widthRatio", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`水平间距: ${draft.horizontalGap}`}>
            {horizontalGapOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.horizontalGap, item.value) || same(draft.horizontalGap, `${item.value}.0`))}
                action={() => setField("horizontalGap", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`滚动区域比例: ${draft.floatPercentage}`}>
            {floatPercentageOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.floatPercentage, item.value))}
                action={() => setField("floatPercentage", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`透明度: ${draft.alpha}`}>
            {alphaOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.alpha, item.value))}
                action={() => setField("alpha", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`描边: ${draft.outline}`}>
            {outlineOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.outline, item.value))}
                action={() => setField("outline", item.value)}
              />
            ))}
          </Menu>

          <Menu title={`时间偏移: ${draft.timeOffset}`}>
            {timeOffsetOptions.map((item) => (
              <Button
                key={item.value}
                title={marked(`${item.label}${item.note ? ` (${item.note})` : ""}`, same(draft.timeOffset, item.value) || same(draft.timeOffset, `${item.value}.0`))}
                action={() => setField("timeOffset", item.value)}
              />
            ))}
          </Menu>

          <Toggle title={`加粗: ${draft.bold ? "开" : "关"}`} value={draft.bold} onChanged={(v) => setField("bold", v)} toggleStyle={"switch"} />
        </Section>

        <Section title={"高级自定义（可改）"}>
          <Text>如果你想在点选基础上微调，可以直接改下面输入框。</Text>
          <TextField title={"width"} value={draft.width} onChanged={(v) => setField("width", v)} />
          <TextField title={"height"} value={draft.height} onChanged={(v) => setField("height", v)} />
          <TextField title={"font"} value={draft.font} onChanged={(v) => setField("font", v)} />
          <TextField title={"fontSize"} value={draft.fontSize} onChanged={(v) => setField("fontSize", v)} />
          <TextField title={"duration"} value={draft.duration} onChanged={(v) => setField("duration", v)} />
          <TextField title={"laneSize"} value={draft.laneSize} onChanged={(v) => setField("laneSize", v)} />
          <TextField title={"widthRatio"} value={draft.widthRatio} onChanged={(v) => setField("widthRatio", v)} />
          <TextField title={"horizontalGap"} value={draft.horizontalGap} onChanged={(v) => setField("horizontalGap", v)} />
          <TextField title={"floatPercentage"} value={draft.floatPercentage} onChanged={(v) => setField("floatPercentage", v)} />
          <TextField title={"alpha"} value={draft.alpha} onChanged={(v) => setField("alpha", v)} />
          <TextField title={"outline"} value={draft.outline} onChanged={(v) => setField("outline", v)} />
          <TextField title={"timeOffset"} value={draft.timeOffset} onChanged={(v) => setField("timeOffset", v)} />
        </Section>

        <Section title={"黑名单过滤"}>
          <Text>每行一个关键词，命中则过滤。</Text>
          <TextField
            title={"关键词列表"}
            value={draftDenylist}
            onChanged={setDenylist}
            axis={"vertical"}
            prompt={"例如\n23333\n测试词"}
          />
        </Section>
      </List>
    </NavigationStack>
  );
}
