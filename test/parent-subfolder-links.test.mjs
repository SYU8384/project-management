import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { ensureParentLinksToChild } from '../scripts/lib/content-semantic-fixers.mjs';

test('existing vault-relative parent link is a no-op on the native platform', () => {
  const vaultRoot = resolve('fixture-vault');
  const pmFolder = join(vaultRoot, 'Projects', 'Example');
  const original = '# docs\n\n## Subfolders\n\n- [[Projects/Example/docs/User Guide/User Guide|User Guide]]\n\n## Notes\n';
  const result = ensureParentLinksToChild(original, 'docs/User Guide/User Guide.md', { pmFolder, vaultRoot });
  assert.deepEqual(result.changes, []);
  assert.equal(result.updated, original);
});

test('a missing parent link is added once, with slash-based vault syntax', () => {
  const vaultRoot = resolve('fixture-vault');
  const pmFolder = join(vaultRoot, 'Projects', 'Example');
  const original = '# docs\n\n## Subfolders\n\n## Notes\n';
  const first = ensureParentLinksToChild(original, 'docs/User Guide/User Guide.md', { pmFolder, vaultRoot });
  assert.equal(first.changes.length, 1);
  assert.match(first.updated, /\[\[Projects\/Example\/docs\/User Guide\/User Guide\|User Guide\]\]/);
  const second = ensureParentLinksToChild(first.updated, 'docs/User Guide/User Guide.md', { pmFolder, vaultRoot });
  assert.deepEqual(second.changes, []);
  assert.equal(second.updated, first.updated);
});
