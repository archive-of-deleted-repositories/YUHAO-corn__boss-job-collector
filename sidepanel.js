const STORAGE_KEY = "opportunityQueueJobs";
const PANE_RATIO_KEY = "opportunityQueuePaneRatio";

const MIN_QUEUE_RATIO = 0.45;
const MAX_QUEUE_RATIO = 0.82;
const DEFAULT_QUEUE_RATIO = 0.62;

const statusText = document.getElementById("statusText");
const countBadge = document.getElementById("countBadge");
const emptyState = document.getElementById("emptyState");
const jobList = document.getElementById("jobList");
const template = document.getElementById("jobCardTemplate");
const captureBtn = document.getElementById("captureBtn");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const workspace = document.getElementById("workspace");
const paneDivider = document.getElementById("paneDivider");

const readerEmpty = document.getElementById("readerEmpty");
const readerCard = document.getElementById("readerCard");
const readerRole = document.getElementById("readerRole");
const readerMeta = document.getElementById("readerMeta");
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
  paneRatio: DEFAULT_QUEUE_RATIO,
  isResizing: false,
};

init();

async function init() {
  await loadJobs();
  loadPaneRatio();
  ensureValidSelection();
  bindTopLevelEvents();
  applyPaneRatio(state.paneRatio, false);
  render();
}

function bindTopLevelEvents() {
  captureBtn.addEventListener("click", captureCurrentJob);
  copyMarkdownBtn.addEventListener("click", copyMarkdown);
  exportJsonBtn.addEventListener("click", exportJson);

  readerCopyBtn.addEventListener("click", copySelectedJd);
  readerOpenBtn.addEventListener("click", openSelectedSource);

  paneDivider.addEventListener("mousedown", startPaneResize);
  window.addEventListener("mousemove", handlePaneResize);
  window.addEventListener("mouseup", stopPaneResize);

  readerFields.forEach((input) => {
    input.addEventListener("change", handleReaderFieldChange);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-wrap")) {
      closeAllMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMenus();
    }
  });
}

function startPaneResize(event) {
  event.preventDefault();
  state.isResizing = true;
  document.body.classList.add("is-resizing");
}

function handlePaneResize(event) {
  if (!state.isResizing) return;

  const rect = workspace.getBoundingClientRect();
  if (!rect.height) return;
  const ratio = (event.clientY - rect.top) / rect.height;
  applyPaneRatio(ratio, false);
}

function stopPaneResize() {
  if (!state.isResizing) return;
  state.isResizing = false;
  document.body.classList.remove("is-resizing");
  persistPaneRatio();
}

function loadPaneRatio() {
  const raw = window.localStorage.getItem(PANE_RATIO_KEY);
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    state.paneRatio = clampPaneRatio(parsed);
  }
}

function persistPaneRatio() {
  window.localStorage.setItem(PANE_RATIO_KEY, String(state.paneRatio));
}

function applyPaneRatio(ratio, persist = true) {
  state.paneRatio = clampPaneRatio(ratio);
  const percentage = `${Math.round(state.paneRatio * 100)}%`;
  workspace.style.setProperty("--queue-size", percentage);
  if (persist) {
    persistPaneRatio();
  }
}

function clampPaneRatio(value) {
  return Math.min(MAX_QUEUE_RATIO, Math.max(MIN_QUEUE_RATIO, value));
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

async function loadJobs() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const jobs = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  const deduped = new Map();

  jobs.forEach((job) => {
    const normalizedUrl = normalizeJobUrl(job.url || job.id || "");
    const normalizedId = normalizeJobUrl(job.id || job.url || normalizedUrl);
    const normalizedJob = {
      ...job,
      id: normalizedId || job.id || crypto.randomUUID(),
      url: normalizedUrl || job.url || "",
    };
    deduped.set(normalizedJob.id, normalizedJob);
  });

  state.jobs = Array.from(deduped.values());
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
  if (state.selectedJobId === jobId && keepEditor) return;
  state.selectedJobId = jobId;
  if (!keepEditor && state.editorJobId !== jobId) {
    state.editorJobId = null;
  }
  render();
}

function render() {
  ensureValidSelection();
  countBadge.textContent = `${state.jobs.length} saved`;
  emptyState.style.display = state.jobs.length ? "none" : "grid";
  jobList.innerHTML = "";

  for (const job of state.jobs) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".job-card");
    const role = fragment.querySelector(".job-role");
    const salary = fragment.querySelector(".job-salary");
    const company = fragment.querySelector(".summary-company");
    const location = fragment.querySelector(".summary-location");
    const summaryDot = fragment.querySelector(".summary-dot");
    const summaryCaptured = fragment.querySelector(".summary-captured");
    const summarySource = fragment.querySelector(".summary-source");

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
    summaryCaptured.textContent = formatRelativeDate(job.capturedAt);
    summarySource.textContent = formatSource(job.url);

    if (job.salary) {
      salary.classList.remove("is-empty");
      salary.textContent = job.salary;
    } else if (job.salaryNeedsReview) {
      salary.classList.remove("is-empty");
      salary.textContent = "Review salary";
    } else {
      salary.classList.add("is-empty");
      salary.textContent = "";
    }

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

  renderReader(getSelectedJob());
}

function renderReader(job) {
  if (!job) {
    readerEmpty.style.display = "grid";
    readerCard.classList.add("is-hidden");
    readerCopyBtn.disabled = true;
    readerOpenBtn.disabled = true;
    return;
  }

  readerEmpty.style.display = "none";
  readerCard.classList.remove("is-hidden");

  readerRole.textContent = job.role || "Untitled role";
  readerMeta.textContent = formatReaderMeta(job);
  readerJdText.textContent = job.jdText || "No JD captured.";

  readerCopyBtn.disabled = !job.jdText;
  readerOpenBtn.disabled = !job.url;

  const isEditorOpen = state.editorJobId === job.id;
  readerEditorPanel.classList.toggle("is-hidden", !isEditorOpen);

  if (isEditorOpen) {
    readerFields.forEach((input) => {
      const field = input.dataset.readerField;
      input.value = job[field] || "";
    });
  }
}

async function handleReaderFieldChange(event) {
  const job = getSelectedJob();
  if (!job) return;

  const field = event.target.dataset.readerField;
  if (!field) return;

  job[field] = event.target.value.trim();
  if (field === "salary" && job.salaryNeedsReview && job.salary) {
    job.salaryNeedsReview = false;
  }

  await saveJobs();
  render();
  setStatus("Saved edits.");
}

async function copySelectedJd() {
  const job = getSelectedJob();
  if (!job?.jdText) {
    setStatus("No JD text to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(job.jdText);
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
  const containsPrivateUse = (value = "") => /[\uE000-\uF8FF]/.test(value);

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
  const salaryFromCard = queryText(".job-salary", activeCard || document);
  const salaryFromDetail = queryText(".job-salary", detailHeader);
  const salaryRaw = [salaryFromCard, salaryFromDetail].find((value) => value && !containsPrivateUse(value)) || salaryFromCard || salaryFromDetail || "";

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

  const salary = containsPrivateUse(salaryRaw) ? "" : salaryRaw;

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
      salary,
      salaryNeedsReview: Boolean(salaryRaw) && containsPrivateUse(salaryRaw),
      salaryRaw,
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
  const blob = new Blob([JSON.stringify(state.jobs, null, 2)], { type: "application/json" });
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
    const order = String(index + 1).padStart(3, "0");
    lines.push(`### ${order} - ${job.company || "Company"} - ${job.role || "Role"}`);
    lines.push(`- Link: ${job.url ? `[JD](${job.url})` : ""}`);
    lines.push(`- Location: ${job.location || ""}`);
    lines.push(`- Salary: ${job.salary || ""}`);
    lines.push(`- Captured: ${formatDate(job.capturedAt)}`);
    lines.push(`- Note: ${job.note || ""}`);
    lines.push("");
    lines.push("#### JD Text");
    lines.push("```text");
    lines.push((job.jdText || "").replace(/```/g, "`\u200b``"));
    lines.push("```");
    lines.push("");
  });

  return lines.join("\n");
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
  const parts = [job.company, job.location, formatRelativeDate(job.capturedAt), formatSource(job.url)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Company or location pending";
}

function dateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
