// Non-mutating credential check — exchanges the refresh token for an access
// token via Google's OAuth endpoint. Confirms .env is wired correctly without
// touching the Chrome Web Store API at all.
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const required = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN", "EXTENSION_ID"];
for (const k of required) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

const body = new URLSearchParams({
  client_id: env.CLIENT_ID,
  client_secret: env.CLIENT_SECRET,
  refresh_token: env.REFRESH_TOKEN,
  grant_type: "refresh_token",
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const data = await res.json();

if (res.ok && data.access_token) {
  console.log("✓ Credentials valid.");
  console.log(`  Access token issued (truncated): ${data.access_token.slice(0, 20)}…`);
  console.log(`  Expires in: ${data.expires_in}s`);
  console.log(`  Scope: ${data.scope ?? "(default)"}`);
  console.log(`  Extension ID: ${env.EXTENSION_ID}`);
} else {
  console.error("✗ Credential check failed.");
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
