export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = () => {
    // Substituímos caso esteja "Undefined", então nunca "quebra"!
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://painel.login-ficticio.com";
    const appId = import.meta.env.VITE_APP_ID || "app-id-padrao";

    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    try {
        const url = new URL(`${oauthPortalUrl}/app-auth`);
        url.searchParams.set("appId", appId);
        url.searchParams.set("redirectUri", redirectUri);
        url.searchParams.set("state", state);
        url.searchParams.set("type", "signIn");

        return url.toString();
    } catch (error) {
        console.error("Endereço do Portal OAuth inválido. Erro interno.", error);
        // Como prevenção extrema: joga para o início local mesmo se dar crash na linha do 'New URL'.
        return "/login";
    }
};