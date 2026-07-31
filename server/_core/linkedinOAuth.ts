import { ENV } from "./env";

const LINKEDIN_AUTH_BASE = "https://www.linkedin.com/oauth/v2";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// "openid profile email" (Sign In with LinkedIn using OpenID Connect) gives us the
// member's identity; "w_member_social" (Share on LinkedIn) lets us post on their behalf.
export const LINKEDIN_SCOPES = "openid profile email w_member_social";

export function buildLinkedInAuthUrl(state: string): string {
  const url = new URL(`${LINKEDIN_AUTH_BASE}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.linkedinClientId);
  url.searchParams.set("redirect_uri", ENV.linkedinRedirectUri);
  url.searchParams.set("scope", LINKEDIN_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokenResponse> {
  const res = await fetch(`${LINKEDIN_AUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ENV.linkedinRedirectUri,
      client_id: ENV.linkedinClientId,
      client_secret: ENV.linkedinClientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<LinkedInTokenResponse>;
}

export type LinkedInUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
};

export async function getLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn userinfo failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as LinkedInUserInfo & { error?: string };
  if (!data.sub) {
    throw new Error(`LinkedIn userinfo missing "sub": ${JSON.stringify(data)}`);
  }
  return data;
}
