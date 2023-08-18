// ==UserScript==
// @name         Strava - Hide from Feed (Mute)
// @namespace    http://github.com/dtruebin/userscripts/
// @version      0.1
// @description  Adds mute option to activity edit page.
// @author       Dmitry Trubin
// @match        https://www.strava.com/activities/*/edit
// @icon         https://www.google.com/s2/favicons?sz=64&domain=strava.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // As of 2023-08-18, when activity[hide_from_home] is present in the submitted form data, activity gets muted
  // regardless of the value. I.e., muting only works one way, and it's impossible to unmute by passing 0/false.
  const div = `
  <div class="form-group">
    <label>Hide from Home or Club Feeds</label>
    <ul class="hide-stats-container">
      <li>
        <input type="checkbox" value="1" name="activity[hide_from_home]" id="hide_from_home">
        <label for="hide_from_home">Mute activity</label>
      </li>
    </ul>
  </div>`
  document.querySelector('fieldset.activity-tags').insertAdjacentHTML('afterend', div)
})();