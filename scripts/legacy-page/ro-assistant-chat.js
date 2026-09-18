/**
 * Injects the "Chat with AI" tab into the legacy calculator's accordion.
 *
 * This runs inside the legacy Angular app, which is served from this project's
 * own origin, so the injected tab can host the React chat page in a same-origin
 * iframe and exchange the current build with it over postMessage.
 *
 * The tab is appended after "Item Descriptions" so every legacy tab keeps its
 * original position and index. Nothing else in the legacy DOM is modified.
 */
(function () {
  "use strict";

  // trailingSlash is enabled, so the exported route lives at ".../chat/".
  var CHAT_URL = "/calculator-v3/chat/";
  var TAB_ID = "ro-assistant-chat-tab";
  var ITEM_DESCRIPTIONS_HEADER = "Item Descriptions";
  var STYLE_ID = "ro-assistant-chat-style";
  var ORDER_KEY = "ro-assistant:accordion-order:v1";

  var chatFrame = null;
  var isChatReady = false;
  /** Last build posted to the panel, so unchanged DOM churn is not re-sent. */
  var lastSent = "";
  var contextTimer = null;
  var pendingContext = null;
  /** The tab being dragged, and the tab set the stored order was last applied to. */
  var draggedTab = null;
  var lastTabSignature = "";

  function findAccordion() {
    return document.querySelector("p-accordion .p-accordion");
  }

  /** The legacy tabs are `<p-accordiontab>` hosts inside the accordion. */
  function findTabByHeader(accordion, headerText) {
    var tabs = accordion.querySelectorAll(".p-accordion-tab");
    for (var index = 0; index < tabs.length; index += 1) {
      var header = tabs[index].querySelector(".p-accordion-header-link");
      if (header && header.textContent.trim().indexOf(headerText) === 0) {
        return tabs[index];
      }
    }
    return null;
  }

  /**
   * Rebuilds PrimeNG's accordion markup by hand so the injected tab is
   * indistinguishable from the legacy ones.
   */
  function buildChatTab() {
    var tab = document.createElement("div");
    tab.className = "p-accordion-tab";
    tab.id = TAB_ID;

    var header = document.createElement("div");
    header.className = "p-accordion-header";

    var link = document.createElement("a");
    link.className = "p-accordion-header-link";
    link.href = "javascript:void(0)";
    link.setAttribute("role", "button");
    link.setAttribute("aria-expanded", "false");

    var icon = document.createElement("span");
    icon.className = "p-icon-wrapper";
    icon.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" class="p-icon">' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.38 13.68a.44.44 0 0 1-.31-.13.44.44 0 0 1 0-.62l5.24-5.24-5.24-5.24a.44.44 0 0 1 .62-.62l5.55 5.55c.17.17.17.45 0 .62l-5.55 5.55a.44.44 0 0 1-.31.13z" fill="currentColor"/>' +
      "</svg>";

    var title = document.createElement("span");
    title.className = "p-accordion-header-text";
    title.textContent = "Chat with AI";

    link.appendChild(icon);
    link.appendChild(title);
    header.appendChild(link);

    var content = document.createElement("div");
    content.className = "p-toggleable-content";
    content.style.display = "none";

    var body = document.createElement("div");
    body.className = "p-accordion-content";
    body.style.padding = "0";

    chatFrame = document.createElement("iframe");
    chatFrame.src = CHAT_URL;
    chatFrame.title = "Chat with AI";
    chatFrame.style.width = "100%";
    // Tall enough to read a long answer without scrolling the log, while still
    // leaving the legacy tabs above it visible. The chat page fills whatever
    // height it is given, so this is the only place the size is set.
    chatFrame.style.height = "min(1000px, calc(100vh - 120px))";
    chatFrame.style.minHeight = "620px";
    chatFrame.style.border = "0";
    chatFrame.style.display = "block";

    body.appendChild(chatFrame);
    content.appendChild(body);
    tab.appendChild(header);
    tab.appendChild(content);

    link.addEventListener("click", function () {
      var isOpen = content.style.display !== "none";
      content.style.display = isOpen ? "none" : "block";
      link.setAttribute("aria-expanded", String(!isOpen));
      header.classList.toggle("p-highlight", !isOpen);
      icon.style.transform = isOpen ? "" : "rotate(90deg)";
      if (!isOpen) sendContext();
    });

    return tab;
  }

  // --- build context ------------------------------------------------------

  /** Reads a PrimeNG dropdown's current label by the inputId the template sets. */
  function dropdownLabel(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return "";
    var dropdown = input.closest(".p-dropdown");
    if (!dropdown) return "";
    var label = dropdown.querySelector(".p-dropdown-label");
    if (!label || label.classList.contains("p-dropdown-label-empty")) return "";
    return label.textContent.trim();
  }

  /**
   * Reads what is on screen rather than reaching into Angular's internals, so a
   * change in the legacy component cannot break the host page.
   */
  function collectContext() {
    var equipments = document.querySelectorAll("app-equipment");
    var equippedCount = 0;
    for (var index = 0; index < equipments.length; index += 1) {
      var label = equipments[index].querySelector(".p-dropdown-label");
      if (
        label &&
        !label.classList.contains("p-dropdown-label-empty") &&
        label.textContent.trim()
      ) {
        equippedCount += 1;
      }
    }

    return {
      className: dropdownLabel("character"),
      skillId: dropdownLabel("skill"),
      monsterName: dropdownLabel("monsterOpponent"),
      equippedCount: equippedCount,
    };
  }

  /**
   * Posts the build only when it actually differs from what the panel already
   * has, so watching the whole document for changes stays cheap.
   */
  function sendContext() {
    if (!chatFrame || !chatFrame.contentWindow) return;
    var context = collectContext();
    var serialised = JSON.stringify(context);
    if (serialised === lastSent) return;

    pendingContext = context;
    // Not delivered yet, so leave `lastSent` alone and send once it is ready.
    if (!isChatReady) return;

    lastSent = serialised;
    chatFrame.contentWindow.postMessage(
      { type: "ro-assistant:build-context", context: context },
      window.location.origin,
    );
  }

  /**
   * The class, skill, target and gear can all change while the chat tab is
   * open, and the panel showed whatever was selected when it was opened until
   * this ran on every change too. Debounced because Angular rewrites large
   * parts of the DOM for a single dropdown selection.
   */
  function scheduleContextSync() {
    if (contextTimer) return;
    contextTimer = window.setTimeout(function () {
      contextTimer = null;
      sendContext();
    }, 250);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === "ro-assistant:chat-ready") {
      isChatReady = true;
      if (pendingContext) sendContext();
    }
  });

  // --- tab reordering -----------------------------------------------------

  /** Direct children only, so a nested accordion could never be picked up. */
  function accordionTabs(accordion) {
    var result = [];
    var children = accordion.children;
    for (var index = 0; index < children.length; index += 1) {
      if (children[index].classList.contains("p-accordion-tab")) {
        result.push(children[index]);
      }
    }
    return result;
  }

  /**
   * Header text identifies a tab across reloads. Angular assigns no stable id
   * of its own, and the headers are the labels the user is dragging anyway.
   */
  function tabKey(tab) {
    var link = tab.querySelector(".p-accordion-header-link");
    return link ? link.textContent.trim() : "";
  }

  function tabSignature(accordion) {
    return accordionTabs(accordion).map(tabKey).join("|");
  }

  function readOrder() {
    try {
      var raw = window.localStorage.getItem(ORDER_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveOrder(accordion) {
    try {
      window.localStorage.setItem(
        ORDER_KEY,
        JSON.stringify(accordionTabs(accordion).map(tabKey)),
      );
    } catch {
      // Dragging still works for this session when storage is unavailable.
    }
  }

  /**
   * A tab the stored order has never seen — a new legacy tab, or the chat tab
   * before it was first dragged — keeps its original position relative to the
   * others rather than being dropped or forced to the front.
   */
  function applyStoredOrder(accordion) {
    var order = readOrder();
    if (!order.length) return;

    var tabs = accordionTabs(accordion);
    var ranked = tabs.slice().sort(function (a, b) {
      var indexA = order.indexOf(tabKey(a));
      var indexB = order.indexOf(tabKey(b));
      if (indexA === -1 && indexB === -1) return tabs.indexOf(a) - tabs.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    var moved = false;
    for (var index = 0; index < ranked.length; index += 1) {
      if (ranked[index] !== tabs[index]) moved = true;
    }
    if (!moved) return;

    for (var position = 0; position < ranked.length; position += 1) {
      accordion.appendChild(ranked[position]);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".p-accordion .p-accordion-header{cursor:grab}" +
      ".p-accordion .p-accordion-header:active{cursor:grabbing}" +
      ".ro-assistant-dragging{opacity:0.5}";
    document.head.appendChild(style);
  }

  function makeTabsDraggable(accordion) {
    var tabs = accordionTabs(accordion);
    for (var index = 0; index < tabs.length; index += 1) {
      enhanceTab(tabs[index]);
    }
  }

  function enhanceTab(tab) {
    var header = tab.querySelector(".p-accordion-header");
    if (!header || header.getAttribute("data-ro-assistant-drag")) return;
    header.setAttribute("data-ro-assistant-drag", "1");
    header.setAttribute("draggable", "true");

    // The header's anchor is natively draggable, which would start a link drag
    // instead of ours, so the header stays the only drag source.
    var link = header.querySelector(".p-accordion-header-link");
    if (link) link.setAttribute("draggable", "false");

    header.addEventListener("dragstart", function (event) {
      draggedTab = tab;
      tab.classList.add("ro-assistant-dragging");
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag until some data is set.
      event.dataTransfer.setData("text/plain", tabKey(tab));
    });

    header.addEventListener("dragend", function () {
      tab.classList.remove("ro-assistant-dragging");
      draggedTab = null;

      // The list already rearranged under the cursor, so the order on screen is
      // committed even when the pointer is released outside the accordion —
      // otherwise what the user sees would silently revert on the next redraw.
      var accordion = tab.parentElement;
      if (!accordion) return;
      saveOrder(accordion);
      lastTabSignature = tabSignature(accordion);
    });
  }

  function enableReordering(accordion) {
    if (accordion.getAttribute("data-ro-assistant-reorder")) return;
    accordion.setAttribute("data-ro-assistant-reorder", "1");

    accordion.addEventListener("dragover", function (event) {
      if (!draggedTab) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

      // Insert before the first tab whose upper half the pointer is in, so the
      // list rearranges under the cursor instead of only on drop.
      var tabs = accordionTabs(accordion);
      var before = null;
      for (var index = 0; index < tabs.length; index += 1) {
        if (tabs[index] === draggedTab) continue;
        var rect = tabs[index].getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          before = tabs[index];
          break;
        }
      }

      if (before) {
        accordion.insertBefore(draggedTab, before);
      } else {
        accordion.appendChild(draggedTab);
      }
    });

    accordion.addEventListener("drop", function (event) {
      if (!draggedTab) return;
      event.preventDefault();
      saveOrder(accordion);
      lastTabSignature = tabSignature(accordion);
    });
  }

  function syncAccordion() {
    // Re-applying the stored order mid-drag would snap the tab back.
    if (draggedTab) return;

    var accordion = findAccordion();
    if (!accordion) return;

    injectStyles();
    enableReordering(accordion);
    makeTabsDraggable(accordion);

    // Only worth reordering when the set of tabs changed: Angular rewrites the
    // accordion's contents constantly for reasons that have nothing to do with
    // which tabs exist.
    if (tabSignature(accordion) === lastTabSignature) return;
    applyStoredOrder(accordion);
    lastTabSignature = tabSignature(accordion);
  }

  // --- injection ----------------------------------------------------------

  function tryInject() {
    if (document.getElementById(TAB_ID)) return true;

    var accordion = findAccordion();
    if (!accordion) return false;

    var itemDescriptions = findTabByHeader(accordion, ITEM_DESCRIPTIONS_HEADER);
    if (!itemDescriptions) return false;

    var tab = buildChatTab();
    if (itemDescriptions.nextSibling) {
      accordion.insertBefore(tab, itemDescriptions.nextSibling);
    } else {
      accordion.appendChild(tab);
    }
    return true;
  }

  function start() {
    tryInject();
    syncAccordion();

    // The accordion renders after the catalog loads, so wait for it, keep
    // watching in case Angular re-creates it, and treat every change as a
    // possible edit to the build the panel is describing.
    var observer = new MutationObserver(function () {
      tryInject();
      syncAccordion();
      scheduleContextSync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
