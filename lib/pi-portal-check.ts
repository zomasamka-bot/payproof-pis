/**
 * Pi Developer Portal Detection and Diagnostics
 *
 * The Developer Portal (Step 10) loads apps in an iframe sandbox.
 * If Pi.authenticate() fails with "Unable to post message to app-cdn.minepi.com",
 * it means the postMessage channel between the app and Pi Browser is broken.
 *
 * This module provides diagnostics to identify why postMessage communication fails.
 */

export function detectPortalEnvironment() {
  const diagnostics = {
    isInsideIframe: window.self !== window.top,
    parentAccessible: false,
    parentOrigin: null as string | null,
    postMessageWorks: false,
    sandboxRestrictions: [] as string[],
    isDeveloperPortal: false,
  };

  try {
    // Check if we can access parent
    diagnostics.parentOrigin = window.parent.location.origin;
    diagnostics.parentAccessible = true;
  } catch (e) {
    diagnostics.sandboxRestrictions.push(
      "Cannot access window.parent.location (sandbox restriction)"
    );
  }

  // Test if postMessage works
  try {
    const channel = new MessageChannel();
    window.parent.postMessage({ type: "connectivity-test" }, "*");
    diagnostics.postMessageWorks = true;
  } catch (e) {
    diagnostics.sandboxRestrictions.push(
      `postMessage blocked: ${(e as Error).message}`
    );
  }

  // Check if we're in a Developer Portal iframe
  const isDeveloperPortal =
    window.location.hostname.includes("developer") ||
    window.location.search.includes("portal") ||
    window.location.search.includes("step10");

  diagnostics.isDeveloperPortal = isDeveloperPortal;

  return diagnostics;
}

export function logPortalDiagnostics() {
  const diag = detectPortalEnvironment();
  console.log("[v0] === Pi Developer Portal Diagnostics ===");
  console.log("[v0] Inside iframe:", diag.isInsideIframe);
  console.log("[v0] Parent frame accessible:", diag.parentAccessible);
  console.log("[v0] Parent origin:", diag.parentOrigin ?? "N/A");
  console.log("[v0] postMessage works:", diag.postMessageWorks);
  console.log("[v0] Is Developer Portal:", diag.isDeveloperPortal);
  if (diag.sandboxRestrictions.length > 0) {
    console.log("[v0] Sandbox restrictions detected:");
    diag.sandboxRestrictions.forEach((r) => console.log("[v0]   -", r));
  }
  console.log("[v0] ======================================");
  return diag;
}
