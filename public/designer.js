/* =================================================================
   designer.js — Template Designer logic
   ================================================================= */

'use strict';

// ----------------------------------------------------------------
// Default Template (kept in sync with app.js)
// ----------------------------------------------------------------
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
let sampleOrder = null;
let editor      = null;

// ----------------------------------------------------------------
// DOM refs
// ----------------------------------------------------------------
const tabBtns             = document.querySelectorAll('.tab-btn');
const tabPanels           = document.querySelectorAll('.tab-panel');
const saveBtn             = document.getElementById('saveBtn');
const resetBtn            = document.getElementById('resetBtn');
const fieldsBtn           = document.getElementById('fieldsBtn');
const saveFeedback        = document.getElementById('saveFeedback');
const previewInner        = document.getElementById('previewInner');
const fieldsModalBackdrop = document.getElementById('fieldsModalBackdrop');
const closeFieldsModal    = document.getElementById('closeFieldsModal');
const fieldsList          = document.getElementById('fieldsList');
const editorWrap          = document.getElementById('editorWrap');

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initEditor();
  bindTabEvents();
  bindToolbarEvents();
  bindModalEvents();
  fetchSampleOrder();
});

// ----------------------------------------------------------------
// CodeMirror Init
// ----------------------------------------------------------------
function initEditor() {
  const textarea = document.createElement('textarea');
  editorWrap.appendChild(textarea);

  editor = CodeMirror.fromTextArea(textarea, {
    mode: 'htmlmixed',
    theme: 'material',
    lineNumbers: true,
    lineWrapping: true,
    indentWithTabs: false,
    tabSize: 2,
    // Mobile-friendly: softer keyboard interaction
    extraKeys: {
      'Tab': cm => cm.execCommand('insertSoftTab')
    }
  });

  // Load saved template or default
  const saved = localStorage.getItem('orderPrintTemplate');
  editor.setValue(saved || DEFAULT_TEMPLATE);

  // Make CodeMirror fill the editor-wrap height properly
  // (the CSS sets height:100% but CM needs a refresh after attach)
  setTimeout(() => editor.refresh(), 50);
}

// ----------------------------------------------------------------
// Tab Switching
// ----------------------------------------------------------------
function bindTabEvents() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => {
        const active = b.dataset.tab === target;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });

      tabPanels.forEach(panel => {
        const isTarget = panel.id === `panel-${target}`;
        panel.classList.toggle('active', isTarget);
        panel.hidden = !isTarget;
      });

      if (target === 'preview') {
        renderPreview();
      } else {
        // Refresh CM after becoming visible
        setTimeout(() => editor && editor.refresh(), 50);
      }
    });
  });
}

// ----------------------------------------------------------------
// Toolbar Events
// ----------------------------------------------------------------
function bindToolbarEvents() {
  saveBtn.addEventListener('click', saveTemplate);
  resetBtn.addEventListener('click', resetTemplate);
  fieldsBtn.addEventListener('click', openFieldsModal);
}

function saveTemplate() {
  const val = editor.getValue();
  localStorage.setItem('orderPrintTemplate', val);
  showSaveFeedback();
}

function resetTemplate() {
  if (!confirm('Reset to the default template? Your custom template will be lost.')) return;
  localStorage.removeItem('orderPrintTemplate');
  editor.setValue(DEFAULT_TEMPLATE);
  showSaveFeedback('✓ Reset to default');
}

function showSaveFeedback(msg = '✓ Saved!') {
  saveFeedback.textContent = msg;
  saveFeedback.hidden = false;
  setTimeout(() => { saveFeedback.hidden = true; }, 2500);
}

// ----------------------------------------------------------------
// Preview Rendering
// ----------------------------------------------------------------
function renderPreview() {
  const template = editor.getValue();
  const order    = sampleOrder || getSampleOrderFallback();

  let html = template;

  // Handle conditional blocks
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

  // Inject print-order class styles inline for preview
  previewInner.innerHTML = `<div class="print-order" style="padding:0;">${html}</div>`;
}

function buildLineItemsTable(order) {
  const items = order['Line Items'];
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '<p style="color:#666;font-style:italic;font-size:10pt;">No line items.</p>';
  }
  const rows = items.map(item => {
    const product = item['Product Name'] || item['Product'] || item['Item'] || item['Order Details'] || item['Description'] || '';
    const qty     = item['Qty'] || item['Quantity'] || item['QTY'] || '';
    return `<tr>
      <td class="slip-check-cell"></td>
      <td class="slip-detail-cell">${escHtml(String(product))}</td>
      <td class="slip-qty-cell">${escHtml(String(qty))}</td>
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
// Fetch Sample Order (for preview + fields list)
// ----------------------------------------------------------------
async function fetchSampleOrder() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const orders = await res.json();
    if (Array.isArray(orders) && orders.length > 0) {
      sampleOrder = orders[0];
    }
    populateFieldsList();
  } catch {
    // Graceful degradation — use fallback sample
    sampleOrder = getSampleOrderFallback();
    populateFieldsList();
  }
}

function getSampleOrderFallback() {
  return {
    _RowNumber: 1,
    'Order Number': '1001',
    'Customer Name': 'Sample Customer',
    'Order Date': '2025-03-15',
    'Status': 'Shipped',
    'Total': '$99.00',
    'Email': 'sample@example.com',
    'Phone': '555-0100',
    'Shipping Address': '123 Sample St, Anytown, IL 00000',
    'Notes': 'Sample notes',
    'Line Items': [
      { 'Product': 'Sample Item', 'Qty': 1, 'Unit Price': '$99.00', 'Line Total': '$99.00' }
    ]
  };
}

// ----------------------------------------------------------------
// Fields Modal
// ----------------------------------------------------------------
function bindModalEvents() {
  closeFieldsModal.addEventListener('click', closeModal);
  fieldsModalBackdrop.addEventListener('click', e => {
    if (e.target === fieldsModalBackdrop) closeModal();
  });
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !fieldsModalBackdrop.hidden) closeModal();
  });
}

function openFieldsModal() {
  fieldsModalBackdrop.hidden = false;
  closeFieldsModal.focus();
}

function closeModal() {
  fieldsModalBackdrop.hidden = true;
  fieldsBtn.focus();
}

function populateFieldsList() {
  const order = sampleOrder || getSampleOrderFallback();

  // Build field list — all top-level keys + special placeholders
  const specialFields = [
    { key: 'LINE_ITEMS_TABLE', note: 'Renders a table of line items' },
    { key: 'PRINT_DATE',       note: 'Today\'s date at print time' }
  ];

  const orderFields = Object.keys(order)
    .filter(k => k !== 'Line Items') // handled by LINE_ITEMS_TABLE
    .map(k => ({ key: k, note: String(order[k] ?? '').slice(0, 40) }));

  const allFields = [...orderFields, ...specialFields];

  fieldsList.innerHTML = allFields.map(f => `
    <div class="field-item" role="listitem">
      <span class="field-placeholder">{{${escHtml(f.key)}}}</span>
      <span class="field-key">${escHtml(f.note)}</span>
      <button class="btn-insert" data-placeholder="{{${escHtml(f.key)}}}" type="button">Insert</button>
    </div>
  `).join('');

  fieldsList.querySelectorAll('.btn-insert').forEach(btn => {
    btn.addEventListener('click', () => {
      const placeholder = btn.dataset.placeholder;
      if (editor) {
        editor.replaceSelection(placeholder);
        editor.focus();
      }
      closeModal();
    });
  });
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
