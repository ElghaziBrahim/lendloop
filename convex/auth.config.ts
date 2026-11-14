import type { AuthConfig } from "convex/server";

/**
 * Clerk is the identity provider. The `convex` JWT template in the Clerk
 * application must sign tokens with `aud: "convex"`, which is what
 * `applicationID` matches below.
 *
 * `CLERK_JWT_ISSUER_DOMAIN` is the Clerk Frontend API origin for this
 * instance, e.g. `https://your-app.clerk.accounts.dev`. It is an environment
 * variable on the Convex deployment, not a frontend value:
 *
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<instance>.clerk.accounts.dev
 */
const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!issuerDomain) {
  throw new Error(
    "CLERK_JWT_ISSUER_DOMAIN is not set on this Convex deployment. Run: npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<instance>.clerk.accounts.dev",
  );
}

const authConfig: AuthConfig = {
  providers: [
    {
      domain: issuerDomain,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
