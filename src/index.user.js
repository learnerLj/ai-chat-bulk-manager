// ==UserScript==
// @name         AI Chat Bulk Manager
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Bulk delete/hide conversations on AI Chat platforms
// @author       Luo Jiahao
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      chatgpt.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[AI Chat Bulk Manager]';
    const CONVERSATION_LINK_SELECTOR = 'a[href*="/c/"]';
    const GEMINI_BOOT_DELAY_MS = 3500;
    const BULK_DELETE_INTERVAL_MS = 100;
    const GEMINI_DELETE_POLL_MS = 150;
    const GEMINI_SELECTORS = {
        conversation: [
            'gem-nav-list-item[data-test-id="conversation"]',
            'div[data-test-id="conversation"]',
            '.chat-history-list gem-nav-list-item',
            '.chat-history-list a.mat-mdc-list-item'
        ].join(', '),
        historyRoot: [
            '.chat-history',
            'bard-sidenav',
            'side-navigation',
            'mat-sidenav',
            '[role="navigation"]'
        ].join(', '),
        menuButton: [
            'button[data-test-id="actions-menu-button"]',
            'button[aria-label*="更多选项"]',
            'button[aria-label*="More options"]',
            'button[aria-label*="More"]',
            'button[aria-label*="更多"]',
            'button:has(mat-icon[data-mat-icon-name="more_vert"])',
            'button:has(mat-icon[fonticon="more_vert"])',
            'button:has(mat-icon)'
        ].join(', '),
        deleteItem: [
            'button[data-test-id="delete-button"]',
            '[role="menu"] button:has-text("删除")',
            '[role="menu"] button:has-text("Delete")',
            '.mat-mdc-menu-panel button:has-text("删除")',
            '.mat-mdc-menu-panel button:has-text("Delete")',
            'div[role="menu"] button:has(mat-icon[data-mat-icon-name="delete"])',
            'div[role="menu"] button:has(mat-icon[fonticon="delete"])',
            'div[role="menu"] [role="menuitem"]:has(mat-icon[data-mat-icon-name="delete"])',
            'div[role="menu"] [role="menuitem"]:has(mat-icon[fonticon="delete"])',
            'button:has(mat-icon[data-mat-icon-name="delete"])',
            'button:has(mat-icon[fonticon="delete"])'
        ].join(', '),
        confirmButton: [
            'mat-dialog-container gem-button[data-test-id="confirm-button"]',
            '.cdk-overlay-pane gem-button[data-test-id="confirm-button"]',
            'gem-button[data-test-id="confirm-button"]',
            'mat-dialog-container gem-button[data-test-id="confirm-button"] button',
            '.cdk-overlay-pane gem-button[data-test-id="confirm-button"] button',
            'gem-button[data-test-id="confirm-button"] button',
            'mat-dialog-container button[data-test-id="confirm-button"]',
            'mat-dialog-container button:has-text("Delete")',
            'mat-dialog-container button:has-text("删除")',
            '.cdk-overlay-pane button:has-text("Delete")',
            '.cdk-overlay-pane button:has-text("删除")',
            'button[data-test-id="confirm-button"]'
        ].join(', ')
    };

    const log = (...args) => console.log(LOG_PREFIX, ...args);
    const warn = (...args) => console.warn(LOG_PREFIX, ...args);
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getText = (node) => (node && node.textContent ? node.textContent.trim() : '');

    const clickElement = (node) => {
        const nodeWindow = node.ownerDocument.defaultView || window;
        const mouseEventInit = { bubbles: true, cancelable: true, view: nodeWindow };
        node.dispatchEvent(new nodeWindow.MouseEvent('pointerdown', mouseEventInit));
        node.dispatchEvent(new nodeWindow.MouseEvent('mousedown', mouseEventInit));
        node.dispatchEvent(new nodeWindow.MouseEvent('pointerup', mouseEventInit));
        node.dispatchEvent(new nodeWindow.MouseEvent('mouseup', mouseEventInit));
        node.click();
    };

    const getConversationIdFromHref = (href) => {
        if (!href) return '';
        const match = href.match(/\/c\/([a-f0-9-]{36})/i);
        return match ? match[1] : '';
    };

    const queryTextSelector = (root, selector) => {
        const hasTextMatch = selector.match(/^(.*):has-text\("(.+)"\)$/);
        if (!hasTextMatch) return root.querySelector(selector);

        const [, baseSelector, expectedText] = hasTextMatch;
        return Array.from(root.querySelectorAll(baseSelector))
            .find(node => getText(node).includes(expectedText)) || null;
    };

    const queryFirst = (selector, root = document) => {
        const selectors = selector.split(',').map(item => item.trim()).filter(Boolean);
        for (const item of selectors) {
            try {
                const node = queryTextSelector(root, item);
                if (node) return node;
            } catch (error) {
                warn('Selector failed', item, error);
            }
        }
        return null;
    };

    const waitForElement = async (selector, root = document, timeoutMs = 1500) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            const node = queryFirst(selector, root);
            if (node) return node;
            await delay(100);
        }
        throw new Error(`Element not found: ${selector}`);
    };

    const isVisible = (node) => {
        if (!node || !node.isConnected) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    const waitForNodeRemoval = async (node, timeoutMs = 8000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (!node || !node.isConnected) return;
            await delay(150);
        }
        throw new Error('Conversation node was not removed after delete confirmation');
    };

    const sendRequest = (details) => {
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    ...details,
                    onload: resolve,
                    onerror: reject
                });
            });
        }

        return fetch(details.url, {
            method: details.method,
            headers: details.headers,
            body: details.data,
            credentials: 'include'
        }).then(async response => ({
            status: response.status,
            responseText: await response.text()
        }));
    };

    const addStyle = (css) => {
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
            return;
        }
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    };

    class BaseAdapter {
        getConversations() { throw new Error('Not implemented'); }
        injectCheckbox(node, callback) { throw new Error('Not implemented'); }
        deleteConversation(node) { throw new Error('Not implemented'); }
        archiveConversation(node) { return this.deleteConversation(node); }
        getSidebarHeader() { throw new Error('Not implemented'); }
        getNodeId(node) { return getText(node); }
        findConversationById(id) {
            return this.getConversations().find(node => this.getNodeId(node) === id) || null;
        }
    }

    class OpenAIAdapter extends BaseAdapter {
        constructor() {
            super();
            this.accessToken = '';
            this.fetchAccessToken();
        }

        fetchAccessToken() {
            return sendRequest({
                method: 'GET',
                url: 'https://chatgpt.com/api/auth/session',
            }).then((res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    this.accessToken = data.accessToken || '';
                    log('ChatGPT token loaded', Boolean(this.accessToken));
                } catch(e) {
                    console.error(LOG_PREFIX, 'Failed to parse ChatGPT token', e);
                }
            }).catch((error) => {
                console.error(LOG_PREFIX, 'Failed to load ChatGPT token', error);
            });
        }

        getConversations() {
            const links = Array.from(document.querySelectorAll(`nav ${CONVERSATION_LINK_SELECTOR}`))
                .filter(link => getConversationIdFromHref(link.getAttribute('href')));
            const seen = new Set();
            return links.filter(link => {
                const id = getConversationIdFromHref(link.getAttribute('href'));
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }

        getNodeId(node) {
            return getConversationIdFromHref(node.getAttribute('href'));
        }

        injectCheckbox(node, onSelectChange) {
            if (node.querySelector('.bulk-delete-checkbox')) return;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.addEventListener('click', (event) => event.stopPropagation());
            checkbox.addEventListener('change', (e) => onSelectChange(node, e.target.checked, e));
            node.insertBefore(checkbox, node.firstChild);
        }

        async deleteConversation(node) {
            const href = node.getAttribute('href');
            const id = getConversationIdFromHref(href);
            if (!id) return Promise.reject('No conversation ID found');
            if (!this.accessToken) {
                await this.fetchAccessToken();
            }
            if (!this.accessToken) return Promise.reject('No Access Token');

            const res = await sendRequest({
                method: 'PATCH',
                url: `https://chatgpt.com/backend-api/conversation/${id}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                data: JSON.stringify({ is_visible: false })
            });

            if (res.status >= 200 && res.status < 300) {
                node.remove();
                log('ChatGPT hidden', id, res.status);
                return;
            }

            throw new Error(`HTTP error ${res.status}`);
        }

        async archiveConversation(node) {
            const href = node.getAttribute('href');
            const id = getConversationIdFromHref(href);
            if (!id) return Promise.reject('No conversation ID found');
            if (!this.accessToken) {
                await this.fetchAccessToken();
            }
            if (!this.accessToken) return Promise.reject('No Access Token');

            const res = await sendRequest({
                method: 'PATCH',
                url: `https://chatgpt.com/backend-api/conversation/${id}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                data: JSON.stringify({ is_archived: true })
            });

            if (res.status >= 200 && res.status < 300) {
                node.remove();
                log('ChatGPT archived', id, res.status);
                return;
            }

            throw new Error(`HTTP error ${res.status}`);
        }

        getSidebarHeader() {
            const firstConversation = this.getConversations()[0];
            return firstConversation?.closest('ul') || document.querySelector('nav');
        }
    }

    class GoogleAdapter extends BaseAdapter {
        getConversations() {
            const nodes = Array.from(document.querySelectorAll(GEMINI_SELECTORS.conversation))
                .map(node => node.closest('gem-nav-list-item[data-test-id="conversation"]') || node)
                .filter(node => !node.closest('#bulk-controls-panel'));
            return Array.from(new Set(nodes));
        }

        getNodeId(node) {
            const href = node.querySelector('a[href^="/app/"]')?.getAttribute('href');
            return href || getText(node);
        }

        injectCheckbox(node, onSelectChange) {
            if (node.querySelector('.bulk-delete-checkbox')) return;
            node.classList.add('gemini-bulk-delete-row');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.addEventListener('click', (event) => event.stopPropagation());
            checkbox.addEventListener('change', (e) => onSelectChange(node, e.target.checked, e));
            const anchor = node.querySelector('a.mat-mdc-list-item') || node.firstChild;
            node.insertBefore(checkbox, anchor);
        }

        async deleteConversation(node) {
            const nodeId = this.getNodeId(node);
            node.scrollIntoView({ block: 'center' });
            node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            const menuBtn = await waitForElement(GEMINI_SELECTORS.menuButton, node, 1500);
            clickElement(menuBtn);

            const deleteItem = await waitForElement(GEMINI_SELECTORS.deleteItem, document, 1500);
            clickElement(deleteItem);

            const confirmBtn = await this.waitForConfirmButton();
            clickElement(confirmBtn);
            await this.waitForDeletedNode(node, nodeId);
            log('Gemini delete clicked', getText(node).slice(0, 80));
        }

        isConversationDeleted(node, nodeId) {
            return !node || !node.isConnected || Boolean(nodeId && !this.findConversationById(nodeId));
        }

        async waitForDeletedNode(node, nodeId) {
            const startedAt = Date.now();
            while (Date.now() - startedAt < 10000) {
                const confirmBtn = await this.findConfirmButton();
                const isDeleted = this.isConversationDeleted(node, nodeId);
                if (isDeleted && confirmBtn) {
                    const cancelBtn = await this.findCancelButton();
                    if (cancelBtn) {
                        clickElement(cancelBtn);
                        await delay(GEMINI_DELETE_POLL_MS);
                        if (!await this.findConfirmButton()) return;
                    }
                }
                if (isDeleted && !confirmBtn) return;
                if (confirmBtn) {
                    clickElement(confirmBtn);
                }
                await delay(GEMINI_DELETE_POLL_MS);
            }
            if (!this.isConversationDeleted(node, nodeId)) {
                await waitForNodeRemoval(node, 1);
            }
        }

        async findConfirmButton() {
            const confirmHosts = Array.from(document.querySelectorAll([
                'mat-dialog-container gem-button[data-test-id="confirm-button"]',
                '.cdk-overlay-pane gem-button[data-test-id="confirm-button"]'
            ].join(', '))).filter(isVisible);
            if (confirmHosts.length > 0) {
                const host = confirmHosts[confirmHosts.length - 1];
                return host.querySelector('button') || host;
            }

            const buttons = Array.from(document.querySelectorAll([
                'mat-dialog-container gem-button[data-test-id="confirm-button"] button',
                '.cdk-overlay-pane gem-button[data-test-id="confirm-button"] button',
                'mat-dialog-container button',
                '.cdk-overlay-pane button',
                'button[data-test-id="confirm-button"]'
            ].join(', '))).filter(isVisible);
            const confirmButtons = buttons.filter(button => {
                const text = getText(button);
                return text === '删除'
                    || text === 'Delete'
                    || button.matches('[data-test-id="confirm-button"]')
                    || Boolean(button.closest('gem-button[data-test-id="confirm-button"]'));
            });
            return confirmButtons.length > 0 ? confirmButtons[confirmButtons.length - 1] : null;
        }

        async findCancelButton() {
            const cancelHosts = Array.from(document.querySelectorAll([
                'mat-dialog-container gem-button[data-test-id="cancel-button"]',
                '.cdk-overlay-pane gem-button[data-test-id="cancel-button"]'
            ].join(', '))).filter(isVisible);
            if (cancelHosts.length > 0) {
                const host = cancelHosts[cancelHosts.length - 1];
                return host.querySelector('button') || host;
            }

            const buttons = Array.from(document.querySelectorAll([
                'mat-dialog-container button',
                '.cdk-overlay-pane button'
            ].join(', '))).filter(isVisible);
            return buttons.find(button => ['取消', 'Cancel'].includes(getText(button))) || null;
        }

        async waitForConfirmButton() {
            const startedAt = Date.now();
            while (Date.now() - startedAt < 3000) {
                const confirmButton = await this.findConfirmButton();
                if (confirmButton) {
                    return confirmButton;
                }
                await delay(100);
            }
            throw new Error(`Element not found: ${GEMINI_SELECTORS.confirmButton}`);
        }

        getSidebarHeader() {
            return queryFirst(GEMINI_SELECTORS.historyRoot) || document.querySelector('nav');
        }
    }

    const getAdapter = () => {
        const host = window.location.hostname;
        if (host.includes('chatgpt.com')) {
            return new OpenAIAdapter();
        } else if (host.includes('gemini.google.com')) {
            return new GoogleAdapter();
        }
        return null;
    };

    class BulkManager {
        constructor() {
            this.adapter = getAdapter();
            if (!this.adapter) return;
            this.selectedNodes = new Set();
            this.isDeleting = false;
            this.init();
        }

        init() {
            addStyle(`
                .bulk-delete-checkbox { width: 16px; height: 16px; margin: 4px 8px 4px 0; cursor: pointer; flex: 0 0 auto; }
                #bulk-controls-panel { padding: 8px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(0,0,0,0.16); background: rgba(255,255,255,0.92); color: #111; position: sticky; top: 0; z-index: 9999; font-size: 12px; }
                #bulk-controls-panel.bulk-controls-panel-gemini { margin: 4px 0 8px; border: 1px solid rgba(255,255,255,0.16); border-radius: 8px; background: rgba(32,32,32,0.96); color: #f2f2f2; box-sizing: border-box; max-width: 100%; }
                #bulk-controls-panel.bulk-controls-panel-chatgpt { margin: 4px 0 8px; border-radius: 8px; box-sizing: border-box; max-width: 100%; }
                .bulk-btn { padding: 4px 8px; cursor: pointer; border-radius: 4px; border: 1px solid #aaa; background: #fff; color: #111; }
                .bulk-btn:disabled { cursor: not-allowed; opacity: 0.5; }
                .bulk-status { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gemini-bulk-delete-row { display: flex !important; align-items: center !important; }
            `);
            this.startObserver();
            this.injectPanel();
        }

        injectPanel() {
            if (document.getElementById('bulk-controls-panel')) return;
            const isGemini = window.location.hostname.includes('gemini.google.com');
            const isChatGPT = window.location.hostname.includes('chatgpt.com');
            const header = isGemini ? document.querySelector('.chat-history-list') : this.adapter.getSidebarHeader();
            if (!header) return;
            
            const panel = document.createElement('div');
            panel.id = 'bulk-controls-panel';
            if (isGemini) {
                panel.classList.add('bulk-controls-panel-gemini');
            } else if (isChatGPT) {
                panel.classList.add('bulk-controls-panel-chatgpt');
            }
            const selectAll = document.createElement('input');
            selectAll.type = 'checkbox';
            selectAll.id = 'bulk-select-all';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'bulk-btn';
            deleteBtn.id = 'bulk-delete-btn';
            deleteBtn.textContent = '删除选中 (0)';
            const archiveBtn = document.createElement('button');
            archiveBtn.className = 'bulk-btn';
            archiveBtn.id = 'bulk-archive-btn';
            archiveBtn.textContent = '归档选中 (0)';
            const stopBtn = document.createElement('button');
            stopBtn.className = 'bulk-btn';
            stopBtn.id = 'bulk-stop-btn';
            stopBtn.textContent = '停止';
            stopBtn.disabled = true;
            const status = document.createElement('span');
            status.className = 'bulk-status';
            status.id = 'bulk-status';
            status.textContent = '就绪';
            if (isChatGPT) {
                panel.append(selectAll, archiveBtn, deleteBtn, stopBtn, status);
            } else {
                panel.append(selectAll, deleteBtn, stopBtn, status);
            }
            
            if (isGemini) {
                header.parentElement.insertBefore(panel, header);
            } else if (isChatGPT && header.parentElement) {
                header.parentElement.insertBefore(panel, header);
            } else {
                header.insertBefore(panel, header.firstChild);
            }
            
            selectAll.addEventListener('change', (e) => {
                const list = this.adapter.getConversations();
                list.forEach(node => {
                    const cb = node.querySelector('.bulk-delete-checkbox');
                    if (cb) {
                        cb.checked = e.target.checked;
                        this.onSelectChange(node, e.target.checked);
                    }
                });
            });

            archiveBtn.addEventListener('click', () => this.runBulkArchive());
            deleteBtn.addEventListener('click', () => this.runBulkDelete());
            stopBtn.addEventListener('click', () => {
                this.stopRequested = true;
                this.setStatus('停止中');
            });
        }

        onSelectChange(node, isSelected) {
            if (isSelected) {
                this.selectedNodes.add(node);
            } else {
                this.selectedNodes.delete(node);
            }
            this.refreshSelectedState();
        }

        refreshSelectedState() {
            const btn = document.getElementById('bulk-delete-btn');
            const archiveBtn = document.getElementById('bulk-archive-btn');
            if (btn) {
                btn.innerText = `删除选中 (${this.selectedNodes.size})`;
            }
            if (archiveBtn) {
                archiveBtn.innerText = `归档选中 (${this.selectedNodes.size})`;
            }
        }

        syncSelectedFromDom() {
            this.selectedNodes.clear();
            this.adapter.getConversations().forEach(node => {
                const checkbox = node.querySelector('.bulk-delete-checkbox');
                if (checkbox?.checked) {
                    this.selectedNodes.add(node);
                }
            });
            this.refreshSelectedState();
        }

        setStatus(message) {
            const status = document.getElementById('bulk-status');
            if (status) status.innerText = message;
        }

        scanAndInject() {
            const list = this.adapter.getConversations();
            list.forEach(node => this.adapter.injectCheckbox(node, (n, s, e) => this.onSelectChange(n, s, e)));
            this.injectPanel();
            this.setStatus(`检测到 ${list.length} 条会话`);
        }

        startObserver() {
            this.scanAndInject();
            this.observer = new MutationObserver(() => {
                window.clearTimeout(this.scanTimer);
                this.scanTimer = window.setTimeout(() => this.scanAndInject(), 150);
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        }

        async runBulkDelete() {
            this.syncSelectedFromDom();
            const actionLabel = '删除';
            if (this.selectedNodes.size === 0) {
                this.setStatus('未选择会话');
                return;
            }
            if (!window.confirm(`确认${actionLabel}选中的 ${this.selectedNodes.size} 条会话？`)) {
                this.setStatus('已取消');
                return;
            }
            await this.runBulkAction('delete');
        }

        async runBulkArchive() {
            await this.runBulkAction('archive');
        }

        async runBulkAction(action) {
            this.syncSelectedFromDom();
            if (this.isDeleting || this.selectedNodes.size === 0) {
                this.setStatus('未选择会话');
                return;
            }
            this.isDeleting = true;
            this.stopRequested = false;
            const btn = document.getElementById('bulk-delete-btn');
            const archiveBtn = document.getElementById('bulk-archive-btn');
            const stopBtn = document.getElementById('bulk-stop-btn');
            const nodes = Array.from(this.selectedNodes)
                .map(node => ({ node, id: this.adapter.getNodeId(node) }));
            if (btn) btn.disabled = true;
            if (archiveBtn) archiveBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            const actionLabel = action === 'archive' ? '归档' : '删除';
            
            for (let i = 0; i < nodes.length; i++) {
                if (this.stopRequested) break;
                const entry = nodes[i];
                const node = entry.node.isConnected ? entry.node : this.adapter.findConversationById(entry.id);
                if (!node) {
                    this.selectedNodes.delete(entry.node);
                    continue;
                }
                const activeBtn = action === 'archive' ? archiveBtn : btn;
                if (activeBtn) activeBtn.innerText = `正在${actionLabel} (${i + 1}/${nodes.length})`;
                this.setStatus(`正在处理 ${i + 1}/${nodes.length}`);
                try {
                    if (action === 'archive') {
                        await this.adapter.archiveConversation(node);
                    } else {
                        await this.adapter.deleteConversation(node);
                    }
                    this.selectedNodes.delete(node);
                } catch(e) {
                    console.error(LOG_PREFIX, `${actionLabel} failed`, e);
                    this.setStatus(`失败：${e.message || e}`);
                }
                await delay(BULK_DELETE_INTERVAL_MS);
            }
            
            this.refreshSelectedState();
            const selectAll = document.getElementById('bulk-select-all');
            if (selectAll) selectAll.checked = false;
            if (btn) btn.disabled = false;
            if (archiveBtn) archiveBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            this.setStatus(this.stopRequested ? '已停止' : '完成');
            this.isDeleting = false;
        }
    }

    const boot = () => {
        if (window.__aiChatBulkManager) return;
        if (!document.body || !document.documentElement) {
            window.setTimeout(boot, 100);
            return;
        }
        window.__aiChatBulkManager = new BulkManager();
        log('initialized');
    };

    if (window.location.hostname.includes('gemini.google.com')) {
        window.setTimeout(boot, GEMINI_BOOT_DELAY_MS);
    } else {
        boot();
    }
})();
