import type { Settings } from "../shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] as Partial<Settings> ?? {}) };
}

async function init(): Promise<void> {
  const settings = await loadSettings();

  const providerEl = document.getElementById("api-provider") as HTMLSelectElement;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement;
  const privacyAckEl = document.getElementById("privacy-ack") as HTMLInputElement;
  const privacyWarningEl = document.getElementById("privacy-warning") as HTMLElement;
  const apiKeyRowEl = document.getElementById("api-key-row") as HTMLElement;
  const aiThreshEl = document.getElementById("ai-threshold") as HTMLInputElement;
  const aiThreshValEl = document.getElementById("ai-threshold-val") as HTMLElement;
  const uncertThreshEl = document.getElementById("uncertain-threshold") as HTMLInputElement;
  const uncertThreshValEl = document.getElementById("uncertain-threshold-val") as HTMLElement;
  const minLenEl = document.getElementById("min-length") as HTMLInputElement;
  const denyListEl = document.getElementById("deny-list") as HTMLTextAreaElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const saveMsg = document.getElementById("save-msg") as HTMLElement;

  // Populate fields
  providerEl.value = settings.apiProvider;
  privacyAckEl.checked = settings.privacyAcknowledged;
  aiThreshEl.value = String(Math.round(settings.threshold.ai * 100));
  aiThreshValEl.textContent = `${Math.round(settings.threshold.ai * 100)}%`;
  uncertThreshEl.value = String(Math.round(settings.threshold.uncertain * 100));
  uncertThreshValEl.textContent = `${Math.round(settings.threshold.uncertain * 100)}%`;
  minLenEl.value = String(settings.minTextLength);
  denyListEl.value = Object.entries(settings.siteOverrides)
    .filter(([, v]) => v === false)
    .map(([k]) => k)
    .join("\n");

  // API key visibility
  const updateVisibility = () => {
    const isApi = providerEl.value !== "none";
    apiKeyRowEl.style.display = isApi ? "flex" : "none";
    privacyWarningEl.style.display = isApi ? "block" : "none";
  };
  updateVisibility();
  providerEl.addEventListener("change", updateVisibility);

  // Slider live labels
  aiThreshEl.addEventListener("input", () => {
    aiThreshValEl.textContent = `${aiThreshEl.value}%`;
    // Clamp uncertain to be always below ai
    if (Number(uncertThreshEl.value) >= Number(aiThreshEl.value)) {
      uncertThreshEl.value = String(Number(aiThreshEl.value) - 1);
      uncertThreshValEl.textContent = `${uncertThreshEl.value}%`;
    }
  });
  uncertThreshEl.addEventListener("input", () => {
    uncertThreshValEl.textContent = `${uncertThreshEl.value}%`;
  });

  // Save
  saveBtn.addEventListener("click", async () => {
    const denyEntries = denyListEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const denyOverrides: Record<string, boolean> = {};
    for (const h of denyEntries) denyOverrides[h] = false;

    const newSettings: Settings = {
      ...settings,
      apiProvider: providerEl.value as Settings["apiProvider"],
      apiKey: apiKeyEl.value || settings.apiKey,
      privacyAcknowledged: privacyAckEl.checked,
      threshold: {
        ai: Number(aiThreshEl.value) / 100,
        uncertain: Number(uncertThreshEl.value) / 100,
      },
      minTextLength: Number(minLenEl.value),
      siteOverrides: denyOverrides,
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
    // Clear the key field after saving for security
    apiKeyEl.value = "";
    saveMsg.textContent = "Saved!";
    setTimeout(() => (saveMsg.textContent = ""), 2500);
  });
}

init().catch(console.error);
