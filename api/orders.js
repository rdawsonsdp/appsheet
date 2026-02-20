// api/orders.js — GET /api/orders
// Fetches all orders from AppSheet and joins line items from Bakery Products Ordered

const fetch = require('node-fetch');

async function appsheetFind(appId, apiKey, tableName) {
  const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'ApplicationAccessKey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Action: 'Find',
      Properties: { Locale: 'en-US', Timezone: 'US/Central' },
      Rows: []
    })
  });

  const data = await response.json();
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data) ? data : (data?.rows ?? []);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const appId         = process.env.APPSHEET_APP_ID;
  const apiKey        = process.env.APPSHEET_API_KEY;
  const ordersTable   = process.env.APPSHEET_TABLE_NAME        || 'Customer Orders';
  const lineItemsTable = process.env.APPSHEET_LINE_ITEMS_TABLE || 'Bakery Products Ordered';

  try {
    // Fetch orders and line items in parallel
    const [orders, lineItems] = await Promise.all([
      appsheetFind(appId, apiKey, ordersTable),
      appsheetFind(appId, apiKey, lineItemsTable)
    ]);

    // Join on OrderID (FK in both tables)
    const itemsByOrder = {};
    lineItems.forEach(item => {
      const key = String(item['OrderID'] || '');
      if (!key) return;
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    });

    // Attach line items to each order
    const ordersWithItems = orders.map(order => {
      const key = String(order['OrderID'] || '');
      return {
        ...order,
        'Line Items': itemsByOrder[key] || []
      };
    });

    return res.status(200).json(ordersWithItems);

  } catch (err) {
    console.error('[orders] AppSheet API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
