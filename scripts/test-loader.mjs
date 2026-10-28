const assets = new URL("../src/assets/", import.meta.url).href;

// Plain Node needs the image and server-only test substitutes normally supplied by Next.js.
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.startsWith(assets) && url.endsWith(".jpg")) {
    return { format: "module", source: `export default { src: ${JSON.stringify(url)} };`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
