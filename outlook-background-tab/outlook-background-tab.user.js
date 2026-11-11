// ==UserScript==
// @name         Outlook - Ctrl/Cmd+Click for Background Tab
// @namespace    https://github.com/dtruebin/userscripts/
// @supportURL   https://github.com/dtruebin/userscripts/issues
// @version      1.0.0
// @description  Makes Ctrl/Cmd+click on email links open a background tab, like middle-click.
// @author       Dmitry Trubin
// @match        https://outlook.office.com/*
// @match        https://outlook.office365.com/*
// @match        https://outlook.live.com/*
// @match        https://outlook.cloud.microsoft/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=outlook.office.com
// @grant        none
// @license      MIT
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Outlook handles left-clicks on email links itself and calls window.open(), which always
    // yields a foreground tab. Hide the click from Outlook so the browser handles it natively.
    window.addEventListener('click', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.target.closest?.('a[href]')) {
            event.stopImmediatePropagation();
        }
    }, true);
})();
