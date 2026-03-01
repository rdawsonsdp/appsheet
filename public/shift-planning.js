/* =================================================================
   shift-planning.js — Shift checklist creation, history, and task
   template management. All data persisted to localStorage.
   ================================================================= */

'use strict';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const HOUSES = [
  { key: 'front',  label: 'Front of House' },
  { key: 'middle', label: 'Middle of House' },
  { key: 'back',   label: 'Back of House' },
];

const SEED_EMPLOYEES = [
  { id: 'e1', name: 'Maria',  house: 'front' },
  { id: 'e2', name: 'James',  house: 'back' },
  { id: 'e3', name: 'Sophie', house: 'middle' },
];

const SEED_TEMPLATES = [
  { id: 't1', title: 'Organize receipts',      house: 'front',  sortOrder: 0 },
  { id: 't2', title: 'Fill ice boxes',          house: 'front',  sortOrder: 1 },
  { id: 't3', title: 'Restock display case',    house: 'front',  sortOrder: 2 },
  { id: 't4', title: 'Cut cakes',               house: 'middle', sortOrder: 0 },
  { id: 't5', title: 'Portion desserts',         house: 'middle', sortOrder: 1 },
  { id: 't6', title: 'Bake bread',              house: 'back',   sortOrder: 0 },
  { id: 't7', title: 'Prep icing',              house: 'back',   sortOrder: 1 },
  { id: 't8', title: 'Clean ovens',             house: 'back',   sortOrder: 2 },
];

// ----------------------------------------------------------------
// Data Layer (localStorage)
// ----------------------------------------------------------------
function loadTemplates() {
  const raw = localStorage.getItem('shiftTaskTemplates');
  if (raw) return JSON.parse(raw);
  // First load — seed with sample tasks
  saveTemplates(SEED_TEMPLATES);
  return SEED_TEMPLATES;
}

function saveTemplates(templates) {
  localStorage.setItem('shiftTaskTemplates', JSON.stringify(templates));
}

function loadChecklists() {
  const raw = localStorage.getItem('shiftChecklists');
  return raw ? JSON.parse(raw) : [];
}

function saveChecklists(checklists) {
  localStorage.setItem('shiftChecklists', JSON.stringify(checklists));
}

function loadEmployees() {
  const raw = localStorage.getItem('shiftEmployees');
  if (raw) return JSON.parse(raw);
  saveEmployees(SEED_EMPLOYEES);
  return [...SEED_EMPLOYEES];
}

function saveEmployees(employees) {
  localStorage.setItem('shiftEmployees', JSON.stringify(employees));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let templates   = [];
let checklists  = [];
let employees   = [];
let currentView = 'create'; // 'create' | 'history' | 'admin'

// Create-view state: which template task IDs are checked
let selectedTaskIds = new Set();
// Custom tasks added in Create view: [{ id, title, house }]
let customTasks = [];
// Per-house notes: { front: '', middle: '', back: '' }
let houseNotes = { front: '', middle: '', back: '' };
// Assignee map: { taskId: employeeId }
let taskAssignments = {};

// ----------------------------------------------------------------
// DOM refs
// ----------------------------------------------------------------
const viewCreate     = document.getElementById('viewCreate');
const viewHistory    = document.getElementById('viewHistory');
const viewAdmin      = document.getElementById('viewAdmin');
const houseSections  = document.getElementById('houseSections');
const historyList    = document.getElementById('historyList');
const templateSections  = document.getElementById('templateSections');
const employeeSections  = document.getElementById('employeeSections');
const shiftDate      = document.getElementById('shiftDate');
const shiftType      = document.getElementById('shiftType');
const shiftNotes     = document.getElementById('shiftNotes');
const shiftTaskCount = document.getElementById('shiftTaskCount');
const shiftPrintBtn  = document.getElementById('shiftPrintBtn');
const shiftSaveBtn   = document.getElementById('shiftSaveBtn');
const shiftActionBar = document.getElementById('shiftActionBar');
const printContainer    = document.getElementById('printContainer');
const printChecklistBtn = document.getElementById('printChecklistBtn');
const toast             = document.getElementById('toast');

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  templates  = loadTemplates();
  checklists = loadChecklists();
  employees  = loadEmployees();

  // Default date to today
  shiftDate.value = new Date().toISOString().slice(0, 10);

  bindViewTabs();
  bindActionBar();
  renderCreateView();
});

// ----------------------------------------------------------------
// View Tab Switching
// ----------------------------------------------------------------
function bindViewTabs() {
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view === currentView) return;
      currentView = view;

      document.querySelectorAll('.view-tab').forEach(t => {
        const isActive = t.dataset.view === view;
        t.classList.toggle('view-tab--active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });

      viewCreate.hidden  = view !== 'create';
      viewHistory.hidden = view !== 'history';
      viewAdmin.hidden   = view !== 'admin';

      // Show/hide action bar (only on create view)
      shiftActionBar.hidden = view !== 'create';

      if (view === 'create')  renderCreateView();
      if (view === 'history') renderHistoryView();
      if (view === 'admin')   renderAdminView();
    });
  });
}

// ----------------------------------------------------------------
// Action Bar
// ----------------------------------------------------------------
function bindActionBar() {
  shiftPrintBtn.addEventListener('click', printChecklist);
  shiftSaveBtn.addEventListener('click', saveChecklist);
  printChecklistBtn.addEventListener('click', printChecklist);
}

function updateActionBar() {
  const total = selectedTaskIds.size + customTasks.filter(ct => selectedTaskIds.has(ct.id)).length;
  // Count: selected template tasks + all custom tasks (custom tasks are always included)
  const count = selectedTaskIds.size;
  shiftTaskCount.innerHTML = `<strong>${count}</strong> task${count !== 1 ? 's' : ''} selected`;
  shiftPrintBtn.disabled      = count === 0;
  shiftSaveBtn.disabled       = count === 0;
  printChecklistBtn.disabled  = count === 0;
}

// ----------------------------------------------------------------
// CREATE CHECKLIST VIEW
// ----------------------------------------------------------------
function buildAssigneeSelect(houseKey, taskId) {
  const houseEmployees = employees.filter(e => e.house === houseKey);
  const currentAssignee = taskAssignments[taskId] || '';
  let html = `<select class="task-assign-select" data-task-id="${taskId}">`;
  html += `<option value="">Unassigned</option>`;
  houseEmployees.forEach(e => {
    html += `<option value="${e.id}" ${currentAssignee === e.id ? 'selected' : ''}>${escHtml(e.name)}</option>`;
  });
  html += `</select>`;
  return html;
}

function renderCreateView() {
  templates = loadTemplates(); // refresh
  employees = loadEmployees(); // refresh
  houseSections.innerHTML = '';

  HOUSES.forEach(house => {
    const houseTasks = templates
      .filter(t => t.house === house.key)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const houseCustom = customTasks.filter(ct => ct.house === house.key);
    const selectedCount = houseTasks.filter(t => selectedTaskIds.has(t.id)).length
                        + houseCustom.filter(ct => selectedTaskIds.has(ct.id)).length;

    const section = document.createElement('div');
    section.className = 'house-section';
    section.innerHTML = `
      <button class="house-toggle" aria-expanded="true" data-house="${house.key}">
        <span>
          ${escHtml(house.label)}
          <span class="house-badge ${selectedCount > 0 ? '' : 'house-badge--hidden'}">${selectedCount} selected</span>
        </span>
        <span class="arrow" aria-hidden="true">&#9660;</span>
      </button>
      <div class="house-panel" data-house="${house.key}">
        ${houseTasks.map(t => `
          <div class="task-check-row">
            <label class="task-check-row-label">
              <input type="checkbox" value="${t.id}" ${selectedTaskIds.has(t.id) ? 'checked' : ''}>
              <span class="task-check-label">${escHtml(t.title)}</span>
            </label>
            ${buildAssigneeSelect(house.key, t.id)}
          </div>
        `).join('')}
        ${houseCustom.map(ct => `
          <div class="task-check-row task-check-row--custom">
            <label class="task-check-row-label">
              <input type="checkbox" value="${ct.id}" checked>
              <span class="task-check-label">${escHtml(ct.title)}</span>
            </label>
            ${buildAssigneeSelect(house.key, ct.id)}
            <button class="task-remove-btn" data-custom-id="${ct.id}" title="Remove custom task" aria-label="Remove custom task">&times;</button>
          </div>
        `).join('')}
        <form class="custom-task-form" data-house="${house.key}">
          <input type="text" placeholder="Add custom task..." class="custom-task-input" aria-label="Add custom task to ${house.label}">
          <button type="submit" class="custom-task-add-btn">+ Add</button>
        </form>
        <div class="house-notes">
          <label class="house-notes-label" for="houseNotes_${house.key}">Notes</label>
          <textarea class="house-notes-input" id="houseNotes_${house.key}" data-house="${house.key}" rows="5" placeholder="Add additional notes here">${escHtml(houseNotes[house.key] || '')}</textarea>
        </div>
      </div>
    `;

    houseSections.appendChild(section);
  });

  // Bind events
  houseSections.querySelectorAll('.house-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const panel = btn.nextElementSibling;
      panel.hidden = expanded;
    });
  });

  houseSections.querySelectorAll('.task-check-row input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selectedTaskIds.add(cb.value);
      } else {
        selectedTaskIds.delete(cb.value);
      }
      updateBadges();
      updateActionBar();
    });
  });

  // Bind assignee dropdowns
  houseSections.querySelectorAll('.task-assign-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const taskId = sel.dataset.taskId;
      if (sel.value) {
        taskAssignments[taskId] = sel.value;
      } else {
        delete taskAssignments[taskId];
      }
    });
  });

  houseSections.querySelectorAll('.task-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const customId = btn.dataset.customId;
      customTasks = customTasks.filter(ct => ct.id !== customId);
      selectedTaskIds.delete(customId);
      renderCreateView();
      updateActionBar();
    });
  });

  houseSections.querySelectorAll('.custom-task-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.custom-task-input');
      const title = input.value.trim();
      if (!title) return;
      const houseKey = form.dataset.house;
      const ct = { id: generateId(), title, house: houseKey };
      customTasks.push(ct);
      selectedTaskIds.add(ct.id);
      input.value = '';
      renderCreateView();
      updateActionBar();
    });
  });

  // Bind house notes — save to state on input
  houseSections.querySelectorAll('.house-notes-input').forEach(textarea => {
    textarea.addEventListener('input', () => {
      houseNotes[textarea.dataset.house] = textarea.value;
    });
  });

  updateActionBar();
}

function updateBadges() {
  HOUSES.forEach(house => {
    const houseTasks = templates.filter(t => t.house === house.key);
    const houseCustom = customTasks.filter(ct => ct.house === house.key);
    const count = houseTasks.filter(t => selectedTaskIds.has(t.id)).length
                + houseCustom.filter(ct => selectedTaskIds.has(ct.id)).length;
    const badge = houseSections.querySelector(`.house-toggle[data-house="${house.key}"] .house-badge`);
    if (badge) {
      badge.textContent = `${count} selected`;
      badge.classList.toggle('house-badge--hidden', count === 0);
    }
  });
}

// ----------------------------------------------------------------
// SAVE CHECKLIST
// ----------------------------------------------------------------
function saveChecklist() {
  const items = gatherSelectedItems();
  if (items.length === 0) return;

  const checklist = {
    id: generateId(),
    shiftDate: shiftDate.value,
    shiftType: shiftType.value,
    notes: shiftNotes.value.trim(),
    houseNotes: { ...houseNotes },
    createdAt: new Date().toISOString(),
    items: items.map(item => ({
      id: generateId(),
      title: item.title,
      house: item.house,
      isCompleted: false,
      isCustom: item.isCustom,
      assigneeId: item.assigneeId || null,
      assigneeName: item.assigneeName || '',
    })),
  };

  checklists.push(checklist);
  saveChecklists(checklists);

  // Reset form
  selectedTaskIds.clear();
  customTasks = [];
  taskAssignments = {};
  houseNotes = { front: '', middle: '', back: '' };
  shiftNotes.value = '';
  renderCreateView();
  updateActionBar();

  showToast('Checklist saved!');
}

function gatherSelectedItems() {
  const items = [];

  // Template tasks
  templates.forEach(t => {
    if (selectedTaskIds.has(t.id)) {
      const assigneeId = taskAssignments[t.id] || null;
      const assignee = assigneeId ? employees.find(e => e.id === assigneeId) : null;
      items.push({
        title: t.title,
        house: t.house,
        isCustom: false,
        assigneeId: assigneeId,
        assigneeName: assignee ? assignee.name : '',
      });
    }
  });

  // Custom tasks
  customTasks.forEach(ct => {
    if (selectedTaskIds.has(ct.id)) {
      const assigneeId = taskAssignments[ct.id] || null;
      const assignee = assigneeId ? employees.find(e => e.id === assigneeId) : null;
      items.push({
        title: ct.title,
        house: ct.house,
        isCustom: true,
        assigneeId: assigneeId,
        assigneeName: assignee ? assignee.name : '',
      });
    }
  });

  return items;
}

// ----------------------------------------------------------------
// PRINT CHECKLIST
// ----------------------------------------------------------------
function printChecklist() {
  const items = gatherSelectedItems();
  if (items.length === 0) return;

  const dateStr = shiftDate.value
    ? new Date(shiftDate.value + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date';
  const typeStr = shiftType.value;
  const notes = shiftNotes.value.trim();
  const now = new Date();
  const printedAt = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  let html = '';

  HOUSES.forEach(house => {
    const houseItems = items.filter(i => i.house === house.key);
    if (houseItems.length === 0) return;

    const hn = (houseNotes[house.key] || '').trim();
    html += `<div class="print-shift-checklist print-shift-page">
      <h1 class="print-shift-title">Shift Checklist — ${escHtml(house.label)}</h1>
      <div class="print-shift-meta">
        <span><strong>Date:</strong> ${escHtml(dateStr)}</span>
        <span><strong>Shift:</strong> ${escHtml(typeStr)}</span>
      </div>
      <div class="print-shift-timestamp">Printed: ${escHtml(printedAt)}</div>
      ${notes ? `<div class="print-shift-notes"><strong>Shift Notes:</strong> ${escHtml(notes)}</div>` : ''}
      <table class="print-shift-table">
        <thead><tr><th class="print-check-col"></th><th>Task</th><th class="print-assign-col">Assigned</th></tr></thead>
        <tbody>
          ${houseItems.map(i => `<tr>
            <td class="print-check-col"></td>
            <td>${escHtml(i.title)}${i.isCustom ? ' <em>(custom)</em>' : ''}</td>
            <td class="print-assign-col">${escHtml(i.assigneeName || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${hn ? `<div class="print-shift-notes"><strong>Notes:</strong> ${escHtml(hn)}</div>` : ''}
    </div>`;
  });

  printContainer.innerHTML = html;
  setTimeout(() => window.print(), 100);
}

// ----------------------------------------------------------------
// PAST CHECKLISTS VIEW (History)
// ----------------------------------------------------------------
function renderHistoryView() {
  checklists = loadChecklists(); // refresh
  historyList.innerHTML = '';

  if (checklists.length === 0) {
    historyList.innerHTML = `
      <div class="state-msg">
        <span class="icon" aria-hidden="true">&#128203;</span>
        <p>No saved checklists yet.</p>
        <p style="font-size:0.875rem;margin-top:8px;color:var(--color-text-secondary);">Create and save a checklist to see it here.</p>
      </div>`;
    return;
  }

  // Sort newest-first
  const sorted = [...checklists].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sorted.forEach(cl => {
    const completedCount = cl.items.filter(i => i.isCompleted).length;
    const totalCount = cl.items.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const dateStr = cl.shiftDate
      ? new Date(cl.shiftDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No date';

    const card = document.createElement('div');
    card.className = 'checklist-card';
    card.dataset.id = cl.id;

    card.innerHTML = `
      <div class="checklist-card-header" data-id="${cl.id}">
        <div class="checklist-card-info">
          <span class="checklist-card-date">${escHtml(dateStr)}</span>
          <span class="shift-type-badge shift-type-badge--${cl.shiftType.toLowerCase().replace(' ', '')}">${escHtml(cl.shiftType)}</span>
          <span class="checklist-card-count">${totalCount} task${totalCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="checklist-card-progress">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="progress-text">${completedCount}/${totalCount}</span>
        </div>
        <span class="checklist-card-arrow" aria-hidden="true">&#9654;</span>
      </div>
      <div class="checklist-card-body" data-id="${cl.id}" hidden>
        ${cl.notes ? `<div class="checklist-card-notes"><strong>Notes:</strong> ${escHtml(cl.notes)}</div>` : ''}
        ${renderHistoryItems(cl)}
        <div class="checklist-card-actions">
          <button class="btn-history-print" data-id="${cl.id}">Print</button>
          <button class="btn-history-delete" data-id="${cl.id}">Delete</button>
        </div>
      </div>
    `;

    historyList.appendChild(card);
  });

  // Bind expand/collapse
  historyList.querySelectorAll('.checklist-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const id = header.dataset.id;
      const body = historyList.querySelector(`.checklist-card-body[data-id="${id}"]`);
      const arrow = header.querySelector('.checklist-card-arrow');
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
    });
  });

  // Bind completion toggles
  historyList.querySelectorAll('.history-task-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const clId = cb.dataset.checklistId;
      const itemId = cb.dataset.itemId;
      const cl = checklists.find(c => c.id === clId);
      if (!cl) return;
      const item = cl.items.find(i => i.id === itemId);
      if (!item) return;
      item.isCompleted = cb.checked;
      saveChecklists(checklists);
      renderHistoryView(); // re-render to update progress
    });
  });

  // Bind print
  historyList.querySelectorAll('.btn-history-print').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      printHistoryChecklist(btn.dataset.id);
    });
  });

  // Bind delete
  historyList.querySelectorAll('.btn-history-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this checklist?')) return;
      checklists = checklists.filter(c => c.id !== btn.dataset.id);
      saveChecklists(checklists);
      renderHistoryView();
      showToast('Checklist deleted');
    });
  });
}

function renderHistoryItems(cl) {
  let html = '';
  HOUSES.forEach(house => {
    const items = cl.items.filter(i => i.house === house.key);
    if (items.length === 0) return;
    html += `<div class="history-house-label">${escHtml(house.label)}</div>`;
    items.forEach(item => {
      const assigneeTag = item.assigneeName
        ? ` <span class="history-assignee">${escHtml(item.assigneeName)}</span>`
        : '';
      html += `
        <label class="task-check-row ${item.isCompleted ? 'task-check-row--completed' : ''}">
          <input type="checkbox" class="history-task-check" data-checklist-id="${cl.id}" data-item-id="${item.id}" ${item.isCompleted ? 'checked' : ''}>
          <span class="task-check-label">${escHtml(item.title)}${item.isCustom ? ' <em>(custom)</em>' : ''}${assigneeTag}</span>
        </label>
      `;
    });
  });
  return html;
}

function printHistoryChecklist(clId) {
  const cl = checklists.find(c => c.id === clId);
  if (!cl) return;

  const dateStr = cl.shiftDate
    ? new Date(cl.shiftDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date';
  const now = new Date();
  const printedAt = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  let html = '';

  HOUSES.forEach(house => {
    const items = cl.items.filter(i => i.house === house.key);
    if (items.length === 0) return;
    const hn = ((cl.houseNotes || {})[house.key] || '').trim();
    html += `<div class="print-shift-checklist print-shift-page">
      <h1 class="print-shift-title">Shift Checklist — ${escHtml(house.label)}</h1>
      <div class="print-shift-meta">
        <span><strong>Date:</strong> ${escHtml(dateStr)}</span>
        <span><strong>Shift:</strong> ${escHtml(cl.shiftType)}</span>
      </div>
      <div class="print-shift-timestamp">Printed: ${escHtml(printedAt)}</div>
      ${cl.notes ? `<div class="print-shift-notes"><strong>Shift Notes:</strong> ${escHtml(cl.notes)}</div>` : ''}
      <table class="print-shift-table">
        <thead><tr><th class="print-check-col"></th><th>Task</th><th class="print-assign-col">Assigned</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr>
            <td class="print-check-col"></td>
            <td>${escHtml(i.title)}${i.isCustom ? ' <em>(custom)</em>' : ''}</td>
            <td class="print-assign-col">${escHtml(i.assigneeName || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${hn ? `<div class="print-shift-notes"><strong>Notes:</strong> ${escHtml(hn)}</div>` : ''}
    </div>`;
  });

  printContainer.innerHTML = html;
  setTimeout(() => window.print(), 100);
}

// ----------------------------------------------------------------
// MANAGE TASKS VIEW (Templates)
// ----------------------------------------------------------------
function renderAdminView() {
  renderTemplatesSection();
  renderEmployeesSection();
}

function renderTemplatesSection() {
  templates = loadTemplates(); // refresh
  templateSections.innerHTML = '';

  HOUSES.forEach(house => {
    const houseTasks = templates
      .filter(t => t.house === house.key)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const section = document.createElement('div');
    section.className = 'house-section';
    section.innerHTML = `
      <button class="house-toggle" aria-expanded="true" data-house="${house.key}">
        <span>${escHtml(house.label)} <span class="house-badge">${houseTasks.length} task${houseTasks.length !== 1 ? 's' : ''}</span></span>
        <span class="arrow" aria-hidden="true">&#9660;</span>
      </button>
      <div class="house-panel" data-house="${house.key}">
        ${houseTasks.map(t => `
          <div class="template-row" data-id="${t.id}">
            <input type="text" class="template-title-input" value="${escAttr(t.title)}" data-id="${t.id}">
            <button class="template-delete-btn" data-id="${t.id}" title="Delete task" aria-label="Delete task">&times;</button>
          </div>
        `).join('')}
        <form class="custom-task-form" data-house="${house.key}">
          <input type="text" placeholder="Add new task..." class="custom-task-input" aria-label="Add task to ${house.label}">
          <button type="submit" class="custom-task-add-btn">+ Add</button>
        </form>
      </div>
    `;

    templateSections.appendChild(section);
  });

  // Bind toggle
  templateSections.querySelectorAll('.house-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.nextElementSibling.hidden = expanded;
    });
  });

  // Bind title editing (save on blur)
  templateSections.querySelectorAll('.template-title-input').forEach(input => {
    input.addEventListener('blur', () => {
      const id = input.dataset.id;
      const newTitle = input.value.trim();
      if (!newTitle) {
        const t = templates.find(t => t.id === id);
        if (t) input.value = t.title;
        return;
      }
      const t = templates.find(t => t.id === id);
      if (t && t.title !== newTitle) {
        t.title = newTitle;
        saveTemplates(templates);
      }
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });

  // Bind delete
  templateSections.querySelectorAll('.template-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      templates = templates.filter(t => t.id !== id);
      saveTemplates(templates);
      renderTemplatesSection();
      showToast('Task deleted');
    });
  });

  // Bind add
  templateSections.querySelectorAll('.custom-task-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.custom-task-input');
      const title = input.value.trim();
      if (!title) return;
      const houseKey = form.dataset.house;
      const houseTasks = templates.filter(t => t.house === houseKey);
      const maxSort = houseTasks.length > 0 ? Math.max(...houseTasks.map(t => t.sortOrder)) + 1 : 0;
      templates.push({
        id: generateId(),
        title,
        house: houseKey,
        sortOrder: maxSort,
      });
      saveTemplates(templates);
      input.value = '';
      renderTemplatesSection();
      showToast('Task added');
    });
  });
}

function renderEmployeesSection() {
  employees = loadEmployees(); // refresh
  employeeSections.innerHTML = '';

  HOUSES.forEach(house => {
    const houseEmps = employees.filter(e => e.house === house.key);

    const section = document.createElement('div');
    section.className = 'house-section';
    section.innerHTML = `
      <button class="house-toggle" aria-expanded="true" data-house="${house.key}">
        <span>${escHtml(house.label)} <span class="house-badge">${houseEmps.length} employee${houseEmps.length !== 1 ? 's' : ''}</span></span>
        <span class="arrow" aria-hidden="true">&#9660;</span>
      </button>
      <div class="house-panel" data-house="${house.key}">
        ${houseEmps.map(e => `
          <div class="template-row" data-id="${e.id}">
            <input type="text" class="employee-name-input" value="${escAttr(e.name)}" data-id="${e.id}">
            <button class="employee-delete-btn" data-id="${e.id}" title="Delete employee" aria-label="Delete employee">&times;</button>
          </div>
        `).join('')}
        <form class="custom-task-form employee-add-form" data-house="${house.key}">
          <input type="text" placeholder="Add employee..." class="custom-task-input" aria-label="Add employee to ${house.label}">
          <button type="submit" class="custom-task-add-btn">+ Add</button>
        </form>
      </div>
    `;

    employeeSections.appendChild(section);
  });

  // Bind toggle
  employeeSections.querySelectorAll('.house-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.nextElementSibling.hidden = expanded;
    });
  });

  // Bind name editing (save on blur)
  employeeSections.querySelectorAll('.employee-name-input').forEach(input => {
    input.addEventListener('blur', () => {
      const id = input.dataset.id;
      const newName = input.value.trim();
      if (!newName) {
        const e = employees.find(e => e.id === id);
        if (e) input.value = e.name;
        return;
      }
      const e = employees.find(e => e.id === id);
      if (e && e.name !== newName) {
        e.name = newName;
        saveEmployees(employees);
      }
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });

  // Bind delete
  employeeSections.querySelectorAll('.employee-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      employees = employees.filter(e => e.id !== id);
      saveEmployees(employees);
      renderEmployeesSection();
      showToast('Employee deleted');
    });
  });

  // Bind add
  employeeSections.querySelectorAll('.employee-add-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.custom-task-input');
      const name = input.value.trim();
      if (!name) return;
      const houseKey = form.dataset.house;
      employees.push({
        id: generateId(),
        name,
        house: houseKey,
      });
      saveEmployees(employees);
      input.value = '';
      renderEmployeesSection();
      showToast('Employee added');
    });
  });
}

// ----------------------------------------------------------------
// Toast
// ----------------------------------------------------------------
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2500);
}

// ----------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}
