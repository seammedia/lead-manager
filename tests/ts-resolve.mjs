// Lets `node --test` load this app's TypeScript (extensionless relative imports, as Next.js writes them).
// Used with --experimental-strip-types; see package.json "test".
export async function resolve(specifier, context, next) {
  if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(`${specifier}.ts`, context); } catch { /* fall through */ }
  }
  return next(specifier, context);
}
