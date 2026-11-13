# dsh-omega-proxy

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的 ZeroOmega 式代理分流插件。
一份「当前配置」同时驱动 shell 命令、终端和模型请求；分流配置按 provider 或工作区选路；每个已启用的
Host 插件还能单独指定线路。

[English](README.md) · [架构说明](ARCHITECTURE.md)

## 能做什么

- **一份当前配置。** 在头部 chip 里切换，作用于之后启动的所有 shell 命令、终端会话和模型请求。
- **分流配置。** 规则自上而下，命中第一条即生效。条件是 `provider` 或 `工作区`，匹配值从列表里选而不是手写；
  同一条件只能出现一次。兜底可以是「跟随系统」或另一份配置。
- **插件线路。** 设置页列出所有已启用的 Host 插件，每个都能设为 `跟随系统` 或某份代理服务器配置；
  分流与 SOCKS5 配置不参与，因为插件请求没有 provider/工作区可供解析，SOCKS5 也没有请求 dispatcher。
- **对话进行中不切换。** 有 turn 打开时菜单项变灰，Host 也会拒绝切换请求，运行中的对话不会在脚下换线路。
- **只写三个小写变量。** 子进程拿到 `http_proxy`、`https_proxy`、`all_proxy`；不写大写变体，也不写
  `NO_PROXY`。没有生效配置时一个变量都不注入。

## 安装

组合包安装进一个 profile。用 CLI：

```sh
# 本地 checkout（以 link 方式挂进 profile）
dsh plugin --profile desktop add /path/to/dsh-omega-proxy

# 打包成 tarball 安装（不走网络，也不需要构建）
dsh plugin --profile desktop add ./dsh-omega-proxy-0.1.0.tgz

# 从 GitHub 安装
dsh plugin --profile desktop add github:54wedge/dsh-omega-proxy
```

GitHub 方式拉取的是仓库源码。本仓库把构建好的 `client.js` 一起提交了，安装时不会跑构建脚本，也不需要
为构建授权。建议锁定 commit，避免后续推送改变实际运行的内容：
`github:YOUR-NAME/dsh-omega-proxy#<sha>`。

装好后重启该 profile。全新安装只带一份指向 `127.0.0.1:7890` 的配置，其余由你自己配置。

## 使用

- **头部 chip。** 在右侧工具区、「用 App 打开」控件左边，显示当前配置；菜单里是「跟随系统」加你的全部配置。
  选中分流的配置时，还会显示它对当前会话解析到的结果。
- **新建会话行。** 同一个 chip 在工作区/预设那一行的右端。
- **设置 → 代理。** 两个 tab：
  - *配置*：新增、编辑、删除。编辑器包含名称、类型（代理服务器 / 分流）、颜色、四行服务器
    （`(default)` / `http` / `https` / `socks`）、「通过 SOCKS 解析 DNS」开关，以及可选的用户名密码。
    分流配置另有规则列表和兜底。所有改动即时保存。有对话在进行时整页会被锁定（和切换配置共用一把锁），
    并用一条提示说明原因。没有「应用」按钮。
  - *插件*：每个已启用的 Host 插件一行，右侧是它的线路。

圆点含义：实心点 = 普通代理配置；空心环 = 分流配置，环是配置自身颜色，内芯是它解析到的配置颜色
（灰芯表示「跟随系统」）。

## 路由是怎么加的

| 流量 | 做法 |
|---|---|
| shell / 终端 | 包装 `subprocess.spawn` 与 `spawnTerminal`，用子进程的 `cwd` 找到工作区，把解析结果的三个变量合并进 `env` |
| 模型请求 | `llm/stream` 把本次请求的 provider 记进 `AsyncLocalStorage` 作用域；作用域内的 `fetch` 调用改用该 provider 解析出的配置的 `ProxyAgent` |
| 插件请求 | 没有 provider 作用域时，从调用栈认出请求来自哪个 npm 包；配了线路的包用对应 profile 的 agent，其余原样放行 |

切换或保存配置会关闭已缓存的 `ProxyAgent`，避免复用旧连接。

## 状态与接口

`$DSH_HOME/dsh-omega-proxy.json`（`version: 5`）：

```json
{
  "version": 5,
  "activeProfile": "auto",
  "pluginRouting": { "some-package": "proxy" },
  "profiles": [
    { "id": "proxy", "name": "proxy", "kind": "http", "host": "127.0.0.1", "port": 7890, "color": "#22c55e" },
    { "id": "auto", "name": "auto", "kind": "switch", "color": "#3b82f6",
      "rules": [{ "type": "provider", "value": "relay", "profile": "proxy" }] }
  ]
}
```

`/proxy-switch` 下的接口：`GET /state` 给 chip，`GET /settings` 给设置页，`POST /active` 切换，
`POST /settings` 保存，`GET|POST /log` 收客户端诊断。

模型侧还有 `proxy` 工具（报告当前配置、按工作区解析结果，或切换配置）；系统提示里会声明当前线路，
并说明代理变量已经存在，避免模型再给命令加代理参数。

## 兼容性

在 **DeepSeek Harness 0.2.1-rc.4**（macOS）上实测可用。插件没有声明 `engines.dsh` 版本范围，它依赖
下面这些接口——Harness 升级时如果有变动，需要同步修改。

| 接口 | 用途 |
|---|---|
| `subprocess.spawn` / `spawnTerminal` | 注入代理变量（`src/host/spawn.js`） |
| `globalThis.fetch` | 改写模型与插件请求的去向（`src/host/traffic.js`） |
| `llm/stream` | 取本次请求的 provider |
| `agents.list` / `turnBoundaryOf` | 判断是否有 turn 进行中 |
| `sessionController.projections` → `modelSelection` | 调用方没给 provider 时按会话记录解析 |
| `webServer.register` | 提供 `/proxy-switch` |
| `pluginInventory.list` | 列出已启用的 Host 插件 |
| slot `conversation.session.header.utilities`、`conversation.hero.options`、`settings.section` | 挂载点 |
| 客户端服务 `modelDirectories` | 读输入框里已选但未发送的模型 |
| 客户端模块 `@deepseek-ai/dsh-client-ui-primitives` | Menu、Button、Input、Switch、Pill 与图标 |

其中 `fetch` 与两个 `subprocess` 方法是在插件加载期间 monkey patch、卸载时恢复的；其余都是常规注册。

## 网络、隐私与安全

插件自己发起的网络行为：

- **不发起任何自己的请求**：没有遥测、没有统计、没有更新检查、没有远程配置。它只改变 Harness 已有请求的去向。
- **不读取、不缓存、不记录请求体或响应体**。改写只是给请求加一个 dispatcher，不去看内容。
- 诊断日志（`$DSH_HOME/dsh-omega-proxy.log`，也可通过 `GET /proxy-switch/log` 读）记录的是客户端生命周期
  事件，比如「bundle 已加载」或渲染错误，附带一段很短的说明。里面没有 URL、请求头或凭据。

你的代理能看到什么：

- 明文 `http://` 请求：代理能看到完整请求，包括请求头和请求体。
- `https://` 请求：代理只从 `CONNECT` 看到目标主机和端口；除非别处终结 TLS，内容仍是加密的。本插件不做
  TLS 中间人。
- 写在代理 URL 里的凭据会发给那个代理。建议使用本机代理或你信任的代理，不要把线路指向不可信的端点。

凭据与本地访问：

- 配置里的密码以**明文**保存在 `$DSH_HOME/dsh-omega-proxy.json`，和其他 Harness 状态放在一起。不要把这个
  文件提交进仓库，目录权限保持仅本人可读。
- HTTP 接口从不返回密码：设置 payload 里只有 `hasPassword`。密码输入框留空表示保持原值，输入新值则替换。
- 接口由 Harness 的 web 服务提供（默认只监听本机），并通过 `sec-fetch-site` 拒绝跨站请求。能访问该本机端口
  且被视为同源的进程可以切换配置。

使用线路前值得知道的行为：

- 线路是进程级的。指向不可信代理的配置，会让它承载的所有流量暴露目标地址。
- 插件归属靠读**调用栈**判断，本质是启发式：经过辅助模块、worker，或某个包自己替换了 `fetch` 时，可能判断
  不到或判到别的包。
- 插件加载期间会改变全局行为（`fetch`、子进程创建）。如果卸载没能干净恢复，重启 Harness，不要假设原函数已回来。
- 配置指向的代理没启动时，相关网络操作会失败，直到你切回「跟随系统」。

## 已知限制

- SOCKS5 配置只作用于 shell 与终端：请求改道需要 HTTP `CONNECT` 代理，所以插件线路里不提供 SOCKS5。
- 插件线路必须是单份 HTTP 代理。分流配置也不在其中——插件请求没有 provider 或工作区可供解析。
- 自带 HTTP 客户端或替换 `fetch` 的包改不到。
- 自己从环境变量解析代理的代码路径改不到。
- WebSocket 流量不改道。

## 开发

```
index.js                  Host 装配：状态、切换锁、事件订阅
src/host/profile.js       配置模型、环境变量推导、状态结构
src/host/switch.js        规则匹配与分流解析
src/host/http.js          /state /settings /active /log
src/host/traffic.js       undici 解析、fetch shim、连接池、流作用域
src/host/spawn.js         子进程环境
src/host/workspace.js     目录 → 工作区
src/host/tool.js          模型工具 proxy
src/host/agent-context.js 每个 agent 的系统提示段落
src/client/*.js           客户端源码（共享一个 factory 作用域）
client.js                 生成的单文件 bundle
scripts/build-client.mjs  拼接 src/client/*.js
```

模块加载器一个包只接受一个 `client.js`，且只暴露共享模块（`react`、UI primitives……），所以客户端源码是
普通声明，按构建脚本里 `ORDER` 的顺序拼接。

```sh
npm run build   # 重新生成 client.js
npm run check   # 语法检查 + 检查 client.js 是否过期
```

## License

MIT
