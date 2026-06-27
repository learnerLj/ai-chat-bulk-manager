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

    class BaseAdapter {
        getConversations() { throw new Error('Not implemented'); }
        injectCheckbox(node, callback) { throw new Error('Not implemented'); }
        deleteConversation(node) { throw new Error('Not implemented'); }
        getSidebarHeader() { throw new Error('Not implemented'); }
    }

    class OpenAIAdapter extends BaseAdapter {
        constructor() {
            super();
            this.accessToken = '';
            this.fetchAccessToken();
        }

        fetchAccessToken() {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://chatgpt.com/api/auth/session',
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        this.accessToken = data.accessToken;
                    } catch(e) {
                        console.error('Failed to parse ChatGPT token', e);
                    }
                }
            });
        }

        getConversations() {
            return Array.from(document.querySelectorAll('nav a[href^="/c/"]'));
        }

        injectCheckbox(node, onSelectChange) {
            if (node.querySelector('.bulk-delete-checkbox')) return;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.style.marginRight = '8px';
            checkbox.addEventListener('change', (e) => onSelectChange(node, e.target.checked));
            node.insertBefore(checkbox, node.firstChild);
        }

        deleteConversation(node) {
            const href = node.getAttribute('href');
            if (!href) return Promise.reject('No href attribute found');
            const match = href.match(/\/c\/([a-f0-9-]{36})/);
            if (!match || !this.accessToken) return Promise.reject('No conversation ID or Access Token');
            const id = match[1];

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'PATCH',
                    url: `https://chatgpt.com/backend-api/conversation/${id}`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    data: JSON.stringify({ is_visible: false }),
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            node.remove();
                            resolve();
                        } else {
                            reject(`HTTP error ${res.status}`);
                        }
                    },
                    onerror: (err) => reject(err)
                });
            });
        }

        getSidebarHeader() {
            return document.querySelector('nav');
        }
    }
    class GoogleAdapter extends BaseAdapter {
        getConversations() {
            return Array.from(document.querySelectorAll('div[data-test-id="conversation"]'));
        }

        injectCheckbox(node, onSelectChange) {
            if (node.querySelector('.bulk-delete-checkbox')) return;
            node.classList.add('gemini-bulk-delete-row');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.addEventListener('change', (e) => onSelectChange(node, e.target.checked));
            node.insertBefore(checkbox, node.firstChild);
        }

        async deleteConversation(node) {
            const menuBtn = node.querySelector('button[data-test-id="actions-menu-button"]');
            if (!menuBtn) return Promise.reject('Menu button not found');
            menuBtn.click();

            await new Promise(r => setTimeout(r, 400));
            const deleteItem = document.querySelector('button[data-test-id="delete-button"], div[role="menu"] button:has(mat-icon[data-mat-icon-name="delete"])');
            if (!deleteItem) return Promise.reject('Delete menu item not found');
            deleteItem.click();

            await new Promise(r => setTimeout(r, 400));
            const confirmBtn = document.querySelector('mat-dialog-container button[data-test-id="confirm-button"]');
            if (!confirmBtn) return Promise.reject('Confirm button not found');
            confirmBtn.click();
            
            await new Promise(r => setTimeout(r, 600));
            return Promise.resolve();
        }

        getSidebarHeader() {
            return document.querySelector('.gb_Rd') || document.querySelector('.chat-history');
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
            GM_addStyle(`
                .bulk-delete-checkbox { width: 16px; height: 16px; margin: 4px; cursor: pointer; }
                #bulk-controls-panel { padding: 10px; display: flex; gap: 8px; border-bottom: 1px solid #ccc; background: rgba(0,0,0,0.05); }
                .bulk-btn { padding: 4px 8px; cursor: pointer; border-radius: 4px; border: 1px solid #aaa; }
            `);
            this.startObserver();
            this.injectPanel();
        }

        injectPanel() {
            if (document.getElementById('bulk-controls-panel')) return;
            const header = this.adapter.getSidebarHeader();
            if (!header) return;
            
            const panel = document.createElement('div');
            panel.id = 'bulk-controls-panel';
            panel.innerHTML = `
                <input type="checkbox" id="bulk-select-all" />
                <button class="bulk-btn" id="bulk-delete-btn">删除选中 (0)</button>
            `;
            
            header.insertBefore(panel, header.firstChild);
            
            panel.querySelector('#bulk-select-all').addEventListener('change', (e) => {
                const list = this.adapter.getConversations();
                list.forEach(node => {
                    const cb = node.querySelector('.bulk-delete-checkbox');
                    if (cb) {
                        cb.checked = e.target.checked;
                        this.onSelectChange(node, e.target.checked);
                    }
                });
            });

            panel.querySelector('#bulk-delete-btn').addEventListener('click', () => this.runBulkDelete());
        }

        onSelectChange(node, isSelected) {
            if (isSelected) {
                this.selectedNodes.add(node);
            } else {
                this.selectedNodes.delete(node);
            }
            const btn = document.getElementById('bulk-delete-btn');
            if (btn) {
                btn.innerText = `删除选中 (${this.selectedNodes.size})`;
            }
        }

        startObserver() {
            setInterval(() => {
                const list = this.adapter.getConversations();
                list.forEach(node => this.adapter.injectCheckbox(node, (n, s) => this.onSelectChange(n, s)));
                this.injectPanel();
            }, 1000);
        }

        async runBulkDelete() {
            if (this.isDeleting || this.selectedNodes.size === 0) return;
            this.isDeleting = true;
            const btn = document.getElementById('bulk-delete-btn');
            const nodes = Array.from(this.selectedNodes);
            
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                btn.innerText = `正在删除 (${i + 1}/${nodes.length})`;
                try {
                    await this.adapter.deleteConversation(node);
                    this.selectedNodes.delete(node);
                } catch(e) {
                    console.error('Delete failed', e);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            
            btn.innerText = `删除选中 (0)`;
            const selectAll = document.getElementById('bulk-select-all');
            if (selectAll) selectAll.checked = false;
            this.isDeleting = false;
        }
    }

    new BulkManager();
    console.log('AI Chat Bulk Manager initialized');
})();
