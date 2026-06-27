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

    class OpenAIAdapter extends BaseAdapter {}
    class GoogleAdapter extends BaseAdapter {}

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
