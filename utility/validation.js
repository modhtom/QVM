import dns from 'dns';
import net from 'net';

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

export async function validateSafeUrl(urlString) {
    if (!urlString || typeof urlString !== 'string')
        return 'URL is required';
    
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch (e) {
        return 'Invalid URL format';
    }
    
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Only HTTP and HTTPS protocols are allowed';
    }
    
    const host = parsed.hostname;
    if (!host) {
        return 'Hostname is missing in URL';
    }
    
    let resolvedIps = [];
    if (net.isIP(host)) {
        resolvedIps.push({ address: host });
    } else {
        try {
            const lookupResult = await dns.promises.lookup(host, { all: true });
            resolvedIps = lookupResult;
        } catch (err) {
            return 'Failed to resolve hostname';
        }
    }
    
    for (const { address } of resolvedIps) {
        if (isPrivateIP(address)) {
            return `Access to private or local network is forbidden: ${address}`;
        }
    }
    
    return null;
}

function isPrivateIP(ip) {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        
        if (parts[0] === 127) return true;
        if (parts[0] === 10) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        if (parts[0] === 172 && (parts[1] >= 16 && parts[1] <= 31)) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (ip === '0.0.0.0' || ip === '255.255.255.255') return true;
    }
    
    if (net.isIPv6(ip)) {
        const lowerIp = ip.toLowerCase();
        
        if (lowerIp === '::1' || lowerIp === '0:0:0:0:0:0:0:1') return true;
        if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;
        if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true;
    }
    
    return false;
}