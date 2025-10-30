MYWAI Marketplace Tool - Single Page Events Toolkit

This single-page toolkit integrates with the MYWAI Platform to:
- Receive a payload from the platform (via window.postMessage)
- Fetch facts for a specific equipment
- Display events and, on selection, load assets (images and downloadable files)

Files
- index.html – UI layout and containers
- styles.css – Basic styling
- script.js – Payload reception, API calls, rendering (images/files only)

Run locally (Windows PowerShell)
- Serve statically:
  - python -m http.server 8080
  - npx serve . -l 8080 --single --no-clipboard
  Then open http://localhost:8080/

Auth & payload
window.postMessage({
  type: 'mywai_payload',
  token: 'Bearer <JWT or API token>',
  apiBaseUrl: 'https://rossana.platform.myw.ai/api',
  equipmentId: '191',
  user: { id: 'user-1', name: 'Jane Doe' }
}, '*');

If no payload is provided, paste the token in the UI token field.

API (relative to base URL)
- POST /QualityControlLabelledFact/LabelledFactFilteredPagedMultiImport/1/-1/empty/empty/false
  body: { equipmentId: number, customFieldFilters: null }
- GET  /Detections/getFactMultiMeasure/{factId}/true
- Blobs: {baseURL-without-/api}/blobs/{relativePath}

Notes
- Browser CORS may block direct calls; a local proxy can help during local dev:
  - npx local-cors-proxy --proxyUrl https://rossana.platform.myw.ai --port 3001
  - Use API Base URL = http://localhost:3001/api

Usage
1) Open the page in a browser
2) Ensure API Base URL is https://rossana.platform.myw.ai/api
3) Equipment ID defaults to 191; change if needed
4) Paste Bearer token if not provided by platform
5) Click Load Events, then Open on an event to view images/files

Reference
- Marketplace Tools – MYWAI Docs: https://mywai.gitbook.io/user-manual/marketplace-tools

