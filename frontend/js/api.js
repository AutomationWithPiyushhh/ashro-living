// Ashro Living - Core API & Authentication Client
const API_BASE = '/api';

const AshroAPI = {
    async get(endpoint, params = {}) {
        const url = new URL(API_BASE + endpoint, window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.append(key, params[key]);
            }
        });
        const headers = { 'Accept': 'application/json' };
        const token = AuthService.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url.toString(), { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json.data;
    },

    async post(endpoint, data = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        const token = AuthService.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(API_BASE + endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    },

    async put(endpoint, data = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        const token = AuthService.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    }
};

// ================= Authentication Service =================
const AuthService = {
    STORAGE_KEY: 'ashro_auth_user',
    TOKEN_KEY: 'ashro_auth_token',

    async login(email, password) {
        const res = await AshroAPI.post('/auth/login', { email, password });
        if (res.user && res.token) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res.user));
            localStorage.setItem(this.TOKEN_KEY, res.token);
            return res.user;
        }
        throw new Error('Authentication response invalid.');
    },

    async signup(name, email, password, phone = '') {
        const res = await AshroAPI.post('/auth/signup', { name, email, password, phone });
        if (res.user && res.token) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res.user));
            localStorage.setItem(this.TOKEN_KEY, res.token);
            return res.user;
        }
        throw new Error('Registration response invalid.');
    },

    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.TOKEN_KEY);
        window.location.href = '/';
    },

    getCurrentUser() {
        const str = localStorage.getItem(this.STORAGE_KEY);
        try {
            return str ? JSON.parse(str) : null;
        } catch (e) {
            return null;
        }
    },

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    isResident() {
        const user = this.getCurrentUser();
        return user && user.role === 'resident';
    },

    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    }
};

// Toast Notifications Helper (Clean & Editorial)
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Indian Currency Formatter
function formatINR(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
}
