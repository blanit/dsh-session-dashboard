/**
 * Host half of dsh-session-dashboard.
 *
 * The plugin is browser-only: the whole product lives in the client bundle
 * (client/client.js), which the Web shell loads from the package's
 * `dsh.client` declaration. This Host entry only has to exist so the Loader
 * owns a live fiber named after the package; client-modules then discovers
 * and serves the browser half.
 *
 * @module dsh-session-dashboard
 */

/** Host plugin body: no Host services, tools, or routes. */
export function apply() {}
