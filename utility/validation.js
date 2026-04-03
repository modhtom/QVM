export function validateUsername(username) {
    if (!username || typeof username !== 'string') return 'Username is required';
    if (username.length < 3 || username.length > 30) return 'Username must be 3-30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    return null;
}

export function validateEmail(email) {
    if (!email || typeof email !== 'string') return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Invalid email format';
    return null;
}

export function validatePassword(password) {
    if (!password || typeof password !== 'string') return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 128) return 'Password must be less than 128 characters';
    return null;
}