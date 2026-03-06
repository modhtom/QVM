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

const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const newToken = response.headers.get('X-New-Token');
    if (newToken) {
        const user = getCurrentUser();
        saveAuth(newToken, user);
    }
    return response;
};

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
}

export async function deleteAccount(password) {
    const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ password })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return data.message;
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

export async function forgotPassword(email) {
    const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to request reset');
    return data.message;
}

export async function resetPassword(token, newPassword) {
    const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to reset password');
    return data.message;
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
    const showForgotPasswordLink = document.getElementById('showForgotPassword');
    const backToLoginFromForgot = document.getElementById('backToLoginFromForgot');
    const backToLoginFromReset = document.getElementById('backToLoginFromReset');

    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const forgotPasswordSection = document.getElementById('forgotPasswordSection');
    const resetPasswordSection = document.getElementById('resetPasswordSection');

    function hideAllSections() {
        if (loginSection) loginSection.style.display = 'none';
        if (registerSection) registerSection.style.display = 'none';
        if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
        if (resetPasswordSection) resetPasswordSection.style.display = 'none';
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllSections();
            registerSection.style.display = 'block';
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllSections();
            loginSection.style.display = 'block';
        });
    }
    if (showForgotPasswordLink) {
        showForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllSections();
            forgotPasswordSection.style.display = 'block';
        });
    }
    const showLoginHandler = (e) => {
        e.preventDefault();
        hideAllSections();
        loginSection.style.display = 'block';
    };
    if (backToLoginFromForgot) backToLoginFromForgot.addEventListener('click', showLoginHandler);
    if (backToLoginFromReset) backToLoginFromReset.addEventListener('click', showLoginHandler);

    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');

    if (resetToken && window.location.pathname === '/') {
        hideAllSections();
        if (resetPasswordSection) {
            resetPasswordSection.style.display = 'block';
            if (authPage) authPage.classList.add('active'); // force show auth
        }
    }

    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value.trim();
            const errorEl = document.getElementById('forgotMessage');
            const btn = forgotPasswordForm.querySelector('button[type="submit"]');

            try {
                errorEl.style.color = '#c9d1d9';
                errorEl.textContent = 'جاري الإرسال...';
                btn.disabled = true;
                const msg = await forgotPassword(email);
                errorEl.style.color = '#a5d6a7';
                errorEl.textContent = msg;
            } catch (err) {
                errorEl.style.color = '#ff4444';
                errorEl.textContent = err.message;
            } finally {
                btn.disabled = false;
            }
        });
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmNewPassword').value;
            const errorEl = document.getElementById('resetMessage');
            const btn = resetPasswordForm.querySelector('button[type="submit"]');

            if (pw !== confirm) {
                errorEl.style.color = '#ff4444';
                errorEl.textContent = 'كلمة المرور غير متطابقة';
                return;
            }

            try {
                errorEl.style.color = '#c9d1d9';
                errorEl.textContent = 'جاري الحفظ...';
                btn.disabled = true;
                const msg = await resetPassword(resetToken, pw);
                errorEl.style.color = '#a5d6a7';
                errorEl.textContent = msg + '. يمكنك الآن تسجيل الدخول.';

                setTimeout(() => {
                    // clear token from url
                    window.history.replaceState({}, document.title, window.location.pathname);
                    hideAllSections();
                    loginSection.style.display = 'block';
                }, 3000);
            } catch (err) {
                errorEl.style.color = '#ff4444';
                errorEl.textContent = err.message;
                btn.disabled = false;
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = confirm('هل أنت متأكد من حذف حسابك؟ هذا الإجراء لا يمكن التراجع عنه.');
            if (!confirmed) return;

            const password = prompt('أدخل كلمة المرور لتأكيد الحذف:');
            if (!password) return;

            try {
                await deleteAccount(password);
                alert('تم حذف حسابك بنجاح.');
                window.location.reload();
            } catch (err) {
                alert(err.message);
            }
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
