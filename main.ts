// Entry point for the make.fun frontend bounty (Node 22, standard library
// only). The front end itself is plain static files under app/, with three
// screenshots of it running on live data under screenshots/. This program
// assembles the submission directory: it copies those two folders into the
// output directory and writes dossier.json there, the summary the judge
// reads, using the kit's vendored library. The library's own copy is the
// scorer's copy, so the dossier it writes is the dossier the gate expects.
//
// The grader runs this twice and both runs must produce identical bytes, so
// nothing here reads the clock, rolls dice or depends on walk order: entries
// are copied in sorted name order, and the dossier library is deterministic.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The folder this file lives in is the repository root.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader gives us /output; locally MAKEFUN_OUTPUT_DIR stands in for it.
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the kit's reference/gate.json. Only
// text_max_bytes changes the dossier's bytes; the rest refuse an entry the
// scorer would refuse anyway (too many screenshots, one too large, app/
// past its file or byte caps).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

function copyTree(sourceDir: string, destDir: string): number {
  mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(sourceDir).sort()) {
    const from = join(sourceDir, name);
    const to = join(destDir, name);
    if (statSync(from).isDirectory()) {
      copied += copyTree(from, to);
    } else {
      copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

function assemble(): void {
  mkdirSync(targetDir, { recursive: true });
  const appFiles = copyTree(join(repoRoot, 'app'), join(targetDir, 'app'));
  const shotFiles = copyTree(join(repoRoot, 'screenshots'), join(targetDir, 'screenshots'));
  const dossier = buildDossier(targetDir, caps);
  writeFileSync(join(targetDir, 'dossier.json'), dossier);
  console.log(`copied ${appFiles} app files and ${shotFiles} screenshots to ${targetDir}`);
  console.log(`dossier.json: ${dossier.length} bytes`);
}

assemble();
