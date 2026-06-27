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

    console.log('AI Chat Bulk Manager initialized');
})();
