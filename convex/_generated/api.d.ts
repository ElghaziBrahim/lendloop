/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as automationStore from "../automationStore.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_fixtures from "../lib/fixtures.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_signing from "../lib/signing.js";
import type * as lib_users from "../lib/users.js";
import type * as lib_validation from "../lib/validation.js";
import type * as loans from "../loans.js";
import type * as maintenance from "../maintenance.js";
import type * as requests from "../requests.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  automation: typeof automation;
  automationStore: typeof automationStore;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/authz": typeof lib_authz;
  "lib/availability": typeof lib_availability;
  "lib/dates": typeof lib_dates;
  "lib/fixtures": typeof lib_fixtures;
  "lib/roles": typeof lib_roles;
  "lib/signing": typeof lib_signing;
  "lib/users": typeof lib_users;
  "lib/validation": typeof lib_validation;
  loans: typeof loans;
  maintenance: typeof maintenance;
  requests: typeof requests;
  seed: typeof seed;
  tools: typeof tools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
