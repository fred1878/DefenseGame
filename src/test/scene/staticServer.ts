import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".fnt": "application/xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export interface StaticServer {
  /** Base URL with trailing slash, e.g. `http://127.0.0.1:41234/`. */
  url: string;
  /** Paths requested so far (for asserting what a scene loaded). */
  requests: string[];
  close(): Promise<void>;
}

/**
 * Serves `public/` like the Vite dev server does at `/`, so real BootScene /
 * loader code can fetch shipped JSON and textures over HTTP inside jsdom.
 */
export async function startPublicServer(
  root = path.join(process.cwd(), "public"),
): Promise<StaticServer> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(
      new URL(req.url ?? "/", "http://x").pathname,
    );
    requests.push(urlPath);
    const file = path.join(root, path.normalize(urlPath));
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      res.writeHead(404, { "access-control-allow-origin": "*" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type":
        MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "access-control-allow-origin": "*",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
