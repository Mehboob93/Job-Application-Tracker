"use strict";
const STORAGE_KEY = "jobTracker.applications.v1";
const VIEW_KEY = "jobTracker.view";
const THEME_KEY = "jobTracker.theme";
const STATUSES = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];
const FOLLOW_UP_DAYS = 7;

/* ---------- Small utilities ---------- */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESC[c]);
const pad = (n) => String(n).padStart(2, "0");
const $ = (selector) => document.querySelector(selector);

const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const todayISO = () => toISO(new Date());

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysSince(iso) {
  return Math.round((parseISO(todayISO()) - parseISO(iso)) / 86400000);
}

function relativeDate(iso) {
  const n = daysSince(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 0) return `In ${-n} days`;
  if (n < 30) return `${n} days ago`;
  if (n < 365) return `${Math.floor(n / 30)} mo ago`;
  return `${Math.floor(n / 365)} yr ago`;
}

function shortDate(iso) {
  const date = parseISO(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function hueFor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

function initialsFor(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const chars =
    words.length > 1
      ? [words[0], words[1]].map((w) => Array.from(w)[0])
      : Array.from(words[0] || "?").slice(0, 2);
  return chars.join("").toUpperCase();
}

/* ---------- Data ---------- */
function normalize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const company = String(raw.company ?? "").trim();
  const role = String(raw.role ?? "").trim();
  if (!company || !role) return null;
  return {
    id: String(raw.id || uid()),
    company,
    role,
    status: STATUSES.includes(raw.status) ? raw.status : "Applied",
    date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : todayISO(),
    notes: String(raw.notes ?? ""),
  };
}

let firstVisit = false;

function loadApps() {
  const raw = store.get(STORAGE_KEY);

 
  if (raw === null) {
    firstVisit = true;
    return sampleApps();
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const state = {
  apps: loadApps(),
  query: "",
  filter: "all",
  sort: "newest",
  view: store.get(VIEW_KEY) === "list" ? "list" : "board",
  editingId: null,
};

let saveWarned = false;
function save() {
  const ok = store.set(STORAGE_KEY, JSON.stringify(state.apps));
  if (!ok && !saveWarned) {
    saveWarned = true;
    toast("Could not save. Browser storage may be full or blocked.");
  }
}

function sampleApps() {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISO(d);
  };
  return [
    { company: "Northwind Labs", role: "Frontend Developer", status: "Interview", date: daysAgo(6), notes: "Technical round on Thursday. Revise closures and the event loop." },
    { company: "Lumen Health", role: "UI Engineer", status: "Applied", date: daysAgo(11), notes: "Referred by a friend. No reply yet." },
    { company: "Paperplane", role: "Junior Web Developer", status: "Offer", date: daysAgo(21), notes: "Offer received. Reply by Friday." },
    { company: "Orbit Pay", role: "Software Engineer Intern", status: "Applied", date: daysAgo(2), notes: "Applied through the careers page." },
    { company: "Fernhill Studio", role: "Web Developer", status: "Rejected", date: daysAgo(30), notes: "Went with a candidate who had more React experience." },
    { company: "Quanta Cloud", role: "Frontend Engineer", status: "Wishlist", date: daysAgo(0), notes: "Applications open next week." },
    { company: "Brightside Retail", role: "React Developer", status: "Interview", date: daysAgo(9), notes: "HR call done. Take-home task due in 3 days." },
    { company: "Kite Analytics", role: "Junior Software Engineer", status: "Applied", date: daysAgo(4), notes: "Tailored resume for the data dashboard role." },
    { company: "Maple & Oak", role: "Web Developer Intern", status: "Wishlist", date: daysAgo(1), notes: "Ask a senior from college for a referral." },
    { company: "Stackwise", role: "Full Stack Developer", status: "Rejected", date: daysAgo(18), notes: "Rejected after the coding test. Practice array problems." },
    { company: "Helio Games", role: "Frontend Developer", status: "Applied", date: daysAgo(8), notes: "Portfolio link sent. Follow up by email." },
    { company: "Tidewater Bank", role: "UI Developer", status: "Wishlist", date: daysAgo(3), notes: "Needs Angular. Check the job description again." },
  ].map((a) => ({ id: uid(), ...a }));
}

/* ---------- Derived data ---------- */
function counts() {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  state.apps.forEach((a) => { c[a.status] += 1; });
  return c;
}

const needsFollowUp = (a) => a.status === "Applied" && daysSince(a.date) >= FOLLOW_UP_DAYS;

function getVisible() {
  const q = state.query.trim().toLowerCase();
  const list = state.apps.filter((a) => {
    if (state.filter !== "all" && a.status !== state.filter) return false;
    return !q || `${a.company} ${a.role} ${a.notes}`.toLowerCase().includes(q);
  });

  list.sort((a, b) => {
    if (state.sort === "company") return a.company.localeCompare(b.company);
    if (state.sort === "oldest") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
  return list;
}

/* ---------- Icons ---------- */
const icon = (paths) =>
  `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

const icons = {
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  trash: icon('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
  left: icon('<path d="M14 6l-6 6 6 6"/>'),
  right: icon('<path d="M10 6l6 6-6 6"/>'),
  edit: icon('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
};

/* ---------- Elements ---------- */
const els = {
  heroTitle: $("#heroTitle"),
  heroSub: $("#heroSub"),
  pipeline: $("#pipeline"),
  chips: $("#chips"),
  toolbar: $("#toolbar"),
  search: $("#searchInput"),
  sort: $("#sortSelect"),
  board: $("#board"),
  listView: $("#listView"),
  empty: $("#emptyState"),
  noMatch: $("#noMatch"),
  drawer: $("#drawer"),
  form: $("#appForm"),
  drawerTitle: $("#drawerTitle"),
  submitBtn: $("#submitBtn"),
  deleteBtn: $("#deleteBtn"),
  formError: $("#formError"),
  notesCount: $("#notesCount"),
  themeBtn: $("#themeBtn"),
  toasts: $("#toasts"),
  viewButtons: document.querySelectorAll('[data-action="view"]'),
};

/* ---------- Rendering: header ---------- */
function renderHero() {
  const total = state.apps.length;

  if (total === 0) {
    els.heroTitle.textContent = "Your job search starts here.";
    els.heroSub.textContent = "Add an application and watch your pipeline take shape.";
    return;
  }

  const c = counts();
  const due = state.apps.filter(needsFollowUp).length;

  els.heroTitle.textContent = `You are tracking ${total} ${total === 1 ? "application" : "applications"}.`;

  const parts = [];
  if (c.Interview) parts.push(`${c.Interview} in interview`);
  if (c.Offer) parts.push(`${c.Offer} ${c.Offer === 1 ? "offer" : "offers"} to consider`);
  if (due) parts.push(`${due} due a follow-up`);

  els.heroSub.textContent = parts.length
    ? `${parts.join(", ")}.`
    : "Nothing in motion yet. Move a card to Interview when you hear back.";
}

function buildFilterControls() {
  els.pipeline.innerHTML = STATUSES.map(
    (s) =>
      `<button type="button" class="bar" data-status="${s}" data-filter="${s}" aria-pressed="false" aria-label="${s}"></button>`
  ).join("");

  const chips = [["all", "All"], ...STATUSES.map((s) => [s, s])];
  els.chips.innerHTML = chips
    .map(
      ([value, label]) =>
        `<button type="button" class="chip" data-filter="${value}"${value === "all" ? "" : ` data-status="${value}"`} aria-pressed="false">` +
        `${value === "all" ? "" : '<span class="dot"></span>'}${label}<span class="chip-count">0</span></button>`
    )
    .join("");
}

let pipelineIntroDone = false;

function renderPipeline() {
  const c = counts();
  const total = state.apps.length;

  els.pipeline.classList.toggle("is-empty", total === 0);
  els.pipeline.dataset.filter = state.filter;

  els.pipeline.querySelectorAll(".bar").forEach((bar) => {
    const status = bar.dataset.status;
    bar.style.flexGrow = pipelineIntroDone ? c[status] : 0;
    bar.dataset.empty = String(c[status] === 0);
    bar.setAttribute("aria-pressed", String(state.filter === status));
    bar.setAttribute("aria-label", `${status}: ${c[status]}`);
    bar.title = `${status}: ${c[status]}`;
  });

  els.chips.querySelectorAll(".chip").forEach((chip) => {
    const value = chip.dataset.filter;
    chip.querySelector(".chip-count").textContent = value === "all" ? total : c[value];
    chip.setAttribute("aria-pressed", String(state.filter === value));
  });
}

/* ---------- Rendering: board ---------- */
function cardHTML(app) {
  const idx = STATUSES.indexOf(app.status);
  const prev = idx > 0 ? STATUSES[idx - 1] : null;
  const next = idx < STATUSES.length - 1 ? STATUSES[idx + 1] : null;

  return `
    <article class="card" draggable="true" tabindex="0" data-id="${esc(app.id)}" data-status="${app.status}"
             aria-label="${esc(app.company)}, ${esc(app.role)}">
      <div class="card-top">
        <span class="avatar" style="--h:${hueFor(app.company)}" aria-hidden="true">${esc(initialsFor(app.company))}</span>
        <div class="card-title">
          <h3>${esc(app.company)}</h3>
          <p>${esc(app.role)}</p>
        </div>
      </div>
      ${app.notes ? `<p class="card-notes">${esc(app.notes)}</p>` : ""}
      <div class="card-foot">
        <time datetime="${app.date}" title="${esc(shortDate(app.date))}">${esc(relativeDate(app.date))}</time>
        ${needsFollowUp(app) ? '<span class="nudge">Follow up</span>' : ""}
        <span class="card-actions">
          ${prev ? `<button type="button" class="icon-btn" data-action="move-prev" aria-label="Move to ${prev}" title="Move to ${prev}">${icons.left}</button>` : ""}
          ${next ? `<button type="button" class="icon-btn" data-action="move-next" aria-label="Move to ${next}" title="Move to ${next}">${icons.right}</button>` : ""}
          <button type="button" class="icon-btn" data-action="delete" aria-label="Delete ${esc(app.company)}" title="Delete">${icons.trash}</button>
        </span>
      </div>
    </article>`;
}

function renderBoard(visible) {
  const statuses = state.filter === "all" ? STATUSES : [state.filter];
  els.board.style.setProperty("--cols", statuses.length);
  els.board.classList.toggle("is-single", statuses.length === 1);

  els.board.innerHTML = statuses
    .map((status) => {
      const items = visible.filter((a) => a.status === status);
      return `
        <section class="column" data-status="${status}" aria-label="${status}, ${items.length}">
          <header class="column-head">
            <span class="dot"></span>
            <h2>${status}</h2>
            <span class="count">${items.length}</span>
            <button type="button" class="icon-btn" data-action="add-in" data-status="${status}" aria-label="Add application to ${status}" title="Add to ${status}">${icons.plus}</button>
          </header>
          <div class="column-body">
            ${items.length ? items.map(cardHTML).join("") : '<p class="column-empty">Nothing here yet.</p>'}
          </div>
        </section>`;
    })
    .join("");
}

/* ---------- Rendering: list ---------- */
function rowHTML(app) {
  return `
    <tr class="row" data-id="${esc(app.id)}" data-status="${app.status}">
      <td>
        <div class="cell-company">
          <span class="avatar" style="--h:${hueFor(app.company)}" aria-hidden="true">${esc(initialsFor(app.company))}</span>
          <div><strong>${esc(app.company)}</strong><span>${esc(app.role)}</span></div>
        </div>
      </td>
      <td>
        <span class="sel-wrap status-wrap">
          <select class="status-select" aria-label="Status for ${esc(app.company)}">
            ${STATUSES.map((s) => `<option value="${s}"${s === app.status ? " selected" : ""}>${s}</option>`).join("")}
          </select>
        </span>
      </td>
      <td class="cell-date col-date">${esc(shortDate(app.date))}<small>${esc(relativeDate(app.date))}</small></td>
      <td class="cell-notes col-notes">${esc(app.notes)}</td>
      <td class="cell-actions">
        <button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${esc(app.company)}" title="Edit">${icons.edit}</button>
        <button type="button" class="icon-btn" data-action="delete" aria-label="Delete ${esc(app.company)}" title="Delete">${icons.trash}</button>
      </td>
    </tr>`;
}

function renderList(visible) {
  els.listView.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Status</th>
          <th class="col-date">Applied</th>
          <th class="col-notes">Notes</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>${visible.map(rowHTML).join("")}</tbody>
    </table>`;
}

/* ---------- Render root ---------- */
function render() {
  if (!pipelineIntroDone) {
    // First paint: bars start at zero width, then grow into place.
    renderHero();
    renderPipeline();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        pipelineIntroDone = true;
        renderPipeline();
      })
    );
  } else {
    renderHero();
    renderPipeline();
  }

  const visible = getVisible();
  const none = state.apps.length === 0;
  const noMatch = !none && visible.length === 0;

  els.chips.hidden = none;
  els.toolbar.hidden = none;
  els.empty.hidden = !none;
  els.noMatch.hidden = !noMatch;

  const showBoard = !none && !noMatch && state.view === "board";
  const showList = !none && !noMatch && state.view === "list";
  els.board.hidden = !showBoard;
  els.listView.hidden = !showList;

  if (showBoard) renderBoard(visible);
  if (showList) renderList(visible);

  els.viewButtons.forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.view === state.view))
  );
}

/* ---------- Actions ---------- */
function setFilter(value) {
  state.filter = state.filter === value ? "all" : value;
  render();
}

function setView(view) {
  state.view = view;
  store.set(VIEW_KEY, view);
  render();
}

function clearFilters() {
  state.filter = "all";
  state.query = "";
  els.search.value = "";
  render();
}

function moveApp(id, status) {
  const app = state.apps.find((a) => a.id === id);
  if (!app || app.status === status || !STATUSES.includes(status)) return;
  app.status = status;
  save();
  render();
  toast(`${app.company} moved to ${status}`);
}

function removeApp(id) {
  const index = state.apps.findIndex((a) => a.id === id);
  if (index === -1) return;
  const [removed] = state.apps.splice(index, 1);
  save();
  render();
  toast("Application deleted", {
    actionLabel: "Undo",
    onAction() {
      state.apps.splice(Math.min(index, state.apps.length), 0, removed);
      save();
      render();
    },
  });
}

function loadSample() {
  state.apps = sampleApps();
  save();
  render();
  toast("Sample data loaded");
}

/* ---------- Drawer form ---------- */
function openDrawer(app = null, presetStatus = null) {
  const f = els.form.elements;
  state.editingId = app ? app.id : null;

  els.drawerTitle.textContent = app ? "Edit application" : "Add application";
  els.submitBtn.textContent = app ? "Save changes" : "Add application";
  els.deleteBtn.hidden = !app;

  f.company.value = app ? app.company : "";
  f.role.value = app ? app.role : "";
  f.status.value = app ? app.status : presetStatus || "Applied";
  f.date.value = app ? app.date : todayISO();
  f.notes.value = app ? app.notes : "";
  updateNotesCount();
  clearFormError();

  els.drawer.showModal();
  f.company.focus();
}

function closeDrawer() {
  if (els.drawer.open) els.drawer.close();
  state.editingId = null;
}

function updateNotesCount() {
  els.notesCount.textContent = `${els.form.elements.notes.value.length}/500`;
}

function clearFormError() {
  els.formError.hidden = true;
  els.formError.textContent = "";
  els.form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

function onSubmit(event) {
  event.preventDefault();
  const f = els.form.elements;
  clearFormError();

  const data = {
    company: f.company.value.trim(),
    role: f.role.value.trim(),
    status: f.status.value,
    date: f.date.value,
    notes: f.notes.value.trim(),
  };

  const invalid = !data.company ? f.company : !data.role ? f.role : !data.date ? f.date : null;
  if (invalid) {
    const labels = { company: "a company", role: "a role", date: "the date you applied" };
    invalid.setAttribute("aria-invalid", "true");
    els.formError.textContent = `Enter ${labels[invalid.name]} to save this application.`;
    els.formError.hidden = false;
    invalid.focus();
    return;
  }

  if (state.editingId) {
    state.apps = state.apps.map((a) => (a.id === state.editingId ? { ...a, ...data } : a));
    toast("Changes saved");
  } else {
    state.apps.push({ id: uid(), ...data });
    toast("Application added");
  }

  save();
  closeDrawer();
  render();
}

/* ---------- Toasts ---------- */
function toast(message, { actionLabel, onAction } = {}) {
  while (els.toasts.children.length >= 3) els.toasts.firstElementChild.remove();

  const el = document.createElement("div");
  el.className = "toast";
  const text = document.createElement("span");
  text.textContent = message;
  el.append(text);

  const dismiss = () => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 220);
  };

  if (actionLabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      onAction?.();
      dismiss();
    });
    el.append(btn);
  }

  els.toasts.append(el);
  setTimeout(dismiss, 5000);
}

/* ---------- CSV export ---------- */
function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; 
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCSV() {
  if (!state.apps.length) {
    toast("Add an application before exporting.");
    return;
  }
  const rows = [
    ["Company", "Role", "Status", "Date applied", "Notes"],
    ...state.apps.map((a) => [a.company, a.role, a.status, a.date, a.notes]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));

  const link = document.createElement("a");
  link.href = url;
  link.download = `job-applications-${todayISO()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("CSV downloaded");
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  store.set(THEME_KEY, next);
}

/* ---------- Events ---------- */
function handleAction(el) {
  const action = el.dataset.action;
  const id = el.closest("[data-id]")?.dataset.id;
  const app = id ? state.apps.find((a) => a.id === id) : null;

  switch (action) {
    case "new": openDrawer(); break;
    case "add-in": openDrawer(null, el.dataset.status); break;
    case "edit": if (app) openDrawer(app); break;
    case "delete": if (app) removeApp(app.id); break;
    case "delete-current": {
      const target = state.editingId;
      closeDrawer();
      if (target) removeApp(target);
      break;
    }
    case "close": closeDrawer(); break;
    case "view": setView(el.dataset.view); break;
    case "export": exportCSV(); break;
    case "theme": toggleTheme(); break;
    case "sample": loadSample(); break;
    case "clear-filters": clearFilters(); break;
    case "move-prev":
    case "move-next": {
      if (!app) break;
      const step = action === "move-next" ? 1 : -1;
      moveApp(app.id, STATUSES[STATUSES.indexOf(app.status) + step]);
      document.querySelector(`.card[data-id="${CSS.escape(app.id)}"]`)?.focus();
      break;
    }
  }
}

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    handleAction(actionEl);
    return;
  }

  const filterEl = event.target.closest("[data-filter]");
  if (filterEl) {
    const value = filterEl.dataset.filter;
    if (value === "all") {
      state.filter = "all";
      render();
    } else {
      setFilter(value);
    }
    return;
  }

  const item = event.target.closest(".card, .row");
  if (item && !event.target.closest("select, button, a, input, .sel-wrap")) {
    const app = state.apps.find((a) => a.id === item.dataset.id);
    if (app) openDrawer(app);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches(".status-select")) {
    const id = event.target.closest("[data-id]")?.dataset.id;
    if (id) moveApp(id, event.target.value);
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches?.(".card")) {
    event.preventDefault();
    const app = state.apps.find((a) => a.id === event.target.dataset.id);
    if (app) openDrawer(app);
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (els.drawer.open) return;
  if (event.target.matches?.("input, textarea, select, [contenteditable]")) return;

  if (event.key === "/") {
    event.preventDefault();
    els.search.focus();
  } else if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    openDrawer();
  }
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});

els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  render();
});

els.form.addEventListener("submit", onSubmit);
els.form.elements.notes.addEventListener("input", updateNotesCount);


els.drawer.addEventListener("click", (event) => {
  if (event.target === els.drawer) closeDrawer();
});

/* ---------- Drag and drop between columns ---------- */
let dragId = null;

els.board.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".card");
  if (!card) return;
  dragId = card.dataset.id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragId);
  requestAnimationFrame(() => card.classList.add("is-dragging"));
});

els.board.addEventListener("dragend", () => {
  dragId = null;
  els.board.querySelectorAll(".is-dragging, .is-over").forEach((el) =>
    el.classList.remove("is-dragging", "is-over")
  );
});

els.board.addEventListener("dragover", (event) => {
  const column = event.target.closest(".column");
  if (!column || !dragId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  els.board.querySelectorAll(".is-over").forEach((el) => {
    if (el !== column) el.classList.remove("is-over");
  });
  column.classList.add("is-over");
});

els.board.addEventListener("dragleave", (event) => {
  const column = event.target.closest(".column");
  if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-over");
});

els.board.addEventListener("drop", (event) => {
  const column = event.target.closest(".column");
  if (!column || !dragId) return;
  event.preventDefault();
  const id = dragId;
  dragId = null;
  moveApp(id, column.dataset.status);
  render();
});

//init
applyTheme(document.documentElement.dataset.theme || "light");
buildFilterControls();
render();

if (firstVisit) {
  save();
  toast("Example applications added. Edit or delete them any time.");
}