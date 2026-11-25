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

## 四、设置在图片被画出来的地方做

**第一版做错了**：把设置分区做成一张缩小版的截图，点部件隐藏、右键勾选。用户看了一眼就否掉：要的不是“设置里有一张预览”，而是**在对话原来的位置**打开一块临时界面，在那里加内容、藏控件，展示与结果都是所见即所得；并且凡是可能被截进图片的控件都必须出现，此前的默认隐藏、无条件剪枝都要变成可管理的开关。

现在做成这样，两点是关键：

- **编辑面就是截图那份克隆**。用与截图完全相同的构建函数（克隆 → 净化 → 标记部件 → 插入页头页脚）产出 DOM，只是把它按原长挂在一个可滚动的框里盖在对话上。这样“所见即所得”是构造性的：不存在第二份渲染代码会走偏。不要为了编辑另画一份 mock，那正是第一版被否掉的原因。
- **控件清单是唯一真相**。`[{id, option, selectors}]` 一张表，截图路径按它删除（`dropChrome`），编辑路径按它标记（`paintChrome`，只加属性与变暗样式，不删元素）。关掉的部件**留在原地变暗**，所以没有“看不见的设置”；凡是可能出现在图片里的部件都必须进这张表，不能写成调用点上的无条件删除——分页控件和输入区原本就是这样被切掉的，它们也就成了没人找得到的设置。

其余细节：

- 点击切开关、右键开宿主 `Menu`（开关 + 分隔线 + 信息行 + 恢复默认）、页头页脚用 `contenteditable="plaintext-only"` 就地写（占位提示走 `data-cs-placeholder` + `::before`，不能进正文，否则空字段的 textContent 会把提示当成内容保存）。
- 重建只由 revision 计数触发，**不要**把 options 放进 effect 依赖：每敲一个字都会重建克隆并夺走光标。文字直接写进保存的选项。
- 克隆里的 `a`/`button` 点击必须 `preventDefault`：克隆没有 React 监听，只有浏览器默认行为，点一下会让真实页面跳转。
- 覆盖层挂在 `document.body` 上：`position: fixed` 放进带 `transform`/`filter` 的祖先里会被那个祖先当包含块。层级取宿主对话框（1000）之上、提示条与菜单（1100）之下，例如 1050，这样从设置对话框里打开也能盖住它，而宿主的弹层仍在最上面。
- 覆盖层要**对准对话自身的矩形**，不是整个窗口：`[data-conversation-scroll]` 的 `getBoundingClientRect()` 直接写成 `left/top/width/height`。无边框窗口把标题栏与窗口按钮画在页面之上，从视口顶端铺满时顶栏会被压在按钮下面、标题栏还会从半透明底上透出来；用户报的“完成按钮点不到”就是这个。矩形会随侧栏开合、窗口缩放变化，所以在同一个防抖里重新取矩形并重建，另挂 `ResizeObserver` 盯住滚动区。

**第二版又被推翻了一次**：八个固定部件仍然是“被特殊设定的那几个”。用户要的是**整个页面任何元素都能选**、能自己起名字、能像调试器那样改属性。现在的模型是规则表：

- 一条规则是 `{ selector, name, hide, style, attrs }`，按选择器生效，所以插件后来加进对话的东西、同一选择器命中的一批元素都能一起处理；内置的八个部件退化成“带默认值与名字的规则”，走同一条 `applyRules`，截图与编辑面因此不可能给出不同答案。
- **隐藏是声明，不是删除**：元素留在副本里，只是 `display:none`。于是截图量到的就是“没有它”的排版，而编辑面还能指向那个洞、闪回原位、再还原。这一条同时解决了“隐藏之后就没法再看见它”的死角。
- 隐藏栏固定在编辑面底部：单击闪回（临时把 `display` 存起来置空、加虚线标记、`scrollIntoView`、到时还原），双击还原。双击画面里的元素即可隐藏，右键还有隐藏、还原、删除这个元素的规则、以及页头页脚专属的分隔线与信息行。
- 侧栏（点了元素才出现）承担命名与属性：标签、选择器、隐藏开关、名称输入、六个样式预设（淡化、描边、去留白、去底色、等宽、小字号）、自由填写的样式行与属性行，外加一条“改的是选择器，命中的同类元素都会生效”的说明。样式白名单与预设名单放在 `const.js`，与“新数字进 const.js”一致。
- 侧栏占宽度会把画面挤窄，而副本的宽度是它被造出来时对话的宽度：用 `zoom`（而不是 `transform: scale`）把副本缩到宿主剩余宽度，布局照旧，看到的仍是那张图。

补充两条实现上的坑：`i18n` 表按“第一处锚点”替换会把英文写进中文表，必须先定位 `  zh: {` / `  en: {` 各自表的起点再在表内替换；fixture 的模块体一旦有语法错误，浏览器**静默不执行**（不报 `window.onerror`），要么用 `node --check` 检查抽出来的模块体，要么在脚本最前面挂 `error` 与 `unhandledrejection` 监听。

## 五、验证

- `node build.mjs --check`、`checks/structure.mjs`、`checks/i18n.mjs`、`checks/logic.mjs`：契约、文案表、纯函数。
- `checks/dom.html` + `checks/serve.mjs`：用宿主标记搭 fixture，模块图必须经 HTTP 加载（`file://` 下浏览器拒绝）。
- 无头取结果：`msedge --headless=new --disable-gpu --user-data-dir=%TEMP%\cs-fixture --virtual-time-budget=9000 --dump-dom http://127.0.0.1:8712/checks/dom.html`，标题即 PASS/FAIL，逐条结果写在 `<pre id="report">` 与 `window.__verify`。
- 不要用宿主的侧栏或内置浏览器验证本地页：面板拒绝 `127.0.0.1`，内置浏览器会为一个本地 fixture 常驻一条 Edge 进程链，关窗也杀不掉（`provider.close(session)` 只在会话关闭时释放，持有 tab 时每 1200ms 的引用泵会把进程拉回来）。顺序是先前 `reset_session`，再 `Stop-Process`。
- 界面类的判断只能看着改：起一个真实实例比读代码可靠。`Start-Process node -ArgumentList '"<dsh>/lib/bin.js" web --port 7391 --no-open' -Environment @{ DSH_HOME = "<沙箱 home>" }`，把输出重定向到 `boot.log`，其中 `dsh web: http://127.0.0.1:7391/?token=...` 就是要打开的地址。**不传 `-Environment` 时它静默使用真实的 `~/.dsh`**，于是看到的全是用户的真实会话，而插件来自用户自己的 profile——很容易误判成“插件没装对”。
- 插件出现在页面上要同时满足三件事：profile 的 `node_modules` 里有包、`package.json` 的 `dependencies` 里有 `link:` 条目、`dsh.profile.bundles` 里有同名条目。只往 `cordis.patch.yml` 里 `insert` 不够（重复 insert 还会让行落空）。核对办法：`window.__DSH_BOOT__.entries` 里有没有这一行。
- 截图与交互走 `Tool/Sandbox/tools/cdp.mjs`：`start` 起一个独立 Edge（CDP 9333），`shot <url> <png> --width N`、`eval <url> <file.js>`。**传当前的同一个 URL** 才不会重新导航、把已经打开的面板丢掉；`eval` 里的脚本会被包进 `(async () => { ... })()`，所以必须自己 `return`，否则拿到 `{}`。改完模块要带 `?v=N`，并且 import 的查询串也要跟着改。
- 这套换到无头 Edge 上时 `--dump-dom` 有时什么都不返回；改成用 CDP 打开 fixture 页再 `eval` 读 `#report` 更稳。

## 六、其他容易被误判的地方

- `var(--dsw-alias-*)` 在活 DOM 里能解析，序列化进 SVG 文档后没有主题根；插入到图片里的块用字面色值，两条渲染路径才一致。
- 剪枝与克隆配对：按子节点下标把活树与克隆配对的清理函数必须**先于**任何剪枝运行，否则下标错位，深层 `video`/`iframe` 漏删。
- 打包产物带内容版本，运行中的宿主仍用旧字节：改完要让用户把插件关掉再打开并刷新。
