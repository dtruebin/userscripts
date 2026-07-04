// ==UserScript==
// @name         Strava - Restore "Vive le Tour" Map Style Option
// @namespace    https://github.com/dtruebin/userscripts/
// @supportURL   https://github.com/dtruebin/userscripts/issues
// @version      1.0.0
// @description  Adds the TDF-inspired "Vive le Tour" map style option (previously available natively during the Tour de France) on the activity edit page.
// @author       Dmitry Trubin
// @match        https://www.strava.com/activities/*/edit
// @icon         https://www.google.com/s2/favicons?sz=64&domain=strava.com
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const selectId = 'activity_selected_polyline_style';

    function addTourOption() {
        const selectEl = document.getElementById(selectId);

        // Check if the element exists and the option hasn't been added yet
        if (selectEl && !selectEl.querySelector('option[value="tdf_fan"]')) {
            const newOption = document.createElement('option');
            newOption.value = 'tdf_fan';
            newOption.textContent = 'Vive le Tour';
            selectEl.prepend(newOption);

            // Stop observing once we've successfully injected the option
            observer.disconnect();
        }
    }

    // Run immediately in case the element is already there
    addTourOption();

    // Set up an observer to catch it if the DOM loads/renders dynamically
    const observer = new MutationObserver(() => addTourOption());

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();