const STORAGE_KEY = "opportunityQueueJobs";
const FORMATTER_CONFIG_KEY = "opportunityQueueJdFormatterConfig";
const FORMATTER_PROVIDERS = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
};
const FORMATTER_TIMEOUT_MS = 25000;
const FORMATTER_LOG_LIMIT = 18;
const FORMATTER_DEFAULTS = {
  [FORMATTER_PROVIDERS.OPENAI]: {
    model: "gpt-4.1-mini",
    endpoint: "https://api.openai.com/v1/responses",
  },
  [FORMATTER_PROVIDERS.ANTHROPIC]: {
    model: "claude-3-5-haiku-latest",
    endpoint: "https://api.anthropic.com/v1/messages",
  },
};

const statusText = document.getElementById("statusText");
const countBadge = document.getElementById("countBadge");
const emptyState = document.getElementById("emptyState");
const jobList = document.getElementById("jobList");
const template = document.getElementById("jobCardTemplate");
const captureBtn = document.getElementById("captureBtn");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const formatterSettingsBtn = document.getElementById("formatterSettingsBtn");
const formatterSettingsPanel = document.getElementById("formatterSettingsPanel");
const formatterSettingsForm = document.getElementById("formatterSettingsForm");
const formatterCloseBtn = document.getElementById("formatterCloseBtn");
const formatterEnabledInput = document.getElementById("formatterEnabledInput");
const formatterProviderInput = document.getElementById("formatterProviderInput");
const formatterModelInput = document.getElementById("formatterModelInput");
const formatterEndpointInput = document.getElementById("formatterEndpointInput");
const formatterApiKeyInput = document.getElementById("formatterApiKeyInput");
const formatterTestBtn = document.getElementById("formatterTestBtn");
const formatterTestStatus = document.getElementById("formatterTestStatus");
const formatterTestPreview = document.getElementById("formatterTestPreview");
const formatterDebugLog = document.getElementById("formatterDebugLog");
const workspace = document.getElementById("workspace");

const readerEmpty = document.getElementById("readerEmpty");
const readerCard = document.getElementById("readerCard");
const readerRole = document.getElementById("readerRole");
const readerMeta = document.getElementById("readerMeta");
const readerFormatHint = document.getElementById("readerFormatHint");
const readerFormatHintText = document.getElementById("readerFormatHintText");
const readerFormatRetryBtn = document.getElementById("readerFormatRetryBtn");
const readerJdText = document.getElementById("readerJdText");
const readerCopyBtn = document.getElementById("readerCopyBtn");
const readerOpenBtn = document.getElementById("readerOpenBtn");
const readerEditorPanel = document.getElementById("readerEditorPanel");
const readerFields = Array.from(document.querySelectorAll("[data-reader-field]"));

const state = {
  jobs: [],
  dragId: null,
  selectedJobId: null,
  editorJobId: null,
  formatterConfig: createDefaultFormatterConfig(),
  structuredCache: {},
  pendingStructuredJobs: new Set(),
  formatterFailures: {},
  formatterLogs: [],
};

init();

async function init() {
  await Promise.all([loadJobs(), loadFormatterConfig()]);
  ensureValidSelection();
  bindTopLevelEvents();
  render();
}

function bindTopLevelEvents() {
  captureBtn.addEventListener("click", captureCurrentJob);
  copyMarkdownBtn.addEventListener("click", copyMarkdown);
  exportJsonBtn.addEventListener("click", exportJson);
  formatterSettingsBtn.addEventListener("click", toggleFormatterSettingsPanel);
  formatterCloseBtn.addEventListener("click", () => closeFormatterSettingsPanel());
  formatterSettingsForm.addEventListener("submit", saveFormatterConfigFromForm);
  formatterProviderInput.addEventListener("change", handleProviderChange);
  formatterTestBtn.addEventListener("click", testFormatterConnection);

  readerCopyBtn.addEventListener("click", copySelectedJd);
  readerOpenBtn.addEventListener("click", openSelectedSource);
  readerFormatRetryBtn.addEventListener("click", retrySelectedFormatting);

  readerFields.forEach((input) => {
    input.addEventListener("change", handleReaderFieldChange);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-wrap")) {
      closeAllMenus();
    }
    if (!event.target.closest(".settings-wrap")) {
      closeFormatterSettingsPanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMenus();
      closeFormatterSettingsPanel();
    }
  });
}

function closeAllMenus() {
  document.querySelectorAll(".menu-panel").forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll(".job-card.is-menu-active").forEach((card) => {
    card.classList.remove("is-menu-active");
  });
  document.querySelectorAll('.menu-trigger[aria-expanded="true"]').forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
}

function toggleFormatterSettingsPanel(event) {
  event.preventDefault();
  event.stopPropagation();
  const shouldOpen = formatterSettingsPanel.hidden;
  if (!shouldOpen) {
    closeFormatterSettingsPanel();
    return;
  }

  syncFormatterConfigToForm();
  clearFormatterTestStatus();
  formatterSettingsPanel.hidden = false;
  formatterSettingsBtn.setAttribute("aria-expanded", "true");
}

function closeFormatterSettingsPanel() {
  formatterSettingsPanel.hidden = true;
  formatterSettingsBtn.setAttribute("aria-expanded", "false");
}

async function loadJobs() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const jobs = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  const deduped = new Map();

  jobs.forEach((job) => {
    const normalizedJobBase = stripLegacySalaryFields(job);
    const normalizedUrl = normalizeJobUrl(job.url || job.id || "");
    const normalizedId = normalizeJobUrl(job.id || job.url || normalizedUrl);
    const normalizedJob = {
      ...normalizedJobBase,
      id: normalizedId || job.id || crypto.randomUUID(),
      url: normalizedUrl || job.url || "",
    };
    deduped.set(normalizedJob.id, normalizedJob);
  });

  state.jobs = Array.from(deduped.values());
}

async function loadFormatterConfig() {
  const stored = await chrome.storage.local.get(FORMATTER_CONFIG_KEY);
  const config = stored[FORMATTER_CONFIG_KEY];

  if (!config || typeof config !== "object") {
    return;
  }

  const provider = normalizeProvider(config.provider);
  const defaults = getFormatterDefaults(provider);
  state.formatterConfig = {
    enabled: Boolean(config.enabled),
    provider,
    apiKey: typeof config.apiKey === "string" ? config.apiKey.trim() : "",
    model: typeof config.model === "string" && config.model.trim() ? config.model.trim() : defaults.model,
    endpoint: normalizeFormatterEndpoint(provider, typeof config.endpoint === "string" ? config.endpoint.trim() : defaults.endpoint),
  };
}

function createDefaultFormatterConfig() {
  const provider = FORMATTER_PROVIDERS.OPENAI;
  const defaults = getFormatterDefaults(provider);
  return {
    enabled: false,
    provider,
    apiKey: "",
    model: defaults.model,
    endpoint: defaults.endpoint,
  };
}

function getFormatterDefaults(provider) {
  return FORMATTER_DEFAULTS[normalizeProvider(provider)] || FORMATTER_DEFAULTS[FORMATTER_PROVIDERS.OPENAI];
}

function normalizeProvider(provider) {
  return provider === FORMATTER_PROVIDERS.ANTHROPIC ? FORMATTER_PROVIDERS.ANTHROPIC : FORMATTER_PROVIDERS.OPENAI;
}

function normalizeFormatterEndpoint(provider, rawEndpoint) {
  const normalizedProvider = normalizeProvider(provider);
  const defaults = getFormatterDefaults(normalizedProvider);
  const trimmed = String(rawEndpoint || "").trim().replace(/\/+$/u, "");
  if (!trimmed) return defaults.endpoint;

  if (normalizedProvider === FORMATTER_PROVIDERS.ANTHROPIC) {
    if (/\/messages$/u.test(trimmed)) return trimmed;
    if (/\/v1$/u.test(trimmed)) return `${trimmed}/messages`;
    return `${trimmed}/v1/messages`;
  }

  if (/\/responses$/u.test(trimmed)) return trimmed;
  if (/\/(v\d+|api\/v\d+)$/u.test(trimmed)) return `${trimmed}/responses`;
  return `${trimmed}/v1/responses`;
}

function syncFormatterConfigToForm() {
  formatterEnabledInput.checked = Boolean(state.formatterConfig.enabled);
  formatterProviderInput.value = normalizeProvider(state.formatterConfig.provider);
  formatterModelInput.value = state.formatterConfig.model || "";
  formatterEndpointInput.value = state.formatterConfig.endpoint || "";
  formatterApiKeyInput.value = state.formatterConfig.apiKey || "";
}

function handleProviderChange() {
  const provider = normalizeProvider(formatterProviderInput.value);
  const defaults = getFormatterDefaults(provider);
  formatterProviderInput.value = provider;
  formatterModelInput.value = defaults.model;
  formatterEndpointInput.value = defaults.endpoint;
  clearFormatterTestStatus();
}

function getFormatterConfigFromForm() {
  const provider = normalizeProvider(formatterProviderInput.value);
  const defaults = getFormatterDefaults(provider);
  return {
    enabled: Boolean(formatterEnabledInput.checked),
    provider,
    apiKey: formatterApiKeyInput.value.trim(),
    model: formatterModelInput.value.trim() || defaults.model,
    endpoint: normalizeFormatterEndpoint(provider, formatterEndpointInput.value.trim()),
  };
}

async function saveFormatterConfigFromForm(event) {
  event.preventDefault();

  const config = getFormatterConfigFromForm();

  state.formatterConfig = config;
  state.structuredCache = {};
  state.pendingStructuredJobs.clear();
  state.formatterFailures = {};
  await chrome.storage.local.set({ [FORMATTER_CONFIG_KEY]: config });
  closeFormatterSettingsPanel();
  render();
  setStatus("Formatter settings saved.");
}

function clearFormatterTestStatus() {
  formatterTestStatus.textContent = "";
  formatterTestStatus.classList.remove("is-success", "is-error");
  formatterTestPreview.textContent = "";
  formatterTestPreview.classList.add("is-hidden");
}

function clearFormatterLogs() {
  state.formatterLogs = [];
  renderFormatterLogs();
}

function setFormatterTestStatus(message, type = "neutral") {
  formatterTestStatus.textContent = message;
  formatterTestStatus.classList.remove("is-success", "is-error");
  if (type === "success") {
    formatterTestStatus.classList.add("is-success");
  } else if (type === "error") {
    formatterTestStatus.classList.add("is-error");
  }
}

function setFormatterTestPreview(text) {
  const content = String(text || "").trim();
  formatterTestPreview.textContent = content;
  formatterTestPreview.classList.toggle("is-hidden", !content);
}

function logFormatterEvent(message, data) {
  const time = new Date().toLocaleTimeString();
  const detail = data ? ` ${JSON.stringify(data)}` : "";
  const line = `[${time}] ${message}${detail}`;
  state.formatterLogs = [line, ...state.formatterLogs].slice(0, FORMATTER_LOG_LIMIT);
  renderFormatterLogs();
  console.log("[formatter]", message, data || "");
}

function renderFormatterLogs() {
  const content = state.formatterLogs.join("\n");
  formatterDebugLog.textContent = content;
  formatterDebugLog.classList.toggle("is-hidden", !content);
}

async function testFormatterConnection() {
  const config = getFormatterConfigFromForm();
  if (!config.apiKey || !config.model || !config.endpoint) {
    setFormatterTestStatus("Please fill API key, model, and endpoint first.", "error");
    return;
  }

  formatterTestBtn.disabled = true;
  setFormatterTestStatus("Testing connection...", "neutral");
  clearFormatterLogs();

  try {
    const startedAt = performance.now();
    const result = await pingFormatter(config);
    const elapsedMs = Math.round(performance.now() - startedAt);
    const scopeLabel = result.usedSelectedJob ? "selected JD" : "sample text";
    const changeLabel = result.changed ? "changed" : "unchanged";
    setFormatterTestStatus(`Test OK in ${elapsedMs}ms using ${scopeLabel} (${changeLabel}).`, "success");
    setFormatterTestPreview(result.preview);
  } catch (error) {
    const message = error?.message ? String(error.message) : "Unknown error.";
    setFormatterTestStatus(`Failed: ${message}`, "error");
    setFormatterTestPreview("");
  } finally {
    formatterTestBtn.disabled = false;
  }
}

async function pingFormatter(config) {
  const selectedJob = getSelectedJob();
  const rawText =
    selectedJob?.jdText?.trim() ||
    "岗位职责：负责数据分析与增长运营。任职要求：有A/B测试经验，沟通协作良好。";
  const prompt = buildFormatterPrompt(rawText);
  const context = {
    source: selectedJob?.jdText?.trim() ? "test:selected-job" : "test:sample",
    rawLength: rawText.length,
  };

  let formatted = "";
  if (config.provider === FORMATTER_PROVIDERS.ANTHROPIC) {
    formatted = await formatJdWithAnthropic(prompt, config, context);
  } else {
    formatted = await formatJdWithOpenAI(prompt, config, context);
  }
  if (!formatted) throw new Error("Model returned empty text.");

  const normalizedRaw = normalizeComparableText(rawText);
  const normalizedFormatted = normalizeComparableText(formatted);
  const changed = normalizedRaw !== normalizedFormatted;

  return {
    usedSelectedJob: Boolean(selectedJob?.jdText?.trim()),
    changed,
    preview: formatted.slice(0, 320),
  };
}

async function saveJobs() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.jobs });
}

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function normalizeJobUrl(url = "") {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0];
  }
}

function ensureValidSelection() {
  if (!state.jobs.length) {
    state.selectedJobId = null;
    state.editorJobId = null;
    return;
  }

  const hasSelected = state.jobs.some((job) => job.id === state.selectedJobId);
  if (!hasSelected) {
    state.selectedJobId = state.jobs[0].id;
    state.editorJobId = null;
  }

  if (state.editorJobId && !state.jobs.some((job) => job.id === state.editorJobId)) {
    state.editorJobId = null;
  }
}

function getSelectedJob() {
  return state.jobs.find((job) => job.id === state.selectedJobId) || null;
}

function selectJob(jobId, { keepEditor = false } = {}) {
  const isSwitching = state.selectedJobId && state.selectedJobId !== jobId;
  if (state.selectedJobId === jobId && keepEditor) return;
  state.selectedJobId = jobId;
  if (!keepEditor && state.editorJobId !== jobId) {
    state.editorJobId = null;
  }
  if (isSwitching && readerCard) {
    readerCard.classList.add("is-switching");
    window.setTimeout(() => {
      readerCard.classList.remove("is-switching");
    }, 160);
  }
  render();
}

function render() {
  ensureValidSelection();
  const selectedJob = getSelectedJob();
  countBadge.textContent = `${state.jobs.length} saved`;
  emptyState.style.display = state.jobs.length ? "none" : "grid";
  jobList.innerHTML = "";

  for (const job of state.jobs) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".job-card");
    const role = fragment.querySelector(".job-role");
    const company = fragment.querySelector(".summary-company");
    const location = fragment.querySelector(".summary-location");
    const summaryDot = fragment.querySelector(".summary-dot");

    const menuTrigger = fragment.querySelector(".menu-trigger");
    const menuPanel = fragment.querySelector(".menu-panel");
    const menuOpen = fragment.querySelector(".menu-open");
    const menuEdit = fragment.querySelector(".menu-edit");
    const menuDelete = fragment.querySelector(".menu-delete");

    card.dataset.id = job.id;
    card.classList.toggle("is-active", job.id === state.selectedJobId);

    role.textContent = job.role || "Untitled role";
    role.title = role.textContent;

    const hasCompany = Boolean(job.company);
    const hasLocation = Boolean(job.location);
    company.textContent = job.company || "Company pending";
    location.textContent = job.location || "Location pending";
    summaryDot.classList.toggle("is-hidden", !hasCompany || !hasLocation);

    card.addEventListener("click", (event) => {
      if (event.target.closest(".menu-wrap")) return;
      selectJob(job.id);
    });

    menuTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const shouldOpen = menuPanel.hidden;
      closeAllMenus();
      if (shouldOpen) {
        menuPanel.hidden = false;
        card.classList.add("is-menu-active");
        menuTrigger.setAttribute("aria-expanded", "true");
      }
    });

    menuOpen.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      state.selectedJobId = job.id;
      if (job.url) {
        window.open(job.url, "_blank", "noopener,noreferrer");
      }
      render();
    });

    menuEdit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      state.selectedJobId = job.id;
      state.editorJobId = state.editorJobId === job.id ? null : job.id;
      render();
    });

    menuDelete.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      const deleteId = job.id;
      state.jobs = state.jobs.filter((item) => item.id !== deleteId);
      if (state.selectedJobId === deleteId) {
        state.selectedJobId = null;
        state.editorJobId = null;
      }
      await saveJobs();
      render();
      setStatus("Deleted one saved job.");
    });

    card.addEventListener("dragstart", () => {
      closeAllMenus();
      state.dragId = job.id;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      state.dragId = null;
      card.classList.remove("dragging");
      document.querySelectorAll(".job-card").forEach((node) => node.classList.remove("drop-target"));
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (job.id !== state.dragId) {
        card.classList.add("drop-target");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-target");
    });

    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      card.classList.remove("drop-target");
      if (!state.dragId || state.dragId === job.id) return;
      reorderJobs(state.dragId, job.id);
      await saveJobs();
      render();
      setStatus("Reordered queue.");
    });

    jobList.appendChild(fragment);
  }

  workspace?.classList.toggle("has-selection", Boolean(selectedJob));
  renderReader(selectedJob);
}

function renderReader(job) {
  if (!job) {
    readerEmpty.style.display = "grid";
    readerCard.classList.add("is-hidden");
    readerCopyBtn.disabled = true;
    readerOpenBtn.disabled = true;
    updateReaderFormatHint(null);
    return;
  }

  readerEmpty.style.display = "none";
  readerCard.classList.remove("is-hidden");

  readerRole.textContent = job.role || "Untitled role";
  readerMeta.textContent = formatReaderMeta(job);
  updateReaderFormatHint(job);
  const displayText = getReaderDisplayText(job);
  readerJdText.textContent = displayText;

  readerCopyBtn.disabled = !displayText || displayText === "No JD captured.";
  readerOpenBtn.disabled = !job.url;

  const isEditorOpen = state.editorJobId === job.id;
  readerEditorPanel.classList.toggle("is-hidden", !isEditorOpen);

  if (isEditorOpen) {
    readerFields.forEach((input) => {
      const field = input.dataset.readerField;
      input.value = job[field] || "";
    });
  }

  maybeFormatStructured(job);
}

function updateReaderFormatHint(job) {
  if (!job || !canUseFormatter() || !job.jdText?.trim()) {
    readerFormatHint.classList.add("is-hidden");
    readerFormatHint.classList.remove("is-error");
    readerFormatRetryBtn.hidden = true;
    readerFormatHintText.textContent = "";
    return;
  }

  const hasStructured = Boolean(getStructuredForJob(job));
  const isPending = Boolean(job && state.pendingStructuredJobs.has(job.id));
  const failure = getFormatterFailure(job);

  if (isPending) {
    readerFormatHint.classList.add("is-hidden");
    readerFormatHint.classList.remove("is-error");
    readerFormatRetryBtn.hidden = true;
    readerFormatHintText.textContent = "";
    return;
  }

  if (failure) {
    readerFormatHint.classList.remove("is-hidden");
    readerFormatHint.classList.add("is-error");
    readerFormatRetryBtn.hidden = false;
    readerFormatHintText.textContent = `Formatting failed: ${failure.message}`;
    return;
  }

  if (hasStructured) {
    readerFormatHint.classList.add("is-hidden");
    readerFormatHint.classList.remove("is-error");
    readerFormatRetryBtn.hidden = true;
    readerFormatHintText.textContent = "";
    return;
  }

  readerFormatHint.classList.add("is-hidden");
  readerFormatHint.classList.remove("is-error");
  readerFormatRetryBtn.hidden = true;
  readerFormatHintText.textContent = "";
}

function getReaderDisplayText(job) {
  if (!job) return "";
  const structured = getStructuredForJob(job);
  return structured || job.jdText || "No JD captured.";
}

async function handleReaderFieldChange(event) {
  const job = getSelectedJob();
  if (!job) return;

  const field = event.target.dataset.readerField;
  if (!field) return;

  job[field] = event.target.value.trim();

  await saveJobs();
  render();
  setStatus("Saved edits.");
}

function canUseFormatter() {
  return Boolean(
    state.formatterConfig.enabled &&
      state.formatterConfig.apiKey &&
      state.formatterConfig.model &&
      state.formatterConfig.endpoint &&
      state.formatterConfig.provider
  );
}

function getJobSignature(job) {
  return `${job.id || ""}|${job.role || ""}|${job.jdText || ""}`;
}

function getStructuredForJob(job) {
  const cached = state.structuredCache[job.id];
  if (!cached) return "";
  return cached.signature === getJobSignature(job) ? cached.text : "";
}

function getFormatterFailure(job) {
  const failure = state.formatterFailures[job.id];
  if (!failure) return null;
  return failure.signature === getJobSignature(job) ? failure : null;
}

function maybeFormatStructured(job, { force = false } = {}) {
  if (!job || !canUseFormatter()) return;
  if (!job.jdText?.trim()) return;
  if (getStructuredForJob(job)) return;
  if (state.pendingStructuredJobs.has(job.id)) return;
  if (!force && getFormatterFailure(job)) return;

  state.pendingStructuredJobs.add(job.id);
  delete state.formatterFailures[job.id];
  updateReaderFormatHint(job);

  formatJdWithModel(job)
    .then((formattedText) => {
      if (!formattedText) {
        state.formatterFailures[job.id] = {
          signature: getJobSignature(job),
          message: "Model returned empty text.",
        };
        return;
      }
      state.structuredCache[job.id] = {
        signature: getJobSignature(job),
        text: formattedText,
      };
      delete state.formatterFailures[job.id];
    })
    .catch((error) => {
      state.formatterFailures[job.id] = {
        signature: getJobSignature(job),
        message: formatFailureMessage(error),
      };
    })
    .finally(() => {
      state.pendingStructuredJobs.delete(job.id);
      if (state.selectedJobId === job.id) {
        renderReader(job);
      }
    });
}

async function formatJdWithModel(job) {
  const prompt = buildFormatterPrompt(job.jdText || "");
  const context = {
    source: "reader",
    jobId: String(job.id || "").slice(-12),
    rawLength: (job.jdText || "").length,
  };

  if (state.formatterConfig.provider === FORMATTER_PROVIDERS.ANTHROPIC) {
    return formatJdWithAnthropic(prompt, state.formatterConfig, context);
  }
  return formatJdWithOpenAI(prompt, state.formatterConfig, context);
}

function buildFormatterPrompt(rawText) {
  return [
    "这是从网页抓下来的原始JD文本，可能存在换行混乱、空行不合理、编号不整齐、标题粘连等排版问题。",
    "请先判断是否真的需要整理。",
    "如果原文已经清晰、自然、结构完整，请尽量保持原样返回，不要为了改而改。",
    "如果原文确实排版差，请在不改变事实信息的前提下，只做必要的排版整理，让它更清晰易读。",
    "不要补充信息，不要总结，不要重写内容，不要改写语气。",
    "只输出最终纯文本，不要解释，不要JSON，不要Markdown代码块。",
    "原始文本：",
    rawText,
  ].join("\n");
}

async function formatJdWithOpenAI(prompt, formatterConfig, context = {}) {
  const controller = new AbortController();
  const startedAt = performance.now();
  const endpoint = normalizeFormatterEndpoint(FORMATTER_PROVIDERS.OPENAI, formatterConfig.endpoint);
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, FORMATTER_TIMEOUT_MS);
  logFormatterEvent("openai request:start", {
    ...context,
    model: formatterConfig.model,
    endpoint,
    promptLength: prompt.length,
    timeoutMs: FORMATTER_TIMEOUT_MS,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${formatterConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: formatterConfig.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    logFormatterEvent("openai request:response", {
      ...context,
      status: response.status,
      elapsedMs: Math.round(performance.now() - startedAt),
    });

    if (!response.ok) {
      throw new Error(await describeFormatterError(response));
    }

    const payload = await response.json();
    if (payload?.incomplete_details?.reason) {
      logFormatterEvent("openai request:incomplete", {
        ...context,
        reason: payload.incomplete_details.reason,
      });
    }
    const outputText = extractModelOutputText(payload);
    const formatted = sanitizeFormattedText(outputText);
    if (!formatted) {
      logFormatterEvent("openai request:empty-output", summarizeFormatterPayload(payload));
    }
    logFormatterEvent("openai request:done", {
      ...context,
      rawOutputLength: outputText.length,
      outputLength: formatted.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return formatted;
  } catch (error) {
    const normalizedError = normalizeFormatterRuntimeError(error, { didTimeout });
    if (didTimeout) {
      logFormatterEvent("openai request:timeout", {
        ...context,
        timeoutMs: FORMATTER_TIMEOUT_MS,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    }
    logFormatterEvent("openai request:error", {
      ...context,
      error: normalizedError.message,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    throw normalizedError;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function formatJdWithAnthropic(prompt, formatterConfig, context = {}) {
  const controller = new AbortController();
  const startedAt = performance.now();
  const endpoint = normalizeFormatterEndpoint(FORMATTER_PROVIDERS.ANTHROPIC, formatterConfig.endpoint);
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, FORMATTER_TIMEOUT_MS);
  logFormatterEvent("anthropic request:start", {
    ...context,
    model: formatterConfig.model,
    endpoint,
    promptLength: prompt.length,
    timeoutMs: FORMATTER_TIMEOUT_MS,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": formatterConfig.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: formatterConfig.model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    logFormatterEvent("anthropic request:response", {
      ...context,
      status: response.status,
      elapsedMs: Math.round(performance.now() - startedAt),
    });

    if (!response.ok) {
      throw new Error(await describeFormatterError(response));
    }

    const payload = await response.json();
    const outputText = extractAnthropicOutputText(payload);
    const formatted = sanitizeFormattedText(outputText);
    if (!formatted) {
      logFormatterEvent("anthropic request:empty-output", summarizeFormatterPayload(payload));
    }
    logFormatterEvent("anthropic request:done", {
      ...context,
      rawOutputLength: outputText.length,
      outputLength: formatted.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return formatted;
  } catch (error) {
    const normalizedError = normalizeFormatterRuntimeError(error, { didTimeout });
    if (didTimeout) {
      logFormatterEvent("anthropic request:timeout", {
        ...context,
        timeoutMs: FORMATTER_TIMEOUT_MS,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    }
    logFormatterEvent("anthropic request:error", {
      ...context,
      error: normalizedError.message,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    throw normalizedError;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeFormatterRuntimeError(error, { didTimeout = false } = {}) {
  const message = error?.message ? String(error.message) : "";
  if (didTimeout || error?.name === "AbortError" || /signal is aborted without reason/i.test(message)) {
    return new Error(`Request timed out after ${FORMATTER_TIMEOUT_MS}ms.`);
  }
  return error instanceof Error ? error : new Error(message || "Unknown formatter error.");
}

async function describeFormatterError(response) {
  let detail = "";
  try {
    const payload = await response.json();
    detail =
      payload?.error?.message ||
      payload?.error?.type ||
      payload?.message ||
      "";
  } catch {
    try {
      detail = (await response.text()).trim();
    } catch {
      detail = "";
    }
  }
  const compact = String(detail || "").replace(/\s+/g, " ").trim().slice(0, 140);
  return compact ? `Request failed (${response.status}): ${compact}` : `Request failed (${response.status}).`;
}

function extractModelOutputText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (typeof payload?.response?.output_text === "string" && payload.response.output_text.trim()) {
    return payload.response.output_text.trim();
  }

  const outputChunks = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  output.forEach((item) => {
    collectTextFragments(item?.content, outputChunks);
    collectTextFragments(item?.text, outputChunks);
    collectTextFragments(item?.output_text, outputChunks);
  });

  if (outputChunks.length) {
    return dedupeTextFragments(outputChunks).join("\n");
  }

  const choiceText = payload?.choices?.[0]?.message?.content;
  if (typeof choiceText === "string" && choiceText.trim()) {
    return choiceText.trim();
  }

  const choiceChunks = [];
  collectTextFragments(payload?.choices, choiceChunks);
  if (choiceChunks.length) {
    return dedupeTextFragments(choiceChunks).join("\n");
  }

  const fallbackChunks = [];
  collectTextFragments(payload?.response, fallbackChunks);
  collectTextFragments(payload?.content, fallbackChunks);
  if (fallbackChunks.length) {
    return dedupeTextFragments(fallbackChunks).join("\n");
  }

  return "";
}

function extractAnthropicOutputText(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  const chunks = content
    .filter((item) => item?.type === "text" && typeof item?.text === "string")
    .map((item) => item.text.trim())
    .filter(Boolean);
  return chunks.join("\n").trim();
}

function sanitizeFormattedText(text) {
  if (!text) return "";
  return text
    .replace(/^```[\w-]*\n?/u, "")
    .replace(/\n?```$/u, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectTextFragments(value, chunks, depth = 0) {
  if (!value || depth > 6) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTextFragments(item, chunks, depth + 1));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  ["output_text", "text", "content"].forEach((key) => {
    if (key in value) {
      collectTextFragments(value[key], chunks, depth + 1);
    }
  });
}

function dedupeTextFragments(chunks) {
  const seen = new Set();
  return chunks.filter((chunk) => {
    const key = chunk.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeFormatterPayload(payload) {
  const keys = payload && typeof payload === "object" ? Object.keys(payload).slice(0, 8) : [];
  const outputItems = Array.isArray(payload?.output) ? payload.output.length : 0;
  const contentItems = Array.isArray(payload?.content) ? payload.content.length : 0;
  const preview = JSON.stringify(payload).slice(0, 280);
  return {
    keys,
    outputItems,
    contentItems,
    preview,
  };
}

function normalizeComparableText(text) {
  return sanitizeFormattedText(text).replace(/\s+/g, " ").trim();
}

function formatFailureMessage(error) {
  const message = error?.message ? String(error.message) : "Unknown error.";
  return message.replace(/\s+/g, " ").trim().slice(0, 120);
}

function retrySelectedFormatting() {
  const job = getSelectedJob();
  if (!job) return;
  maybeFormatStructured(job, { force: true });
}

async function copySelectedJd() {
  const job = getSelectedJob();
  const copyText = getReaderDisplayText(job).trim();
  if (!copyText || copyText === "No JD captured.") {
    setStatus("No JD text to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(copyText);
    setStatus("Copied JD text.");
  } catch {
    setStatus("Could not copy JD text.");
  }
}

function openSelectedSource() {
  const job = getSelectedJob();
  if (!job?.url) {
    setStatus("Source link is missing.");
    return;
  }
  window.open(job.url, "_blank", "noopener,noreferrer");
}

function reorderJobs(sourceId, targetId) {
  const sourceIndex = state.jobs.findIndex((item) => item.id === sourceId);
  const targetIndex = state.jobs.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [moved] = state.jobs.splice(sourceIndex, 1);
  state.jobs.splice(targetIndex, 0, moved);
}

async function captureCurrentJob() {
  try {
    setStatus("Capturing current BOSS job...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");
    if (!tab.url || !tab.url.includes("zhipin.com")) throw new Error("Open a BOSS page first.");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractBossJob,
    });

    if (!result?.ok) throw new Error(result?.error || "Could not capture this page.");

    const incomingId = normalizeJobUrl(result.job.id || result.job.url || "");
    const existingIndex = state.jobs.findIndex((item) => normalizeJobUrl(item.id) === incomingId);

    if (existingIndex >= 0) {
      state.jobs[existingIndex] = {
        ...state.jobs[existingIndex],
        ...result.job,
      };
      state.selectedJobId = state.jobs[existingIndex].id;
      setStatus("Updated an existing saved job.");
    } else {
      state.jobs.unshift(result.job);
      state.selectedJobId = result.job.id;
      setStatus("Captured current job.");
    }

    state.editorJobId = null;
    await saveJobs();
    render();
  } catch (error) {
    setStatus(error.message || "Capture failed.");
  }
}

function extractBossJob() {
  const normalizeUrl = (url = "") => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return url.split("?")[0];
    }
  };

  const readText = (node, { preserveLines = false } = {}) => {
    if (!node) return "";
    const raw = node.innerText || node.textContent || "";
    const normalized = raw.replace(/\u00a0/g, "");

    if (!preserveLines) {
      return normalized.replace(/\s+/g, " ").trim();
    }

    const lines = normalized
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim());

    const compact = [];
    for (const line of lines) {
      if (!line) {
        if (compact[compact.length - 1] !== "") {
          compact.push("");
        }
      } else {
        compact.push(line);
      }
    }

    return compact.join("\n").trim();
  };

  const queryText = (selector, root = document, options) => {
    const node = root?.querySelector(selector);
    return readText(node, options);
  };

  const activeCard = document.querySelector(".job-card-wrap.active");
  const detailBox = document.querySelector(".job-detail-box");
  const detailHeader = document.querySelector(".job-detail-header");
  const detailBody = document.querySelector(".job-detail-body");

  if (!detailBox || !detailHeader || !detailBody) {
    return { ok: false, error: "No job detail panel found on this page." };
  }

  const role = queryText(".job-name", detailHeader) || queryText(".job-name", activeCard || document);

  const companyRaw = queryText(".boss-name", activeCard || document) || queryText(".boss-info", activeCard || document);
  const company = companyRaw.split("·")[0].trim();
  const location = queryText(".tag-list li:first-child", detailHeader) || queryText(".company-location", activeCard || document) || "";

  const activeJobHref = activeCard?.querySelector('a[href*="/job_detail/"]')?.href;
  const detailJobHref = detailBox.querySelector("a.more-job-btn[href]")?.href;
  const jobLink = normalizeUrl(activeJobHref || detailJobHref || window.location.href);

  const detailBodyClone = detailBody.cloneNode(true);
  detailBodyClone
    .querySelectorAll(".job-detail-operate, .job-boss-info, .job-address, .more-job-btn, .job-search-scan, style, script")
    .forEach((node) => node.remove());
  let jdText = readText(detailBodyClone, { preserveLines: true });
  jdText = jdText
    .replace(/^举报\n微信扫码分享\n?/u, "")
    .replace(/^举报 微信扫码分享\s*/u, "")
    .trim();

  if (!role || !jdText) {
    return { ok: false, error: "Could not find role or JD text." };
  }

  return {
    ok: true,
    job: {
      id: jobLink,
      url: jobLink,
      role,
      company,
      location,
      jdText,
      note: "",
      capturedAt: new Date().toISOString(),
    },
  };
}

async function copyMarkdown() {
  try {
    const markdown = generateMarkdown(state.jobs);
    await navigator.clipboard.writeText(markdown);
    setStatus("Copied Markdown to clipboard.");
  } catch {
    setStatus("Could not copy Markdown.");
  }
}

function exportJson() {
  const exportableJobs = state.jobs.map((job) => buildExportJob(job));
  const blob = new Blob([JSON.stringify(exportableJobs, null, 2)], { type: "application/json" });
  downloadBlob(blob, `opportunity-queue-${dateStamp()}.json`);
  setStatus("Exported JSON.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function generateMarkdown(jobs) {
  const lines = ["# Opportunity Queue", ""];

  jobs.forEach((job, index) => {
    const exportJdText = getExportJdText(job);
    const order = String(index + 1).padStart(3, "0");
    lines.push(`### ${order} - ${job.company || "Company"} - ${job.role || "Role"}`);
    lines.push(`- Link: ${job.url ? `[JD](${job.url})` : ""}`);
    lines.push(`- Location: ${job.location || ""}`);
    lines.push(`- Captured: ${formatDate(job.capturedAt)}`);
    lines.push(`- Note: ${job.note || ""}`);
    lines.push("");
    lines.push("#### JD Text");
    lines.push("```text");
    lines.push(exportJdText.replace(/```/g, "`\u200b``"));
    lines.push("```");
    lines.push("");
  });

  return lines.join("\n");
}

function getExportJdText(job) {
  return getStructuredForJob(job) || job.jdText || "";
}

function buildExportJob(job) {
  const rawJob = stripLegacySalaryFields(job);
  const jdTextRaw = rawJob.jdText || "";
  const jdTextFormatted = getStructuredForJob(job);

  if (!jdTextFormatted) {
    return rawJob;
  }

  return {
    ...rawJob,
    jdText: jdTextFormatted,
    jdTextRaw,
    jdTextFormatted,
  };
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return date.toLocaleString();
}

function formatRelativeDate(value) {
  if (!value) return "time unknown";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "time unknown";

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(value);
}

function formatSource(url = "") {
  if (!url) return "UNKNOWN";

  try {
    const hostname = new URL(url).hostname.replace(/^www\./u, "");
    if (hostname.includes("zhipin.com")) return "BOSS";
    return hostname;
  } catch {
    return "UNKNOWN";
  }
}

function formatReaderMeta(job) {
  const parts = [job.company, job.location].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Company or location pending";
}

function stripLegacySalaryFields(job) {
  if (!job || typeof job !== "object") return job;
  const { salary, salaryNeedsReview, salaryRaw, ...rest } = job;
  return rest;
}

function dateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
