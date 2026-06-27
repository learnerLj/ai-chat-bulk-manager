const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const source = readFileSync(join(__dirname, '../src/index.user.js'), 'utf8');

test('ChatGPT conversation selector accepts absolute and relative /c/ links', () => {
    assert.match(source, /a\[href\*=["']\/c\/["']\]/);
});

test('ChatGPT control panel mounts above the conversation list', () => {
    assert.match(source, /firstConversation\?\.closest\('ul'\)/);
    assert.match(source, /bulk-controls-panel-chatgpt/);
    assert.match(source, /isChatGPT && header\.parentElement/);
});

test('ChatGPT supports archive as the primary bulk action', () => {
    assert.match(source, /archiveConversation/);
    assert.match(source, /is_archived:\s*true/);
    assert.match(source, /bulk-archive-btn/);
    assert.match(source, /归档选中/);
    assert.match(source, /删除选中/);
});

test('Gemini injection uses MutationObserver for dynamic history rows', () => {
    assert.match(source, /new\s+MutationObserver/);
});

test('Gemini boot waits for the side navigation to settle before injection', () => {
    assert.match(source, /GEMINI_BOOT_DELAY_MS\s*=\s*3500/);
    assert.match(source, /gemini\.google\.com/);
    assert.match(source, /setTimeout\(boot,\s*GEMINI_BOOT_DELAY_MS\)/);
});

test('Gemini control panel mounts above the history list', () => {
    assert.match(source, /bulk-controls-panel-gemini/);
    assert.match(source, /const header = isGemini \? document\.querySelector\('\.chat-history-list'\) : this\.adapter\.getSidebarHeader\(\)/);
    assert.match(source, /header\.parentElement\.insertBefore\(panel,\s*header\)/);
});

test('Gemini delete flow waits for menu and confirmation elements', () => {
    assert.match(source, /waitForElement/);
    assert.match(source, /actions-menu-button/);
    assert.match(source, /confirm-button/);
});

test('synthetic clicks use the target document window for userscript sandboxes', () => {
    assert.match(source, /node\.ownerDocument\.defaultView \|\| window/);
    assert.match(source, /new nodeWindow\.MouseEvent/);
    assert.doesNotMatch(source, /new MouseEvent\([^)]*view:\s*window/);
});

test('Gemini delete flow waits for confirmation dialog to close after node removal', () => {
    assert.match(source, /isConversationDeleted/);
    assert.match(source, /findConversationById\(nodeId\)/);
    assert.match(source, /GEMINI_DELETE_POLL_MS\s*=\s*150/);
    assert.match(source, /delay\(GEMINI_DELETE_POLL_MS\)/);
    assert.match(source, /host\.querySelector\('button'\) \|\| host/);
    assert.match(source, /findCancelButton/);
    assert.match(source, /cancel-button/);
    assert.match(source, /if \(confirmBtn\) \{\s+clickElement\(confirmBtn\);/);
    assert.match(source, /isDeleted && !confirmBtn/);
});

test('bulk controls include a stop button for long deletion queues', () => {
    assert.match(source, /bulk-stop-btn/);
});

test('bulk delete asks for confirmation before destructive actions', () => {
    assert.match(source, /window\.confirm\(`确认\$\{actionLabel\}选中的 \$\{this\.selectedNodes\.size\} 条会话？`\)/);
    assert.match(source, /this\.setStatus\('已取消'\)/);
});

test('bulk delete queue uses the configured fast interval', () => {
    assert.match(source, /BULK_DELETE_INTERVAL_MS\s*=\s*100/);
    assert.match(source, /delay\(BULK_DELETE_INTERVAL_MS\)/);
});

test('bulk delete synchronizes checked DOM boxes before running', () => {
    assert.match(source, /syncSelectedFromDom/);
    assert.match(source, /checkbox\?\.checked/);
    assert.match(source, /this\.syncSelectedFromDom\(\);\s+if \(this\.isDeleting \|\| this\.selectedNodes\.size === 0\)/);
});
