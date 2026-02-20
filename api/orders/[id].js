// api/orders/[id].js — GET /api/orders/:id
// Fetches a single order by row number or order number from AppSheet API

const fetch = require('node-fetch');

// Same dummy data as orders.js for consistency
const DUMMY_ORDERS = [
  {
    _RowNumber: 1,
    'Order Number': '1001',
    'Customer Name': 'Alice Johnson',
    'Order Date': '2025-03-10',
    'Status': 'Shipped',
    'Total': '$124.50',
    'Email': 'alice@example.com',
    'Phone': '555-0101',
    'Shipping Address': '123 Main St, Springfield, IL 62701',
    'Notes': 'Leave at door',
    'Line Items': [
      { 'Product': 'Widget A', 'Qty': 2, 'Unit Price': '$12.25', 'Line Total': '$24.50' },
      { 'Product': 'Gadget B', 'Qty': 1, 'Unit Price': '$100.00', 'Line Total': '$100.00' }
    ]
  },
  {
    _RowNumber: 2,
    'Order Number': '1002',
    'Customer Name': 'Bob Martinez',
    'Order Date': '2025-03-11',
    'Status': 'Pending',
    'Total': '$56.00',
    'Email': 'bob@example.com',
    'Phone': '555-0102',
    'Shipping Address': '456 Oak Ave, Chicago, IL 60601',
    'Notes': '',
    'Line Items': [
      { 'Product': 'Doohickey C', 'Qty': 4, 'Unit Price': '$14.00', 'Line Total': '$56.00' }
    ]
  },
  {
    _RowNumber: 3,
    'Order Number': '1003',
    'Customer Name': 'Carol White',
    'Order Date': '2025-03-12',
    'Status': 'Delivered',
    'Total': '$210.75',
    'Email': 'carol@example.com',
    'Phone': '555-0103',
    'Shipping Address': '789 Pine Rd, Rockford, IL 61101',
    'Notes': 'Fragile items',
    'Line Items': [
      { 'Product': 'Widget A', 'Qty': 5, 'Unit Price': '$12.25', 'Line Total': '$61.25' },
      { 'Product': 'Premium Kit', 'Qty': 1, 'Unit Price': '$149.50', 'Line Total': '$149.50' }
    ]
  },
  {
    _RowNumber: 4,
    'Order Number': '1004',
    'Customer Name': 'David Lee',
    'Order Date': '2025-03-13',
    'Status': 'Cancelled',
    'Total': '$30.00',
    'Email': 'david@example.com',
    'Phone': '555-0104',
    'Shipping Address': '321 Elm St, Peoria, IL 61602',
    'Notes': 'Customer requested cancellation',
    'Line Items': [
      { 'Product': 'Gadget B', 'Qty': 1, 'Unit Price': '$30.00', 'Line Total': '$30.00' }
    ]
  },
  {
    _RowNumber: 5,
    'Order Number': '1005',
    'Customer Name': 'Eva Green',
    'Order Date': '2025-03-14',
    'Status': 'Shipped',
    'Total': '$88.00',
    'Email': 'eva@example.com',
    'Phone': '555-0105',
    'Shipping Address': '654 Maple Dr, Aurora, IL 60505',
    'Notes': '',
    'Line Items': [
      { 'Product': 'Doohickey C', 'Qty': 2, 'Unit Price': '$14.00', 'Line Total': '$28.00' },
      { 'Product': 'Widget A', 'Qty': 4, 'Unit Price': '$12.25', 'Line Total': '$49.00' },
      { 'Product': 'Sprocket D', 'Qty': 1, 'Unit Price': '$11.00', 'Line Total': '$11.00' }
    ]
  },
  {
    _RowNumber: 6,
    'Order Number': '1006',
    'Customer Name': 'Frank Bishop',
    'Order Date': '2025-03-15',
    'Status': 'Pending',
    'Total': '$45.25',
    'Email': 'frank@example.com',
    'Phone': '555-0106',
    'Shipping Address': '987 Cedar Ln, Joliet, IL 60432',
    'Notes': 'Call before delivery',
    'Line Items': [
      { 'Product': 'Sprocket D', 'Qty': 3, 'Unit Price': '$12.25', 'Line Total': '$36.75' },
      { 'Product': 'Clip E', 'Qty': 1, 'Unit Price': '$8.50', 'Line Total': '$8.50' }
    ]
  }
];

function isDummyMode() {
  const appId  = process.env.APPSHEET_APP_ID  || '';
  const apiKey = process.env.APPSHEET_API_KEY || '';
  return !appId || appId === 'your_app_id_here' ||
         !apiKey || apiKey === 'your_api_key_here';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  if (isDummyMode()) {
    const order = DUMMY_ORDERS.find(
      o => String(o._RowNumber) === String(id) || o['Order Number'] === String(id)
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json(order);
  }

  const appId     = process.env.APPSHEET_APP_ID;
  const apiKey    = process.env.APPSHEET_API_KEY;
  const tableName = process.env.APPSHEET_TABLE_NAME || 'Orders';

  try {
    const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'ApplicationAccessKey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Action: 'Find',
        Properties: {
          Locale: 'en-US',
          Timezone: 'US/Eastern',
          Selector: `FILTER("${tableName}", [_RowNumber] = ${parseInt(id, 10) || 0})`
        },
        Rows: []
      })
    });

    const data = await response.json();
    if (data?.error) throw new Error(data.error);

    const rows = Array.isArray(data) ? data : (data?.rows ?? []);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    return res.status(200).json(rows[0]);

  } catch (err) {
    console.error(`[orders/${id}] AppSheet API error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
