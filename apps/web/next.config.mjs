// Monorepo convenience: load the root .env for local dev (Vercel injects env vars in production).
// Existing process.env values always win.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  /* no root .env - fine */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@liveboard/shared"],
};

export default nextConfig;
