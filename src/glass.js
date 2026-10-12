import { createGlassScene } from "@glass-sdk/liquid-glass/dom";
import "@glass-sdk/liquid-glass/styles.css";

// Liquid Glass renders its material maps with WebGPU on a secure origin. Without that the page
// keeps its plain styles: the glass-only CSS is scoped under html.glass, which is set only on success.
function start() {
  if (!window.isSecureContext || !navigator.gpu) return;
  var root = document.getElementById("scene");
  var backdrop = document.getElementById("backdrop");
  if (!root || !backdrop) return;

  var html = document.documentElement;
  var scene = null;
  var removers = [];
  function teardown() {
    html.classList.remove("glass");
    removers.forEach(function (r) { r(); });
    removers = [];
    if (scene) scene.dispose();
    scene = null;
  }

  navigator.gpu.requestAdapter().then(function (adapter) {
    if (!adapter) return;
    html.classList.add("glass");
    root.classList.add("lg-scene");
    backdrop.classList.add("lg-content");
    scene = createGlassScene(root, {
      onDiagnostic: function (d) { if (d.error) teardown(); },
    });
    scene.setContent(backdrop);
    // The display lives in the absolutely positioned content layer; reserve its height in the flow.
    var screenEl = document.getElementById("screen");
    var ro = new ResizeObserver(function () {
      root.style.setProperty("--screen-h", screenEl.offsetHeight + "px");
    });
    ro.observe(screenEl);
    removers.push(function () { ro.disconnect(); root.style.removeProperty("--screen-h"); });
    document.querySelectorAll("[data-glass]").forEach(function (node) {
      node.classList.add("lg-surface");
      node.setAttribute("data-glass-appearance", "dark");
      var radius = node.getAttribute("data-glass") === "circle" ? "circle" : 22;
      removers.push(scene.addSurface(node, {
        material: "regular",
        appearance: "dark",
        radius: radius,
        refraction: 24,
        interactive: node.tagName === "BUTTON" || node.hasAttribute("data-glass-press"),
      }));
    });
  }).catch(teardown);
}

start();
