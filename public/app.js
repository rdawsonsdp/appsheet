/* =================================================================
   app.js — Orders list, filtering, selection, and print logic
   ================================================================= */

'use strict';

// ----------------------------------------------------------------
// Default Print Template
// ----------------------------------------------------------------
// Template generates both Packing Slip + Bakery Sheet halves on one page.
// Field names match AppSheet "Customer Orders" table — update if yours differ.
const DEFAULT_TEMPLATE = `<!-- ═══ PACKING SLIP (top half) ═══ -->
<div class="slip-half">
  <div class="slip-title">Packing Slip</div>
  <div class="slip-header">
    <div>
      <div class="slip-order-id">{{OrderID}}</div>
      <h2 class="slip-customer">{{Order Name}}</h2>
    </div>
    <span class="slip-count">{{Order Count}}</span>
  </div>
  <div class="slip-meta">
    <div><strong>Due Date:</strong> {{Due Pickup Date}}</div>
    <div><strong>Due Time:</strong> {{Due Pickup Time}}</div>
    <div><strong>Number:</strong> {{PhoneNumber}}</div>
  </div>
  {{LINE_ITEMS_TABLE}}
</div>

<hr class="slip-divider">

<!-- ═══ BAKERY SHEET (bottom half) ═══ -->
<div class="slip-half">
  <div class="slip-title">Bakery Sheet</div>
  <div class="slip-header">
    <div>
      <div class="slip-order-id">{{OrderID}}</div>
      <h2 class="slip-customer">{{Order Name}}</h2>
    </div>
    <span class="slip-count">{{Order Count}}</span>
  </div>
  <div class="slip-meta">
    <div><strong>Due Date:</strong> {{Due Pickup Date}}</div>
    <div><strong>Due Time:</strong> {{Due Pickup Time}}</div>
    <div><strong>Number:</strong> {{PhoneNumber}}</div>
  </div>
  {{LINE_ITEMS_TABLE}}
</div>`;

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let allOrders      = [];
let filteredOrders = [];
let selectedIds    = new Set(); // keyed by _RowNumber (string)
let sortField      = 'Due Pickup Date';
let sortAsc        = true;

// ----------------------------------------------------------------
// DOM refs
// ----------------------------------------------------------------
const ordersList      = document.getElementById('ordersList');
const ordersCount     = document.getElementById('ordersCount');
const actionBarCount  = document.getElementById('actionBarCount');
const printBtn        = document.getElementById('printBtn');
const printContainer  = document.getElementById('printContainer');
const filterToggleBtn = document.getElementById('filterToggleBtn');
const filterPanel     = document.getElementById('filterPanel');
const filterBadge     = document.getElementById('filterBadge');
const dateFrom        = document.getElementById('dateFrom');
const dateTo          = document.getElementById('dateTo');
const orderDateFrom   = document.getElementById('orderDateFrom');
const orderDateTo     = document.getElementById('orderDateTo');
const groupDateFrom   = document.getElementById('groupDateFrom');
const groupDateTo     = document.getElementById('groupDateTo');
const groupOrderDateFrom = document.getElementById('groupOrderDateFrom');
const groupOrderDateTo   = document.getElementById('groupOrderDateTo');
const statusSelect      = document.getElementById('statusSelect');
const orderTypeSelect   = document.getElementById('orderTypeSelect');
const customerSearch    = document.getElementById('customerSearch');
const chipLocalDelivery = document.getElementById('chipLocalDelivery');
const clearFiltersBtn   = document.getElementById('clearFiltersBtn');
const searchBtn           = document.getElementById('searchBtn');
const selectAllBtn        = document.getElementById('selectAllBtn');
const sortFieldEl         = document.getElementById('sortField');
const sortDirBtn          = document.getElementById('sortDirBtn');
// Modal
const orderModalBackdrop  = document.getElementById('orderModalBackdrop');
const modalOrderName      = document.getElementById('modalOrderName');
const modalCount          = document.getElementById('modalCount');
const modalMeta           = document.getElementById('modalMeta');
const modalItemsWrap      = document.getElementById('modalItemsWrap');
const modalNotes          = document.getElementById('modalNotes');
const modalCloseBtn       = document.getElementById('modalCloseBtn');
const modalSelectBtn      = document.getElementById('modalSelectBtn');
const modalPrintBtn       = document.getElementById('modalPrintBtn');
let   modalCurrentId      = null;

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  bindFilterEvents();
  bindActionBarEvents();
  bindModalEvents();
  showIdle(); // don't fetch until user hits "Get Orders"
});

// ----------------------------------------------------------------
// Fetch Orders
// ----------------------------------------------------------------
async function fetchOrders() {
  showLoading();
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data?.error) throw new Error(data.error);

    allOrders = Array.isArray(data) ? data : [];
    populateStatusFilter();
    populateOrderTypeFilter();
    applyFilters();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// ----------------------------------------------------------------
// Filter Logic
// ----------------------------------------------------------------
// Local-delivery types (used by chip and filter logic)
const LOCAL_DELIVERY_TYPES = new Set(['Delivery', 'Local Delivery Order']);

function applyFilters() {
  const pickupFrom = dateFrom.value;
  const pickupTo   = dateTo.value;
  const orderFrom  = orderDateFrom.value;
  const orderTo    = orderDateTo.value;
  const status     = statusSelect.value;
  const orderType  = orderTypeSelect.value;
  const chipActive = chipLocalDelivery.dataset.active === 'true';
  const customerQ  = customerSearch.value.toLowerCase().trim();

  const usePickup = pickupFrom || pickupTo;
  const useOrder  = orderFrom  || orderTo;

  filteredOrders = allOrders.filter(order => {
    const name = (order['Order Name'] || order['Customer Name'] || '').toLowerCase();

    // Date filtering — only one group active at a time
    let dateMatch = true;
    if (usePickup) {
      const d = toISODate(order['Due Pickup Date'] || '');
      dateMatch = (!pickupFrom || d >= pickupFrom) && (!pickupTo || d <= pickupTo);
    } else if (useOrder) {
      const d = toISODate(order['Order Date'] || '');
      dateMatch = (!orderFrom || d >= orderFrom) && (!orderTo || d <= orderTo);
    }

    // Order type: chip overrides dropdown (both Delivery + Local Delivery Order)
    let typeMatch = true;
    if (chipActive) {
      typeMatch = LOCAL_DELIVERY_TYPES.has(order['Order Type']);
    } else if (orderType) {
      typeMatch = order['Order Type'] === orderType;
    }

    return dateMatch
        && typeMatch
        && (!status    || order['Status'] === status)
        && (!customerQ || name.includes(customerQ));
  });

  // Drop any selected IDs that are no longer in filtered list
  const filteredIds = new Set(filteredOrders.map(o => String(o._RowNumber)));
  for (const id of selectedIds) {
    if (!filteredIds.has(id)) selectedIds.delete(id);
  }

  sortOrders();
  renderOrders();
  updateFilterBadge();
  updateActionBar();
}

function sortOrders() {
  filteredOrders.sort((a, b) => {
    let aVal = a[sortField] ?? '';
    let bVal = b[sortField] ?? '';

    // Dates: convert MM/DD/YYYY → YYYY-MM-DD for correct chronological sort
    if (sortField === 'Due Pickup Date' || sortField === 'Order Date') {
      aVal = toISODate(String(aVal));
      bVal = toISODate(String(bVal));
    }

    // Numeric fields
    if (sortField === 'Order Count' || sortField === 'Total') {
      aVal = parseFloat(String(aVal).replace(/[^0-9.-]/g, '')) || 0;
      bVal = parseFloat(String(bVal).replace(/[^0-9.-]/g, '')) || 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    }

    // String / date comparison
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
    return sortAsc ? cmp : -cmp;
  });
}

function countActiveFilters() {
  let n = 0;
  if (dateFrom.value)                        n++;
  if (dateTo.value)                          n++;
  if (orderDateFrom.value)                   n++;
  if (orderDateTo.value)                     n++;
  if (statusSelect.value)                    n++;
  if (orderTypeSelect.value)                 n++;
  if (chipLocalDelivery.dataset.active === 'true') n++;
  if (customerSearch.value.trim())           n++;
  return n;
}

function updateFilterBadge() {
  const n = countActiveFilters();
  filterBadge.textContent = n;
  filterBadge.hidden = n === 0;
}

function clearFilters() {
  dateFrom.value          = '';
  dateTo.value            = '';
  orderDateFrom.value     = '';
  orderDateTo.value       = '';
  statusSelect.value      = '';
  orderTypeSelect.value   = '';
  customerSearch.value    = '';
  setChip(chipLocalDelivery, false);
  syncDateGroupExclusion();
  applyFilters();
}

// ----------------------------------------------------------------
// Mutual exclusion: Pickup Date ↔ Order Date
// When either group has a value, the other group is disabled + grayed.
// ----------------------------------------------------------------
function syncDateGroupExclusion() {
  const pickupActive = !!(dateFrom.value || dateTo.value);
  const orderActive  = !!(orderDateFrom.value || orderDateTo.value);

  // Disable Order Date group when Pickup has values
  const disableOrder = pickupActive;
  orderDateFrom.disabled = disableOrder;
  orderDateTo.disabled   = disableOrder;
  groupOrderDateFrom.classList.toggle('filter-group--disabled', disableOrder);
  groupOrderDateTo.classList.toggle('filter-group--disabled', disableOrder);

  // Disable Pickup Date group when Order Date has values
  const disablePickup = orderActive;
  dateFrom.disabled = disablePickup;
  dateTo.disabled   = disablePickup;
  groupDateFrom.classList.toggle('filter-group--disabled', disablePickup);
  groupDateTo.classList.toggle('filter-group--disabled', disablePickup);
}

function populateStatusFilter() {
  const statuses = [...new Set(allOrders.map(o => o['Status']).filter(Boolean))].sort();
  statusSelect.innerHTML = '<option value="">All Statuses</option>';
  statuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });
}

function populateOrderTypeFilter() {
  const types = [...new Set(allOrders.map(o => o['Order Type']).filter(Boolean))].sort();
  orderTypeSelect.innerHTML = '<option value="">All Types</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    orderTypeSelect.appendChild(opt);
  });
}

// ----------------------------------------------------------------
// Chip helpers
// ----------------------------------------------------------------
function setChip(btn, active) {
  btn.dataset.active = String(active);
  btn.classList.toggle('chip--active', active);
  btn.setAttribute('aria-pressed', String(active));
}

// ----------------------------------------------------------------
// Render Orders
// ----------------------------------------------------------------
function renderOrders() {
  if (filteredOrders.length === 0) {
    ordersList.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'state-msg';
    msg.innerHTML = '<span class="icon" aria-hidden="true">📭</span><p>No orders match your filters.</p>';
    ordersList.appendChild(msg);
    ordersCount.textContent = '0 orders';
    return;
  }

  ordersCount.textContent = `${filteredOrders.length} order${filteredOrders.length !== 1 ? 's' : ''}`;
  ordersList.innerHTML = '';

  filteredOrders.forEach(order => {
    const id       = String(order._RowNumber);
    const isSelected = selectedIds.has(id);
    const status   = order['Status'] || '';
    const statusClass = getStatusClass(status);

    const card = document.createElement('div');
    card.className = `order-card${isSelected ? ' selected' : ''}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Order ${order['OrderID'] || id}, ${order['Order Name'] || ''}, ${status}`);
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    card.setAttribute('tabindex', '0');
    card.dataset.id = id;

    card.innerHTML = `
      <div class="card-row-top">
        <div class="card-left">
          <div class="card-checkbox" aria-hidden="true">${isSelected ? '✓' : ''}</div>
          <span class="card-order-num">${escHtml(order['Order Name'] || order['OrderID'] || id)}</span>
          ${order['Order Count'] ? `<span class="card-order-count">${escHtml(order['Order Count'])}</span>` : ''}
        </div>
        <span class="status-badge ${statusClass}">${escHtml(status)}</span>
      </div>
      <div class="card-order-id">${escHtml(order['OrderID'] || '')}</div>
      <div class="card-meta">
        <span>${escHtml(formatDate(order['Due Pickup Date'] || order['Order Date']))}</span>
        ${order['Due Pickup Time'] ? `<span class="card-meta-sep">·</span><span>${escHtml(order['Due Pickup Time'])}</span>` : ''}
      </div>
      ${buildItemsSummary(order)}
    `;

    // Tap card body → open modal; tap checkbox → toggle selection
    card.addEventListener('click', e => {
      if (e.target.closest('.card-checkbox')) {
        toggleSelect(id);
      } else {
        openOrderModal(id);
      }
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); openOrderModal(id); }
      if (e.key === ' ')     { e.preventDefault(); toggleSelect(id); }
    });

    ordersList.appendChild(card);
  });
}

// ----------------------------------------------------------------
// Selection
// ----------------------------------------------------------------
function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  // Update just the affected card (avoid full re-render flicker)
  const card = ordersList.querySelector(`.order-card[data-id="${CSS.escape(id)}"]`);
  if (card) {
    const isSelected = selectedIds.has(id);
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    const checkbox = card.querySelector('.card-checkbox');
    if (checkbox) checkbox.textContent = isSelected ? '✓' : '';
  }
  updateActionBar();
}

function selectAll() {
  const allSelected = filteredOrders.every(o => selectedIds.has(String(o._RowNumber)));
  if (allSelected) {
    // Deselect all in current filter
    filteredOrders.forEach(o => selectedIds.delete(String(o._RowNumber)));
    selectAllBtn.textContent = 'Select All';
  } else {
    filteredOrders.forEach(o => selectedIds.add(String(o._RowNumber)));
    selectAllBtn.textContent = 'Deselect All';
  }
  renderOrders();
  updateActionBar();
}

function updateActionBar() {
  const n = selectedIds.size;
  actionBarCount.innerHTML = `<strong>${n}</strong> selected`;
  printBtn.disabled = n === 0;
  // Update select-all button text
  if (filteredOrders.length > 0) {
    const allSelected = filteredOrders.every(o => selectedIds.has(String(o._RowNumber)));
    selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
  }
}

// ----------------------------------------------------------------
// Print
// ----------------------------------------------------------------
function printSelected() {
  const ordersToprint = allOrders.filter(o => selectedIds.has(String(o._RowNumber)));
  if (ordersToprint.length === 0) return;

  printContainer.innerHTML = ordersToprint.map(renderOrderForPrint).join('');

  // Safari/iOS needs a small delay before window.print()
  setTimeout(() => {
    window.print();
  }, 100);
}

function getTemplate() {
  return localStorage.getItem('orderPrintTemplate') || DEFAULT_TEMPLATE;
}

function renderOrderForPrint(order) {
  let html = getTemplate();

  // Handle conditional blocks: {{#Field}}...{{/Field}}
  html = html.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const val = order[key.trim()];
    return (val && String(val).trim()) ? content : '';
  });

  // Replace placeholders
  html = html.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    if (k === 'LINE_ITEMS_TABLE') return buildLineItemsTable(order);
    if (k === 'PRINT_DATE')       return new Date().toLocaleDateString();
    return escHtml(String(order[k] ?? ''));
  });

  return `<div class="print-order">${html}</div>`;
}

function buildItemsSummary(order) {
  const items = order['Line Items'];
  if (!items || !Array.isArray(items) || items.length === 0) return '';

  const rows = items.map(item => {
    const product = item['Product Description'] || '';
    const qty     = item['CakeQty'] || '';
    const notes   = [item['Writing Notes'], item['Color'], item['Add-Ons'], item['Line Item Notes']]
                      .filter(Boolean).join(' · ');
    return `<div class="card-item-row">
      <span class="card-item-name">
        ${escHtml(String(product))}
        ${notes ? `<span class="card-item-notes">${escHtml(notes)}</span>` : ''}
      </span>
      <span class="card-item-qty">×${escHtml(String(qty))}</span>
    </div>`;
  }).join('');

  return `<div class="card-items">${rows}</div>`;
}

function buildLineItemsTable(order) {
  const items = order['Line Items'];
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '<p style="color:#666;font-style:italic;font-size:10pt;">No line items.</p>';
  }

  const rows = items.map(item => {
    // Build the detail cell: product + optional sub-lines (writing, color, add-ons, notes)
    const product = escHtml(String(item['Product Description'] || ''));
    const subLines = [
      item['Writing Notes']  ? `<div class="slip-sub">Writing: ${escHtml(item['Writing Notes'])}</div>`   : '',
      item['Color']          ? `<div class="slip-sub">Color: ${escHtml(item['Color'])}</div>`             : '',
      item['Add-Ons']        ? `<div class="slip-sub">Add-Ons: ${escHtml(item['Add-Ons'])}</div>`         : '',
      item['Line Item Notes']? `<div class="slip-sub">Notes: ${escHtml(item['Line Item Notes'])}</div>`   : '',
    ].join('');
    const qty = escHtml(String(item['CakeQty'] || ''));

    return `<tr>
      <td class="slip-check-cell"></td>
      <td class="slip-detail-cell">${product}${subLines}</td>
      <td class="slip-qty-cell">${qty}</td>
    </tr>`;
  }).join('');

  return `<table class="slip-items-table">
    <thead>
      <tr>
        <th class="slip-check-cell"></th>
        <th class="slip-detail-cell">Order Details</th>
        <th class="slip-qty-cell">Qty</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ----------------------------------------------------------------
// Event Bindings
// ----------------------------------------------------------------
function bindFilterEvents() {
  filterToggleBtn.addEventListener('click', () => {
    const expanded = filterToggleBtn.getAttribute('aria-expanded') === 'true';
    filterToggleBtn.setAttribute('aria-expanded', String(!expanded));
    filterPanel.hidden = expanded;
  });

  // Live filtering — also enforce mutual exclusion on date groups
  const onPickupChange = () => {
    syncDateGroupExclusion();
    if (allOrders.length) applyFilters();
  };
  const onOrderDateChange = () => {
    syncDateGroupExclusion();
    if (allOrders.length) applyFilters();
  };
  dateFrom.addEventListener('change',      onPickupChange);
  dateTo.addEventListener('change',        onPickupChange);
  orderDateFrom.addEventListener('change', onOrderDateChange);
  orderDateTo.addEventListener('change',   onOrderDateChange);
  statusSelect.addEventListener('change',    () => { if (allOrders.length) applyFilters(); });
  orderTypeSelect.addEventListener('change', () => {
    // If a specific type is chosen, deactivate the chip so they don't conflict
    if (orderTypeSelect.value) setChip(chipLocalDelivery, false);
    if (allOrders.length) applyFilters();
  });
  customerSearch.addEventListener('input',   () => { if (allOrders.length) applyFilters(); });

  // Local Delivery chip toggle
  chipLocalDelivery.addEventListener('click', () => {
    const nowActive = chipLocalDelivery.dataset.active !== 'true';
    setChip(chipLocalDelivery, nowActive);
    // Chip overrides dropdown — clear dropdown when chip activates
    if (nowActive) orderTypeSelect.value = '';
    if (allOrders.length) applyFilters();
  });

  clearFiltersBtn.addEventListener('click', clearFilters);
  searchBtn.addEventListener('click', fetchOrders);

  // Sort controls
  sortFieldEl.addEventListener('change', () => {
    sortField = sortFieldEl.value;
    if (allOrders.length) { applyFilters(); }
  });

  sortDirBtn.addEventListener('click', () => {
    sortAsc = !sortAsc;
    sortDirBtn.textContent = sortAsc ? '↑' : '↓';
    sortDirBtn.title = sortAsc ? 'Ascending — click to reverse' : 'Descending — click to reverse';
    if (allOrders.length) { applyFilters(); }
  });

  // Allow Enter key in any filter input to trigger fetch/filter
  [dateFrom, dateTo, orderDateFrom, orderDateTo, customerSearch].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') fetchOrders();
    });
  });
}

function bindActionBarEvents() {
  printBtn.addEventListener('click', printSelected);
  selectAllBtn.addEventListener('click', selectAll);
}

// ----------------------------------------------------------------
// Order Detail Modal
// ----------------------------------------------------------------
function openOrderModal(id) {
  const order = allOrders.find(o => String(o._RowNumber) === String(id));
  if (!order) return;
  modalCurrentId = id;

  // Header
  modalOrderName.textContent = order['Order Name'] || order['OrderID'] || id;
  modalCount.textContent     = order['Order Count'] ? `${order['Order Count']} item${order['Order Count'] != 1 ? 's' : ''}` : '';

  // Meta fields grid
  const status      = order['Status'] || '';
  const statusClass = getStatusClass(status);
  modalMeta.innerHTML = `
    <div class="modal-status-row">
      <span class="status-badge ${statusClass}">${escHtml(status)}</span>
    </div>
    <div class="modal-field-grid">
      <div class="modal-field">
        <span class="modal-field-label">Pickup Date</span>
        <span class="modal-field-value">${escHtml(formatDate(order['Due Pickup Date'] || ''))}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Pickup Time</span>
        <span class="modal-field-value">${escHtml(order['Due Pickup Time'] || '—')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Phone</span>
        <span class="modal-field-value">${order['PhoneNumber'] ? `<a href="tel:${escHtml(order['PhoneNumber'])}">${escHtml(order['PhoneNumber'])}</a>` : '—'}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Order ID</span>
        <span class="modal-field-value">${escHtml(order['OrderID'] || '—')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Order Type</span>
        <span class="modal-field-value">${escHtml(order['Order Type'] || '—')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Location</span>
        <span class="modal-field-value">${escHtml(order['Location'] || '—')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Total</span>
        <span class="modal-field-value">${escHtml(order['Total'] || '—')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-field-label">Order Date</span>
        <span class="modal-field-value">${escHtml(formatDate(order['Order Date'] || ''))}</span>
      </div>
    </div>`;

  // Line items
  const items = order['Line Items'] || [];
  if (items.length > 0) {
    const rows = items.map(item => {
      const product = item['Product Description'] || '';
      const qty     = item['CakeQty'] || '';
      const subs = [
        item['Writing Notes']   ? `<div class="modal-item-sub"><strong>Writing:</strong> ${escHtml(item['Writing Notes'])}</div>`   : '',
        item['Color']           ? `<div class="modal-item-sub"><strong>Color:</strong> ${escHtml(item['Color'])}</div>`             : '',
        item['Add-Ons']         ? `<div class="modal-item-sub"><strong>Add-Ons:</strong> ${escHtml(item['Add-Ons'])}</div>`         : '',
        item['Line Item Notes'] ? `<div class="modal-item-sub"><strong>Notes:</strong> ${escHtml(item['Line Item Notes'])}</div>`   : '',
        item['Flavor']          ? `<div class="modal-item-sub"><strong>Flavor:</strong> ${escHtml(item['Flavor'])}</div>`           : '',
      ].join('');
      return `<div class="modal-item-row">
        <div class="modal-item-qty">${escHtml(String(qty))}</div>
        <div class="modal-item-details">
          <div class="modal-item-name">${escHtml(product)}</div>
          ${subs}
        </div>
      </div>`;
    }).join('');

    modalItemsWrap.innerHTML = `<div class="modal-items-title">Order Details</div>${rows}`;
  } else {
    modalItemsWrap.innerHTML = `<div class="modal-items-title">Order Details</div>
      <p style="color:var(--color-text-secondary);font-style:italic;padding:12px 0;font-size:0.875rem;">No line items.</p>`;
  }

  // Notes
  const notes = order['Order Notes'] || '';
  if (notes.trim()) {
    modalNotes.hidden = false;
    modalNotes.innerHTML = `<div class="modal-notes-label">Order Notes</div>${escHtml(notes)}`;
  } else {
    modalNotes.hidden = true;
  }

  // Select button state
  updateModalSelectBtn();

  orderModalBackdrop.hidden = false;
  modalCloseBtn.focus();
}

function updateModalSelectBtn() {
  if (!modalCurrentId) return;
  const isSelected = selectedIds.has(modalCurrentId);
  modalSelectBtn.textContent  = isSelected ? '☑ Selected for Print' : '☐ Select for Print';
  modalSelectBtn.classList.toggle('is-selected', isSelected);
}

function closeOrderModal() {
  orderModalBackdrop.hidden = true;
  modalCurrentId = null;
  // Return focus to the card that was tapped
  const card = ordersList.querySelector(`.order-card[data-id="${CSS.escape(String(modalCurrentId))}"]`);
  if (card) card.focus();
}

function bindModalEvents() {
  modalCloseBtn.addEventListener('click', closeOrderModal);
  orderModalBackdrop.addEventListener('click', e => {
    if (e.target === orderModalBackdrop) closeOrderModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !orderModalBackdrop.hidden) closeOrderModal();
  });
  modalSelectBtn.addEventListener('click', () => {
    if (!modalCurrentId) return;
    toggleSelect(modalCurrentId);
    updateModalSelectBtn();
    // Also refresh the card in the list
    renderOrders();
  });
  modalPrintBtn.addEventListener('click', () => {
    if (!modalCurrentId) return;
    const order = allOrders.find(o => String(o._RowNumber) === String(modalCurrentId));
    if (!order) return;
    printContainer.innerHTML = renderOrderForPrint(order);
    setTimeout(() => window.print(), 100);
  });
}

// ----------------------------------------------------------------
// UI Helpers
// ----------------------------------------------------------------
function showIdle() {
  ordersList.innerHTML = `
    <div class="state-msg">
      <span class="icon" aria-hidden="true">📋</span>
      <p>Set your filters above then tap <strong>Get Orders</strong>.</p>
    </div>`;
  ordersCount.textContent = '';
}

function showLoading() {
  searchBtn.disabled = true;
  searchBtn.textContent = '⏳ Loading…';
  ordersList.innerHTML = `
    <div class="state-msg">
      <div class="spinner" role="status" aria-label="Loading"></div>
      <p>Fetching orders…</p>
    </div>`;
  ordersCount.textContent = 'Loading…';
}

function hideLoading() {
  searchBtn.disabled = false;
  searchBtn.textContent = '📋 Get Orders';
}

function showError(msg) {
  ordersList.innerHTML = `
    <div class="state-msg">
      <span class="icon" aria-hidden="true">⚠️</span>
      <p><strong>Failed to load orders</strong></p>
      <p style="font-size:0.875rem;margin-top:8px;">${escHtml(msg)}</p>
      <button onclick="fetchOrders()" style="margin-top:16px;padding:10px 20px;background:#1a73e8;color:#fff;border:none;border-radius:20px;font-size:0.9rem;cursor:pointer;">
        Retry
      </button>
    </div>`;
  ordersCount.textContent = 'Error';
}

function getStatusClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'shipped':   return 'status-shipped';
    case 'delivered': return 'status-delivered';
    case 'pending':   return 'status-pending';
    case 'cancelled':
    case 'canceled':  return 'status-cancelled';
    default:          return 'status-default';
  }
}

// Convert MM/DD/YYYY (AppSheet) → YYYY-MM-DD (for date input comparison)
function toISODate(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return dateStr; // already ISO or unknown format
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Handle both MM/DD/YYYY (AppSheet) and YYYY-MM-DD
  const iso = toISODate(dateStr);
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
