# Technical Specification

## 1. Purpose

AI Chat Bulk Manager adds bulk conversation management to ChatGPT and Gemini through a Tampermonkey userscript. The script targets the sidebar history list, injects checkboxes, and provides platform-aware bulk actions.

## 2. Supported Platforms

| Platform | Domain | Strategy |
| --- | --- | --- |
| ChatGPT | `chatgpt.com` | Use authenticated backend PATCH requests from the logged-in browser session. |
| Gemini | `gemini.google.com` | Use DOM automation against the visible page UI. |

## 3. Architecture

The userscript dispatches by `window.location.hostname`:

- `OpenAIAdapter` handles ChatGPT.
- `GoogleAdapter` handles Gemini.
- `BulkManager` owns shared UI state, checkbox injection, selected-node synchronization, and queue execution.

The adapters expose:

- `getConversations()`
- `injectCheckbox(node, onSelectChange)`
- `deleteConversation(node)`
- `archiveConversation(node)`
- `getSidebarHeader()`
- `getNodeId(node)`
- `findConversationById(id)`

## 4. ChatGPT Behavior

### 4.1 Selectors

- Conversation links: `nav a[href*="/c/"]`
- Conversation id extraction: `/c/{uuid}`
- Control panel mount: above the first conversation list `ul`

### 4.2 Auth

The script requests:

```http
GET https://chatgpt.com/api/auth/session
```

It reads `accessToken` from the current logged-in browser session.

### 4.3 Archive

Archive uses:

```http
PATCH https://chatgpt.com/backend-api/conversation/{id}
Content-Type: application/json
Authorization: Bearer {accessToken}

{"is_archived": true}
```

### 4.4 Delete

Delete uses:

```http
PATCH https://chatgpt.com/backend-api/conversation/{id}
Content-Type: application/json
Authorization: Bearer {accessToken}

{"is_visible": false}
```

This is a user-visible soft delete. The conversation disappears from the normal sidebar list, but the script does not call an undocumented hard-delete endpoint.

## 5. Gemini Behavior

### 5.1 Selectors

The current Gemini UI uses:

- History list: `.chat-history-list`
- Conversation rows:
  - `gem-nav-list-item[data-test-id="conversation"]`
  - `div[data-test-id="conversation"]`
  - `.chat-history-list gem-nav-list-item`
  - `.chat-history-list a.mat-mdc-list-item`
- More-options buttons:
  - `button[data-test-id="actions-menu-button"]`
  - localized `aria-label` matches such as `更多选项` and `More options`
- Delete menu items:
  - `button[data-test-id="delete-button"]`
  - menu buttons containing delete text or delete icons
- Confirmation dialog:
  - `gem-button[data-test-id="confirm-button"]`
  - its inner native `button`

### 5.2 Delete Queue

Gemini deletion is performed through the visible page UI:

1. Scroll the row into view.
2. Hover the row.
3. Click the row more-options button.
4. Click the delete menu item.
5. Click the Gemini confirmation button.
6. Wait until the target conversation id can no longer be found.
7. Close any residual confirmation overlay.

The queue uses:

```js
const BULK_DELETE_INTERVAL_MS = 100;
const GEMINI_DELETE_POLL_MS = 150;
```

## 6. UI

The control panel is mounted above the history list.

ChatGPT actions:

- `归档选中`
- `删除选中`
- `停止`

Gemini actions:

- `删除选中`
- `停止`

The destructive delete path asks for browser confirmation before starting.

## 7. Tampermonkey Sandbox Handling

Synthetic mouse events use the target node's document window:

```js
const nodeWindow = node.ownerDocument.defaultView || window;
new nodeWindow.MouseEvent(...)
```

This avoids `MouseEvent.view` conversion errors in userscript sandboxes.

## 8. Verification

Local checks:

```bash
node -c src/index.user.js
node --test test/index-user.test.js
```

Manual verification should cover:

- ChatGPT checkbox injection.
- ChatGPT archive request returning 2xx.
- ChatGPT delete request returning 2xx and removing DOM nodes.
- Gemini checkbox injection.
- Gemini menu-delete-confirm flow.
- Gemini selected rows disappearing from the history list.

## 9. 中文说明

这个脚本通过适配器模式分别处理 ChatGPT 和 Gemini。

- ChatGPT 使用当前登录态的后台接口：
  - 归档：`{"is_archived": true}`
  - 删除：`{"is_visible": false}`
- Gemini 使用页面 DOM 模拟点击：
  - 打开更多菜单
  - 点击删除
  - 点击确认弹窗

ChatGPT 的删除不是硬删除，但用户层面会从正常会话列表里消失。Gemini 的删除跟网页手动操作一致。
