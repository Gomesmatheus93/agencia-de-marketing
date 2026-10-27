export const COOKIE_NAME = "app_session_id";
export const REFRESH_COOKIE_NAME = "app_refresh_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Access token curto — renovado de forma transparente pelo refresh token.
export const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
export const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 dias
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
