/* =============================================================
   Keepsake — a small Google Keep clone
   Organized in three parts: STATE, RENDER, EVENTS
   ============================================================= */

(() => {
  "use strict";

  /* ----------------------------------------------------------
     1. STATE
     Notes are persisted to localStorage so they survive reloads.
  ---------------------------------------------------------- */
  const STORAGE_KEY = "keepsake.notes";

  const COLORS = [
    { id: "default", hex: "#ffffff" },
    { id: "coral",   hex: "#f7d8ce" },
    { id: "peach",   hex: "#fbe4c6" },
    { id: "sage",    hex: "#e2ecd6" },
    { id: "sky",     hex: "#d9e9ec" },
    { id: "lilac",   hex: "#e6e0f4" },
    { id: "rose",    hex: "#f6dce7" },
    { id: "tan",     hex: "#ece3d4" },
  ];

  /** @typedef {{id:string, title:string, body:string, color:string, pinned:boolean, status:'active'|'archived'|'trashed', updatedAt:number}} Note */

  /** @type {Note[]} */
  let notes = loadNotes();
  let currentView = "notes";     // 'notes' | 'archive' | 'trash'
  let searchTerm = "";
  let editingId = null;          // note currently open in the modal
  let composerColor = "default";
  let composerPinned = false;
  let lastDeleted = null;        // for the "Undo" toast

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return []; // corrupted storage shouldn't crash the app
    }
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function createNote({ title, body, color, pinned }) {
    /** @type {Note} */
    const note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      body: body.trim(),
      color,
      pinned,
      status: "active",
      updatedAt: Date.now(),
    };
    notes.unshift(note);
    saveNotes();
    return note;
  }

  function updateNote(id, changes) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    Object.assign(note, changes, { updatedAt: Date.now() });
    saveNotes();
  }

  function removeNotePermanently(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
  }

  /* ----------------------------------------------------------
     2. RENDER
  ---------------------------------------------------------- */
  const notesGrid = document.getElementById("notesGrid");
  const emptyState = document.getElementById("emptyState");
  const emptyStateText = document.getElementById("emptyStateText");
  const viewLabel = document.getElementById("viewLabel");
  const composerWrap = document.querySelector(".composer-wrap");

  const EMPTY_MESSAGES = {
    notes: "Notes you add appear here",
    archive: "Your archived notes appear here",
    trash: "No notes in trash",
  };
  const VIEW_LABELS = {
    notes: "Your notes",
    archive: "Archive",
    trash: "Trash",
  };

  function colorHex(id) {
    return (COLORS.find((c) => c.id === id) || COLORS[0]).hex;
  }

  function getVisibleNotes() {
    const statusFilter = currentView === "notes" ? "active" : currentView;
    const term = searchTerm.trim().toLowerCase();

    return notes
      .filter((n) => n.status === statusFilter)
      .filter((n) => !term || `${n.title} ${n.body}`.toLowerCase().includes(term))
      .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const visible = getVisibleNotes();

    // Composer only makes sense on the main notes view.
    composerWrap.hidden = currentView !== "notes";
    viewLabel.textContent = searchTerm ? `Results for "${searchTerm}"` : VIEW_LABELS[currentView];

    notesGrid.innerHTML = "";
    emptyState.hidden = visible.length !== 0;
    emptyStateText.textContent = searchTerm ? "No matching notes" : EMPTY_MESSAGES[currentView];

    const fragment = document.createDocumentFragment();
    visible.forEach((note) => fragment.appendChild(renderNoteCard(note)));
    notesGrid.appendChild(fragment);
  }

  function renderNoteCard(note) {
    const card = document.createElement("article");
    card.className = "note-card" + (note.pinned ? " is-pinned" : "");
    card.style.background = colorHex(note.color);
    card.tabIndex = 0;
    card.dataset.id = note.id;

    const showPin = currentView === "notes";
    const showRestore = currentView !== "notes";

    card.innerHTML = `
      ${note.title ? `<h3 class="note-title">${escapeHtml(note.title)}</h3>` : ""}
      ${note.body ? `<p class="note-body">${escapeHtml(note.body)}</p>` : ""}
      <div class="note-hover-actions">
        ${showPin ? `
          <button class="icon-btn small" data-action="pin" data-tooltip="${note.pinned ? "Unpin note" : "Pin note"}" aria-pressed="${note.pinned}">
            <svg viewBox="0 0 24 24"><path d="M12 2 9 9l-6 1.5L8 15l-1 7 5-4 5 4-1-7 5-4.5L15 9z" stroke="currentColor" stroke-width="1.5" fill="${note.pinned ? "currentColor" : "none"}" stroke-linejoin="round"/></svg>
          </button>` : ""}
        ${currentView === "notes" ? `
          <button class="icon-btn small" data-action="archive" data-tooltip="Archive">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>
          </button>` : ""}
        ${showRestore ? `
          <button class="icon-btn small" data-action="restore" data-tooltip="Restore">
            <svg viewBox="0 0 24 24"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14a8 8 0 1 0 2-8.6L4 10M19 10l1.5-4.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>` : ""}
        <button class="icon-btn small" data-action="delete" data-tooltip="${currentView === 'trash' ? 'Delete forever' : 'Delete'}">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
    return card;
  }

  function buildSwatches(container, selectedColor, onPick) {
    container.innerHTML = "";
    COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch" + (c.id === selectedColor ? " is-selected" : "");
      btn.style.background = c.hex;
      btn.dataset.color = c.id;
      btn.setAttribute("data-tooltip", c.id[0].toUpperCase() + c.id.slice(1));
      btn.setAttribute("aria-label", `Color: ${c.id}`);
      btn.addEventListener("click", () => onPick(c.id));
      container.appendChild(btn);
    });
  }

  function showToast(message, { actionLabel, onAction } = {}) {
    const toast = document.getElementById("toast");
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (actionLabel) {
      const btn = document.createElement("button");
      btn.textContent = actionLabel;
      btn.addEventListener("click", () => {
        onAction?.();
        hideToast();
      });
      toast.appendChild(btn);
    }
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(hideToast, 5000);
  }
  function hideToast() {
    document.getElementById("toast").hidden = true;
  }

  /* ----------------------------------------------------------
     3. EVENTS
  ---------------------------------------------------------- */

  // --- Sidebar navigation ---
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".nav-item.is-active")?.classList.remove("is-active");
      btn.classList.add("is-active");
      currentView = btn.dataset.view;
      render();
    });
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("is-open");
  });

  // --- Grid / list toggle (visual density) ---
  const gridToggle = document.getElementById("gridToggle");
  gridToggle.addEventListener("click", () => {
    const listMode = notesGrid.classList.toggle("list-mode");
    notesGrid.style.columnWidth = listMode ? "100%" : "";
    gridToggle.setAttribute("data-tooltip", listMode ? "View: list" : "View: grid");
  });

  // --- Search ---
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  // --- Composer (create note) ---
  const composerForm = document.getElementById("composerForm");
  const composerTitle = document.getElementById("composerTitle");
  const composerBody = document.getElementById("composerBody");
  const composerPinBtn = document.getElementById("composerPin");
  const composerColorsEl = document.getElementById("composerColors");

  function expandComposer() {
    composerForm.dataset.expanded = "true";
  }
  function pickComposerColor(id) {
    composerColor = id;
    buildSwatches(composerColorsEl, composerColor, pickComposerColor);
  }

  function resetComposer() {
    composerForm.reset();
    composerForm.dataset.expanded = "false";
    composerColor = "default";
    composerPinned = false;
    composerPinBtn.setAttribute("aria-pressed", "false");
    buildSwatches(composerColorsEl, composerColor, pickComposerColor);
    autoGrow(composerBody);
  }

  buildSwatches(composerColorsEl, composerColor, pickComposerColor);

  composerBody.addEventListener("focus", expandComposer);
  composerTitle.addEventListener("focus", expandComposer);
  composerBody.addEventListener("input", () => autoGrow(composerBody));

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  composerPinBtn.addEventListener("click", () => {
    composerPinned = !composerPinned;
    composerPinBtn.setAttribute("aria-pressed", String(composerPinned));
  });

  document.getElementById("composerClose").addEventListener("click", resetComposer);

  composerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = composerTitle.value;
    const body = composerBody.value;
    if (!title.trim() && !body.trim()) {
      resetComposer();
      return;
    }
    createNote({ title, body, color: composerColor, pinned: composerPinned });
    resetComposer();
    render();
  });

  // Click outside the expanded composer collapses it (only if empty).
  document.addEventListener("click", (e) => {
    if (composerForm.dataset.expanded === "true" && !composerForm.contains(e.target)) {
      if (!composerTitle.value.trim() && !composerBody.value.trim()) {
        resetComposer();
      } else {
        composerForm.requestSubmit();
      }
    }
  });

  // --- Note card actions (event delegation) ---
  notesGrid.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    const card = e.target.closest(".note-card");
    if (!card) return;
    const id = card.dataset.id;

    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      if (action === "pin") {
        const note = notes.find((n) => n.id === id);
        updateNote(id, { pinned: !note.pinned });
        render();
      } else if (action === "archive") {
        updateNote(id, { status: "archived" });
        render();
        showToast("Note archived");
      } else if (action === "restore") {
        updateNote(id, { status: "active" });
        render();
        showToast("Note restored");
      } else if (action === "delete") {
        if (currentView === "trash") {
          removeNotePermanently(id);
          render();
        } else {
          const note = notes.find((n) => n.id === id);
          lastDeleted = { ...note };
          updateNote(id, { status: "trashed" });
          render();
          showToast("Note moved to trash", {
            actionLabel: "Undo",
            onAction: () => {
              if (lastDeleted) updateNote(lastDeleted.id, { status: lastDeleted.status });
              render();
            },
          });
        }
      }
      return;
    }

    // Otherwise open the note in the edit modal.
    openModal(id);
  });

  // --- Edit modal ---
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalPinBtn = document.getElementById("modalPin");
  const modalColorsEl = document.getElementById("modalColors");
  const modalArchiveBtn = document.getElementById("modalArchive");
  const modalDeleteBtn = document.getElementById("modalDelete");

  function pickModalColor(colorId) {
    updateNote(editingId, { color: colorId });
    buildSwatches(modalColorsEl, colorId, pickModalColor);
  }

  function openModal(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    editingId = id;
    modalTitle.value = note.title;
    modalBody.value = note.body;
    modalPinBtn.setAttribute("aria-pressed", String(note.pinned));
    buildSwatches(modalColorsEl, note.color, pickModalColor);
    modalOverlay.hidden = false;
    modalTitle.focus();
  }

  function closeModal() {
    if (editingId) {
      updateNote(editingId, { title: modalTitle.value, body: modalBody.value });
    }
    editingId = null;
    modalOverlay.hidden = true;
    render();
  }

  modalPinBtn.addEventListener("click", () => {
    const note = notes.find((n) => n.id === editingId);
    const next = !note.pinned;
    updateNote(editingId, { pinned: next });
    modalPinBtn.setAttribute("aria-pressed", String(next));
  });

  modalArchiveBtn.addEventListener("click", () => {
    updateNote(editingId, { status: "archived" });
    closeModal();
    showToast("Note archived");
  });

  modalDeleteBtn.addEventListener("click", () => {
    updateNote(editingId, { status: "trashed" });
    closeModal();
    showToast("Note moved to trash");
  });

  document.getElementById("modalDone").addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });

  /* ----------------------------------------------------------
     Init
  ---------------------------------------------------------- */
  resetComposer();
  render();
})();