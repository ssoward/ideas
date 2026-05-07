import type { Settings } from "../shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  const saved = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    colors: { ...DEFAULT_SETTINGS.colors, ...(saved.colors ?? {}) },
    threshold: { ...DEFAULT_SETTINGS.threshold, ...(saved.threshold ?? {}) },
  };
}

async function init(): Promise<void> {
  const settings = await loadSettings();

  const providerEl   = document.getElementById("api-provider") as HTMLSelectElement;
  const apiKeyEl     = document.getElementById("api-key") as HTMLInputElement;
  const privacyAckEl = document.getElementById("privacy-ack") as HTMLInputElement;
  const privacyWarnEl = document.getElementById("privacy-warning") as HTMLElement;
  const apiKeyRowEl  = document.getElementById("api-key-row") as HTMLElement;
  const aiThreshEl   = document.getElementById("ai-threshold") as HTMLInputElement;
  const aiThreshVal  = document.getElementById("ai-threshold-val") as HTMLElement;
  const uncThreshEl  = document.getElementById("uncertain-threshold") as HTMLInputElement;
  const uncThreshVal = document.getElementById("uncertain-threshold-val") as HTMLElement;
  const minLenEl     = document.getElementById("min-length") as HTMLInputElement;
  const denyListEl   = document.getElementById("deny-list") as HTMLTextAreaElement;
  const colorAiEl    = document.getElementById("color-ai") as HTMLInputElement;
  const colorUncEl   = document.getElementById("color-uncertain") as HTMLInputElement;
  const swatchAi     = document.getElementById("swatch-ai") as HTMLElement;
  const swatchUnc    = document.getElementById("swatch-uncertain") as HTMLElement;
  const saveBtn      = document.getElementById("save-btn") as HTMLButtonElement;
  const saveMsg      = document.getElementById("save-msg") as HTMLElement;

  // Populate
  providerEl.value    = settings.apiProvider;
  privacyAckEl.checked = settings.privacyAcknowledged;
  aiThreshEl.value    = String(Math.round(settings.threshold.ai * 100));
  aiThreshVal.textContent = `${Math.round(settings.threshold.ai * 100)}%`;
  uncThreshEl.value   = String(Math.round(settings.threshold.uncertain * 100));
  uncThreshVal.textContent = `${Math.round(settings.threshold.uncertain * 100)}%`;
  minLenEl.value      = String(settings.minTextLength);
  colorAiEl.value     = settings.colors.ai;
  colorUncEl.value    = settings.colors.uncertain;
  swatchAi.style.background  = settings.colors.ai;
  swatchUnc.style.background = settings.colors.uncertain;
  denyListEl.value    = Object.entries(settings.siteOverrides)
    .filter(([, v]) => v === false).map(([k]) => k).join("\n");

  // API visibility
  const updateApiVisibility = () => {
    const isApi = providerEl.value !== "none";
    apiKeyRowEl.style.display   = isApi ? "flex" : "none";
    privacyWarnEl.style.display = isApi ? "block" : "none";
  };
  updateApiVisibility();
  providerEl.addEventListener("change", updateApiVisibility);

  // Sliders
  aiThreshEl.addEventListener("input", () => {
    aiThreshVal.textContent = `${aiThreshEl.value}%`;
    if (Number(uncThreshEl.value) >= Number(aiThreshEl.value)) {
      uncThreshEl.value = String(Number(aiThreshEl.value) - 1);
      uncThreshVal.textContent = `${uncThreshEl.value}%`;
    }
  });
  uncThreshEl.addEventListener("input", () => {
    uncThreshVal.textContent = `${uncThreshEl.value}%`;
  });

  // Color pickers — live swatch update
  colorAiEl.addEventListener("input", () => { swatchAi.style.background = colorAiEl.value; });
  colorUncEl.addEventListener("input", () => { swatchUnc.style.background = colorUncEl.value; });

  // Preset buttons
  document.querySelectorAll<HTMLButtonElement>(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ai  = btn.dataset.ai!;
      const unc = btn.dataset.unc!;
      colorAiEl.value  = ai;
      colorUncEl.value = unc;
      swatchAi.style.background  = ai;
      swatchUnc.style.background = unc;
    });
  });

  // Save
  saveBtn.addEventListener("click", async () => {
    const denyOverrides: Record<string, boolean> = {};
    denyListEl.value.split("\n").map((s) => s.trim()).filter(Boolean)
      .forEach((h) => { denyOverrides[h] = false; });

    const newSettings: Settings = {
      ...settings,
      apiProvider: providerEl.value as Settings["apiProvider"],
      apiKey: apiKeyEl.value || settings.apiKey,
      privacyAcknowledged: privacyAckEl.checked,
      threshold: {
        ai: Number(aiThreshEl.value) / 100,
        uncertain: Number(uncThreshEl.value) / 100,
      },
      colors: {
        ai: colorAiEl.value,
        uncertain: colorUncEl.value,
      },
      minTextLength: Number(minLenEl.value),
      siteOverrides: denyOverrides,
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
    apiKeyEl.value = "";
    saveMsg.textContent = "Saved!";
    setTimeout(() => (saveMsg.textContent = ""), 2500);
  });
}

init().catch(console.error);
