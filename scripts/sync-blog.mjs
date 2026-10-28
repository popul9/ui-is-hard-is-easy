import { createHash } from 'node:crypto';
import { log } from 'node:console';
import { argv } from 'node:process';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const blog = resolve(argv[2] ?? join(root, '../my-blog'));
const destination = join(blog, 'public/games/ui-is-hard-is-easy');
// Require an existing blog checkout before copying any generated files.
await readFile(join(blog, 'package.json'), 'utf8');
const dist = join(root, 'dist');
// Include both HTML entries, worker chunks, and public replay fixtures.
// Vite's main manifest does not enumerate worker dependencies.
const files = [];
async function collect(directory = '') {
  for (const entry of await readdir(join(dist, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.isFile()) files.push(file);
  }
}
await collect();
for (const file of files) {
  const target = resolve(destination, file);
  if (!target.startsWith(destination + sep)) throw new Error(`Invalid build path: ${file}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(dist, file), target);
}
// These hand-edited files are superseded by the game build and must not diverge.
for (const file of ['result.css', 'dog.js', 'random.js', 'volume-popover.js', 'volume-popover.css']) {
  await rm(join(destination, file), { force: true });
}
const version = createHash('sha256').update(await readFile(join(dist, 'index.html'))).digest('hex').slice(0, 12);
for (const language of ['ko', 'en', 'th', 'vi', 'zh']) {
  const post = join(blog, `src/content/developer/ui-is-hard-is-easy/${language}.mdx`);
  const content = await readFile(post, 'utf8');
  const updated = content.replace(/(\/games\/ui-is-hard-is-easy\/index\.html\?embed&v=)[^"\s]+/g, `$1${version}`);
  if (content !== updated) await writeFile(post, updated);
}
log(`Synced ${files.length} game files to ${destination}; iframe version ${version}.`);
