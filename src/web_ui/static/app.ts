// MediaFlow Proxy Light - Enhanced WebUI Application
// Alpine.js SPA with modern dashboard

// Configuration
const API_BASE = '';
const STORAGE_KEY = 'mediaflow-webui-config';

// Utility functions
const utils = {
    // Generate unique ID
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); },

    // Debounce
    debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    },

    // Format bytes
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Format duration
    formatDuration(ms) {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    },

    // Format number
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    // Copy to clipboard
    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    },

    // Show toast
    toast(message, type, title) {
        type = type || 'info';
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = '<div class="toast-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : '') + (type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : '') + (type === 'warning' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : '') + (type === 'info' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' : '') + '</svg></div><div class="toast-content">' + (title ? '<div class="toast-title">' + title + '</div>' : '') + '<div class="toast-message">' + message + '</div></div><button class="toast-close" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        toast.querySelector('.toast-close').onclick = function() { toast.remove(); };
        container.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 5000);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    // Build URL with params
    buildUrl(path, params) {
        const url = new URL(path, window.location.origin);
        Object.keys(params).forEach(function(key) {
            if (params[key] !== '' && params[key] !== undefined && params[key] !== null) url.searchParams.set(key, params[key]);
        });
        return url.toString();
    },

    // Parse JSON safely
    parseJson(str, fallback) {
        fallback = fallback || null;
        try { return JSON.parse(str); } catch { return fallback; }
    },

    // Format JSON for display
    formatJson(obj) {
        return JSON.stringify(obj, null, 2);
    },

    // Get API password from UI
    getApiPassword() {
        const el = document.getElementById('apiPassword');
        return el ? el.value.trim() : '';
    },

    // Add auth to params
    addAuth(params) {
        const pwd = this.getApiPassword();
        if (pwd) params.api_password = pwd;
        return params;
    },

    // Fetch with error handling
    async fetchJson(url, options) {
        options = options || {};
        try {
            const res = await fetch(url, {
                method: options.method || 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
                body: options.body
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = text; }
            return { ok: res.ok, status: res.status, data: data, headers: res.headers };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // Load config from localStorage
    loadConfig() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    },

    // Save config to localStorage
    saveConfig(config) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    }
};

// API Service
const api = {
    // Health check
    async health() {
        return utils.fetchJson(API_BASE + '/health');
    },

    // Stream proxy URL generator
    buildStreamProxy(params) {
        return utils.buildUrl('/proxy/stream', params);
    },

    // HLS proxy URL generator
    buildHlsProxy(params) {
        return utils.buildUrl('/proxy/hls/manifest.m3u8', params);
    },

    // Extract video
    async extractVideo(params) {
        return utils.fetchJson(utils.buildUrl('/extractor/video', params));
    },

    // Resolve redirect
    async resolveRedirect(params) {
        return utils.fetchJson(utils.buildUrl('/resolve_redirect', params));
    },

    // Resolve redirect + extract
    async resolveExtract(params) {
        return utils.fetchJson(utils.buildUrl('/resolve_redirect/extract', params));
    },

    // EPG proxy
    async fetchEpg(params) {
        return utils.fetchJson(utils.buildUrl('/proxy/epg', params));
    },

    // Base64 encode
    async base64Encode(data) {
        return utils.fetchJson(API_BASE + '/base64/encode', {
            method: 'POST',
            body: JSON.stringify({ d: data })
        });
    },

    // Base64 decode
    async base64Decode(data) {
        return utils.fetchJson(API_BASE + '/base64/decode', {
            method: 'POST',
            body: JSON.stringify({ d: data })
        });
    },

    // Get metrics
    async getMetrics() {
        const pwd = utils.getApiPassword();
        return utils.fetchJson(utils.buildUrl('/metrics', { api_password: pwd }));
    },

    // Get proxy IP
    async getProxyIp() {
        const pwd = utils.getApiPassword();
        return utils.fetchJson(utils.buildUrl('/proxy/ip', { api_password: pwd }));
    },

    // List supported hosts
    async listHosts() {
        return utils.fetchJson(API_BASE + '/mcp/tools/list_supported_hosts');
    },

    // Auto detect host
    async autoDetectHost(url) {
        return utils.fetchJson(utils.buildUrl('/mcp/tools/auto_detect_host', { d: url }));
    },

    // Playlist builder (returns HTML)
    async playlistBuilder() {
        const pwd = utils.getApiPassword();
        const url = utils.buildUrl('/playlist/builder', { api_password: pwd });
        const res = await fetch(url);
        return { ok: res.ok, html: await res.text() };
    },

    // Speed test (returns HTML)
    async speedtest() {
        const pwd = utils.getApiPassword();
        const url = utils.buildUrl('/speedtest', { api_password: pwd });
        const res = await fetch(url);
        return { ok: res.ok, html: await res.text() };
    }
};

// Main Alpine App
function initApp() {
    // Alpine data
    document.body.setAttribute('x-data', 'app()');
    document.body.setAttribute('x-init', 'init()');
}

// Alpine component
window.app = function() {
    return {
        // State
        activePage: 'dashboard',
        apiPassword: '',
        config: {},
        loading: false,
        error: null,

        // Dashboard data
        stats: {
            requests: 0,
            bandwidth: 0,
            errors: 0,
            uptime: 0
        },
        recentRequests: [],

        // Proxy tool
        proxyForm: {
            type: 'stream',
            url: '',
            headers: '{}',
            filename: ''
        },
        proxyResult: '',

        // HLS tool
        hlsForm: { url: '', headers: '{}' },
        hlsResult: '',

        // Extractor tool
        extractForm: { host: '', url: '', redirect: false },
        extractResult: null,
        extractLoading: false,
        supportedHosts: [],

        // Resolve tool
        resolveForm: { url: '', extract: false },
        resolveResult: null,
        resolveLoading: false,

        // EPG tool
        epgForm: { url: '', ttl: '3600', headers: '{}' },
        epgResult: '',
        epgLoading: false,

        // Base64 tool
        base64Form: { input: '', action: 'encode' },
        base64Result: '',

        // Metrics
        metricsData: '',
        metricsLoading: false,

        // Playlist builder
        playlistHtml: '',
        playlistLoading: false,

        // Speed test
        speedtestHtml: '',
        speedtestLoading: false,

        // Settings
        settings: { theme: 'system', compactMode: false, autoRefresh: true },

        // Init
        async init() {
            this.loadSettings();
            this.apiPassword = utils.loadConfig().apiPassword || '';
            await this.loadHosts();
            await this.checkHealth();
            this.startAutoRefresh();
        },

        // Load settings
        loadSettings() {
            this.settings = Object.assign({}, { theme: 'system', compactMode: false, autoRefresh: true }, utils.loadConfig());
            this.applyTheme();
        },

        saveSettings() {
            utils.saveConfig(Object.assign({}, utils.loadConfig(), this.settings, { apiPassword: this.apiPassword }));
            this.applyTheme();
        },

        applyTheme() {
            document.documentElement.setAttribute('data-theme', this.settings.theme);
        },

        // Health check
        async checkHealth() {
            const res = await api.health();
            if (res.ok) {
                this.showToast('Worker is healthy', 'success');
            }
        },

        // Load supported hosts
        async loadHosts() {
            const res = await api.listHosts();
            if (res.ok && res.data) {
                this.supportedHosts = res.data.hosts || [];
            }
        },

        // Navigation
        setPage(page) {
            this.activePage = page;
            window.scrollTo(0, 0);
            if (page === 'dashboard') this.refreshDashboard();
            if (page === 'metrics' && !this.metricsData) this.fetchMetrics();
        },

        // Auto refresh
        startAutoRefresh() {
            if (this.settings.autoRefresh) {
                setInterval(() => {
                    if (this.activePage === 'dashboard') this.refreshDashboard();
                    if (this.activePage === 'metrics') this.fetchMetrics();
                }, 30000);
            }
        },

        // Dashboard
        async refreshDashboard() {
            const res = await api.getMetrics();
            if (res.ok && res.data) {
                const text = res.data;
                this.parseMetrics(text);
            }
        },

        parseMetrics(text) {
            const lines = text.split('\n');
            const metrics = {};
            lines.forEach(function(line) {
                if (line.startsWith('#') || !line.trim()) return;
                const match = line.match(/^(\w+)\s+(.+)$/);
                if (match) metrics[match[1]] = parseFloat(match[2]);
            });
            this.stats.requests = metrics.mediaflow_requests_total || 0;
            this.stats.bandwidth = metrics.mediaflow_bytes_transferred_total || 0;
            this.stats.errors = metrics.mediaflow_errors_total || 0;
            this.stats.uptime = metrics.mediaflow_uptime_seconds || 0;
        },

        // Proxy Tool
        generateProxyUrl() {
            const type = this.proxyForm.type;
            const url = this.proxyForm.url;
            const headers = this.proxyForm.headers;
            const filename = this.proxyForm.filename;
            if (!url) return this.showToast('Enter a destination URL', 'warning');
            let h = {};
            try { h = JSON.parse(headers); } catch { return this.showToast('Invalid JSON in headers', 'error'); }
            const headerParams = {};
            Object.keys(h).forEach(function(k) { headerParams['h_' + k.replace(/-/g, '_')] = h[k]; });
            const params = utils.addAuth(Object.assign({ d: url }, headerParams));
            if (filename) params.filename = filename;
            const result = type === 'stream' ? api.buildStreamProxy(params) : api.buildHlsProxy(params);
            this.proxyResult = result;
            this.showToast('Proxy URL generated', 'success');
        },

        copyProxyResult() {
            utils.copy(this.proxyResult).then(function(ok) { this.showToast(ok ? 'Copied to clipboard' : 'Failed to copy', ok ? 'success' : 'error'); }.bind(this));
        },

        // Extractor Tool
        async extractVideo() {
            const host = this.extractForm.host;
            const url = this.extractForm.url;
            const redirect = this.extractForm.redirect;
            if (!host || !url) return this.showToast('Select host and enter URL', 'warning');
            this.extractLoading = true;
            this.extractResult = null;
            const params = utils.addAuth({ host: host, d: url, redirect_stream: redirect });
            const res = await api.extractVideo(params);
            this.extractLoading = false;
            if (res.ok) {
                this.extractResult = res.data;
                const status = res.data && res.data.status === 'success' ? 'success' : 'error';
                this.showToast(res.data && res.data.status === 'success' ? 'Stream extracted successfully' : 'Extraction failed', status);
            } else {
                this.showToast(res.error || 'Extraction failed', 'error');
            }
        },

        // Resolve Tool
        async resolveUrl() {
            const url = this.resolveForm.url;
            const extract = this.resolveForm.extract;
            if (!url) return this.showToast('Enter a URL to resolve', 'warning');
            this.resolveLoading = true;
            this.resolveResult = null;
            const params = utils.addAuth({ d: url });
            const endpoint = extract ? '/resolve_redirect/extract' : '/resolve_redirect';
            const res = await utils.fetchJson(utils.buildUrl(endpoint, params));
            this.resolveLoading = false;
            if (res.ok) {
                this.resolveResult = res.data;
                this.showToast('URL resolved', 'success');
            } else {
                this.showToast(res.error || 'Resolution failed', 'error');
            }
        },

        // EPG Tool
        async fetchEpg() {
            const url = this.epgForm.url;
            const ttl = this.epgForm.ttl;
            const headers = this.epgForm.headers;
            if (!url) return this.showToast('Enter EPG URL', 'warning');
            this.epgLoading = true;
            this.epgResult = 'Fetching...';
            let h = {};
            try { h = JSON.parse(headers); } catch { this.epgLoading = false; return this.showToast('Invalid JSON in headers', 'error'); }
            const headerParams = {};
            Object.keys(h).forEach(function(k) { headerParams['h_' + k.replace(/-/g, '_')] = h[k]; });
            const params = utils.addAuth(Object.assign({ d: url, cache_ttl: ttl }, headerParams));
            const res = await api.fetchEpg(params);
            this.epgLoading = false;
            if (res.ok) {
                const cache = res.headers && res.headers.get ? res.headers.get('X-EPG-Cache') || 'UNKNOWN' : 'UNKNOWN';
                const data = typeof res.data === 'string' ? res.data.substring(0, 5000) : JSON.stringify(res.data, null, 2);
                this.epgResult = 'Cache: ' + cache + '\n\n' + data;
                this.showToast('EPG fetched', 'success');
            } else {
                this.epgResult = 'Error: ' + (res.error || 'Failed to fetch EPG');
                this.showToast('EPG fetch failed', 'error');
            }
        },

        // Base64 Tool
        async base64Action() {
            const input = this.base64Form.input;
            const action = this.base64Form.action;
            if (!input) return this.showToast('Enter input', 'warning');
            this.base64Result = 'Processing...';
            const res = action === 'encode' ? await api.base64Encode(input) : await api.base64Decode(input);
            if (res.ok) {
                this.base64Result = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
                this.showToast('Base64 ' + action + 'd', 'success');
            } else {
                this.base64Result = 'Error: ' + res.error;
                this.showToast('Failed', 'error');
            }
        },

        // Metrics
        async fetchMetrics() {
            this.metricsLoading = true;
            const res = await api.getMetrics();
            this.metricsLoading = false;
            if (res.ok) {
                this.metricsData = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
                this.showToast('Metrics loaded', 'success');
            } else {
                this.metricsData = 'Error: ' + res.error;
                this.showToast('Failed to load metrics', 'error');
            }
        },

        // Playlist Builder
        async loadPlaylistBuilder() {
            this.playlistLoading = true;
            const res = await api.playlistBuilder();
            this.playlistLoading = false;
            if (res.ok) {
                this.playlistHtml = res.html;
                this.showToast('Loaded', 'success');
            } else {
                this.showToast('Failed to load', 'error');
            }
        },

        // Speed Test
        async loadSpeedtest() {
            this.speedtestLoading = true;
            const res = await api.speedtest();
            this.speedtestLoading = false;
            if (res.ok) {
                this.speedtestHtml = res.html;
                this.showToast('Loaded', 'success');
            } else {
                this.showToast('Failed to load', 'error');
            }
        },

        // Proxy IP
        async fetchProxyIp() {
            const res = await api.getProxyIp();
            if (res.ok) {
                const data = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
                this.showToast(data, 'info', 'Proxy IP');
            } else {
                this.showToast('Failed to get proxy IP', 'error');
            }
        },

        // Auto detect host
        async autoDetect() {
            const url = this.extractForm.url || this.resolveForm.url;
            if (!url) return this.showToast('Enter a URL first', 'warning');
            const res = await api.autoDetectHost(url);
            if (res.ok && res.data && res.data.host) {
                this.extractForm.host = res.data.host;
                this.showToast('Detected: ' + res.data.host, 'success');
            } else {
                this.showToast('Could not auto-detect host', 'warning');
            }
        },

        // Toast
        showToast(message, type, title) {
            type = type || 'info';
            utils.toast(message, type, title);
        },

        // Format helpers for templates
        formatBytes: utils.formatBytes,
        formatDuration: utils.formatDuration,
        formatNumber: utils.formatNumber,
        formatJson: utils.formatJson
    };
};
