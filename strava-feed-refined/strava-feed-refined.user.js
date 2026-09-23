// @ts-check
// ==UserScript==
// @name         Strava - Hide Unwanted Feed Items
// @namespace    https://github.com/dtruebin/userscripts/
// @supportURL   https://github.com/dtruebin/userscripts/issues
// @version      7.0.0
// @description  Hides uninspiring/already-kudoed activities and challenge progress from Strava feed.
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
      "Yoga", "Йога",
      "Swim", "Заплыв",
      "Rock Climb", "Скалолазание",
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
    kudosFilled: '[data-testid="filled_kudos"]',
    kudosUnfilled: '[data-testid="unfilled_kudos"]',
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
     * @param {string} [signature] precomputed signature to store
     */
    markAsProcessed(signature = this.signature) {
      this.el.dataset.processed = signature;
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

    get hasFilledKudos() {
      return !!this.el.querySelector(SELECTORS.kudosFilled);
    }

    get hasUnfilledKudos() {
      return !!this.el.querySelector(SELECTORS.kudosUnfilled);
    }

    /**
     * Whether the viewer already gave kudos to this entry.
     * Entries without a kudos button (challenges, own activities, etc.)
     * are treated as not kudoed.
     */
    get isKudoed() {
      return this.hasFilledKudos && !this.hasUnfilledKudos;
    }

    get kudosSignature() {
      return `${this.hasFilledKudos}:${this.hasUnfilledKudos}`;
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
        this.kudosSignature,
      ]);
    }
  }

  // === Main function ===
  /**
   * Content-based hide reason (challenge, tags, partner tags, devices,
   * types), or null when the item should stay visible. Favorites are exempt.
   * @param {FeedItem} item
   * @returns {string|null}
   */
  function getUnwantedReason(item) {
    // Pure function
    if (item.isChallenge) {
      return `challenge progress: ${item.challengeInfo}`;
    }
    if (!item.isActivity) {
      return null;
    }
    if (item.isFromFavoriteAthlete) {
      return null;
    }
    for (const tag of item.tags) {
      if (CONFIG.unwantedTags.has(tag)) {
        if ((tag === "Commute" || tag === "Регулярный маршрут") && item.hasRealPhoto) {
          return null;
        }
        return `activity by tag "${tag}": ${item.activityName}`;
      }
    }
    for (const tag of item.partnerTags) {
      if (CONFIG.unwantedPartnerTags.has(tag)) {
        return `activity by partner tag "${tag}": ${item.activityName}`;
      }
    }
    if (CONFIG.unwantedDevices.has(item.deviceName)) {
      return `activity by device "${item.deviceName}": ${item.activityName}`;
    }
    if (CONFIG.unwantedTypes.has(item.activityType.toLowerCase())) {
      if (item.hasRealPhoto) {
        return null;
      }
      return `activity by type "${item.activityType}": ${item.activityName}`;
    }
    return null;
  }

  // Kudo filtering only makes sense on the main feed. On athlete pages the
  // user is browsing history, so already-kudoed entries must stay visible.
  function isKudoFilterApplicable() {
    return !document.URL.includes("/athletes/");
  }

  /**
   * Evaluates a single feed wrapper against the hide criteria.
   * @param {Element} div
   */
  function evaluateWrapper(div) {
    const item = new FeedItem(/** @type {HTMLElement} */ (div));
    const signature = item.signature;

    // Skip re-evaluation when nothing relevant changed since last decision.
    // (dataset.processed stores the signature, not a boolean flag.)
    if (item.el.dataset.processed !== undefined && item.el.dataset.processed === signature) {
      return;
    }
    const wasHidden = item.el.style.display === "none";
    const unwantedReason = getUnwantedReason(item);

    if (unwantedReason) {
      if (!wasHidden) {
        item.hide(unwantedReason);
      } else {
        item.markAsProcessed(signature);
      }
      return;
    }

    if (!item.isActivity) {
      item.markAsProcessed(signature);
      return;
    }

    if (item.isFromFavoriteAthlete) {
      if (!document.URL.includes("/athletes/")) {
        console.log(`skipping further processing of ${item.athleteName}'s ⭐ activity: ${item.activityName}`);
      }
      item.markAsProcessed(signature);
      return;
    }

    if (isKudoFilterApplicable() && item.isKudoed) {
      if (!wasHidden) {
        item.hide(`already-kudoed activity: ${item.activityName}`);
      } else {
        item.markAsProcessed(signature);
      }
      return;
    }

    item.markAsProcessed(signature);
  }

  /**
   * Collects feed wrappers affected by a mutation batch.
   * @param {MutationRecord[]} mutations
   * @returns {Set<Element>}
   */
  function collectWrappers(mutations) {
    const wrappers = /** @type {Set<Element>} */ (new Set());
    for (const m of mutations) {
      if (m.target.nodeType === 1) {
        const w = /** @type {Element} */ (m.target).closest(".feature-feed > div");
        if (w) wrappers.add(w);
      }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const el = /** @type {Element} */ (n);
        if (el.matches(".feature-feed > div")) wrappers.add(el);
        const w = el.closest(".feature-feed > div");
        if (w) wrappers.add(w);
        for (const inner of el.querySelectorAll(".feature-feed > div")) {
          wrappers.add(inner);
        }
      }
    }
    return wrappers;
  }

  // Process whole feed once on initial load.
  document.querySelectorAll(`.feature-feed > div:has(${SELECTORS.feedEntry})`)
    .forEach(evaluateWrapper);

  const observer = new MutationObserver((mutations) => {
    for (const div of collectWrappers(mutations)) {
      if (div.isConnected) evaluateWrapper(div);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Resolving <img> src swaps produce no childList records, so watch
    // image attributes too. Kudo toggles swap filled/unfilled icons via
    // childList, so no attribute watching is needed for them.
    attributes: true,
    attributeFilter: ["src", "data-src", "srcset"],
  });

})();
