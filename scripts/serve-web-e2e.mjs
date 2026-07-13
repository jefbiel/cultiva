import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 8081);
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const exportResult = spawnSync(
  npxBin,
  ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
    },
    stdio: 'inherit',
  }
);

if (exportResult.status !== 0) {
  process.exit(exportResult.status ?? 1);
}

const mimeTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.map', 'application/json'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function resolveFilePath(pathname) {
  const decodedPath = decodeURIComponent(pathname.split('?')[0] ?? '/');
  const safePath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(distDir, safePath);

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(distDir, 'index.html');
}

const server = createServer((request, response) => {
  const filePath = resolveFilePath(request.url ?? '/');
  const mimeType = mimeTypes.get(extname(filePath)) ?? 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': mimeType });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving Expo web export at http://127.0.0.1:${port}`);
});
