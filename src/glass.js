import { createGlassScene } from "@glass-sdk/liquid-glass/dom";
import "@glass-sdk/liquid-glass/styles.css";

// Liquid Glass renders its material maps with WebGPU on a secure origin. Without that, or if the
// scene reports an error, every control keeps its plain themed style: the glass-only CSS keys off
// the .lg-surface class this module adds to an element once it is registered as glass.

var MAX_SURFACES = 64;
var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
var mounted = [];

function appearance() {
  return darkQuery.matches ? "dark" : "light";
}

function surfaceOptions(node, look) {
  var primary = node.classList.contains("main") || node.classList.contains("add");
  return {
    material: "regular",
    appearance: look,
    radius: node.getAttribute("data-glass") === "circle" ? "circle" : 22,
    refraction: 24,
    // Primary actions keep their solid ink colour as a tint so they stay distinct from the rest.
    tint: primary ? (look === "dark" ? "#f2f2f7" : "#1c1c1e") : undefined,
    interactive: node.tagName === "BUTTON",
  };
}

// Registers every [data-glass] element inside a [data-glass-scene] root, and keeps doing so as the
// page's own script adds or removes them (quick buttons, history cards).
function mount(root, look, onError) {
  // Nested scenes (the history footer) own their elements.
  function own(node) { return node.closest("[data-glass-scene]") === root; }
  var content = Array.from(root.querySelectorAll("[data-glass-content]")).filter(own)[0];
  if (!content) return null;
  root.classList.add("lg-scene");
  content.classList.add("lg-content");
  var scene = createGlassScene(root, {
    maxSurfaces: MAX_SURFACES,
    onDiagnostic: function (d) { if (d.error) onError(d.error); },
  });
  scene.setContent(content);

  var surfaces = new Map();
  function add(node) {
    if (surfaces.has(node) || surfaces.size >= MAX_SURFACES) return;
    node.classList.add("lg-surface");
    node.setAttribute("data-glass-appearance", look);
    surfaces.set(node, scene.addSurface(node, surfaceOptions(node, look)));
  }
  function remove(node) {
    var off = surfaces.get(node);
    if (!off) return;
    off();
    surfaces.delete(node);
    node.classList.remove("lg-surface");
    node.removeAttribute("data-glass-appearance");
  }
  function sync() {
    surfaces.forEach(function (_, node) { if (!root.contains(node)) remove(node); });
    root.querySelectorAll("[data-glass]").forEach(function (node) { if (own(node)) add(node); });
  }
  var observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();

  return function unmount() {
    observer.disconnect();
    Array.from(surfaces.keys()).forEach(remove);
    scene.dispose();
    root.classList.remove("lg-scene");
    content.classList.remove("lg-content");
  };
}

function unmountAll() {
  mounted.forEach(function (unmount) { unmount(); });
  mounted = [];
  document.documentElement.classList.remove("glass");
}

function mountAll() {
  var look = appearance();
  document.documentElement.classList.add("glass");
  document.querySelectorAll("[data-glass-scene]").forEach(function (root) {
    var unmount = mount(root, look, function (error) {
      console.warn("Liquid Glass disabled:", error);
      darkQuery.removeEventListener("change", remount);
      unmountAll();
    });
    if (unmount) mounted.push(unmount);
  });
}

function remount() {
  unmountAll();
  mountAll();
}

// Call once the [data-glass-scene] roots are in the document.
export function startGlass() {
  if (!window.isSecureContext || !navigator.gpu) return;
  navigator.gpu.requestAdapter().then(function (adapter) {
    if (!adapter) return;
    mountAll();
    darkQuery.addEventListener("change", remount);
  }).catch(unmountAll);
}
