# 会话截图插件（DSH 客户端插件）

一个 DeepSeek Harness 客户端插件：把会话或其中几轮渲染成 PNG 写入剪贴板。案例记录在这里是因为它踩过的几处只在这个宿主上成立，通用做法已并入[图形界面](../standards/ui.md)与[工程标准](../standards/engineering.md)。

| 项 | 值 |
| --- | --- |
| 仓库 | `D:\Projects\Agent\DSH\Plugin\ChatScreenshot` |
| 宿主 | DSH 桌面版，客户端包在 `D:\Applications\DeepSeekHarness\Desktop\resources\app\dsh\node_modules\@deepseek-ai\` |
| 装载方式 | profile（`C:\Users\invefa\.dsh\profiles\desktop`）以 `link:` 依赖加符号链接指向仓库，`cordis.patch.yml` 用 `- insert:` 插入插件 |
| 验证 | 四个 node 脚本 + 一份 DOM fixture，浏览器只用来跑 fixture |

## 一、宿主组件只在运行时提供

宿主的设置页、对话页都用 `@deepseek-ai/dsh-client-ui-primitives` 里的组件，但磁盘上没有这个包：它是一张“平台种子表”，由前端 bundle 里的 `staticModules` 交给客户端模块系统。插件 bundle 通过 `window.__ModuleLoader__.load({id, factory: require => …})` 装载，`require` 与宿主同源，所以插件能直接拿到同一份实现。

- 种子表内容（本机实测）：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`zod`、`@tanstack/react-virtual`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。
- 解析顺序：种子表 → 已物化缓存 → 包工厂。全落空时报错原文写得很清楚：`client-modules: require("…") missed the module table — not a platform seed word, not a materialized module, and no registered package factory`。
- 取法：在插件里 `try { require('@deepseek-ai/dsh-client-ui-primitives') } catch { undefined }`，把结果作为 `native` 暴露；每处用法在 `native` 缺失时退化为什么都不画，而不是抛错。宿主降级或换构建时不会白屏。
- 常用组件与关键属性（属性名未压缩，可直接照用）：
  - `Button`：`variant`（`ghost`/`primary`/`outline`/`toolbar`/`icon`）、`size`（`md`/`sm`）、`icon`。
  - `Switch`：`checked`、`onChange(next)`、`label`。
  - `Checkbox`：`checked`、`onChange(boolean)`、`label`、`modalAutofocus`。
  - `Input`：其余属性直通 `<input>`。
  - `Modal`：`open`、`onClose`、`title`、`closeLabel`、`description`、`footer`（数组）、`headless`、`backdropBlur`。portal 到 `body`。
  - `Menu`：`open`、`anchorRef` 或 `anchorPoint`、`items`、`selectedId`/`selectedIds`、`onSelect(id)`、`onClose`、`align`、`side`、`portal`、`selection`。菜单项是 `{id, label, icon, disabled, danger, shortcut, submenu}`，分隔项带 `type` 字段；**Menu 不自己关闭**，调用方在 `onSelect` 里关。

## 二、设置分区只有一套契约

注册用 `ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id, order, label }, Component))`。

- `settings.section` 是 `kind: 'list'`、`scope: 'root'`，owner props 只有一个 `close`。
- 左栏导航文字由宿主用注册时给的 `label` 画，右栏 `renderSlot('settings.section', { close }, { only: active })`；所以组件只画行，不画分区标题。
- `settings.section.icon` 的注册 id 必须等于目标分区的 id 才会渲染。
- 宿主自己的设置行是“标题 + 一行说明 + 右侧控件”，沿用这个节奏最省事。

## 三、常驻控件不能按“消失”判定

对话页的“加载更早”按钮**不会卸载**：历史见底时它保留在布局里，变成 `disabled`，可见标签换成“已到会话开头”。而且五个状态标签的 `span` 同时存在，非当前项带 `aria-hidden="true"`。

- 读 `textContent` 会拿到五个标签的拼接串；用前缀匹配就会把拼接串当成“可点”，于是对着一个 disabled 按钮反复点击，每轮等满超时，直到耗尽整个历史预算。
- 正确做法：递归跳过 `aria-hidden="true"` 与 `hidden` 子树取可见标签，要求**精确相等**；`disabled` 或“已到会话开头”即视为到底，busy 时不点、只等效果。

## 四、设置面板做成预览

设置项不是一份开关清单，而是一张缩小版的截图：点某个部件就隐藏它，隐藏后留一条虚线占位，再点恢复；右键打开宿主 `Menu`，每个开关都是可勾选项；页头页脚在将来出现的位置点开 `Modal` 编辑。三行布局选项用 `Menu` 选择器。

这样做的理由：开关清单是同一个状态的第二份描述，画面与设置早晚会走偏；预览直接由已保存的选项渲染，看到的就是下一次截图的样子。

## 五、验证

- `node build.mjs --check`、`checks/structure.mjs`、`checks/i18n.mjs`、`checks/logic.mjs`：契约、文案表、纯函数。
- `checks/dom.html` + `checks/serve.mjs`：用宿主标记搭 fixture，模块图必须经 HTTP 加载（`file://` 下浏览器拒绝）。
- 无头取结果：`msedge --headless=new --disable-gpu --user-data-dir=%TEMP%\cs-fixture --virtual-time-budget=9000 --dump-dom http://127.0.0.1:8712/checks/dom.html`，标题即 PASS/FAIL，逐条结果写在 `<pre id="report">` 与 `window.__verify`。
- 不要用宿主的侧栏或内置浏览器验证本地页：面板拒绝 `127.0.0.1`，内置浏览器会为一个本地 fixture 常驻一条 Edge 进程链，关窗也杀不掉（`provider.close(session)` 只在会话关闭时释放，持有 tab 时每 1200ms 的引用泵会把进程拉回来）。顺序是先前 `reset_session`，再 `Stop-Process`。

## 六、其他容易被误判的地方

- `var(--dsw-alias-*)` 在活 DOM 里能解析，序列化进 SVG 文档后没有主题根；插入到图片里的块用字面色值，两条渲染路径才一致。
- 剪枝与克隆配对：按子节点下标把活树与克隆配对的清理函数必须**先于**任何剪枝运行，否则下标错位，深层 `video`/`iframe` 漏删。
- 打包产物带内容版本，运行中的宿主仍用旧字节：改完要让用户把插件关掉再打开并刷新。
