/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { inputGoToNextPage, inputGoToPrevPage } from "./ui.js";
import { on } from "../renderer.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// BOUNDARIES ////

let g_scrollBoundariesEnabled = true;
let g_lastRequestedScrollbarPos = 0;

const g_scrollStates = {
  IDLE: 0,
  BANNED: 1,
  READY: 2,
};
const g_scrollPositions = {
  MIDDLE: 0,
  TOP: 1,
  BOTTOM: 2,
  TOP_AND_BOTTOM: 3,
};
let g_currentScrollPosition = g_scrollPositions.MIDDLE;
let g_bottomScrollBoundaryState = g_scrollStates.IDLE;
let g_bottomScrollBoundaryTimer = null;
let g_topScrollBoundaryState = g_scrollStates.IDLE;
let g_topScrollBoundaryTimer = null;

let g_scrollBoundaryLockTimeMs = 200;
let g_scrollBoundarySettleTimeMs = 500;
let g_scrollBlockTimeMs = 0;
let g_scrollBlockTimer = null;
let g_scrollIsBlocked = false;

const g_scrollBoundaryThreshold = 4;

///////////////////////////////////////////////////////////////////////////////
// IPC ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function initScrollbarOnIpcCallbacks() {
  on("set-scrollbar-visibility", (isVisible) => {
    showScrollBar(isVisible);
  });

  on("set-scrollbar-position", (position) => {
    setScrollBarsPosition(position);
  });
}

///////////////////////////////////////////////////////////////////////////////
// GENERAL ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function showScrollBar(isVisible) {
  // ref: https://stackoverflow.com/questions/4481485/changing-css-pseudo-element-styles-via-javascript
  if (isVisible) {
    // generic:
    document.body.classList.remove("hidden-scrollbar");
    // if custom title bar enabled:
    document.querySelector("#reader").classList.remove("hidden-scrollbar");
  } else {
    // generic:
    document.body.classList.add("hidden-scrollbar");
    // if custom title bar enabled:
    document.querySelector("#reader").classList.add("hidden-scrollbar");
  }
}

function moveScrollBarsToStart() {
  document.querySelector("#reader").scrollTop = 0;
  document.querySelector("#reader").scrollLeft = 0;

  setLastRequestedScrollbarPos(0);
}

function moveScrollBarsToEnd() {
  document.querySelector("#reader").scrollTop =
    document.querySelector("#reader").scrollHeight;
  document.querySelector("#reader").scrollLeft =
    document.querySelector("#reader").scrollWidth;

  setLastRequestedScrollbarPos(document.querySelector("#reader").scrollHeight);
}

export function setScrollBarsPosition(position) {
  if (position === 0) {
    moveScrollBarsToStart();
  } else if (position === 1) {
    moveScrollBarsToEnd();
  }
}

///////////////////////////////////////////////////////////////////////////////
// BOUNDARIES /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: goal for this code used for the automatic page turn in boundaries:
// - pages with scrollbar: when reaching a scroll boundary, top or bottom,
//   use lock time to ban changing time for some time to avoid inadvertely
//   changing paces due to fast scrolling.
// - when loading a page with no scrollbar: use settle time to ban the last
//   used boundary from changing page, to avoid skipping pages on fast scrolls.
// - use scroll block time to temporarily block scrolling after a page load, to
//   avoid the scrollbar sometimes starting already moved a bit due to accumulated
//   events.

export function setScrollbarBoundariesConfig(
  enabled,
  lockTimeMs,
  settleTimeMs,
  scrollBlockTimeMs,
) {
  g_scrollBoundariesEnabled = enabled;
  g_scrollBoundaryLockTimeMs = lockTimeMs;
  g_scrollBoundarySettleTimeMs = settleTimeMs;
  g_scrollBlockTimeMs = scrollBlockTimeMs;
}

export function setLastRequestedScrollbarPos(value) {
  g_lastRequestedScrollbarPos = value;
}

export function addScrollEventListener() {
  // keep tabs on where the scrollbar is
  document.querySelector("#reader").addEventListener("scroll", (event) => {
    let pagesRow = document.querySelector(".pages-row");
    if (!pagesRow || pagesRow.children.length === 0) return;

    let container = event.currentTarget;
    const hasVerticalScrollSpace =
      container.scrollHeight > container.clientHeight;
    if (!hasVerticalScrollSpace) return;

    let distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    let isAtTop = container.scrollTop < g_scrollBoundaryThreshold;
    let isAtBottom = distanceToBottom < g_scrollBoundaryThreshold;

    // both: small scrollbar with barely any space
    if (isAtTop && isAtBottom) {
      if (g_currentScrollPosition !== g_scrollPositions.TOP_AND_BOTTOM) {
        g_currentScrollPosition = g_scrollPositions.TOP_AND_BOTTOM;
        if (g_bottomScrollBoundaryState === g_scrollStates.IDLE) {
          g_bottomScrollBoundaryState = g_scrollStates.BANNED;
          if (g_bottomScrollBoundaryTimer)
            clearTimeout(g_bottomScrollBoundaryTimer);
          g_bottomScrollBoundaryTimer = setTimeout(() => {
            g_bottomScrollBoundaryState = g_scrollStates.READY;
            g_bottomScrollBoundaryTimer = null;
          }, g_scrollBoundaryLockTimeMs);
        }
        if (g_topScrollBoundaryState === g_scrollStates.IDLE) {
          g_topScrollBoundaryState = g_scrollStates.BANNED;
          if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
          g_topScrollBoundaryTimer = setTimeout(() => {
            g_topScrollBoundaryState = g_scrollStates.READY;
            g_topScrollBoundaryTimer = null;
          }, g_scrollBoundaryLockTimeMs);
        }
      }
    }
    // bottom
    else if (isAtBottom) {
      if (g_currentScrollPosition !== g_scrollPositions.BOTTOM) {
        g_currentScrollPosition = g_scrollPositions.BOTTOM;
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        if (g_topScrollBoundaryState !== g_scrollStates.IDLE) {
          g_topScrollBoundaryState = g_scrollStates.IDLE;
          g_topScrollBoundaryTimer = null;
        }
        if (g_bottomScrollBoundaryState === g_scrollStates.IDLE) {
          g_bottomScrollBoundaryState = g_scrollStates.BANNED;
          if (g_bottomScrollBoundaryTimer)
            clearTimeout(g_bottomScrollBoundaryTimer);
          g_bottomScrollBoundaryTimer = setTimeout(() => {
            g_bottomScrollBoundaryState = g_scrollStates.READY;
            g_bottomScrollBoundaryTimer = null;
          }, g_scrollBoundaryLockTimeMs);
        }
      }
    }
    // top
    else if (isAtTop) {
      if (g_currentScrollPosition !== g_scrollPositions.TOP) {
        g_currentScrollPosition = g_scrollPositions.TOP;
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_bottomScrollBoundaryState !== g_scrollStates.IDLE) {
          g_bottomScrollBoundaryState = g_scrollStates.IDLE;
          g_bottomScrollBoundaryTimer = null;
        }
        if (g_topScrollBoundaryState === g_scrollStates.IDLE) {
          g_topScrollBoundaryState = g_scrollStates.BANNED;
          if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
          g_topScrollBoundaryTimer = setTimeout(() => {
            g_topScrollBoundaryState = g_scrollStates.READY;
            g_topScrollBoundaryTimer = null;
          }, g_scrollBoundaryLockTimeMs);
        }
      }
    }
    // middle
    else {
      if (g_currentScrollPosition !== g_scrollPositions.MIDDLE) {
        g_currentScrollPosition = g_scrollPositions.MIDDLE;
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_bottomScrollBoundaryState !== g_scrollStates.IDLE) {
          g_bottomScrollBoundaryState = g_scrollStates.IDLE;
          g_bottomScrollBoundaryTimer = null;
        }
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        if (g_topScrollBoundaryState !== g_scrollStates.IDLE) {
          g_topScrollBoundaryState = g_scrollStates.IDLE;
          g_topScrollBoundaryTimer = null;
        }
      }
    }
  });

  // const pagesContainerObserver = new MutationObserver((mutations) => {
  //   // only trigger if a node was added or removed to it
  //   const layoutChanged = mutations.some(
  //     (mutation) =>
  //       mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0,
  //   );
  //   if (layoutChanged) {
  // ...
  //   }
  // });

  // pagesContainerObserver.observe(document.querySelector("#pages-container"), {
  //   childList: true,
  //   subtree: true,
  // });
}

export function scrollBoundaryHandleIsLoadingChanged(isLoading) {
  // called when loading state is updated
  let container = document.querySelector("#reader");
  const needsScrollbar = container.scrollHeight > container.clientHeight;
  if (isLoading) {
    if (g_scrollBoundariesEnabled && g_scrollBlockTimeMs > 0) {
      g_scrollIsBlocked = true;
      // if g_scrollBlockTimeMs > hide the scrollbar during load and reshow
      // it after to make chromium flush any remaining events from its
      // smoothing scroll, also keep the gutter space for pages that need it
      // so there's no visual discrepancies in size when hiding<->showing
      // the scrollbar

      if (needsScrollbar) {
        container.classList.add("keep-gutter-space");
      }
      // hide scrollbar so no more scroll events are accepted
      container.style.overflow = "hidden";
    }
  } else {
    // ended loading
    if (g_scrollBoundariesEnabled && g_scrollBlockTimeMs > 0) {
      if (!needsScrollbar) {
        container.classList.remove("keep-gutter-space");
      } else {
        container.classList.add("keep-gutter-space");
      }
      container.style.overflow = "hidden"; // in case it's the first page loaded
      if (g_scrollBlockTimer) clearTimeout(g_scrollBlockTimer);
      g_scrollBlockTimer = setTimeout(() => {
        g_scrollIsBlocked = false;
        container.scrollTop = g_lastRequestedScrollbarPos;
        // restore the scrollbar
        container.style.overflow = "auto";
        container.classList.remove("keep-gutter-space");
      }, g_scrollBlockTimeMs);
    }
    // make sure that the scroll is at the requested place
    container.scrollTop = g_lastRequestedScrollbarPos;

    if (g_bottomScrollBoundaryTimer) clearTimeout(g_bottomScrollBoundaryTimer);
    if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);

    // boundary management ////////////
    let pagesRow = document.querySelector(".pages-row");
    if (needsScrollbar) {
      g_bottomScrollBoundaryTimer = null;
      g_topScrollBoundaryTimer = null;
      g_bottomScrollBoundaryState = g_scrollStates.IDLE;
      g_topScrollBoundaryState = g_scrollStates.IDLE;

      const maxScrollBottom = pagesRow.scrollHeight - container.clientHeight;
      if (maxScrollBottom < g_scrollBoundaryThreshold) {
        g_currentScrollPosition = g_scrollPositions.TOP_AND_BOTTOM;
        g_topScrollBoundaryState = g_scrollStates.READY;
        g_bottomScrollBoundaryState = g_scrollStates.READY;
      } else if (g_lastRequestedScrollbarPos < g_scrollBoundaryThreshold) {
        g_currentScrollPosition = g_scrollPositions.TOP;
        g_topScrollBoundaryState = g_scrollStates.READY;
        g_bottomScrollBoundaryState = g_scrollStates.IDLE;
      } else {
        g_currentScrollPosition = g_scrollPositions.BOTTOM;
        g_bottomScrollBoundaryState = g_scrollStates.READY;
        g_topScrollBoundaryState = g_scrollStates.IDLE;
      }
    } else {
      if (g_topScrollBoundaryState !== g_scrollStates.BANNED) {
        g_topScrollBoundaryState = g_scrollStates.IDLE;
      } else {
        if (g_scrollBoundarySettleTimeMs <= 0)
          console.log("error: _scrollBoundarySettleTimeMs <= 0");
        g_topScrollBoundaryTimer = setTimeout(() => {
          g_topScrollBoundaryState = g_scrollStates.IDLE;
          g_topScrollBoundaryState = null;
        }, g_scrollBoundarySettleTimeMs);
      }
      if (g_bottomScrollBoundaryState !== g_scrollStates.BANNED) {
        g_bottomScrollBoundaryState = g_scrollStates.IDLE;
      } else {
        if (g_scrollBoundarySettleTimeMs <= 0)
          console.log("error: _scrollBoundarySettleTimeMs <= 0");
        g_bottomScrollBoundaryTimer = setTimeout(() => {
          g_bottomScrollBoundaryState = g_scrollStates.IDLE;
          g_bottomScrollBoundaryState = null;
        }, g_scrollBoundarySettleTimeMs);
      }
    }
    ///////////////////////////////
  }
}

export function handleWheelEventScrollBoundaries(event, isLoading) {
  // if (
  //   !(
  //     g_scrollBlockTimeMs > 0 ||
  //     g_scrollBoundaryLockTimeMs > 0 ||
  //     g_scrollBoundarySettleTimeMs > 0
  //   )
  // ) {
  //   console.log("old path");
  //   let container = document.querySelector("#reader");
  //   if (
  //     event.deltaY > 0 &&
  //     Math.abs(
  //       container.scrollHeight - container.scrollTop - container.clientHeight,
  //     ) < 1
  //   ) {
  //     // bottom
  //     inputGoToNextPage();
  //   } else if (event.deltaY < 0 && container.scrollTop <= 0) {
  //     // top
  //     inputGoToPrevPage();
  //   }
  //   return;
  // }

  let container = document.querySelector("#reader");
  const hasVerticalScrollSpace =
    container.scrollHeight > container.clientHeight;

  if (g_scrollIsBlocked) {
    // g_scrollIsBlocked is set in the scroll handler
    event.stopPropagation();
    event.preventDefault();
    return;
  }
  if (isLoading) {
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  let pagesRow = document.querySelector(".pages-row");
  if (!pagesRow || pagesRow.children.length === 0) return;

  // scrollbar, the scroll handler applies the lock time
  if (hasVerticalScrollSpace) {
    // auto-correct top
    if (
      event.deltaY < 0 &&
      g_currentScrollPosition === g_scrollPositions.MIDDLE &&
      container.scrollTop < 4
    ) {
      let distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceToBottom < 4) {
        // scrollbar is so large that it's also at bottom
        g_currentScrollPosition = g_scrollPositions.TOP_AND_BOTTOM;
        g_topScrollBoundaryState = g_scrollStates.READY;
        g_bottomScrollBoundaryState = g_scrollStates.READY;
      } else {
        g_currentScrollPosition = g_scrollPositions.TOP;
        g_topScrollBoundaryState = g_scrollStates.READY;
      }
    }
    // bottom
    if (
      event.deltaY > 0 &&
      (g_currentScrollPosition === g_scrollPositions.BOTTOM ||
        g_currentScrollPosition === g_scrollPositions.TOP_AND_BOTTOM)
    ) {
      if (g_bottomScrollBoundaryState === g_scrollStates.BANNED) {
        // do nothing
      } else if (g_bottomScrollBoundaryState === g_scrollStates.READY) {
        g_bottomScrollBoundaryState = g_scrollStates.IDLE;
        g_topScrollBoundaryState = g_scrollStates.IDLE;
        g_currentScrollPosition = g_scrollPositions.MIDDLE;
        // setup for settle time on next load if new page has no scrollbar
        if (g_scrollBoundarySettleTimeMs > 0)
          g_bottomScrollBoundaryState = g_scrollStates.BANNED;
        ////
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        inputGoToNextPage();
      }
    }
    // top
    else if (
      event.deltaY < 0 &&
      (g_currentScrollPosition === g_scrollPositions.TOP ||
        g_currentScrollPosition === g_scrollPositions.TOP_AND_BOTTOM)
    ) {
      if (g_topScrollBoundaryState === g_scrollStates.BANNED) {
        // do nothing
      } else if (g_topScrollBoundaryState === g_scrollStates.READY) {
        g_bottomScrollBoundaryState = g_scrollStates.IDLE;
        g_topScrollBoundaryState = g_scrollStates.IDLE;
        g_currentScrollPosition = g_scrollPositions.MIDDLE;
        // setup for settle time on next load if new page has no scrollbar
        if (g_scrollBoundarySettleTimeMs > 0)
          g_topScrollBoundaryState = g_scrollStates.BANNED;
        ////
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        inputGoToPrevPage();
      }
    }
  }
  // no scrollbar, apply settle time after page change
  else {
    // bottom
    if (event.deltaY > 0) {
      if (g_bottomScrollBoundaryState !== g_scrollStates.BANNED) {
        // setup for settle time on next load if new page has no scrollbar
        if (g_scrollBoundarySettleTimeMs > 0)
          g_bottomScrollBoundaryState = g_scrollStates.BANNED;
        ////
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        inputGoToNextPage();
      } else {
        // do nothing
      }
    }
    // top
    else if (event.deltaY < 0) {
      if (g_topScrollBoundaryState !== g_scrollStates.BANNED) {
        // setup for settle time on next load if new page has no scrollbar
        if (g_scrollBoundarySettleTimeMs > 0)
          g_topScrollBoundaryState = g_scrollStates.BANNED;
        ////
        if (g_bottomScrollBoundaryTimer)
          clearTimeout(g_bottomScrollBoundaryTimer);
        if (g_topScrollBoundaryTimer) clearTimeout(g_topScrollBoundaryTimer);
        inputGoToPrevPage();
      } else {
        // do nothing
      }
    }
  }
}
