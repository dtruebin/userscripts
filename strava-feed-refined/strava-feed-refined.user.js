// ==UserScript==
// @name         Strava - Hide Unwanted Feed Items
// @namespace    https://github.com/dtruebin/userscripts/
// @supportURL   https://github.com/dtruebin/userscripts/issues
// @version      1.0.0
// @description  Hides uninspiring activities and challenge progress from Strava feed based on device, tags, and activity name.
// @author       Dmitry Trubin
// @match        https://www.strava.com/dashboard*
// @match        https://www.strava.com/athletes/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=strava.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // === Config ===
  const unwantedDevices = new Set(["Rouvy", "Tacx App", "Zwift"]);
  const unwantedTags = new Set([
    "Commute",
    "Регулярный маршрут",
    "Virtual",
    "Виртуальный",
  ]);
  const unwantedNames = ["weight training"].map((s) => s.toLowerCase());

  // === Helper to hide an element and log reason ===
  function hideElement(element, logMessage) {
    console.log(logMessage);
    element.style.display = "none";
    element.dataset.hidden = "true"; // prevent reprocessing
  }

  // === Main function ===
  function hideUnwantedEntries(root = document) {
    root
      .querySelectorAll(
        'div[role="button"]:not([data-hidden]):has([data-testid="web-feed-entry"])',
      )
      .forEach((div) => {
        const challenge = div.querySelector('[data-testid="group-header"]');
        if (challenge) {
          const challengeName = div.querySelector(
            '[data-testid="title-text"]',
          )?.textContent;
          hideElement(
            div,
            `hiding challenge progress: ${challenge.textContent} - ${challengeName}`,
          );
          return;
        }

        const activity = div.querySelector('[data-testid="activity_name"]');
        if (!activity) return;

        const activityName = activity?.textContent.trim();

        const fromFavoriteAthlete = div.querySelector(
          '[data-testid="boosted"]',
        );
        if (fromFavoriteAthlete) {
          if (!document.URL.includes("/athletes/")) {
            const athleteName = div.querySelector(
              '[data-testid="owners-name"]',
            )?.textContent;
            console.log(
              `skipping further processing of ${athleteName}'s ⭐ activity: ${activityName}`,
            );
          }
          return;
        }

        const device = div.querySelector('[data-testid="device"]');
        if (device) {
          const deviceName = device?.textContent.trim();
          if (unwantedDevices.has(deviceName)) {
            hideElement(
              div,
              `hiding activity by device "${deviceName}": ${activityName}`,
            );
            return;
          }
        }

        const tags = div.querySelectorAll('[data-testid="tag"]');
        for (const tag of [...tags].map((tagElement) =>
          tagElement?.textContent.trim(),
        )) {
          if (unwantedTags.has(tag)) {
            hideElement(
              div,
              `hiding activity by tag "${tag}": ${activityName}`,
            );
            return;
          }
        }

        if (
          unwantedNames.some((name) =>
            activityName.toLowerCase().includes(name),
          )
        ) {
          hideElement(div, `hiding activity by name: ${activityName}`);
          return;
        }
      });
  }

  const observer = new MutationObserver(() => hideUnwantedEntries());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
