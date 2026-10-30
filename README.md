# Rime 方案工作站

GitHub 上 Rime 输入方案（`schema.yaml` + `dict.yaml`）的轻量级在线编辑器与浏览器。

- **不替代**本地 CLI / 文本工作流  
- **不持有**配置数据的第二真相源  
- 所有编辑以 **commit** 写回用户指定仓库；原始 YAML 始终是唯一权威来源

## 技术栈

- Next.js 14 (App Router) + TypeScript + Tailwind CSS  
- YAML：`eemeli/yaml`（`parseDocument` + `toString`，禁止 load/dump 写回）  
- 鉴权：GitHub OAuth App + 服务端 collaborator permission 校验  
- 写操作：Git Data API 原子 commit（空仓库初始化例外：Contents API）

## 本地启动

```bash
cp .env.example .env.local
# 填入 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / SESSION_SECRET

npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

| 变量 | 说明 |
|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret（仅服务端） |
| `SESSION_SECRET` 或 `NEXTAUTH_SECRET` | 加密 cookie 密钥，≥32 字符 |
| `NEXT_PUBLIC_APP_URL` | 可选，OAuth 回调用的公网/本地 Origin |

OAuth App 回调地址：`{ORIGIN}/api/auth/callback`  
Scope：`read:user` + `repo`（MVP；未来可迁移 GitHub App 做仓库级细粒度权限）

### 部署（Vercel）

1. 导入本仓库到 Vercel  
2. 配置上述环境变量  
3. 将 OAuth 回调改为 `https://你的域名/api/auth/callback`

## 冒烟测试清单

### 第一阶段（匿名浏览）

1. 首页搜索出现含 rime 的仓库卡片（owner/name、描述、star、「查看方案」）  
2. 进入详情：自动发现 `*.schema.yaml` / `*.dict.yaml`  
3. 词条表格展示；搜索框可模糊过滤 text  
4. 「一键复制路径」剪贴板内容为 `用户名/仓库名称`  
5. 「下载 schema/dict」得到与 GitHub 一致的原始内容（非重新序列化）  
6. 未登录看不到编辑/保存入口

### 第二阶段（登录与编辑）

1. GitHub 登录后进入「工作区」，拉到个人疑似 Rime 仓库  
2. 选中 1 个仓库创建项目；可重复创建多个项目（刷新后 localStorage 仍在）  
3. schema：number / text / boolean 控件可改；未知字段只在预览提示  
4. dict：增删改词条；仅 text 的新行写回为纯 text 列  
5. 保存走 Git Data API 单次 commit；非协作者返回 403，前端隐藏保存

### 第三阶段

1. 空仓库可「从零创建」两个 YAML（Contents API）  
2. 暗色模式切换持久化  
3. 窄屏（&lt;768px）词条为卡片式；保存条贴底安全区  
4. 提交前 Diff 仅显示变更行

### 自动化解析冒烟

```bash
npx tsx scripts/smoke-dict.ts
```

## 权限模型

每次写操作服务端强制调用：

`GET /repos/{owner}/{repo}/collaborators/{username}/permission`

仅 `admin` / `maintain` / `write` 允许提交；`read` / `triage` / `none` → **403**。  
Access token 只存在 httpOnly 加密 cookie，**绝不**写入 localStorage。
