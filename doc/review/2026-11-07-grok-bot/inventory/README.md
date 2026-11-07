# Zadig EE↔React inventory（静态重生成）

生成时间：2026-11-07 17:29:01 +0800 Asia/Shanghai
HEAD：`82ec35eed48e93a65486811a38700e97ab2ab472`（feat/zadig-portal-next）

## 方法论

工作区 wipe 后按**静态证据**重生成，不宣称 REA observation ID，不宣称完整 1:1。

- **路由**：`zadig-ee-portal/static/js/94.*.js` 嵌套 Vue Router；`frontend/src/router/index.tsx` brace-aware `<Route>` 树。
- **组件**：`frontend/src/{pages,components,layouts}/**/*.tsx`；`status`=React 实现状态；`mapping_status` 一律未知。
- **接口**：EE JS + React 源 `/api/` 调用与字面量，method+path_shape 归一。

## 状态规则

| 状态 | 含义 |
|---|---|
| 已有 | 非空实现证据；未宣称完整 1:1 |
| 部分 | 已知不完整，或仅路径/请求候选 |
| 缺失 | EE 能力对应未实现、错误目的地或已知占位 |
| 未知 | 证据不足；未知不代替缺失 |

CSV 为 UTF-8 BOM。按 `status` 筛「缺失」「部分」逐条验证。
