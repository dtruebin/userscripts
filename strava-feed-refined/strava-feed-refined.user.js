// @ts-check
// ==UserScript==
// @name         Strava - Hide Unwanted Feed Items
// @namespace    https://github.com/dtruebin/userscripts/
// @supportURL   https://github.com/dtruebin/userscripts/issues
// @version      6.0.1
// @description  Hides uninspiring activities and challenge progress from Strava feed based on device, tags, and activity type.
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

  const CONFIG = {
    unwantedTags: new Set([
      "Commute", "Регулярный маршрут",
      "Virtual", "Виртуальный",
    ]),
    unwantedPartnerTags: new Set([
      "TrainerRoad",
    ]),
    unwantedDevices: new Set([
      "Hevy",
      "Rouvy",
      "Tacx App",
      "Zwift",
    ]),
    unwantedTypes: new Set([
      "Weight Training", "Силовая тренировка",
      "Йога", "Yoga",
    ].map((s) => s.toLowerCase())),
  };

  const MUSCLE_HEATMAP_URL_FRAGMENT = "muscle-heatmap";

  const SELECTORS = {
    feedEntry: '[data-testid="web-feed-entry"]',
    activityIcon: '[data-testid="activity-icon"] title',
    activityName: '[data-testid="activity_name"]',
    device: '[data-testid="device"]',
    tag: '[data-testid="tag"]',
    partnerTag: '[data-testid="partner_tag"]',
    groupHeader: '[data-testid="group-header"]',
    titleText: '[data-testid="title-text"]',
    boosted: '[data-testid="boosted"]',
    ownersName: '[data-testid="owners-name"]',
    photo: '[data-testid="photo"]',
    photoImage: '[data-testid="photo"] img',
  };

  // === Helpers ===
  /**
   * Wraps the raw DOM element to provide clean accessors to data.
   * Acts as the 'Request' object passed down the chain.
   */
  class FeedItem {
    /**
     * @param {HTMLElement} element
     */
    constructor(element) {
      this.el = element;

      /** @type {Record<string, unknown>} */
      this._cache = {};
    }

    /**
     * Marks this item as evaluated for its current content.
     */
    markAsProcessed() {
      this.el.dataset.processed = this.signature;
    }

    // Hides this item and logs the description of what is being hidden
    /**
     * @param {string} description
     */
    hide(description) {
      console.log(`hiding ${description}`);
      this.el.style.display = "none";
      this.markAsProcessed();
    }

    /**
     * @param {string} selector
     */
    _getText(selector) {
      return this.el.querySelector(selector)?.textContent.trim() || "";
    }

    get isChallenge() {
      return !!this.el.querySelector(SELECTORS.groupHeader);
    }

    get challengeInfo() {
      const text = this._getText(SELECTORS.groupHeader);
      const name = this._getText(SELECTORS.titleText);
      return `${text} - ${name}`;
    }

    get isActivity() {
      return !!this.el.querySelector(SELECTORS.activityName);
    }

    get activityName() {
      if (this._cache.activityName === undefined) {
        this._cache.activityName = this._getText(SELECTORS.activityName);
      }
      return /** @type {string} */ (this._cache.activityName);
    }

    get activityType() {
      if (this._cache.activityType === undefined) {
        this._cache.activityType = this._getText(SELECTORS.activityIcon);
      }
      return /** @type {string} */ (this._cache.activityType);
    }

    get athleteName() {
      return this._getText(SELECTORS.ownersName);
    }

    get isFromFavoriteAthlete() { // aka isBoosted
      return !!this.el.querySelector(SELECTORS.boosted);
    }

    get tags() {
      return [...this.el.querySelectorAll(SELECTORS.tag)].map(t => t?.textContent.trim());
    }

    get hasPhoto() {
      return !!this.el.querySelector(SELECTORS.photo);
    }

    // Muscle-map images don't count as real user photos.
    get hasRealPhoto() {
      if (!this.hasPhoto) {
        return false;
      }
      const images = [...this.el.querySelectorAll(SELECTORS.photoImage)];
      if (images.length === 0) {
        return true;
      }
      return images.some((img) => {
        const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("srcset") || "";
        return !src.includes(MUSCLE_HEATMAP_URL_FRAGMENT);
      });
    }

    get partnerTags() {
      return [...this.el.querySelectorAll(SELECTORS.partnerTag)].map(t => t?.textContent.trim());
    }

    get deviceName() {
      return this._getText(SELECTORS.device);
    }

    /** Snapshot of every field the hide/show decision depends on. */
    get signature() {
      const photoSrcs = [...this.el.querySelectorAll(SELECTORS.photoImage)]
        .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("srcset") || "")
        .join("|");
      return JSON.stringify([
        this.isChallenge, this.challengeInfo,
        this.isActivity, this.activityName, this.activityType,
        this.isFromFavoriteAthlete,
        this.tags.join(","), this.partnerTags.join(","), this.deviceName,
        this.hasPhoto, photoSrcs,
      ]);
    }
  }

  // === Main function ===
  function hideUnwantedEntries(root = document) {
    root.querySelectorAll(`.feature-feed > div:has(${SELECTORS.feedEntry})`)
      .forEach((div) => {
        const item = new FeedItem(/** @type {HTMLElement} */ (div));

        // Skip re-evaluation when nothing relevant changed since last decision.
        // (dataset.processed stores the signature, not a boolean flag.)
        if (item.el.dataset.processed !== undefined && item.el.dataset.processed === item.signature) {
          return;
        }
        const wasHidden = item.el.style.display === "none";

        if (item.isChallenge) {
          if (!wasHidden) {
            item.hide(`challenge progress: ${item.challengeInfo}`);
          } else {
            item.markAsProcessed();
          }
          return;
        }

        if (!item.isActivity) {
          item.markAsProcessed();
          return;
        }

        if (item.isFromFavoriteAthlete) {
          if (!document.URL.includes("/athletes/")) {
            console.log(`skipping further processing of ${item.athleteName}'s ⭐ activity: ${item.activityName}`);
          }
          item.markAsProcessed();
          return;
        }

        for (const tag of item.tags) {
          if (CONFIG.unwantedTags.has(tag)) {
            if ((tag === "Commute" || tag === "Регулярный маршрут") && item.hasRealPhoto) {
              console.log(`not hiding commute activity with photo(s): ${item.activityName}`);
              item.markAsProcessed();
              return;
            }
            if (!wasHidden) {
              item.hide(`activity by tag "${tag}": ${item.activityName}`);
            } else {
              item.markAsProcessed();
            }
            return;
          }
        }

        for (const tag of item.partnerTags) {
          if (CONFIG.unwantedPartnerTags.has(tag)) {
            if (!wasHidden) {
              item.hide(`activity by partner tag "${tag}": ${item.activityName}`);
            } else {
              item.markAsProcessed();
            }
            return;
          }
        }

        if (CONFIG.unwantedDevices.has(item.deviceName)) {
          if (!wasHidden) {
            item.hide(`activity by device "${item.deviceName}": ${item.activityName}`);
          } else {
            item.markAsProcessed();
          }
          return;
        }

        if (CONFIG.unwantedTypes.has(item.activityType.toLowerCase())) {
          if (item.hasRealPhoto) {
            console.log(`not hiding ${item.activityType} activity with photo(s): ${item.activityName}`);
            item.markAsProcessed();
            return;
          }
          if (!wasHidden) {
            item.hide(`activity by type "${item.activityType}": ${item.activityName}`);
          } else {
            item.markAsProcessed();
          }
          return;
        }

        item.markAsProcessed();
      });
  }

  hideUnwantedEntries();
  const observer = new MutationObserver(() => hideUnwantedEntries());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
