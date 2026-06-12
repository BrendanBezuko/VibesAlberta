/**
 * Downloads CC0 KayKit props & environment from itch.io packs (via GitHub).
 * Buildings/units are custom Alberta models — only scenery & props here.
 *
 * - Forest/nature (Rockies, boreal trees): KayKit Medieval Hexagon nature set
 * - Police car, city props: KayKit City Builder Bits
 * - Oil barrels: KayKit Prototype Bits
 *
 * https://itch.io/game-assets/free/tag-3d
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'assets');

const REPOS = {
  nature: 'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0',
  city: 'KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0',
  props: 'KayKit-Game-Assets/KayKit-Prototype-Bits-1.0',
};

const FOLDERS = [
  ['nature', 'addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/nature'],
  ['city', 'addons/kaykit_city_builder_bits/Assets/gltf'],
  ['props', 'addons/kaykit_prototype_bits/Assets/gltf'],
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(repo, repoPath, destPath) {
  if (await exists(destPath)) return 'skip';

  const url = `https://raw.githubusercontent.com/${repo}/main/${repoPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

async function listGithubFolder(repo, folderPath) {
  const url = `https://api.github.com/repos/${repo}/contents/${folderPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed ${url}: ${res.status}`);
  const items = await res.json();
  return items.filter((i) => i.type === 'file').map((i) => i.name);
}

async function main() {
  console.log('Fetching Alberta scenery & props (KayKit CC0)...\n');

  let ok = 0;
  let skip = 0;

  for (const [key, folder] of FOLDERS) {
    const repo = REPOS[key];
    const rel = folder
      .replace('addons/kaykit_medieval_hexagon_pack/Assets/', '')
      .replace('addons/kaykit_city_builder_bits/Assets/', '')
      .replace('addons/kaykit_prototype_bits/Assets/', '');

    console.log(`→ ${key}/${rel}`);
    const files = await listGithubFolder(repo, folder);

    for (const name of files) {
      const dest = join(ROOT, key, rel, name);
      const result = await downloadFile(repo, `${folder}/${name}`, dest);
      if (result === 'ok') ok++;
      else skip++;
    }
  }

  console.log(`\nDone. Downloaded ${ok}, skipped ${skip}.`);
  console.log('License: CC0 — Kay Lousberg / KayKit');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
