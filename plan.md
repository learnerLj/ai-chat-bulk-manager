# Implementation Plan

This document records the current maintenance plan for AI Chat Bulk Manager.

## 1. Current State

- `src/index.user.js` contains the production userscript.
- `test/index-user.test.js` contains lightweight regression checks for selectors, actions, and sandbox-sensitive event construction.
- The script supports ChatGPT and Gemini.
- Browser validation artifacts are excluded through `.gitignore`.

## 2. Maintenance Checklist

Use this checklist for future selector or behavior updates:

1. Reproduce the issue in a logged-in browser session.
2. Inspect the live DOM before changing selectors.
3. Update the smallest platform adapter surface that fixes the issue.
4. Add or update a regression check in `test/index-user.test.js`.
5. Run:

   ```bash
   node -c src/index.user.js
   node --test test/index-user.test.js
   ```

6. Manually test at least one selected conversation on the affected platform.

## 3. ChatGPT Change Plan

When ChatGPT changes its sidebar:

1. Re-check conversation link selectors under `nav`.
2. Verify `/c/{uuid}` extraction still works.
3. Verify the control panel still mounts above the conversation list.
4. Verify `GET /api/auth/session`.
5. Verify PATCH responses for:
   - `{"is_archived": true}`
   - `{"is_visible": false}`

## 4. Gemini Change Plan

When Gemini changes its UI:

1. Re-check `.chat-history-list`.
2. Re-check row selectors for `gem-nav-list-item[data-test-id="conversation"]`.
3. Re-check more-options button labels and attributes.
4. Re-check delete menu item text/icons.
5. Re-check confirmation dialog host and inner button.
6. Run at least a two-row delete test because Gemini virtualizes and re-renders list rows.

## 5. Release Checklist

Before publishing:

1. Update `README.md` if behavior changes.
2. Update `spec.md` if selectors, endpoints, or queue behavior changes.
3. Run local checks.
4. Ensure `.playwright-cli/` is ignored.
5. Commit with a focused message.
6. Push to the public GitHub repository.

## 6. 中文维护说明

后续维护时不要直接猜选择器。先在真实登录页面看 DOM，再改适配器。

- ChatGPT 重点看 `/c/{uuid}` 链接、归档/删除 PATCH 请求、控制条挂载位置。
- Gemini 重点看历史列表、三点菜单、删除菜单项、确认弹窗。
- 每次改完都跑 `node -c` 和 `node --test`。
