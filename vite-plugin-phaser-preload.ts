import type { Plugin } from "vite";

function phaserChunkHref(
  bundle: Record<
    string,
    { type?: string | undefined; name?: string | undefined }
  >,
  base: string,
): string | null {
  for (const [fileName, chunk] of Object.entries(bundle)) {
    if (
      chunk.type === "chunk" &&
      chunk.name === "phaser" &&
      fileName.endsWith(".js")
    ) {
      const prefix = base.endsWith("/") ? base : `${base}/`;
      return `${prefix}${fileName}`;
    }
  }
  return null;
}

/** Inject `<link rel="modulepreload">` for the Rollup `phaser` vendor chunk. */
export function phaserModulePreloadPlugin(): Plugin {
  let resolvedBase = "/";
  return {
    name: "phaser-modulepreload",
    apply: "build",
    configResolved(config) {
      resolvedBase = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const href = phaserChunkHref(bundle, resolvedBase);
        if (!href) return html;
        const tag = `<link rel="modulepreload" crossorigin href="${href}">`;
        if (html.includes(tag)) return html;
        return html.replace("</head>", `    ${tag}\n  </head>`);
      },
    },
  };
}
