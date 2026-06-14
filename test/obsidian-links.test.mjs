import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  extractRenderedWikiLinks,
  findMalformedWikiSyntax,
  fixSimpleMalformedWikiSyntax,
  normalizePmRelativeWikiLinks,
  pmRelToVaultTarget,
  pmWikiLink,
  syncMarkedH2Toc,
} from "../scripts/lib/obsidian-links.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const OBSIDIAN_SCRIPT = join(SKILL_DIR, "scripts", "check-obsidian-links.mjs");

test("vault-relative link generation derives target from vault root", () => {
  const vaultRoot = "/vault";
  const pmFolder = "/vault/Areas/PM/OpenManager";

  assert.equal(
    pmRelToVaultTarget("roadmap/done-pending", { pmFolder, vaultRoot }),
    "Areas/PM/OpenManager/roadmap/done-pending",
  );
  assert.equal(
    pmWikiLink("roadmap/done-pending", "done-pending", { pmFolder, vaultRoot }),
    "[[Areas/PM/OpenManager/roadmap/done-pending|done-pending]]",
  );
});

test("rendered link scanner ignores inline and fenced code", () => {
  const input = [
    "See [[Projects/Foo/README|README]].",
    "`Callable[[str], bytes]` is code.",
    "```",
    "[[Not a link]]",
    "```",
  ].join("\n");

  assert.deepEqual(extractRenderedWikiLinks(input).map((link) => link.body), [
    "Projects/Foo/README|README",
  ]);
  assert.equal(findMalformedWikiSyntax(input).length, 0);
});

test("simple malformed wiki syntax is closed without inventing targets", () => {
  const input = "- [[Projects/Foo/system/overview|overview]\n";
  const result = fixSimpleMalformedWikiSyntax(input);
  assert.equal(result.updated, "- [[Projects/Foo/system/overview|overview]]\n");
});

test("PM-relative slash links preserve aliases and headings when converted", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-obsidian-links-"));
  try {
    const vault = join(pm, "vault");
    const pmFolder = join(vault, "Projects", "OpenManager");
    mkdirSync(join(pmFolder, "roadmap"), { recursive: true });
    writeFileSync(join(pmFolder, "roadmap", "done-pending.md"), "# done\n\n## email\n");

    const input = "[[roadmap/done-pending#email|email work]]";
    const result = normalizePmRelativeWikiLinks(input, { pmFolder, vaultRoot: vault });
    assert.equal(result.updated, "[[Projects/OpenManager/roadmap/done-pending#email|email work]]");
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("marked TOC regenerates from actual H2 headings", () => {
  const input = `# plan

<!-- vault-maintain:toc:start -->
## Contents

- [[#Old]]
<!-- vault-maintain:toc:end -->

## Status

## Real Heading
`;
  const result = syncMarkedH2Toc(input);
  assert.match(result.updated, /- \[\[#Status\]\]/);
  assert.match(result.updated, /- \[\[#Real Heading\]\]/);
  assert.equal(result.updated.includes("[[#Old]]"), false);
});

test("check-obsidian-links --fix repairs OpenManager-style TOC and PM-relative links", () => {
  const root = mkdtempSync(join(tmpdir(), "pm-obsidian-check-"));
  try {
    const vault = join(root, "Vault");
    const pm = join(vault, "Projects", "OpenManager");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    mkdirSync(join(pm, "features"), { recursive: true });
    writeFileSync(join(pm, "features", "agent-runtime.md"), "# agent-runtime\n");
    writeFileSync(join(pm, "README.md"), "See [[features/agent-runtime|agent-runtime]].\n");
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-03_chat.md"), `# chat

<!-- vault-maintain:toc:start -->
## Contents

- [[#Step 1]]
<!-- vault-maintain:toc:end -->

## Status

## Decision
`);

    const before = spawnSync(process.execPath, [OBSIDIAN_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(before.status, 1, before.stdout + before.stderr);
    assert.match(before.stdout, /PM-relative slash link/);
    assert.match(before.stdout, /missing heading/);

    const fixed = spawnSync(process.execPath, [OBSIDIAN_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    assert.match(
      readFileSync(join(pm, "README.md"), "utf8"),
      /\[\[Projects\/OpenManager\/features\/agent-runtime\|agent-runtime\]\]/,
    );
    const plan = readFileSync(join(pm, "roadmap", "plans", "2026-06-03_chat.md"), "utf8");
    assert.match(plan, /- \[\[#Status\]\]/);
    assert.match(plan, /- \[\[#Decision\]\]/);
    assert.equal(plan.includes("[[#Step 1]]"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
