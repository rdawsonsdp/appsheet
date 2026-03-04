/* =================================================================
   management.js — Station SOP Runbook system. View, edit, and print
   station duty cards. All data persisted to localStorage.
   ================================================================= */

'use strict';

// ----------------------------------------------------------------
// Seed Data — 4 Stations from the SOP PDF
// ----------------------------------------------------------------
const SEED_STATIONS = [
  {
    id: 's1', name: 'CASHIER 1', sortOrder: 0,
    sections: [
      { id: 'c1s1', name: 'Opening Duties', sortOrder: 0, tasks: [
        { id: 'c1s1t1', text: 'Arrive 15 minutes before shift; clock in and put on apron and gloves', sortOrder: 0 },
        { id: 'c1s1t2', text: 'Turn on register, verify starting cash drawer ($150 in small bills and coins)', sortOrder: 1 },
        { id: 'c1s1t3', text: 'Unlock front door and flip OPEN sign at scheduled opening time', sortOrder: 2 },
        { id: 'c1s1t4', text: 'Check display case lighting and temperature (must read 38–40 °F)', sortOrder: 3 },
        { id: 'c1s1t5', text: 'Review daily specials sheet and confirm pricing on menu board', sortOrder: 4 },
      ]},
      { id: 'c1s2', name: 'Register Operations', sortOrder: 1, tasks: [
        { id: 'c1s2t1', text: 'Greet every customer within 5 seconds of approaching the counter', sortOrder: 0 },
        { id: 'c1s2t2', text: 'Ring up all items accurately; read back order total before accepting payment', sortOrder: 1 },
        { id: 'c1s2t3', text: 'Process cash, credit, and mobile payments; always offer receipt', sortOrder: 2 },
        { id: 'c1s2t4', text: 'Apply discounts or promo codes only with manager approval on file', sortOrder: 3 },
        { id: 'c1s2t5', text: 'Keep register area clear of personal items and clutter at all times', sortOrder: 4 },
      ]},
      { id: 'c1s3', name: 'Customer Service', sortOrder: 2, tasks: [
        { id: 'c1s3t1', text: 'Upsell featured item or drink with every order ("Have you tried our…?")', sortOrder: 0 },
        { id: 'c1s3t2', text: 'Handle customer complaints calmly; escalate to manager if unresolved in 2 minutes', sortOrder: 1 },
        { id: 'c1s3t3', text: 'Offer samples of the daily special to undecided customers', sortOrder: 2 },
        { id: 'c1s3t4', text: 'Bag items carefully — tissue paper for cakes, branded bags for pastries', sortOrder: 3 },
        { id: 'c1s3t5', text: 'Thank every customer by name if known; say "See you next time!"', sortOrder: 4 },
      ]},
      { id: 'c1s4', name: 'Display Case Maintenance', sortOrder: 3, tasks: [
        { id: 'c1s4t1', text: 'Rotate product every 2 hours — move older items forward', sortOrder: 0 },
        { id: 'c1s4t2', text: 'Replace any item that looks dry, cracked, or melted', sortOrder: 1 },
        { id: 'c1s4t3', text: 'Wipe down glass inside and out with glass cleaner every 2 hours', sortOrder: 2 },
        { id: 'c1s4t4', text: 'Refill price labels and tent cards when product is restocked', sortOrder: 3 },
      ]},
      { id: 'c1s5', name: 'Cleaning & Sanitation', sortOrder: 4, tasks: [
        { id: 'c1s5t1', text: 'Wipe counter surfaces with food-safe sanitizer every 30 minutes', sortOrder: 0 },
        { id: 'c1s5t2', text: 'Empty lobby trash cans when ¾ full; replace liner', sortOrder: 1 },
        { id: 'c1s5t3', text: 'Sweep front-of-house floor every 2 hours or after visible spill', sortOrder: 2 },
        { id: 'c1s5t4', text: 'Restock napkins, straws, and utensil station as needed', sortOrder: 3 },
      ]},
      { id: 'c1s6', name: 'Closing Duties', sortOrder: 5, tasks: [
        { id: 'c1s6t1', text: 'Lock front door and flip sign to CLOSED at scheduled closing time', sortOrder: 0 },
        { id: 'c1s6t2', text: 'Run register Z-report and count cash drawer; note any discrepancy', sortOrder: 1 },
        { id: 'c1s6t3', text: 'Wrap and label remaining display items; store in walk-in cooler', sortOrder: 2 },
        { id: 'c1s6t4', text: 'Mop front-of-house floor with approved cleaning solution', sortOrder: 3 },
      ]},
    ],
  },
  {
    id: 's2', name: 'CASHIER 2', sortOrder: 1,
    sections: [
      { id: 'c2s1', name: 'Opening Support', sortOrder: 0, tasks: [
        { id: 'c2s1t1', text: 'Arrive on time; clock in and put on apron and gloves', sortOrder: 0 },
        { id: 'c2s1t2', text: 'Brew first batch of coffee and hot water for tea (by opening time)', sortOrder: 1 },
        { id: 'c2s1t3', text: 'Set out cream, sugar, stirrers, and cup sleeves at drink station', sortOrder: 2 },
      ]},
      { id: 'c2s2', name: 'Drink Station', sortOrder: 1, tasks: [
        { id: 'c2s2t1', text: 'Monitor coffee levels — brew new pot when ¼ full (never let it run out)', sortOrder: 0 },
        { id: 'c2s2t2', text: 'Prepare specialty drinks (lattes, iced coffee) per recipe card', sortOrder: 1 },
        { id: 'c2s2t3', text: 'Keep drink station wiped down; no spills, no sticky surfaces', sortOrder: 2 },
      ]},
      { id: 'c2s3', name: 'Order Assembly', sortOrder: 2, tasks: [
        { id: 'c2s3t1', text: 'Assemble phone and online orders within 10 minutes of receipt', sortOrder: 0 },
        { id: 'c2s3t2', text: 'Double-check order slip against items before sealing bag', sortOrder: 1 },
        { id: 'c2s3t3', text: 'Attach printed order label to outside of every pickup bag', sortOrder: 2 },
      ]},
      { id: 'c2s4', name: 'Restocking', sortOrder: 3, tasks: [
        { id: 'c2s4t1', text: 'Bring out fresh trays from kitchen when display drops below 50%', sortOrder: 0 },
        { id: 'c2s4t2', text: 'Restock cups, lids, and to-go containers at drink and register stations', sortOrder: 1 },
        { id: 'c2s4t3', text: 'Check napkin and bag supply every hour; refill from back stock', sortOrder: 2 },
      ]},
      { id: 'c2s5', name: 'Closing Support', sortOrder: 4, tasks: [
        { id: 'c2s5t1', text: 'Drain and clean coffee machines per cleaning checklist', sortOrder: 0 },
        { id: 'c2s5t2', text: 'Wipe down drink station, restock supplies for morning crew', sortOrder: 1 },
        { id: 'c2s5t3', text: 'Take out trash and recycling from drink station area', sortOrder: 2 },
      ]},
    ],
  },
  {
    id: 's3', name: 'CASHIER 3', sortOrder: 2,
    sections: [
      { id: 'c3s1', name: 'Morning Prep', sortOrder: 0, tasks: [
        { id: 'c3s1t1', text: 'Arrive on time; clock in and review daily order board', sortOrder: 0 },
        { id: 'c3s1t2', text: 'Print and organize all pre-orders for the day by pickup time', sortOrder: 1 },
        { id: 'c3s1t3', text: 'Confirm special-order cakes with kitchen (decorations, inscriptions)', sortOrder: 2 },
      ]},
      { id: 'c3s2', name: 'Phone & Online Orders', sortOrder: 1, tasks: [
        { id: 'c3s2t1', text: 'Answer phone within 3 rings: "Brown Sugar Bakery, how can I help you?"', sortOrder: 0 },
        { id: 'c3s2t2', text: 'Enter phone orders into POS immediately with customer name and pickup time', sortOrder: 1 },
        { id: 'c3s2t3', text: 'Monitor online order queue every 15 minutes; acknowledge new orders', sortOrder: 2 },
      ]},
      { id: 'c3s3', name: 'Packaging & Labeling', sortOrder: 2, tasks: [
        { id: 'c3s3t1', text: 'Box custom cakes with cardboard base and clear lid; secure with sticker', sortOrder: 0 },
        { id: 'c3s3t2', text: 'Label all boxes with customer name, order number, and pickup time', sortOrder: 1 },
        { id: 'c3s3t3', text: 'Place packaged orders on designated pickup shelf in time order', sortOrder: 2 },
      ]},
      { id: 'c3s4', name: 'Inventory Checks', sortOrder: 3, tasks: [
        { id: 'c3s4t1', text: 'Count packaging supplies (boxes, bags, labels) at start of shift; note shortages', sortOrder: 0 },
        { id: 'c3s4t2', text: 'Report any item running low to manager before it runs out', sortOrder: 1 },
      ]},
      { id: 'c3s5', name: 'End of Shift', sortOrder: 4, tasks: [
        { id: 'c3s5t1', text: 'File completed order slips in daily folder', sortOrder: 0 },
        { id: 'c3s5t2', text: 'Wipe down packaging station and organize supplies neatly', sortOrder: 1 },
      ]},
    ],
  },
  {
    id: 's4', name: 'CASHIER 4 — MANAGER ON DUTY', sortOrder: 3,
    sections: [
      { id: 'c4s1', name: 'Opening Management', sortOrder: 0, tasks: [
        { id: 'c4s1t1', text: 'Arrive 30 minutes before opening; disarm alarm and unlock building', sortOrder: 0 },
        { id: 'c4s1t2', text: 'Verify all stations are staffed; reassign if someone calls out', sortOrder: 1 },
      ]},
      { id: 'c4s2', name: 'Staff Coordination', sortOrder: 1, tasks: [
        { id: 'c4s2t1', text: 'Conduct 5-minute team huddle: daily specials, goals, any issues', sortOrder: 0 },
        { id: 'c4s2t2', text: 'Monitor break schedule — ensure no more than 1 cashier on break at a time', sortOrder: 1 },
        { id: 'c4s2t3', text: 'Step in to any station that falls behind or has a line of 5+', sortOrder: 2 },
      ]},
      { id: 'c4s3', name: 'Quality Control', sortOrder: 2, tasks: [
        { id: 'c4s3t1', text: 'Walk the floor every hour — check display case, cleanliness, and customer flow', sortOrder: 0 },
        { id: 'c4s3t2', text: 'Taste-test one item per batch from kitchen; reject if below standard', sortOrder: 1 },
      ]},
      { id: 'c4s4', name: 'Financial Duties', sortOrder: 3, tasks: [
        { id: 'c4s4t1', text: 'Approve any discount, refund, or void over $5; log reason in manager book', sortOrder: 0 },
        { id: 'c4s4t2', text: 'Prepare bank deposit bag if cash drawer exceeds $500', sortOrder: 1 },
      ]},
      { id: 'c4s5', name: 'Closing Management', sortOrder: 4, tasks: [
        { id: 'c4s5t1', text: 'Review all register Z-reports; investigate discrepancies over $2', sortOrder: 0 },
        { id: 'c4s5t2', text: 'Lock all doors, set alarm, and confirm building is empty before leaving', sortOrder: 1 },
      ]},
    ],
  },
];

// ----------------------------------------------------------------
// Data Layer (localStorage)
// ----------------------------------------------------------------
function loadStations() {
  const raw = localStorage.getItem('sopStations');
  if (raw) return JSON.parse(raw);
  saveStations(SEED_STATIONS);
  return JSON.parse(JSON.stringify(SEED_STATIONS));
}

function saveStations(stations) {
  localStorage.setItem('sopStations', JSON.stringify(stations));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let stations    = [];
let currentTab  = 'runbooks'; // 'runbooks' | 'edit'
let printTarget = null;       // null = all, or station id

// ----------------------------------------------------------------
// DOM refs
// ----------------------------------------------------------------
const viewRunbooks   = document.getElementById('viewRunbooks');
const viewEdit       = document.getElementById('viewEdit');
const runbooksList   = document.getElementById('runbooksList');
const editList       = document.getElementById('editList');
const printContainer = document.getElementById('printContainer');
const toast          = document.getElementById('toast');
const sopPrintModal  = document.getElementById('sopPrintModal');
const sopModalBackdrop = document.getElementById('sopModalBackdrop');
const actionBar      = document.getElementById('sopActionBar');

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  stations = loadStations();
  bindViewTabs();
  bindPrintModal();
  renderRunbooksView();
});

// ----------------------------------------------------------------
// View Tab Switching
// ----------------------------------------------------------------
function bindViewTabs() {
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view === currentTab) return;
      currentTab = view;

      document.querySelectorAll('.view-tab').forEach(t => {
        const isActive = t.dataset.view === view;
        t.classList.toggle('view-tab--active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });

      viewRunbooks.hidden = view !== 'runbooks';
      viewEdit.hidden     = view !== 'edit';
      actionBar.hidden    = view !== 'runbooks';

      if (view === 'runbooks') renderRunbooksView();
      if (view === 'edit')     renderEditView();
    });
  });
}

// ----------------------------------------------------------------
// RUNBOOKS VIEW (read-only + print)
// ----------------------------------------------------------------
function renderRunbooksView() {
  stations = loadStations();
  runbooksList.innerHTML = '';

  if (stations.length === 0) {
    runbooksList.innerHTML = `
      <div class="state-msg">
        <span class="icon" aria-hidden="true">&#128203;</span>
        <p>No stations defined.</p>
        <p style="font-size:0.875rem;margin-top:8px;color:var(--color-text-secondary);">Switch to Edit Stations to add one.</p>
      </div>`;
    return;
  }

  const sorted = [...stations].sort((a, b) => a.sortOrder - b.sortOrder);

  sorted.forEach(station => {
    const totalTasks = station.sections.reduce((sum, s) => sum + s.tasks.length, 0);
    const section = document.createElement('div');
    section.className = 'house-section';
    section.innerHTML = `
      <div class="sop-station-header-row">
        <button class="house-toggle" aria-expanded="true" data-station="${station.id}">
          <span>
            ${escHtml(station.name)}
            <span class="house-badge">${totalTasks} task${totalTasks !== 1 ? 's' : ''}</span>
          </span>
          <span class="arrow" aria-hidden="true">&#9660;</span>
        </button>
        <button class="sop-station-print-btn" data-station="${station.id}" type="button" title="Print ${escAttr(station.name)}">Print</button>
      </div>
      <div class="house-panel" data-station="${station.id}">
        ${station.sections.sort((a, b) => a.sortOrder - b.sortOrder).map(sec => `
          <h4 class="sop-section-header">${escHtml(sec.name)}</h4>
          <ul class="sop-task-list">
            ${sec.tasks.sort((a, b) => a.sortOrder - b.sortOrder).map(t => `
              <li class="sop-task-item">
                <span class="sop-task-bullet" aria-hidden="true"></span>
                ${escHtml(t.text)}
              </li>
            `).join('')}
          </ul>
        `).join('')}
      </div>
    `;
    runbooksList.appendChild(section);
  });

  // Bind collapsible toggles
  runbooksList.querySelectorAll('.house-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.nextElementSibling.hidden = expanded;
    });
  });

  // Bind per-station print buttons
  runbooksList.querySelectorAll('.sop-station-print-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      printTarget = btn.dataset.station;
      openPrintModal();
    });
  });
}

// ----------------------------------------------------------------
// EDIT STATIONS VIEW (CRUD)
// ----------------------------------------------------------------
function renderEditView() {
  stations = loadStations();
  editList.innerHTML = '';

  const sorted = [...stations].sort((a, b) => a.sortOrder - b.sortOrder);

  sorted.forEach(station => {
    const stationEl = document.createElement('div');
    stationEl.className = 'house-section';
    stationEl.innerHTML = `
      <button class="house-toggle" aria-expanded="true" data-station="${station.id}">
        <span>${escHtml(station.name)}</span>
        <span class="arrow" aria-hidden="true">&#9660;</span>
      </button>
      <div class="house-panel" data-station="${station.id}">
        <div class="sop-edit-station-header">
          <input type="text" class="template-title-input sop-station-name-input" value="${escAttr(station.name)}" data-station-id="${station.id}" aria-label="Station name">
          <button class="template-delete-btn sop-delete-station-btn" data-station-id="${station.id}" title="Delete station" aria-label="Delete station">&times;</button>
        </div>
        ${station.sections.sort((a, b) => a.sortOrder - b.sortOrder).map(sec => `
          <div class="sop-edit-section" data-section-id="${sec.id}">
            <div class="sop-edit-section-header">
              <input type="text" class="template-title-input sop-section-name-input" value="${escAttr(sec.name)}" data-station-id="${station.id}" data-section-id="${sec.id}" aria-label="Section name">
              <button class="template-delete-btn sop-delete-section-btn" data-station-id="${station.id}" data-section-id="${sec.id}" title="Delete section" aria-label="Delete section">&times;</button>
            </div>
            ${sec.tasks.sort((a, b) => a.sortOrder - b.sortOrder).map(t => `
              <div class="sop-edit-task">
                <input type="text" class="template-title-input sop-task-text-input" value="${escAttr(t.text)}" data-station-id="${station.id}" data-section-id="${sec.id}" data-task-id="${t.id}" aria-label="Task text">
                <button class="template-delete-btn sop-delete-task-btn" data-station-id="${station.id}" data-section-id="${sec.id}" data-task-id="${t.id}" title="Delete task" aria-label="Delete task">&times;</button>
              </div>
            `).join('')}
            <form class="custom-task-form sop-add-task-form" data-station-id="${station.id}" data-section-id="${sec.id}">
              <input type="text" placeholder="Add task..." class="custom-task-input" aria-label="Add task">
              <button type="submit" class="custom-task-add-btn">+ Add</button>
            </form>
          </div>
        `).join('')}
        <form class="custom-task-form sop-add-section-form" data-station-id="${station.id}">
          <input type="text" placeholder="Add section..." class="custom-task-input" aria-label="Add section">
          <button type="submit" class="custom-task-add-btn">+ Section</button>
        </form>
      </div>
    `;
    editList.appendChild(stationEl);
  });

  // Add Station button at the end
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-station';
  addBtn.type = 'button';
  addBtn.textContent = '+ Add Station';
  editList.appendChild(addBtn);

  bindEditEvents();
}

function bindEditEvents() {
  // Collapsible toggles
  editList.querySelectorAll('.house-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.nextElementSibling.hidden = expanded;
    });
  });

  // Station name edit (blur save)
  editList.querySelectorAll('.sop-station-name-input').forEach(input => {
    input.addEventListener('blur', () => {
      const sid = input.dataset.stationId;
      const val = input.value.trim();
      const st = stations.find(s => s.id === sid);
      if (!st) return;
      if (!val) { input.value = st.name; return; }
      if (st.name !== val) {
        st.name = val;
        saveStations(stations);
        showToast('Station updated');
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  });

  // Section name edit (blur save)
  editList.querySelectorAll('.sop-section-name-input').forEach(input => {
    input.addEventListener('blur', () => {
      const st = stations.find(s => s.id === input.dataset.stationId);
      if (!st) return;
      const sec = st.sections.find(s => s.id === input.dataset.sectionId);
      if (!sec) return;
      const val = input.value.trim();
      if (!val) { input.value = sec.name; return; }
      if (sec.name !== val) {
        sec.name = val;
        saveStations(stations);
        showToast('Section updated');
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  });

  // Task text edit (blur save)
  editList.querySelectorAll('.sop-task-text-input').forEach(input => {
    input.addEventListener('blur', () => {
      const st = stations.find(s => s.id === input.dataset.stationId);
      if (!st) return;
      const sec = st.sections.find(s => s.id === input.dataset.sectionId);
      if (!sec) return;
      const task = sec.tasks.find(t => t.id === input.dataset.taskId);
      if (!task) return;
      const val = input.value.trim();
      if (!val) { input.value = task.text; return; }
      if (task.text !== val) {
        task.text = val;
        saveStations(stations);
        showToast('Task updated');
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  });

  // Delete station
  editList.querySelectorAll('.sop-delete-station-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this entire station?')) return;
      stations = stations.filter(s => s.id !== btn.dataset.stationId);
      saveStations(stations);
      renderEditView();
      showToast('Station deleted');
    });
  });

  // Delete section
  editList.querySelectorAll('.sop-delete-section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = stations.find(s => s.id === btn.dataset.stationId);
      if (!st) return;
      st.sections = st.sections.filter(s => s.id !== btn.dataset.sectionId);
      saveStations(stations);
      renderEditView();
      showToast('Section deleted');
    });
  });

  // Delete task
  editList.querySelectorAll('.sop-delete-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = stations.find(s => s.id === btn.dataset.stationId);
      if (!st) return;
      const sec = st.sections.find(s => s.id === btn.dataset.sectionId);
      if (!sec) return;
      sec.tasks = sec.tasks.filter(t => t.id !== btn.dataset.taskId);
      saveStations(stations);
      renderEditView();
      showToast('Task deleted');
    });
  });

  // Add task
  editList.querySelectorAll('.sop-add-task-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.custom-task-input');
      const text = input.value.trim();
      if (!text) return;
      const st = stations.find(s => s.id === form.dataset.stationId);
      if (!st) return;
      const sec = st.sections.find(s => s.id === form.dataset.sectionId);
      if (!sec) return;
      const maxSort = sec.tasks.length > 0 ? Math.max(...sec.tasks.map(t => t.sortOrder)) + 1 : 0;
      sec.tasks.push({ id: generateId(), text, sortOrder: maxSort });
      saveStations(stations);
      input.value = '';
      renderEditView();
      showToast('Task added');
    });
  });

  // Add section
  editList.querySelectorAll('.sop-add-section-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.custom-task-input');
      const name = input.value.trim();
      if (!name) return;
      const st = stations.find(s => s.id === form.dataset.stationId);
      if (!st) return;
      const maxSort = st.sections.length > 0 ? Math.max(...st.sections.map(s => s.sortOrder)) + 1 : 0;
      st.sections.push({ id: generateId(), name, sortOrder: maxSort, tasks: [] });
      saveStations(stations);
      input.value = '';
      renderEditView();
      showToast('Section added');
    });
  });

  // Add station
  const addStationBtn = editList.querySelector('.btn-add-station');
  if (addStationBtn) {
    addStationBtn.addEventListener('click', () => {
      const maxSort = stations.length > 0 ? Math.max(...stations.map(s => s.sortOrder)) + 1 : 0;
      stations.push({
        id: generateId(),
        name: 'New Station',
        sortOrder: maxSort,
        sections: [],
      });
      saveStations(stations);
      renderEditView();
      showToast('Station added');
    });
  }
}

// ----------------------------------------------------------------
// Print Modal
// ----------------------------------------------------------------
function bindPrintModal() {
  // Print All button in action bar
  document.getElementById('printAllBtn').addEventListener('click', () => {
    printTarget = null;
    openPrintModal();
  });

  // Size buttons
  document.getElementById('printLetterBtn').addEventListener('click', () => {
    closePrintModal();
    executePrint('letter');
  });
  document.getElementById('printIndexBtn').addEventListener('click', () => {
    closePrintModal();
    executePrint('index');
  });

  // Close modal
  document.getElementById('sopModalCloseBtn').addEventListener('click', closePrintModal);
  sopModalBackdrop.addEventListener('click', closePrintModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !sopPrintModal.hidden) closePrintModal();
  });
}

function openPrintModal() {
  sopPrintModal.hidden = false;
  sopModalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePrintModal() {
  sopPrintModal.hidden = true;
  sopModalBackdrop.hidden = true;
  document.body.style.overflow = '';
}

// ----------------------------------------------------------------
// Print Execution
// ----------------------------------------------------------------
function executePrint(size) {
  stations = loadStations();
  const toPrint = printTarget
    ? stations.filter(s => s.id === printTarget)
    : [...stations].sort((a, b) => a.sortOrder - b.sortOrder);

  if (toPrint.length === 0) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let html = '';

  if (size === 'index') {
    html += '<style>@page { size: 6in 4in; margin: 0; }</style>';
    toPrint.forEach(station => {
      html += buildIndexCard(station, dateStr);
    });
  } else {
    html += '<style>@page { size: letter portrait; margin: 0; }</style>';
    toPrint.forEach(station => {
      html += buildLetterPage(station, dateStr);
    });
  }

  printContainer.innerHTML = html;
  setTimeout(() => window.print(), 100);
}

function buildLetterPage(station, dateStr) {
  const sections = [...station.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  let sectionHtml = '';
  sections.forEach(sec => {
    let taskRows = '';
    sec.tasks.sort((a, b) => a.sortOrder - b.sortOrder).forEach(t => {
      taskRows += `<tr>
        <td class="sop-print-check-cell">&#9744;</td>
        <td class="sop-print-task-cell">${escHtml(t.text)}</td>
        <td class="sop-print-init-cell"></td>
      </tr>`;
    });
    sectionHtml += `
      <div class="sop-print-section-label">${escHtml(sec.name).toUpperCase()}</div>
      <table class="sop-print-table">
        <thead><tr>
          <th class="sop-print-check-col">&#10003;</th>
          <th>Task</th>
          <th class="sop-print-init-col">Init.</th>
        </tr></thead>
        <tbody>${taskRows}</tbody>
      </table>`;
  });

  return `<div class="print-sop-letter">
    <div class="sop-id-bar">
      <span class="sop-id-station">${escHtml(station.name)}</span>
      <span class="sop-id-date">${escHtml(dateStr)}</span>
    </div>
    <div class="sop-subtitle">Brown Sugar Bakery &mdash; Station Runbook</div>
    ${sectionHtml}
    <div class="sop-print-signatures">
      <div class="sop-print-sig"><div class="sop-print-sig-line"></div><div class="sop-print-sig-label">Employee</div></div>
      <div class="sop-print-sig"><div class="sop-print-sig-line"></div><div class="sop-print-sig-label">Manager</div></div>
    </div>
    <div class="sop-print-footer">Brown Sugar Bakery &mdash; ${escHtml(dateStr)}</div>
  </div>`;
}

function buildIndexCard(station, dateStr) {
  const sections = [...station.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const shortDate = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  let body = '';
  sections.forEach(sec => {
    body += `<div class="sop-idx-section">${escHtml(sec.name).toUpperCase()}</div>`;
    sec.tasks.sort((a, b) => a.sortOrder - b.sortOrder).forEach(t => {
      body += `<div class="sop-idx-task">&#9744; ${escHtml(t.text)}</div>`;
    });
  });

  return `<div class="print-sop-index">
    <div class="sop-idx-bar">
      <span class="sop-idx-station">${escHtml(station.name)}</span>
      <span class="sop-idx-date">${escHtml(shortDate)}</span>
    </div>
    ${body}
    <div class="sop-idx-signatures">
      <div class="sop-idx-sig"><div class="sop-idx-sig-line"></div><div class="sop-idx-sig-label">Employee</div></div>
      <div class="sop-idx-sig"><div class="sop-idx-sig-line"></div><div class="sop-idx-sig-label">Manager</div></div>
    </div>
    <div class="sop-idx-footer">Brown Sugar Bakery</div>
  </div>`;
}

// ----------------------------------------------------------------
// Toast
// ----------------------------------------------------------------
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.hidden = true; }, 2500);
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
