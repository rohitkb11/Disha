export async function digest(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
function hex(value: ArrayBuffer) {
  return [...new Uint8Array(value)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}
export async function validSignature(
  secret: string,
  value: string,
  supplied: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = await hmac(secret, value);
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ supplied.toLowerCase().charCodeAt(i);
  return diff === 0;
}
