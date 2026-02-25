// api/shopify-orders.js — GET /api/shopify-orders
// Fetches delivery orders from Shopify Admin API (tagged "Local Delivery Order")
// and normalizes them to match AppSheet field names.

const fetch = require('node-fetch');

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatPhone(phone) {
  if (!phone) return '';
  // Strip to digits only (drop leading +1 for US numbers)
  const digits = phone.replace(/[^\d]/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  }
  return phone; // return as-is if not 10-digit US
}

function parseDeliveryDateTime(order) {
  const attrs = order.note_attributes || [];
  let deliveryDate = '';
  let deliveryTime = '';
  let deliveryNote = '';

  // Parse from note_attributes (e.g. Delivery-Date, Delivery-Time, Delivery-Note)
  for (const attr of attrs) {
    const name = (attr.name || '');
    if (name === 'Delivery-Date') deliveryDate = attr.value || '';
    if (name === 'Delivery-Time') deliveryTime = attr.value || '';
    if (name === 'Delivery-Note') deliveryNote = attr.value || '';
  }

  // Convert YYYY/MM/DD or YYYY-MM-DD to MM/DD/YYYY
  if (deliveryDate) {
    const m = deliveryDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) deliveryDate = `${m[2].padStart(2,'0')}/${m[3].padStart(2,'0')}/${m[1]}`;
  }

  // Fallback: parse MM-DD-YYYY from order tags
  if (!deliveryDate && order.tags) {
    const tagMatch = order.tags.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (tagMatch) deliveryDate = `${tagMatch[1]}/${tagMatch[2]}/${tagMatch[3]}`;
  }

  return { deliveryDate, deliveryTime, deliveryNote };
}

function buildAddress(addr) {
  if (!addr) return '';
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province_code,
    addr.zip,
  ].filter(Boolean);
  return parts.join(', ');
}

function normalizeOrder(order, index) {
  const customer = order.customer || {};
  const shipping = order.shipping_address || order.billing_address || {};
  const { deliveryDate, deliveryTime, deliveryNote } = parseDeliveryDateTime(order);
  const phone = order.phone || shipping.phone || customer.phone || '';

  const lineItems = (order.line_items || []).map(item => ({
    'Product Description': item.title + (item.variant_title ? ` - ${item.variant_title}` : ''),
    'CakeQty': String(item.quantity || ''),
    'Writing Notes': '',
    'Color': '',
    'Add-Ons': '',
    'Line Item Notes': (item.properties || [])
      .filter(p => p.name && !p.name.startsWith('_'))
      .map(p => `${p.name}: ${p.value}`)
      .join('; '),
    'Flavor': '',
  }));

  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
    || (shipping.first_name ? [shipping.first_name, shipping.last_name].filter(Boolean).join(' ') : '');

  return {
    '_RowNumber': index + 1,
    'OrderID': order.name || `#${order.order_number}`,
    'Order Name': customerName,
    'Customer Name': customerName,
    'Order Date': formatDate(order.created_at),
    'Order Notes': deliveryNote || order.note || '',
    'Location': buildAddress(shipping),
    'Total': order.total_price ? `$${parseFloat(order.total_price).toFixed(2)}` : '',
    'Line Items': lineItems,
    'Order Count': String(lineItems.length),
    'PhoneNumber': formatPhone(phone),
    'Status': order.fulfillment_status || 'unfulfilled',
    'Order Type': 'Local Delivery Order',
    'Due Pickup Date': deliveryDate || formatDate(order.created_at),
    'Due Pickup Time': deliveryTime || '',
    'Delivery Address': buildAddress(shipping),
    'Delivery Note': deliveryNote || '',
    'Delivery Attributes': (order.note_attributes || [])
      .filter(a => a.name && !a.name.startsWith('_') && a.name !== 'Checkout-Method' && a.name !== 'Delivery-Location-Id' && a.name !== 'Delivery-Slot-Id')
      .map(a => ({ name: a.name.replace(/-/g, ' '), value: a.value })),
  };
}

// ----------------------------------------------------------------
// Dynamic Token Management (OAuth 2.0 Client Credentials Grant)
// Tokens expire every 24h — cached in memory with 60s buffer.
// ----------------------------------------------------------------
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken(shopDomain, clientId, clientSecret) {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { URLSearchParams } = require('url');
  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token exchange ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 86399) * 1000;
  return cachedToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const shopDomain   = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shopDomain || !clientId || !clientSecret) {
    return res.status(200).json([]);
  }

  try {
    const accessToken = await getAccessToken(shopDomain, clientId, clientSecret);

    // Fetch orders tagged "Local Delivery Order" — up to 250 (max per page)
    const apiUrl = `https://${shopDomain}/admin/api/2025-01/orders.json`
      + `?status=any&limit=250&tag=Local+Delivery+Order`;

    const response = await fetch(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If 401, clear cached token so next request gets a fresh one
      if (response.status === 401) { cachedToken = null; tokenExpiresAt = 0; }
      const text = await response.text();
      throw new Error(`Shopify API ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const orders = (data.orders || []).map(normalizeOrder);

    return res.status(200).json(orders);

  } catch (err) {
    console.error('[shopify-orders] API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
