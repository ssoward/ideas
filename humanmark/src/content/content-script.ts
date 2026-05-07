import type { MessageResponse, Settings } from "../shared/types";
import { initRenderer } from "./renderer";
import { startObserving, updateActiveSettings } from "./mutation-observer";

async function init(): Promise<void> {
  const resp = await sendMessage({ type: "GET_SETTINGS" }) as MessageResponse;
  if (resp.type !== "SETTINGS") return;

  const settings: Settings = resp.payload;

  // Check site override
  const hostname = location.hostname;
  const override = settings.siteOverrides[hostname];
  if (override === false || (!settings.enabled && override !== true)) return;

  initRenderer();
  startObserving(settings);

  // Listen for settings changes (options page saves)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes["settings"]) {
      const newSettings = changes["settings"].newValue as Settings;
      updateActiveSettings(newSettings);
    }
  });
}

function sendMessage(msg: object): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp: MessageResponse) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      resolve(resp);
    });
  });
}

init().catch(console.error);
