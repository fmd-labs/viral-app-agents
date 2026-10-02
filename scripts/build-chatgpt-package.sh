#!/usr/bin/env bash
# Builds dist/viral-app-chatgpt.zip, the package OpenAI's plugin dashboard
# takes under "Upload new version" (https://platform.openai.com/plugins).
#
# The ZIP holds the Codex-format plugin at the archive root:
#   .codex-plugin/plugin.json   manifest (skills: ./skills/, mcpServers: ./.mcp.json, interface)
#   .mcp.json                   the remote viral_app server (https://viral.app/api/mcp)
#   skills/<name>/...           the bundled skills
#   assets/                     logo and composer icon referenced by the manifest
# The Claude and Cursor manifests and OS clutter stay out; the Claude Code
# events channel lives in its own plugin (plugins/viral-app-events) and is
# never part of this package. Nothing is uploaded.
#
#   scripts/build-chatgpt-package.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin="$root/plugins/viral-app"
out_dir="$root/dist"
out="$out_dir/viral-app-chatgpt.zip"

for tool in zip unzip python3; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/.codex-plugin"
cp "$plugin/.codex-plugin/plugin.json" "$stage/.codex-plugin/plugin.json"
cp "$plugin/.mcp.json" "$stage/.mcp.json"
cp -R "$plugin/skills" "$stage/skills"
cp -R "$plugin/assets" "$stage/assets"
find "$stage" \( -name '.DS_Store' -o -name '__MACOSX' -o -name '*.swp' \) -exec rm -rf {} +

# Check the package against the rules in OpenAI's submission docs before zipping.
python3 - "$stage" <<'PY'
import json, os, re, sys

stage = sys.argv[1]
errors = []

def fail(msg):
    errors.append(msg)

manifest = json.load(open(os.path.join(stage, ".codex-plugin", "plugin.json")))
for field in ("name", "version", "description", "author", "interface"):
    if field not in manifest:
        fail(f"plugin.json: missing {field}")
if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", manifest.get("name", "")) or len(manifest.get("name", "")) > 64:
    fail("plugin.json: name must be lowercase kebab-case, at most 64 characters")
if manifest.get("skills") != "./skills/":
    fail('plugin.json: skills must be "./skills/"')
if manifest.get("mcpServers") != "./.mcp.json":
    fail('plugin.json: mcpServers must be "./.mcp.json"')

iface = manifest.get("interface", {})
limits = {"displayName": 30, "shortDescription": 30, "longDescription": 4000, "developerName": 80}
for field, limit in limits.items():
    value = iface.get(field)
    if not value:
        fail(f"interface.{field} is required")
    elif len(value) > limit:
        fail(f"interface.{field} is {len(value)} characters (max {limit})")
for field in ("category", "capabilities", "composerIcon", "logo"):
    if field not in iface:
        fail(f"interface.{field} is required for the Codex format")
for field in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
    value = iface.get(field)
    if value and not value.startswith("https://"):
        fail(f"interface.{field} must be an https URL")
prompts = iface.get("defaultPrompt", [])
if isinstance(prompts, str):
    prompts = [prompts]
if len(prompts) > 3 or any(len(p) > 128 for p in prompts):
    fail("interface.defaultPrompt: at most 3 prompts of at most 128 characters")
for field in ("composerIcon", "composerIconDark", "logo", "logoDark"):
    path = iface.get(field)
    if path:
        if not path.startswith("./"):
            fail(f"interface.{field} must start with ./")
        elif not os.path.isfile(os.path.join(stage, path[2:])):
            fail(f"interface.{field} points to a missing file: {path}")
if "apps" in manifest or os.path.exists(os.path.join(stage, ".app.json")):
    fail("app references (.app.json) cannot be submitted in a ZIP")
if "hooks" in manifest or os.path.isdir(os.path.join(stage, "hooks")):
    fail("lifecycle hooks cannot be submitted in a ZIP")

mcp = json.load(open(os.path.join(stage, ".mcp.json")))
servers = mcp.get("mcpServers")
if not isinstance(servers, dict) or len(servers) != 1:
    fail(".mcp.json must declare exactly one MCP server")
else:
    for name, server in servers.items():
        if not str(server.get("url", "")).startswith("https://"):
            fail(f".mcp.json: server {name} must be a remote https URL")

skills_dir = os.path.join(stage, "skills")
names = set()
for entry in sorted(os.listdir(skills_dir)):
    path = os.path.join(skills_dir, entry)
    if os.path.islink(path) or not os.path.isdir(path):
        fail(f"skills/{entry}: each skill must be a real directory")
        continue
    if entry.startswith("."):
        fail(f"skills/{entry}: hidden skill directory")
    skill_md = os.path.join(path, "SKILL.md")
    if not os.path.isfile(skill_md):
        fail(f"skills/{entry}: missing SKILL.md")
        continue
    text = open(skill_md, encoding="utf-8").read()
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not match:
        fail(f"skills/{entry}/SKILL.md: missing YAML front matter")
        continue
    front = dict(re.findall(r"^([A-Za-z_]+):\s*(.*)$", match.group(1), re.M))
    name, description = front.get("name", "").strip(), front.get("description", "").strip()
    if not name or not description:
        fail(f"skills/{entry}/SKILL.md: name and description are required")
    if len(description) > 1024:
        fail(f"skills/{entry}/SKILL.md: description is {len(description)} characters (max 1024)")
    if len(f"{manifest.get('name')}:{name}") > 64:
        fail(f"skills/{entry}: plugin:skill identity longer than 64 characters")
    if name in names:
        fail(f"skills/{entry}: duplicate skill name {name}")
    names.add(name)
    if not match.group(2).strip():
        fail(f"skills/{entry}/SKILL.md: empty instructions")

for dirpath, dirnames, filenames in os.walk(stage):
    for item in dirnames + filenames:
        full = os.path.join(dirpath, item)
        if os.path.islink(full):
            fail(f"symlink not allowed: {os.path.relpath(full, stage)}")
        if len(os.path.relpath(full, stage).split(os.sep)) > 20:
            fail(f"path too deep: {os.path.relpath(full, stage)}")

if errors:
    print("package check failed:", *errors, sep="\n  ", file=sys.stderr)
    sys.exit(1)
print(f"package check passed: {manifest['name']} {manifest['version']}, {len(names)} skills, MCP server(s): {', '.join(servers)}")
PY

mkdir -p "$out_dir"
rm -f "$out"
(cd "$stage" && zip -qr -X "$out" .codex-plugin .mcp.json skills assets)
echo "wrote ${out#"$root"/} ($(wc -c <"$out" | tr -d ' ') bytes)"
unzip -l "$out"
