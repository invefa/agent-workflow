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
- 覆盖层挂在 `document.body` 上：`position: fixed` 放进带 `transform`/`filter` 的祖先里会被那个祖先当包含块。层级取宿主对话框（`[role=dialog]` 的外层是 1000）**之下**，例如 900——第一版取 1050 是为了盖住"点按钮打开它的那个设置对话框"，代价是此后用户按 `Ctrl+Alt+,` 打开的每个对话框都被编辑面整块挡住（截图里只剩顶栏一条缝，点哪都落在覆盖层上）。正确做法是让**调用方**先关自己：设置分区里那个按钮先 `props.close()` 再开编辑面。
- 覆盖层要**对准对话自身的矩形**，不是整个窗口：`[data-conversation-scroll]` 的 `getBoundingClientRect()` 直接写成 `left/top/width/height`。无边框窗口把标题栏与窗口按钮画在页面之上，从视口顶端铺满时顶栏会被压在按钮下面、标题栏还会从半透明底上透出来；用户报的“完成按钮点不到”就是这个。矩形会随侧栏开合、窗口缩放变化，所以在同一个防抖里重新取矩形并重建，另挂 `ResizeObserver` 盯住滚动区。

**第二版又被推翻了一次**：八个固定部件仍然是“被特殊设定的那几个”。用户要的是**整个页面任何元素都能选**、能自己起名字、能像调试器那样改属性。现在的模型是规则表：

- 一条规则是 `{ selector, name, hide, style, attrs }`，按选择器生效，所以插件后来加进对话的东西、同一选择器命中的一批元素都能一起处理；内置的八个部件退化成“带默认值与名字的规则”，走同一条 `applyRules`，截图与编辑面因此不可能给出不同答案。
- **隐藏是声明，不是删除**：元素留在副本里，只是 `display:none`。于是截图量到的就是“没有它”的排版，而编辑面还能指向那个洞、闪回原位、再还原。这一条同时解决了“隐藏之后就没法再看见它”的死角。
- 隐藏栏固定在编辑面底部：单击闪回（临时把 `display` 存起来置空、加虚线标记、`scrollIntoView`、到时还原），双击还原。双击画面里的元素即可隐藏，右键还有隐藏、还原、删除这个元素的规则、以及页头页脚专属的分隔线与信息行。
- 侧栏（点了元素才出现）承担命名与属性：标签、选择器、隐藏开关、名称输入、六个样式预设（淡化、描边、去留白、去底色、等宽、小字号）、自由填写的样式行与属性行，外加一条“改的是选择器，命中的同类元素都会生效”的说明。样式白名单与预设名单放在 `const.js`，与“新数字进 const.js”一致。
- 侧栏占宽度会把画面挤窄，而副本的宽度是它被造出来时对话的宽度：用 `zoom`（而不是 `transform: scale`）把副本缩到宿主剩余宽度，布局照旧，看到的仍是那张图。

补充两条实现上的坑：`i18n` 表按“第一处锚点”替换会把英文写进中文表，必须先定位 `  zh: {` / `  en: {` 各自表的起点再在表内替换；fixture 的模块体一旦有语法错误，浏览器**静默不执行**（不报 `window.onerror`），要么用 `node --check` 检查抽出来的模块体，要么在脚本最前面挂 `error` 与 `unhandledrejection` 监听。

## 五、内容不是几个固定字段，是一串块

第二版编辑面里页头与页脚是两个写死的输入框，用户第一次用真实内容就撞到边界：他要往图里放图片、放空隙、放"第几轮/哪个模型"这类会变的信息，而且这些块本身也该能被拖来拖去。于是内容变成数组：

- 一个块是 `{ id, kind, zone, ... }`，`kind` 取 text / spacer / image / divider / meta，`zone` 取 top / bottom。原来那两个固定字段不是被删掉，而是被迁移成两个普通块（`legacyBlocks` 读旧字段），所以升级后的画面与升级前一致。
- 文本是模板而不是字符串：`dom/tokens.js` 在截图时读当前会话与宿主，填 `{turns}` `{prompts}` `{date}` `{time}` `{weekday}` `{title}` `{model}` `{session}` `{app}` `{version}`，只替换这几个，认不出的花括号原样留着。编辑面用原始值渲染，占位符在那里仍然可读——这就是"编辑时看到的就是截图结果"与"占位符要能看懂"之间的折中：**变的是取值时机，不是渲染路径**。
- 图片块只接受 data URL，在归一化时就拒收超限的内容，而不是先存下来再在渲染时悄悄丢掉。这样"存了但没出现"这种最难查的状态根本不存在。
- 预设组件与用户自定义组件是同一件事：保存一个块就是把它的副本塞进 `custom`，点组件库里的条目就追加一份带新 id 的副本。组件不是第二条渲染路径，所以改块怎么画，预设与已存组件同时变。
- **但"同一件事"要在界面上成立，不能只在数据结构里成立**。第一版把预设做成五个固定按钮、自定义做成另一排带删除叉的名字，用户的判断是"预设是特殊的存在"，这不是外观问题：两套入口意味着两套能力。改法是把组件库收成一张列表，两段（系统组件 / 我的组件）行结构完全相同——名字可拖可点、行尾 `...` 打开设计器，只有自定义多一个 `x`；预设的 `...` 带着副本打开设计器，存下就归用户。判据很硬：**预设能做到的，设计器必须也能表达**；做不到就说明预设那条路径里藏着没抽出来的能力。
- 自带条目不能删、不能原地改，这一条要写在代码注释与文档里，否则下一个人会顺手给它加个删除按钮。归属差异只活在 `entryOf(t, component, builtin)` 一个函数里。

### 工具的字段都要有标签，文件输入框要藏起来

设计器最初把 spacer 的高度、image 的宽度做成没有标签的裸 `<input>`，还把 `input[type=file]` 直接摆出来。真实界面里后者是 `display:none`，于是"图片组件根本选不了图"——代码里字段齐全，界面里一个能点的都没有。修法：每个字段用 `label.cs-ed-field-row` 包住标签与控件；文件选择用一个宿主 `Button` 顶上去，真 input 藏在后面（`.click()` 触发）。另外 `flex:1` 的输入框放进列向容器会被拉成 87px 高的方框，行内控件要显式 `flex:none; width:100%`。
- 拖放只做两件事：从组件库拖进画面（追加），在画面内拖动（移动，跨区域也算）。落点由 `dropTarget(clone, host, clientY)` 算成 `{ zone, index, y }`，用一条 2px 的指示线表达，而不是自己实现一套排序动画。

### 工具放底部，别占侧栏

第一版把检查器放在右侧 268px 的栏里，用户第一句话就是"预览被压缩了"。这个反馈是对的：**被判断的对象是画面，任何占用它宽度的常驻面板都在和自己打架**。改成底部托盘（隐藏清单 + 左检查器 + 右组件库）之后，预览恢复整幅宽度；窗口比图还窄时才用 `zoom` 整体缩放。

### 两个 React 事故，都是"看起来没反应"

这两条值得单独记，因为它们在真实界面里的表现都是"点了没反应"，而控制台干净得像没事：

1. **解构漏了回调**。子组件只从 props 里解构了数据，却调用 `onAdd` / `onDrag` / `onToken`；打包后这些名字是自由标识符，点按钮直接 `ReferenceError`，但事件处理器里的异常不会打断渲染，画面照旧，什么也不发生。教训：视图组件的 props 最好整体取用或显式列举并配对，`node build.mjs` 只对**跨 part 的 import** 报警，对 props 名字无能为力。
2. **把组件当函数调用**。`menuRow({...})` 写在父组件的渲染体里，内部 `useState` 就记进了父组件的 hook 列表；一旦某次渲染的分支顺序变了，React 抛 error #310 并**清空整棵树**，面板直接消失。改成 `h(menuRow, {...})` 才正确。顺带加了错误边界（`getDerivedStateFromError` 渲染一段文本），否则下次再崩仍然是一片空白，只能靠猜。

第三个事故属于同一类"空白"：把 `describeElement()` 返回的对象直接当 React 子节点渲染，触发 error #31（objects are not valid as a React child），同样是整棵树消失。诊断方法是先加边界、把错误文本印在界面上，再读它——比在控制台里翻压缩后的栈快得多。

### 目录按"读什么"分组，文件名不再重复目录

编辑面原本是六个平铺的 `editor-labels.js` / `editor-inspector.js` / `editor-library.js`…，`dom/` 下同样挤了十二个互不相关的文件。分组的依据不是"看起来像"，而是它们各自读什么、产出什么：`dom/clone/` 放发生在副本上的一切（准备、规则、模板变量、内容块），`dom/transcript/` 放读会话本身的东西（轮次、分页、几何），`views/editor/` 放编辑面的各件；而 `dom/capture.js` 与 `dom/stage.js` 留在上层——它们同时调用两组，属于编排，不属于任何一组。

一旦收进目录，文件名就去掉目录已经说清的前缀：`editor/inspector.js` 而不是 `editor-inspector.js`。移动只改路径时用脚本做（先移动文件、再按"新位置 → 旧位置"反查重写每个相对 import、最后改打包顺序数组），一次跑完仍然 `build.mjs --check` 通过、行数不变，就说明真的只动了路径。

### 复用的样式块会脱队

"已隐藏"清单原本是编辑面底部的一条横条，后来搬进元素页左栏，样式却没跟着改：还留着 `flex:none; max-height:30%; border-top; background` 与横条的内边距，塞进竖列后成一个 89px 高、自带底色与上边框的盒子，下面一大片空。用户就是拿这个截图来问的。同一类问题还有分隔线：`.cs-ed-split-side { border-left }` 写死了"侧栏在右边"，而元素页的窄栏是**第一个**子元素，线画在了外侧。判据：一条规则如果只在某个位置成立，就该写成位置条件（`.cs-ed-split-main + .cs-ed-split-side`、`.cs-ed-split-side + .cs-ed-split-main`），而搬动容器时先量一次 `getBoundingClientRect()`，别信"只是样式"。量法：在 CDP 里 `eval` 取 `[side, hidden, main].map(e => [round(rect.height)])` 与 `getComputedStyle(side).borderLeftWidth`，一次就能定论。
## 六、验证

- `node build.mjs --check`、`checks/structure.mjs`、`checks/i18n.mjs`、`checks/logic.mjs`：契约、文案表、纯函数。
- `checks/dom.html` + `checks/serve.mjs`：用宿主标记搭 fixture，模块图必须经 HTTP 加载（`file://` 下浏览器拒绝）。
- 无头取结果：`msedge --headless=new --disable-gpu --user-data-dir=%TEMP%\cs-fixture --virtual-time-budget=9000 --dump-dom http://127.0.0.1:8712/checks/dom.html`，标题即 PASS/FAIL，逐条结果写在 `<pre id="report">` 与 `window.__verify`。
- 不要用宿主的侧栏或内置浏览器验证本地页：面板拒绝 `127.0.0.1`，内置浏览器会为一个本地 fixture 常驻一条 Edge 进程链，关窗也杀不掉（`provider.close(session)` 只在会话关闭时释放，持有 tab 时每 1200ms 的引用泵会把进程拉回来）。顺序是先前 `reset_session`，再 `Stop-Process`。
- 界面类的判断只能看着改：起一个真实实例比读代码可靠。`Start-Process node -ArgumentList '"<dsh>/lib/bin.js" web --port 7391 --no-open' -Environment @{ DSH_HOME = "<沙箱 home>" }`，把输出重定向到 `boot.log`，其中 `dsh web: http://127.0.0.1:7391/?token=...` 就是要打开的地址。**不传 `-Environment` 时它静默使用真实的 `~/.dsh`**，于是看到的全是用户的真实会话，而插件来自用户自己的 profile——很容易误判成“插件没装对”。
- 插件出现在页面上要同时满足三件事：profile 的 `node_modules` 里有包、`package.json` 的 `dependencies` 里有 `link:` 条目、`dsh.profile.bundles` 里有同名条目。只往 `cordis.patch.yml` 里 `insert` 不够（重复 insert 还会让行落空）。核对办法：`window.__DSH_BOOT__.entries` 里有没有这一行。
- 截图与交互走 `Tool/Sandbox/tools/cdp.mjs`：`start` 起一个独立 Edge（CDP 9333），`shot <url> <png> --width N`、`eval <url> <file.js>`。**传当前的同一个 URL** 才不会重新导航、把已经打开的面板丢掉；`eval` 里的脚本会被包进 `(async () => { ... })()`，所以必须自己 `return`，否则拿到 `{}`。改完模块要带 `?v=N`，并且 import 的查询串也要跟着改。
- 这套换到无头 Edge 上时 `--dump-dom` 有时什么都不返回；改成用 CDP 打开 fixture 页再 `eval` 读 `#report` 更稳。

## 七、其他容易被误判的地方

- `var(--dsw-alias-*)` 在活 DOM 里能解析，序列化进 SVG 文档后没有主题根；插入到图片里的块用字面色值，两条渲染路径才一致。
- 剪枝与克隆配对：按子节点下标把活树与克隆配对的清理函数必须**先于**任何剪枝运行，否则下标错位，深层 `video`/`iframe` 漏删。
- 打包产物带内容版本，运行中的宿主仍用旧字节：改完要让用户把插件关掉再打开并刷新。
- **`cacheDisabled` 与包版本一起改会伪造出一个 React 崩溃**：在 CDP 里禁用缓存再导航、而插件的 `client.js` 恰好刚重建（URL 的 `rev` 变了），会看到 `Minified React error #311`（Should have a queue）从插件自己的组件栈里冒出来，像是在渲染宿主组件时丢了 hook 队列。同一页面在缓存开着的普通刷新下完全干净；换全新 profile 也复现不出来。判定口径：一处报错只在"刚重建 + 强制不走缓存 + 复用同一个浏览器进程"三件事同时成立时出现，就不是产品缺陷。验证界面时要么别禁用缓存，要么每次重建后先关掉浏览器再起。
- 带状态的"行组件"（内里有 `useState` 的那种）必须 `h(Row, props)` 挂上去，不能 `Row(props)` 直接调。直接调会把它的 hook 记进父组件的队列，只要调用位置在 `if`/`map` 的条件分支里，渲染次数一变就整棵树崩，报的还是 React 的压缩错误码（`#300`），从栈上看不出是这个原因。


## 八、把一个有历史的仓库发布成独立仓库

脱胎换骨的插件要公开时，历史会暴露来源。本地保留历史、远端只留一个提交的做法：

```
git checkout --orphan public        # 工作树与索引都保留，历史从头开始
git add -A
git commit -F .work/release-msg.txt # 一份写给陌生人的说明，不是 commit 日志合集
git push https://x-access-token:<token>@github.com/<owner>/<repo>.git public:main
git checkout master                 # 本地历史原地不动
```

- 令牌从 `git credential fill` 取，只放在变量里，命令输出用 `-replace` 抹掉再打印；不要写进 remote 配置。
- `.gitignore` 里的临时目录（如 `.work/`）自动不进公开提交，但要先 `git ls-files` 数一遍，确认没有把草稿与附件带进去。
- 公开分支留一个本地分支（`public`）当基线，下次发版 amend 或重建即可，master 继续攒真实历史。
- README 要重写成读者视角：开篇讲它做什么，不讲它曾是什么；描述文件名、目录表、宿主组件取用方式都要按现状写，别留“以前的设置页”这类沿革句子。
