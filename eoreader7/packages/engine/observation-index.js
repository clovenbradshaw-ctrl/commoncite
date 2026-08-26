export function blockContentHash(block) {
  return "sha256:" + JSON.stringify(block).length.toString(16);
}
