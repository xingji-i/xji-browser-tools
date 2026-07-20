/**
 * background.js — Auto Scroll (Mobile/Safari)
 * Handles extension install: sets default scroll settings.
 * No keyboard commands needed on mobile.
 */

const ext = typeof browser !== "undefined" ? browser : chrome;

ext.runtime.onInstalled.addListener(() => {
  ext.storage.local.get("scrollSettings", (result) => {
    if (!result.scrollSettings) {
      ext.storage.local.set({
        scrollSettings: {
          speed: 0.4,
          direction: "down",
          smooth: true
        }
      });
    }
  });
});
