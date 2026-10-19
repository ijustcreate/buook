const { app, BrowserWindow, Menu, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{
  scheme: 'book',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

app.setName('The Book');
app.setAppUserModelId('com.keepersbook.desktop');

async function registerBookProtocol() {
  const root = path.resolve(__dirname);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  await protocol.handle('book', async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    let filePath;
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      filePath = path.resolve(root, relativePath);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (filePath !== root && !filePath.startsWith(rootPrefix)) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const contents = await fs.readFile(filePath);
      return new Response(request.method === 'HEAD' ? null : contents, {
        headers: {
          'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'The Book',
    icon: path.join(__dirname, 'assets', 'buook-icon-v1.png'),
    width: 1180,
    height: 900,
    minWidth: 720,
    minHeight: 640,
    backgroundColor: '#090e10',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadURL('book://app/index.html');
}

const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      { label: 'My shelf', click: (_item, window) => window?.webContents.executeJavaScript("document.querySelector('#shelf-open')?.click()") },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
]);
Menu.setApplicationMenu(menu);

app.whenReady().then(async () => {
  await registerBookProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
