export interface WebAuthnConfig {
    rpId: string;
    rpName: string;
    rpOrigin: string;
}

export function getWebAuthnConfig(): WebAuthnConfig {
    const requiresProductionConfig = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';
    const config = {
        rpId: process.env.RP_ID ?? (requiresProductionConfig ? '' : 'localhost'),
        rpName: process.env.RP_NAME ?? (requiresProductionConfig ? '' : 'Todo App'),
        rpOrigin: process.env.RP_ORIGIN ?? (requiresProductionConfig ? '' : 'http://localhost:3000'),
    };

    if (requiresProductionConfig && Object.values(config).some((value) => !value)) {
        throw new Error('RP_ID, RP_NAME, and RP_ORIGIN must be configured in production');
    }

    if (!/^(localhost|([a-z0-9-]+\.)+[a-z]{2,})$/i.test(config.rpId)) {
        throw new Error('RP_ID must be a hostname without a scheme or path');
    }

    let origin: URL;
    try {
        origin = new URL(config.rpOrigin);
    } catch {
        throw new Error('RP_ORIGIN must be a valid origin URL');
    }
    if (requiresProductionConfig && origin.protocol !== 'https:') {
        throw new Error('RP_ORIGIN must use HTTPS in production');
    }
    if (origin.pathname !== '/' || origin.search || origin.hash) {
        throw new Error('RP_ORIGIN must not include a path, query, or fragment');
    }
    if (origin.hostname !== config.rpId && !origin.hostname.endsWith(`.${config.rpId}`)) {
        throw new Error('RP_ORIGIN hostname must match RP_ID or a subdomain of it');
    }

    return config;
}
