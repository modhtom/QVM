const TOKEN_KEY = 'qvm_auth_token';
const USER_KEY = 'qvm_auth_user';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeaders() {
    const token = getToken();
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
}

export function isLoggedIn() {
    return !!getToken();
}

export function getCurrentUser() {
    try {
        const userStr = localStorage.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
}

function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
}

export async function login(username, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }

    saveAuth(data.token, data.user);
    return data.user;
}

export async function register(username, email, password) {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
    }

    saveAuth(data.token, data.user);
    return data.user;
}

export function initAuthUI() {
    const authPage = document.getElementById('authPage');
    if (!authPage) return;

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            const btn = loginForm.querySelector('button[type="submit"]');

            try {
                errorEl.textContent = '';
                btn.disabled = true;
                btn.textContent = 'جاري الدخول...';
                await login(username, password);
                updateAuthState();
            } catch (err) {
                errorEl.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'تسجيل الدخول';
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const errorEl = document.getElementById('registerError');
            const btn = registerForm.querySelector('button[type="submit"]');

            if (password !== confirmPassword) {
                errorEl.textContent = 'كلمة المرور غير متطابقة';
                return;
            }

            try {
                errorEl.textContent = '';
                btn.disabled = true;
                btn.textContent = 'جاري التسجيل...';
                await register(username, email, password);
                updateAuthState();
            } catch (err) {
                errorEl.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'إنشاء حساب';
            }
        });
    }

    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.style.display = 'none';
            registerSection.style.display = 'block';
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerSection.style.display = 'none';
            loginSection.style.display = 'block';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

export function updateAuthState() {
    const authPage = document.getElementById('authPage');
    const mainMenu = document.getElementById('mainMenu');
    const userInfo = document.getElementById('userInfo');

    if (isLoggedIn()) {
        if (authPage) authPage.classList.remove('active');
        if (mainMenu) mainMenu.classList.add('active');

        const user = getCurrentUser();
        if (userInfo && user) {
            userInfo.style.display = 'flex';
            const usernameEl = document.getElementById('currentUsername');
            if (usernameEl) usernameEl.textContent = user.username;
        }
    } else {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        if (authPage) authPage.classList.add('active');
        if (userInfo) userInfo.style.display = 'none';
    }
}
