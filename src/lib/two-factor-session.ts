import { cookies } from "next/headers";

/** Name of the Auth.js session cookie; the `__Secure-` variant is used over HTTPS. */
export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return (
    jar.get("__Secure-authjs.session-token")?.value ??
    jar.get("authjs.session-token")?.value ??
    null
  );
}
