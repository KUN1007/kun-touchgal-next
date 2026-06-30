# Repository Guidelines

## Project Overview

TouchGal (`kun-touchgal-next`) 是一个 Next.js 15 App Router 的 Galgame 文化社区站点，核心功能包括 Galgame/补丁资料库、资源下载、评分评论、用户主页、私信和后台管理。项目使用 PostgreSQL + Prisma、Redis、S3 兼容存储、JWT 认证和 MDX 内容页。

## Architecture & Data Flow

- 主栈：Next.js 15.5、React 19、TypeScript strict、HeroUI、Tailwind CSS v4、Milkdown/Codemirror。
- 数据层：`prisma/index.ts` 创建 Prisma 7 + PostgreSQL `pg` pool；`lib/redis.ts` 负责 Redis KV、会话和缓存；`lib/s3.ts` 负责图片/视频对象存储。
- 页面流：`app/**/page.tsx` 默认是 Server Component；页面通过 `app/**/actions.ts` 调服务层，再访问 Prisma/Redis。
- 客户端流：Client Component 调 `utils/kunFetch.ts` → `app/api/**/route.ts` → `app/api/utils/parseQuery.ts` + `validations/*.ts` → 鉴权 → service/cache → Prisma。
- 中间件：`middleware.ts` 对 `/api/*` 做 CSRF 校验，对 `/admin`、`/user`、`/comment`、`/edit` 等路径做登录保护。
- 认证：JWT cookie 名为 `kun-galgame-patch-moe-token`；Edge middleware 用 `jwtEdge.ts`，API/服务端用 `jwt.ts`/`verifyHeaderCookie`。
- 内容：`posts/**/*.mdx` 是站内公告/博客；`scripts/generateKunSitemap.ts` 扫描 `app/` 和动态数据生成 `public/sitemap.xml`。
- 定时任务：`instrumentation.ts` 仅在 `NEXT_RUNTIME=nodejs` 且 `KUN_ENABLE_CRON=true` 时启动 `server/cron.ts`。

## Key Directories

- `app/`：App Router 页面、布局、server actions、API route handlers。
- `components/`：功能 UI；`components/kun/` 是共享组件，`components/patch/` 是补丁详情核心组件。
- `store/`：Zustand 状态；用户、设置、搜索、编辑草稿等多为 persisted store。
- `validations/`：Zod schema；所有 API/表单边界优先复用这里。
- `prisma/schema/`：拆分 Prisma models；核心模型是 `user`、`patch`、`patch_resource`、`patch_comment`、`patch_rating`。
- `lib/`：Redis、S3、运行时路径、外部数据源辅助。
- `utils/`：fetch、错误处理、markdown、校验、server action 辅助。
- `middleware/`：认证、CSRF、cookie 校验实现。
- `server/`：cron task 编排和服务端图片资源。
- `scripts/`：部署、构建后拷贝、sitemap、数据回填脚本。
- `migration/`：一次性数据同步/迁移脚本。
- `posts/`、`public/`：MDX 内容和静态资源。

## Development Commands

先按 `.env.example` 创建 `.env`，本地需要 Node.js、pnpm、PostgreSQL、Redis。

```bash
pnpm install
pnpm prisma:push
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

常用补充命令：

```bash
pnpm prisma:generate
pnpm format
pnpm build:sitemap
pnpm deploy:install
pnpm deploy:build
```

当前没有 `test` script。

## Code Conventions & Common Patterns

- 路径别名：`~/*` 指向仓库根目录；优先使用 `~/...` 导入。
- 格式：Prettier 为单引号、无分号、2 空格、无尾逗号；EditorConfig 使用 UTF-8、LF。
- 命名：React 组件用 PascalCase；项目自有 helper/export 常见 `kun` 前缀，例如 `kunFetchGet`、`kunErrorHandler`。
- 组件边界：默认保留 Server Component；只有 hooks、浏览器 API、交互式 HeroUI/Zustand 场景才加 `'use client'`。
- API 结构：`app/api/<feature>/route.ts` 放 HTTP handler；复杂查询/写入放同目录 `service.ts` 或 `cache.ts`。
- 输入校验：新 API/表单先在 `validations/` 增加或复用 Zod schema，再用 `kunParseGetQuery`、`kunParsePostBody`、`kunParsePutBody`、`kunParseDeleteQuery`、`kunParseFormData` 解析。
- 响应约定：业务错误通常 `NextResponse.json('错误消息')`；成功返回 typed JSON。客户端用 `kunErrorHandler`/`kunErrorHandlerAsync` 处理 `string | T`。
- 内部请求：Client Component 调内部 API 时用 `utils/kunFetch.ts`，不要手写重复 fetch；它会带 `credentials: 'include'` 和 `x-requested-with: kun-fetch`。
- 状态管理：跨组件/持久化状态放 `store/*` 的 Zustand store；表单本地状态优先留在组件或 React Hook Form。
- 异步模式：列表接口常用 `Promise.all([findMany, count])`；Server Action/RSC 重复读可用 React `cache()`。
- 事务：无容器式 DI；服务直接 import `prisma`/`redis`。多表写入用 `prisma.$transaction`，需要复用时传 transaction client 给 helper。
- 缓存：TTL 常量在 `config/cache.ts`；Redis key 统一经过 `lib/redis.ts` 前缀。

## Important Files

- `package.json`：脚本、依赖、项目描述。
- `next.config.ts`：MDX、standalone output、图片 remotePatterns、build skip-checks。
- `tsconfig.json`：strict、ESNext、bundler resolution、`~/*` alias。
- `app/layout.tsx`、`app/providers.tsx`：全局布局、HeroUI/theme/progress providers、TopBar/Footer/Toaster。
- `app/page.tsx`、`app/[id]/page.tsx`：首页和补丁详情入口。
- `app/api/utils/parseQuery.ts`：API Zod 解析约定。
- `app/api/utils/jwt.ts`、`app/api/utils/jwtEdge.ts`：JWT/session 验证。
- `middleware.ts`、`middleware/auth.ts`、`middleware/_csrf.ts`：请求保护入口。
- `prisma/index.ts`、`prisma/schema/*.prisma`：数据库 client 和模型。
- `validations/dotenv-check.ts`、`.env.example`：环境变量校验和模板。
- `config/moyu-moe.ts`、`config/cache.ts`：站点元数据和缓存 TTL。
- `instrumentation.ts`、`server/cron.ts`：cron 启动链路。
- `ecosystem.config.cjs`：PM2 生产配置，包含主服务和 cron 服务。
- `scripts/postbuild.ts`、`scripts/deployBuild.ts`：standalone 构建后处理和部署脚本。
- `.github/workflows/lint-check.yml`：CI 只运行 lint 和 typecheck。

## Runtime/Tooling Preferences

- 使用 Node.js + pnpm；CI 使用 Node 22、Corepack、pnpm cache。不要按 Bun 项目处理。
- `package.json` 是 ESM（`"type": "module"`）；TypeScript 脚本通过 `esno` 执行。
- 开发命令 `pnpm dev` 使用 Turbopack；`pnpm dev:webpack` 可切回 webpack dev server。
- 生产构建是 Next standalone；`postbuild` 会把 `public/`、`.next/static/`、`server/image/`、`posts/`、`config/redirect.json` 拷进 `.next/standalone/`。
- Prisma schema 根目录是 `prisma/schema/`，生成 client 到 `prisma/generated/prisma`。
- Tailwind v4 通过 `postcss.config.js` 的 `@tailwindcss/postcss`，主题入口在 `styles/tailwind.css` 和 `styles/hero.ts`。
- `.env` 缺失或不符合 `validations/dotenv-check.ts` 会在启动/构建时失败。

## Testing & QA

- 仓库当前没有测试框架、测试目录、测试文件或 `pnpm test`。
- CI（`.github/workflows/lint-check.yml`）流程：`pnpm install` → 复制 `.env.example` → `pnpm prisma:generate` → `pnpm lint` → `pnpm typecheck`。
- 代码改动至少跑相关静态检查：`pnpm typecheck`；涉及 lint/格式时跑 `pnpm lint` 或 `pnpm format`。
- 路由、配置、Prisma、standalone 相关改动优先跑 `pnpm build`。
- 功能改动需要用 `pnpm dev` 手动 smoke changed flow；API/客户端改动要同时检查成功路径和业务错误字符串路径。
- 数据库模型变更后运行 `pnpm prisma:push` 或至少 `pnpm prisma:generate`，并检查受影响的 Prisma 查询。
