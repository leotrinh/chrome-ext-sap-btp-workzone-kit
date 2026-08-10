// ==UserScript==
// @name         SAP Workzone Helper V16.5 (Search & Smart Sort)
// @namespace    http://tampermonkey.net/
// @version      16.5
// @description  Dashboard UI + Update HTML5 Content + Bulk Version Update + Enhanced Info + Search App/Config + Sort
// @author       Leo SAP Architect
// @match        *://*.hana.ondemand.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === CONFIG ===
    const DEFAULT_VER = "1.136.17";
    const GRAPHQL_ENDPOINT = "/semantic/graphql";
    const HTML5_ENDPOINT = "/semantic/entity/provider/html5";
    const CONTEXT_ID = "SUB_ACCOUNT";
    const BATCH_SIZE = 5;

    //Leo: only show when in content-manage, site directory
    const REQUIRED_HOST_PART = ".dt.";
    const VALID_HASHES = ["Content-Manage", "Site-Directory", "Provider-Manage", "SubAccount-Settings", "Transport-Manager"];

    // === STATE ===
    let _csrfToken = null;
    let _loadedApps = [];
    let _envContext = { subaccountId: "Unknown", subdomain: "Unknown" };

    //Leo: State for Search & Sort
    let _uiState = {
        searchText: "",
        sortCol: "title", // 'title' or 'currentVer'
        sortDesc: false
    };

    // === HELPERS: CONTEXT EXTRACTION ===
    function initEnvContext() {
        try {
            _envContext.subdomain = window.location.hostname.split('.')[0];
            const metaSelectors = ['meta[name="sap.flp.cf.Config"]', 'meta[name="sap.ushellConfig.siteConfig"]'];
            for (const selector of metaSelectors) {
                const el = document.querySelector(selector);
                if (el && el.content) {
                    try {
                        const conf = JSON.parse(el.content);
                        if (conf.accountData) {
                            if (conf.accountData.tenantId) _envContext.subaccountId = conf.accountData.tenantId;
                            if (conf.accountData.subDomain) _envContext.subdomain = conf.accountData.subDomain;
                            return;
                        }
                        if (conf.tenantId) _envContext.subaccountId = conf.tenantId;
                        else if (conf.identityZoneId) _envContext.subaccountId = conf.identityZoneId;
                    } catch (e) {
                        console.warn(`[Helper] Parse fail: ${selector}`);
                    }
                }
            }
        } catch (e) {
            console.error("[Helper] Init Context Error", e);
        }
    }

    // === UI STYLES ===
    const STYLES = `
        /* Dashboard Container */
        #leoDashboard {
            font-family: '72', sans-serif; font-size: 12px; color: #fff;
            position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
            width: 900px; max-height: 80vh;
            background: #1c222e; border: 1px solid #333; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            z-index: 100000; display: none; flex-direction: column;
            border-radius: 6px;
        }
        #leoHeader {
            padding: 10px 15px; background: #2c3e50; border-bottom: 1px solid #444;
            display: flex; justify-content: space-between; align-items: flex-start;
            border-top-left-radius: 6px; border-top-right-radius: 6px;
        }
        #leoInfoContainer { display: flex; flex-direction: column; gap: 2px; margin-top: 5px; }
        .leo-info-row { font-size: 11px; color: #bbb; }
        .leo-val-blue { color: #33c2ff; font-family: monospace; font-weight: bold; }
        .leo-val-green { color: #2ecc71; font-family: monospace; font-weight: bold; }
        #leoBody { padding: 0; overflow-y: auto; flex: 1; }
        #leoFooter {
            padding: 10px 15px; background: #252a36; border-top: 1px solid #333;
            display: flex; justify-content: flex-end; gap: 10px;
            border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;
        }

        /* Buttons */
        .leo-btn {
            border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;
            transition: all 0.2s; font-size: 11px; display: inline-flex; align-items: center; gap: 5px;
        }
        .btn-primary { background: #0070f2; color: white; }
        .btn-primary:hover { background: #005bb5; }
        .btn-purple { background: #6f42c1; color: white; }
        .btn-purple:hover { background: #59359a; }
        .btn-secondary { background: #3f4a5c; color: #ddd; }
        .btn-secondary:hover { background: #4f5a6c; }
        .btn-success { background: #256f3a; color: white; }
        .btn-success:hover { background: #1e5a30; }
        .btn-danger { background: #8e1c1c; color: white; }

        /* Table */
        #leoTable { width: 100%; border-collapse: collapse; }
        #leoTable th {
            position: sticky; top: 0; background: #151a24; padding: 8px;
            text-align: left; border-bottom: 2px solid #0070f2; font-size: 11px; z-index: 2;
            cursor: pointer; user-select: none;
        }
        #leoTable th:hover { background: #2a313d; }
        #leoTable td { padding: 6px 8px; border-bottom: 1px solid #333; font-size: 11px; vertical-align: middle; }
        #leoTable tr:hover { background: #2a313d; }

        /* Inputs & Tags */
        .leo-input { background: #111; border: 1px solid #444; color: #0f0; padding: 4px; border-radius: 3px; font-family: monospace; }
        .leo-tag { padding: 2px 6px; border-radius: 3px; font-size: 10px; display: inline-block; }
        .tag-na { background: #444; color: #aaa; }
        .tag-ver { background: #004085; color: #b8daff; }

        /* Sort Indicator */
        .sort-icon { margin-left: 5px; opacity: 0.5; font-size: 10px; }
        .sort-active { opacity: 1; color: #00d2ff; }

        /* Custom Modal (Backdrop + Box) */
        #leoModalBackdrop {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 100001; display: none;
            justify-content: center; align-items: center;
        }
        #leoModalBox {
            background: #1c222e; border: 1px solid #444; border-radius: 8px;
            width: 400px; padding: 20px; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: '72', sans-serif;
            transform: scale(0.9); transition: transform 0.2s;
        }
        .leo-modal-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #00d2ff; }
        .leo-modal-content { font-size: 12px; line-height: 1.5; color: #ccc; margin-bottom: 20px; white-space: pre-wrap; word-wrap: break-word; }
        .leo-modal-actions { text-align: right; }
    `;

    // === UI COMPONENTS ===
    function createUI() {
        if (document.getElementById('leoDashboard')) return;

        initEnvContext();

        const style = document.createElement('style');
        style.innerHTML = STYLES;
        document.head.appendChild(style);

        const div = document.createElement('div');
        div.id = 'leoDashboard';
        div.innerHTML = `
            <div id="leoHeader">
                <div>
                    <div style="color: #00d2ff; font-weight: bold; font-size: 14px; margin-bottom: 2px;">SAP Workzone Helper V16.5</div>
                    <div id="leoInfoContainer">
                        <div class="leo-info-row">SubAccount: <span class="leo-val-blue" title="Tenant ID">${_envContext.subaccountId}</span></div>
                        <div class="leo-info-row">Domain: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="leo-val-green" title="SubDomain">${_envContext.subdomain}</span></div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <button id="btnLeoScan" class="leo-btn btn-primary">🔄 Scan & Load Apps</button>
                    <button id="btnLeoHtml5" class="leo-btn btn-purple" title="Trigger manual update for HTML5 provider">☁️ Update HTML5</button>
                    <button id="btnLeoClose" class="leo-btn btn-danger">X</button>
                </div>
            </div>

            <div style="padding: 10px; background: #222; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px;">
                <label>Set Version:</label>
                <input type="text" id="leoGlobalVer" value="${DEFAULT_VER}" class="leo-input" style="width: 90px; color: #fff;">
                <button id="btnLeoApplyAll" class="leo-btn btn-secondary">Apply All</button>

                <div style="width: 1px; height: 20px; background: #444; margin: 0 10px;"></div>

                <input type="text" id="leoSearchInput" class="leo-input" placeholder="🔍 Type here to search " style="width: 200px; color: #fff;">
                <a href="https://ui5.sap.com/versionoverview.html" target="_blank" style="color: #00d2ff; font-size: 11px; text-decoration: none; margin-left: 5px;">
                    ℹ️ UI5 Versions Overview
                </a>

                <span id="leoStatusText" style="margin-left: auto; color: #fb0; font-size: 11px;">Waiting to scan...</span>
            </div>

            <div id="leoBody">
                <table id="leoTable">
                    <thead>
                        <tr>
                            <th width="30"><input type="checkbox" id="chkAll"></th>
                            <th class="leo-sort-th" data-col="title">App Name <span class="sort-icon" id="sort-icon-title">⇅</span></th>
                            <th>Type</th>
                            <th width="120" class="leo-sort-th" data-col="currentVer">Current Config <span class="sort-icon" id="sort-icon-currentVer">⇅</span></th>
                            <th width="120">New Version</th>
                            <th width="100">Status</th>
                        </tr>
                    </thead>
                    <tbody id="leoTableBody">
                        <tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">Click "Scan & Load Apps" to fetch data.</td></tr>
                    </tbody>
                </table>
            </div>
            <div id="leoFooter">
                <button id="btnLeoExec" class="leo-btn btn-success" style="width: 150px;">UPDATE SELECTED</button>
            </div>
        `;

        document.body.appendChild(div);

        createModalHTML();

        // Event Handlers
        document.getElementById('btnLeoClose').onclick = () => {
            div.style.display = 'none';
        };

        document.getElementById('btnLeoScan').onclick = startScan;
        document.getElementById('btnLeoApplyAll').onclick = applyGlobalVersion;
        document.getElementById('btnLeoExec').onclick = startUpdateBatch;
        document.getElementById('btnLeoHtml5').onclick = triggerHtml5Update;

        document.getElementById('chkAll').onclick = (e) => {
            document.querySelectorAll('.chk-row').forEach(c => c.checked = e.target.checked);
        };

        // Leo: Search Handler - Search contains App Name + Current Config
        document.getElementById('leoSearchInput').addEventListener('keyup', (e) => {
            _uiState.searchText = e.target.value;
            renderTable();
        });

        // Leo: Sort Handlers
        document.querySelectorAll('.leo-sort-th').forEach(th => {
            th.onclick = () => {
                const col = th.getAttribute('data-col');
                if (_uiState.sortCol === col) {
                    _uiState.sortDesc = !_uiState.sortDesc;
                } else {
                    _uiState.sortCol = col;
                    // Leo: If sorting Config, default to DESC to show values first
                    _uiState.sortDesc = (col === 'currentVer');
                }
                renderTable();
            };
        });

        createMiniButton();
    }

    function createModalHTML() {
        const backdrop = document.createElement('div');
        backdrop.id = 'leoModalBackdrop';
        backdrop.innerHTML = `
            <div id="leoModalBox">
                <div id="leoModalTitle" class="leo-modal-title">Notification</div>
                <div id="leoModalContent" class="leo-modal-content">Message goes here...</div>
                <div class="leo-modal-actions">
                    <button id="btnLeoModalClose" class="leo-btn btn-primary" style="min-width: 80px;">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        document.getElementById('btnLeoModalClose').onclick = () => {
            document.getElementById('leoModalBackdrop').style.display = 'none';
        };

        backdrop.onclick = (e) => {
            if (e.target === backdrop) backdrop.style.display = 'none';
        };
    }

    function showModal(title, message, isSuccess = true) {
        const backdrop = document.getElementById('leoModalBackdrop');
        const titleEl = document.getElementById('leoModalTitle');
        const contentEl = document.getElementById('leoModalContent');
        const box = document.getElementById('leoModalBox');

        if (!backdrop) return;

        titleEl.innerText = title;
        titleEl.style.color = isSuccess ? '#2ecc71' : '#e74c3c';
        contentEl.innerText = message;
        box.style.border = isSuccess ? '1px solid #2ecc71' : '1px solid #e74c3c';
        backdrop.style.display = 'flex';
        box.style.transform = 'scale(0.9)';

        setTimeout(() => {
            box.style.transform = 'scale(1)';
        }, 50);
    }

    function createMiniButton() {
        const btn = document.createElement('div');
        btn.id = 'leoMiniBtn';
        btn.style = "position: fixed; top: 70px; right: 20px; width: 40px; height: 40px; background: #0070f2; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 99998; display: none; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;";
        btn.innerHTML = "⚡";
        btn.title = "Open SAP Workzone Helper";
        btn.onclick = () => {
            const panel = document.getElementById('leoDashboard');
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        };
        document.body.appendChild(btn);
    }

    function checkVisibility() {
        const btn = document.getElementById('leoMiniBtn');
        if (!btn) return;

        const isDT = window.location.href.includes(REQUIRED_HOST_PART);
        const isHash = VALID_HASHES.some(h => window.location.hash.includes(h));

        btn.style.display = (isDT && isHash) ? 'flex' : 'none';
    }

    async function getCsrfToken() {
        const res = await fetch(GRAPHQL_ENDPOINT, {
            method: 'HEAD',
            headers: { 'x-csrf-token': 'Fetch' }
        });

        return res.headers.get('x-csrf-token');
    }

    async function triggerHtml5Update() {
        const btn = document.getElementById('btnLeoHtml5');
        const originalText = btn.innerHTML;

        if (_envContext.subaccountId === "Unknown") {
            showModal("Error", "SubAccount ID not found.", false);
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = "⏳ Updating...";
            updateStatus("Triggering HTML5 Content Update...");

            const token = await getCsrfToken();

            const payload = {
                "providerId": "saas_approuter",
                "contentAdditionMode": "manual",
                "subdomain": _envContext.subdomain,
                "subaccountId": _envContext.subaccountId
            };

            const res = await fetch(HTML5_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': token
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const text = await res.text();
                showModal("Success", `HTML5 Content Update Triggered!\n\nServer Response: ${text}`, true);
                updateStatus("HTML5 Update Success.");
            } else {
                const errText = await res.text();
                showModal("Failed", `Status: ${res.status}\nError: ${errText}`, false);
                updateStatus("HTML5 Update Failed.");
            }
        } catch (err) {
            console.error(err);
            showModal("Error", err.message, false);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async function fetchListApps(token) {
        let allItems = [];
        let hasNextPage = true;
        let continuationToken = null;

        updateStatus("Fetching App List...");

        while (hasNextPage) {
            const query = {
                "query": "query getEntities($contextId: String!, $contextType: Context!, $queryData: QueryData, $queryOptions: QueryOptions, $tenantId: String) { entities(contextId: $contextId, contextType: $contextType, queryData: $queryData, queryOptions: $queryOptions, tenantId: $tenantId) { items{ id, title, baseId, entityType }, continuationToken } }",
                "variables": {
                    "contextId": CONTEXT_ID,
                    "contextType": CONTEXT_ID,
                    "tenantId": "",
                    "queryData": {
                        "entityTypes": ["businessapp"],
                        "pageSize": 50,
                        "continuationToken": continuationToken
                    },
                    "queryOptions": {}
                }
            };

            const res = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': token
                },
                body: JSON.stringify(query)
            });

            const json = await res.json();

            if (json.data.entities.items) {
                allItems = allItems.concat(json.data.entities.items);
            }

            if (json.data.entities.continuationToken) {
                continuationToken = json.data.entities.continuationToken;
            } else {
                hasNextPage = false;
            }
        }

        return allItems.filter(a => a.baseId === null);
    }

    async function fetchAppDetail(id, token) {
        const query = {
            "query": "query getEntity($baseCdmEntity: BaseCdmEntityInput!) { entity(baseCdmEntity: $baseCdmEntity){ cdm } }",
            "variables": {
                "baseCdmEntity": {
                    "entityId": id,
                    "entityType": "businessapp",
                    "contextId": CONTEXT_ID,
                    "contextType": CONTEXT_ID
                }
            }
        };

        const res = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token
            },
            body: JSON.stringify(query)
        });

        const json = await res.json();
        return json.data.entity;
    }

    async function startScan() {
        const btn = document.getElementById('btnLeoScan');
        const tbody = document.getElementById('leoTableBody');

        btn.disabled = true;
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Scanning... Please wait.</td></tr>`;

        try {
            _csrfToken = await getCsrfToken();

            const localApps = await fetchListApps(_csrfToken);
            updateStatus(`Found ${localApps.length} local apps. Loading details...`);

            _loadedApps = [];

            for (let i = 0; i < localApps.length; i += BATCH_SIZE) {
                const batch = localApps.slice(i, i + BATCH_SIZE);
                updateStatus(`Loading details... ${i}/${localApps.length}`);

                const promises = batch.map(async (app) => {
                    try {
                        const detail = await fetchAppDetail(app.id, _csrfToken);
                        const currentVer = extractVersion(detail.cdm);

                        return {
                            ...app,
                            detailData: detail,
                            currentVer
                        };
                    } catch (e) {
                        return {
                            ...app,
                            detailData: null,
                            currentVer: "Error"
                        };
                    }
                });

                const results = await Promise.all(promises);
                _loadedApps = _loadedApps.concat(results);
            }

            // Leo: Assign original index for safe filtering/sorting
            _loadedApps.forEach((app, idx) => app._origIdx = idx);

            renderTable();
            updateStatus(`Ready. Loaded ${_loadedApps.length} apps.`);
        } catch (err) {
            updateStatus("Error: " + err.message);
            tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Scan Failed.</td></tr>`;
        } finally {
            btn.disabled = false;
        }
    }

    function extractVersion(cdm) {
        if (!cdm || !cdm.payload) return "N/A";

        const p = cdm.payload;

        try {
            const v = p.targetAppConfig['sap.integration'].urlTemplateParams.query['sap-ui-version'];
            if (v) return v;
        } catch(e) {}

        try {
            for (let k in p.visualizations) {
                const v = p.visualizations[k].vizConfig['sap.flp'].target.parameters['sap-ui-version'].value;
                if (v) return v;
            }
        } catch(e) {}

        return "N/A";
    }

    // Leo: Sort & Search Logic
    function renderTable() {
        const tbody = document.getElementById('leoTableBody');
        tbody.innerHTML = "";

        const globalVer = document.getElementById('leoGlobalVer').value;

        // 1. Filter: Search contains App Name + Current Config
        let displayApps = _loadedApps.filter(app => {
            const search = (_uiState.searchText || "").trim().toLowerCase();

            if (!search) return true;

            const appName = (app.title || "").toLowerCase();
            const currentConfig = (app.currentVer || "").toLowerCase();

            return appName.includes(search) || currentConfig.includes(search);
        });

        // 2. Sort
        displayApps.sort((a, b) => {
            const valA = a[_uiState.sortCol];
            const valB = b[_uiState.sortCol];

            // Leo: Special Logic for Config: Group Value vs N/A
            if (_uiState.sortCol === 'currentVer') {
                const wA = (valA && valA !== 'N/A') ? 1 : 0;
                const wB = (valB && valB !== 'N/A') ? 1 : 0;

                if (wA !== wB) {
                    return _uiState.sortDesc ? (wB - wA) : (wA - wB);
                }

                return (valA || '').localeCompare(valB || '');
            }

            // Normal Sort
            const strA = (valA || "").toString().toLowerCase();
            const strB = (valB || "").toString().toLowerCase();

            if (strA < strB) return _uiState.sortDesc ? 1 : -1;
            if (strA > strB) return _uiState.sortDesc ? -1 : 1;

            return 0;
        });

        // 3. Update Icons
        document.getElementById('sort-icon-title').innerHTML = (_uiState.sortCol === 'title' && _uiState.sortDesc) ? '⬇️' : '⬆️';
        document.getElementById('sort-icon-currentVer').innerHTML = (_uiState.sortCol === 'currentVer' && _uiState.sortDesc) ? '⬇️' : '⬆️';

        document.getElementById('sort-icon-title').className = _uiState.sortCol === 'title' ? 'sort-icon sort-active' : 'sort-icon';
        document.getElementById('sort-icon-currentVer').className = _uiState.sortCol === 'currentVer' ? 'sort-icon sort-active' : 'sort-icon';

        // 4. Render
        if (displayApps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:10px; color:#999;">No apps found matching "${_uiState.searchText}"</td></tr>`;
            return;
        }

        displayApps.forEach((app) => {
            const idx = app._origIdx;
            const tr = document.createElement('tr');
            const isNA = app.currentVer === "N/A";

            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" class="chk-row" data-idx="${idx}" checked></td>
                <td><b style="color:#fff;">${app.title}</b><div style="color:#666; font-size:9px;">${app.id}</div></td>
                <td>${app.baseId === null ? '<span class="leo-tag" style="background:#555">Local</span>' : 'Linked'}</td>
                <td>${isNA ? '<span class="leo-tag tag-na">N/A</span>' : `<span class="leo-tag tag-ver">${app.currentVer}</span>`}</td>
                <td><input type="text" class="leo-input inp-ver" data-idx="${idx}" value="${globalVer}"></td>
                <td id="status-${idx}"><span style="color:#666">-</span></td>
            `;

            tbody.appendChild(tr);
        });
    }

    function applyGlobalVersion() {
        const val = document.getElementById('leoGlobalVer').value;

        document.querySelectorAll('.inp-ver').forEach(inp => {
            inp.value = val;
        });
    }

    async function startUpdateBatch() {
        const checkboxes = document.querySelectorAll('.chk-row:checked');

        if (_loadedApps.length === 0 || checkboxes.length === 0) {
            showModal("Action Required", "Please scan apps then select at least one apps for process", false);
            return;
        }

        const btn = document.getElementById('btnLeoExec');

        btn.disabled = true;
        btn.innerText = "Processing...";

        let count = 0;

        for (const chk of checkboxes) {
            const idx = chk.getAttribute('data-idx');
            const app = _loadedApps[idx];
            const newVer = document.querySelector(`.inp-ver[data-idx="${idx}"]`).value;
            const statusCell = document.getElementById(`status-${idx}`);

            if (statusCell) {
                statusCell.innerHTML = `<span style="color:#fb0;">Updating...</span>`;
            }

            try {
                await executeMutation(app.detailData, _csrfToken, newVer);

                if (statusCell) {
                    statusCell.innerHTML = `<span style="color:#0f0;">✅ Done</span>`;
                }

                count++;
            } catch (err) {
                if (statusCell) {
                    statusCell.innerHTML = `<span style="color:#f55;">❌ Fail</span>`;
                }

                console.error(app.title, err);
            }

            await new Promise(r => setTimeout(r, 300));
        }

        updateStatus(`Finished. Updated ${count} apps.`);

        btn.disabled = false;
        btn.innerText = "UPDATE SELECTED";

        showModal("Batch Completed", `Successfully processed ${count} applications.`, true);
    }

    async function executeMutation(detailData, token, targetVersion) {
        if (!detailData) throw new Error("No detail data");

        let cdmObject = JSON.parse(JSON.stringify(detailData.cdm));
        let payload = cdmObject.payload;

        try {
            payload.targetAppConfig['sap.integration'].urlTemplateParams.query['sap-ui-version'] = targetVersion;
        } catch (e) {}

        if (payload.visualizations) {
            for (let key in payload.visualizations) {
                try {
                    payload.visualizations[key].vizConfig['sap.flp'].target.parameters['sap-ui-version'] = {
                        "value": targetVersion,
                        "format": "plain"
                    };
                } catch(e) {}
            }
        }

        const mutationBody = {
            "query": "mutation batchProcess($batchOperations: Batch!, $actions: ActionsRequest, $contextId: String!, $contextType: Context, $isCherryPickScenario: Boolean) { batchProcess(batchOperations: $batchOperations, actions: $actions, contextId: $contextId, contextType: $contextType, isCherryPickScenario: $isCherryPickScenario) { activation } }",
            "variables": {
                "batchOperations": {
                    "BATCH": [
                        {
                            "metadata": {
                                "operation": "UPDATE"
                            },
                            "cdm": cdmObject
                        }
                    ]
                },
                "actions": {},
                "contextId": CONTEXT_ID,
                "contextType": CONTEXT_ID,
                "isCherryPickScenario": false
            }
        };

        const res = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token
            },
            body: JSON.stringify(mutationBody)
        });

        const json = await res.json();

        if (json.errors) {
            throw new Error(json.errors[0].message);
        }
    }

    function updateStatus(msg) {
        document.getElementById('leoStatusText').innerText = msg;
    }

    setTimeout(() => {
        createUI();
        setInterval(checkVisibility, 1000);
    }, 2000);

})();