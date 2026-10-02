import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

// Claude Code runs the committed bundle, not the sources: rebuild with
// `bun run build` and commit dist/server.mjs whenever src/ changes.
test("dist/server.mjs matches a fresh build of src/", async () => {
  const dir = mkdtempSync(join(tmpdir(), "viral-app-dist-"))
  try {
    const out = join(dir, "server.mjs")
    const build = Bun.spawnSync(
      ["bun", "build", "src/server.ts", "--target=node", "--format=esm", "--minify-syntax", "--minify-whitespace", "--outfile", out],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    )
    expect(build.exitCode).toBe(0)
    expect(readFileSync(join(root, "dist", "server.mjs"), "utf8") === readFileSync(out, "utf8")).toBe(true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
