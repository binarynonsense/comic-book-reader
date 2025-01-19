/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function initSliders() {
  // ref: https://css-tricks.com/value-bubbles-for-range-inputs/
  const sliders = document.querySelectorAll(".tools-range-wrap");
  sliders.forEach((wrap) => {
    const range = wrap.querySelector(".tools-range");
    const bubble = wrap.querySelector(".tools-range-bubble");
    const ul = wrap.querySelector(".tools-range-ul");
    range.addEventListener("input", () => {
      updateSliderBubble(range, bubble, ul);
    });
    range.addEventListener("mousedown", () => {
      updateSliderBubble(range, bubble, ul);
      bubble.classList.remove("set-display-none");
    });
    range.addEventListener("mouseup", () => {
      bubble.classList.add("set-display-none");
    });
    updateSliderBubble(range, bubble, ul);
  });
}

export function updateSliders() {
  const sliders = document.querySelectorAll(".tools-range-wrap");
  sliders.forEach((wrap) => {
    const range = wrap.querySelector(".tools-range");
    const bubble = wrap.querySelector(".tools-range-bubble");
    const ul = wrap.querySelector(".tools-range-ul");
    updateSliderBubble(range, bubble, ul);
  });
}

function updateSliderBubble(range, bubble, ul) {
  const val = range.value;
  const min = range.min ? range.min : 0;
  const max = range.max ? range.max : 100;
  const newVal = Number(((val - min) * 100) / (max - min));
  bubble.innerHTML = range.value;
  // magic numbers
  bubble.style["inset-inline-start"] = `calc(${newVal}% - (${
    newVal * 0.75
  }px))`;
  ul.innerHTML = `<li class="tools-collection-li">${range.value}</li>`;
}
