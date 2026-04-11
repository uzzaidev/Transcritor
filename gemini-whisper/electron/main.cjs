const { app, BrowserWindow, session, desktopCapturer, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            backgroundThrottling: false // Important: Keep app active in background
        },
        icon: path.join(__dirname, '../public/vite.svg')
    });

    mainWindow.setMenuBarVisibility(false);

    // Setup permission handler for screen recording
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            if (sources.length > 0) {
                callback({ video: sources[0], audio: 'loopback' });
            } else {
                desktopCapturer.getSources({ types: ['window'] }).then((wins) => {
                    if (wins.length > 0) {
                        callback({ video: wins[0], audio: 'loopback' });
                    } else {
                        callback({ video: null, audio: null });
                    }
                });
            }
        }).catch(err => {
            console.error('Error selecting display media:', err);
            callback({ video: null, audio: null });
        });
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
        console.log('Running in development mode');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        console.log('Running in production mode');
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Handlers for Shortcuts
ipcMain.on('register-shortcut', (event, shortcut) => {
    globalShortcut.unregisterAll(); // Clear previous
    if (shortcut) {
        try {
            const ret = globalShortcut.register(shortcut, () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('trigger-screenshot');
                }
            });
            if (!ret) {
                console.log('Registration failed', shortcut);
            } else {
                console.log('Global shortcut registered:', shortcut);
            }
        } catch (e) {
            console.error('Failed to register shortcut:', e);
        }
    }
});

app.whenReady().then(createWindow);

app.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
