/**
 * Native local HTTP file server for serving book files to the WebView.
 *
 * Uses @dr.pogodin/react-native-static-server (embedded Lighttpd) which:
 * - Serves files directly from the native layer (no JS bridge overhead)
 * - Supports HTTP Range requests (206 Partial Content) out of the box
 * - Enables foliate-js to lazily read ZIP entries without loading the entire file
 *
 * This replaces the previous react-native-tcp-socket JS-layer server which
 * had to read entire files into JS memory (file.bytes()) causing severe
 * slowness on large (100-500MB) ebooks.
 */
import StaticServer, { STATES } from "@dr.pogodin/react-native-static-server";

let _server: InstanceType<typeof StaticServer> | null = null;
let _serverUrl: string | null = null;
let _serverDocRoot: string | null = null;

/**
 * Start a native static file server serving files from `docRoot`.
 * Returns the base URL (e.g. `http://127.0.0.1:12345`).
 * Reuses the existing server if one is already running for the same docRoot.
 */
export async function startFileServer(docRoot: string): Promise<string> {
  const cleanRoot = docRoot.replace(/\/+$/, "");

  // Reuse existing server if it's running for the same root
  if (_server && _serverDocRoot === cleanRoot && _serverUrl) {
    if (_server.state === STATES.ACTIVE) {
      return _serverUrl;
    }
    // Server exists but not active — try restarting
    try {
      const origin = await _server.start();
      _serverUrl = origin;
      return origin;
    } catch {
      // Fall through to create new server
      _server = null;
      _serverUrl = null;
      _serverDocRoot = null;
    }
  }

  // Stop any existing server with a different docRoot
  if (_server) {
    try {
      await _server.stop();
    } catch {}
    _server = null;
    _serverUrl = null;
    _serverDocRoot = null;
  }

  // Create new server
  _server = new StaticServer({
    fileDir: cleanRoot,
    port: 0, // random available port
    stopInBackground: false, // keep serving in background for TTS
    // Extra Lighttpd config to enable Range requests and CORS
    extraConfig: `
      # Enable byte-range serving for large files (epub ZIP lazy loading)
      server.range-requests = "enable"

      # CORS headers for WebView fetch
      setenv.add-response-header = (
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers" => "Range, Content-Type",
        "Access-Control-Expose-Headers" => "Content-Range, Content-Length, Accept-Ranges"
      )
    `,
  });

  _serverDocRoot = cleanRoot;

  const origin = await _server.start();
  _serverUrl = origin;

  console.log(`[FileServer] Native static server started: ${origin} (root: ${cleanRoot})`);
  return origin;
}

/**
 * Stop the file server.
 */
export async function stopFileServer(_docRoot?: string): Promise<void> {
  if (_server) {
    try {
      await _server.stop();
    } catch {}
    _server = null;
    _serverUrl = null;
    _serverDocRoot = null;
  }
}
