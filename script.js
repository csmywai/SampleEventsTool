/*
  MYWAI Marketplace Tool - Single Page Events Toolkit

  Features:
  - Receive payload via window.postMessage
  - Use API base URL, bearer token, and equipmentId (payload can override inputs)
  - Fetch facts for an equipment and render images and files (no timeseries)

  Expected payload example:
  window.postMessage({
    type: 'mywai_payload',
    token: 'Bearer <token>',
    apiBaseUrl: 'https://rossana.platform.myw.ai/api',
    equipmentId: '191',
    user: { id: 'user-1', name: 'Jane Doe' }
  }, '*')

  API (relative to base URL):
  - POST /QualityControlLabelledFact/LabelledFactFilteredPagedMultiImport/1/-1/empty/empty/false
      body: { equipmentId: number, customFieldFilters: null }
  - GET  /Detections/getFactMultiMeasure/{factId}/true
  Blobs: {baseURL-without-/api}/blobs/{relativePath}
*/

(function () {
  const state = {
    token: null,
    apiBaseUrl: null,
    equipmentId: null,
    user: null,
  };

  // DOM references
  const $userMeta = document.getElementById('userMeta');
  const $apiBaseUrl = document.getElementById('apiBaseUrl');
  const $authToken = document.getElementById('authToken');
  const $equipmentId = document.getElementById('equipmentId');
  const $loadEventsBtn = document.getElementById('loadEventsBtn');
  const $eventsList = document.getElementById('eventsList');
  const $eventDetails = document.getElementById('eventDetails');
  // Timeseries elements removed
  const $imagesGrid = document.getElementById('imagesGrid');
  const $filesList = document.getElementById('filesList');
  const $footer = document.querySelector('.app-footer');

  // Defaults for standalone usage; payload will override when embedded
  $apiBaseUrl.value = 'https://rossana.platform.myw.ai/api';
  $equipmentId.value = '191';
  // No API mode; we always use MYWAI endpoints with the provided base URL

  window.addEventListener('message', (evt) => {
    const data = evt?.data;
    if (!data) return;
    // New platform bootstrap format
    if (data.message === 'mywai-tool-init') {
      const mapped = mapPlatformInitToPayload(data);
      applyPayload(mapped);
      return;
    }
    // Backward-compat payload format
    if (data.type === 'mywai_payload') {
      applyPayload(data);
      return;
    }
  });

  // Proactively acknowledge (with a short delay) so the platform will send the init payload
  try {
    setTimeout(() => {
      try { window.parent?.postMessage('acknowledgment', '*'); } catch {}
    }, 300);
  } catch {}

  function applyPayload(payload) {
    state.apiBaseUrl = payload.apiBaseUrl || state.apiBaseUrl || $apiBaseUrl.value || null;
    state.token = normalizeToken(payload.token) || state.token;
    state.equipmentId = payload.equipmentId || payload.datasetVersionId || state.equipmentId || $equipmentId.value || null;
    state.user = payload.user || state.user;

    if (state.apiBaseUrl) $apiBaseUrl.value = state.apiBaseUrl;
    if (state.equipmentId) $equipmentId.value = state.equipmentId;
    if (state.token && $authToken) $authToken.value = state.token.replace(/^Bearer\s+/i, '');

    // Hide inputs when values are supplied by the platform
    if (state.apiBaseUrl && $apiBaseUrl?.parentElement) {
      $apiBaseUrl.parentElement.style.display = 'none';
    }
    if (state.token && $authToken?.parentElement) {
      $authToken.parentElement.style.display = 'none';
    }
    const $controlsNote = document.getElementById('controlsNote');
    if ($controlsNote && (state.apiBaseUrl || state.token)) {
      $controlsNote.style.display = 'none';
    }

    // Hide footer hint once payload is received
    if ($footer) {
      $footer.style.display = 'none';
    }

    if (state.user) {
      $userMeta.textContent = `${state.user.name || state.user.id || 'User'} @ ${new URL(state.apiBaseUrl).host}`;
    } else if (state.token) {
      $userMeta.textContent = `Authenticated @ ${safeHost(state.apiBaseUrl)}`;
    } else {
      $userMeta.textContent = 'Not authenticated';
    }
  }

  function mapPlatformInitToPayload(message) {
    const token = message?.user?.['auth-token'] || message?.user?.authToken || null;
    const apiBaseUrl = message?.config?.['api-endpoint'] || message?.config?.apiEndpoint || null;
    const equipmentId = message?.flowiseContext?.equipmentId || null;
    const user = message?.user ? {
      id: message.user.id,
      name: [message.user.name, message.user.surname].filter(Boolean).join(' ') || message.user.email || message.user.id,
      email: message.user.email
    } : null;
    return {
      type: 'mywai_payload',
      token,
      apiBaseUrl,
      equipmentId,
      user
    };
  }

  function normalizeToken(token) {
    if (!token) return null;
    const trimmed = String(token).trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) return trimmed;
    return `Bearer ${trimmed}`;
  }

  function safeHost(url) {
    try { return new URL(url).host; } catch { return 'unknown-host'; }
  }

  async function fetchJson(path) {
    if (!state.apiBaseUrl) throw new Error('API base URL not set');
    const url = `${state.apiBaseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': state.token } : {}),
      },
      credentials: 'omit',
    });
    const { json, text } = await readBody(res);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status || 0} ${res.statusText || ''} for ${path} ${text ? `- body: ${truncate(text, 200)}` : ''}`.trim());
    }
    return json ?? {};
  }

  async function postJson(path, body) {
    if (!state.apiBaseUrl) throw new Error('API base URL not set');
    const url = `${state.apiBaseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': state.token } : {}),
      },
      credentials: 'omit',
      body: JSON.stringify(body || {})
    });
    const { json, text } = await readBody(res);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status || 0} ${res.statusText || ''} for ${path} ${text ? `- body: ${truncate(text, 200)}` : ''}`.trim());
    }
    return json ?? {};
  }

  async function readBody(res) {
    let text = '';
    try { text = await res.text(); } catch {}
    if (!text) return { json: null, text: '' };
    try { return { json: JSON.parse(text), text }; } catch { return { json: null, text }; }
  }

  function truncate(s, n) {
    if (!s) return s;
    return s.length <= n ? s : s.slice(0, n) + '…';
  }

  function renderEvents(events) {
    $eventsList.innerHTML = '';
    $eventsList.classList.toggle('empty', events.length === 0);
    if (events.length === 0) {
      $eventsList.textContent = 'No events found.';
      return;
    }

    for (const ev of events) {
      const item = document.createElement('div');
      item.className = 'event-item';

      const title = document.createElement('div');
      title.innerHTML = `<strong>${escapeHtml(ev.name || ev.type || ev.id)}</strong>`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      const date = ev.occurredAt ? new Date(ev.occurredAt) : null;
      meta.textContent = [date ? date.toLocaleString() : null, ev.summary].filter(Boolean).join(' • ');

      const left = document.createElement('div');
      left.appendChild(title);
      left.appendChild(meta);

      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = 'Open';
      btn.addEventListener('click', () => onSelectEvent(ev));

      item.appendChild(left);
      item.appendChild(btn);
      $eventsList.appendChild(item);
    }
  }

  function setEventDetails(ev) {
    $eventDetails.classList.toggle('empty', !ev);
    if (!ev) {
      $eventDetails.textContent = 'Select an event to view details.';
      return;
    }

    const dateStr = ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : 'N/A';
    $eventDetails.innerHTML = `
      <div>
        <div><strong>${escapeHtml(ev.name || ev.type || ev.id)}</strong></div>
        <div class="labels">${escapeHtml(ev.id)} • ${escapeHtml(dateStr)}</div>
      </div>
      <div>
        <span class="labels">${escapeHtml(ev.summary || '')}</span>
      </div>
    `;
  }

  async function onLoadEvents() {
    // Update state from inputs if not overridden by payload
    state.apiBaseUrl = $apiBaseUrl.value || state.apiBaseUrl;
    state.equipmentId = $equipmentId.value || state.equipmentId;
    if ($authToken && $authToken.value && !state.token) {
      state.token = normalizeToken($authToken.value);
    }

    if (!state.apiBaseUrl) {
      alert('Please set API Base URL');
      return;
    }
    if (!state.equipmentId) {
      alert('Please set Equipment ID');
      return;
    }

    setEventDetails(null);
    renderImages([]);
    renderFiles([]);

    $eventsList.classList.remove('empty');
    $eventsList.innerHTML = '<div class="note">Loading events…</div>';
    try {
      // Fetch facts list by equipmentId
      const equipmentId = Number(state.equipmentId);
      const resp = await postJson(`/QualityControlLabelledFact/LabelledFactFilteredPagedMultiImport/1/-1/empty/empty/false`, {
        equipmentId,
        customFieldFilters: null
      });
      const items = Array.isArray(resp) ? resp : (Array.isArray(resp?.items) ? resp.items : []);
      const events = items.map((it, idx) => ({
        id: it.id || it.factId || it.Id || it.FactId || `fact-${idx}`,
        name: it.serialNumber || it.equipmentName || 'Fact',
        occurredAt: it.timeStamp || it.timestamp || it.occurredAt || it.createdAt || null,
        summary: it.latestLabel || it.description || '',
        __raw: it
      })).filter(e => e.id);
      renderEvents(events);
    } catch (err) {
      console.error(err);
      $eventsList.classList.add('empty');
      $eventsList.textContent = `Failed to load events: ${String(err.message || err)}`;
    }
  }

  async function onSelectEvent(ev) {
    setEventDetails(ev);
    $imagesGrid.classList.remove('empty');
    $imagesGrid.innerHTML = '<div class="note">Loading images…</div>';
    $filesList.classList.remove('empty');
    $filesList.innerHTML = '<div class="note">Loading files…</div>';

    try {
      // If we already have the fact payload, reuse; otherwise re-fetch.
      let factPayload = ev.__mywaiFact;
      if (!factPayload) {
        const factId = ev.id || ev.factId || ev.FactId || ev.Id;
        factPayload = await fetchJson(`/Detections/getFactMultiMeasure/${encodeURIComponent(factId)}/true`);
      }
      const assets = buildAssetsFromMywaiFactSpecific(factPayload, state.apiBaseUrl);
      renderImages(assets.images || []);
      renderFiles(assets.files || []);
    } catch (err) {
      console.error(err);
      $imagesGrid.classList.add('empty');
      $imagesGrid.textContent = `Failed to load images`;
      $filesList.classList.add('empty');
      $filesList.textContent = `Failed to load files`;
    }
  }

  function buildAssetsFromMywaiFactSpecific(factPayload, apiBaseUrl) {
    const baseWithNoApi = (apiBaseUrl || '').replace(/\/$/, '').replace(/\/api$/i, '');
    const toBlobUrl = (rel) => `${baseWithNoApi}/blobs/${String(rel).replace(/^\/+/, '')}`;

    const images = [];
    const files = [];

    for (const [measureKey, measureArr] of Object.entries(factPayload || {})) {
      if (!Array.isArray(measureArr)) continue;
      for (const measure of measureArr) {
        const measureName = measure?.measure || measureKey;
        const dataArr = Array.isArray(measure?.data) ? measure.data : [];
        for (const d of dataArr) {
          const serieName = d?.serie || measureName || 'Series';
          const values = Array.isArray(d?.values) ? d.values : [];
          for (const v of values) {
            const uri = v?.blobMetadata?.uri || v?.stringValue;
            if (uri) {
              const absUrl = toBlobUrl(uri);
              const name = fileName(uri);
              if ((measureName || '').toLowerCase() === 'image' || (serieName || '').toLowerCase() === 'image') {
                images.push({ url: absUrl, name });
              } else {
                files.push({ url: absUrl, name });
              }
            }
            // No timeseries extraction (removed)
          }
        }
      }
    }

    return { images, files };
  }

  // dumpParams preview removed

  // normalizePoint removed (no timeseries)

  // Timeseries visualization removed

  function renderImages(images) {
    $imagesGrid.innerHTML = '';
    const valid = (images || []).filter(img => !!img?.url);
    $imagesGrid.classList.toggle('empty', valid.length === 0);
    if (valid.length === 0) {
      $imagesGrid.textContent = 'No images.';
      return;
    }
    for (const img of valid) {
      const wrap = document.createElement('div');
      wrap.className = 'item';

      const el = document.createElement('img');
      el.src = img.url;
      el.alt = img.name || 'image';

      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.title = img.name || '';
      caption.textContent = img.name || '';

      wrap.appendChild(el);
      wrap.appendChild(caption);
      $imagesGrid.appendChild(wrap);
    }
  }

  function renderFiles(files) {
    $filesList.innerHTML = '';
    const valid = (files || []).filter(f => !!f?.url);
    $filesList.classList.toggle('empty', valid.length === 0);
    if (valid.length === 0) {
      $filesList.textContent = 'No files.';
      return;
    }
    for (const f of valid) {
      const item = document.createElement('div');
      item.className = 'file-item';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = f.name || f.url;

      const a = document.createElement('a');
      a.href = f.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'btn small';
      a.download = '';
      a.textContent = 'Download';

      item.appendChild(name);
      item.appendChild(a);
      $filesList.appendChild(item);
    }
  }

  // palette removed (no chart)

  function fileName(path) {
    try {
      const s = String(path);
      const parts = s.split(/[/\\]/);
      const last = parts[parts.length - 1];
      return last || s;
    } catch {
      return String(path ?? 'file');
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  $loadEventsBtn.addEventListener('click', onLoadEvents);

  // Expose test helpers in console for local development
  Object.assign(window, {
    mywaiDev: {
      sendTestPayload(payload = {}) {
        window.postMessage({ type: 'mywai_payload', apiBaseUrl: $apiBaseUrl.value, equipmentId: $equipmentId.value, ...payload }, '*');
      }
    }
  });
})();


