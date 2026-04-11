const { app, BrowserWindow, session, desktopCapturer, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

let mainWindow;

function resolveWorkspaceRoot() {
    const candidates = [
        path.resolve(__dirname, '..', '..'),
        path.resolve(__dirname, '..'),
        process.cwd(),
    ];

    return candidates.find((candidate) =>
        fs.existsSync(path.join(candidate, 'ata_multiagent_pipeline'))
    ) || path.resolve(__dirname, '..', '..');
}

function resolvePythonExecutable() {
    const configured = process.env.PYTHON_EXECUTABLE;
    if (configured && fs.existsSync(configured)) {
        return configured;
    }

    const candidates = [
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
        'python',
        'py',
    ];

    return candidates.find((candidate) => candidate === 'python' || candidate === 'py' || fs.existsSync(candidate)) || 'python';
}

function ensureRuntimeEventDir(workspaceRoot) {
    const runtimeDir = path.join(workspaceRoot, 'generated', 'ata_pipeline', 'runtime_events');
    fs.mkdirSync(runtimeDir, { recursive: true });
    return runtimeDir;
}

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

ipcMain.handle('ata-pipeline:run', async (_event, payload) => {
    const workspaceRoot = resolveWorkspaceRoot();
    const runtimeDir = ensureRuntimeEventDir(workspaceRoot);
    const eventFile = path.join(runtimeDir, `event_${Date.now()}.json`);
    const eventPayload = {
        tipo_evento: 'nova_reuniao',
        arquivo_fonte: payload.arquivoFonte || 'transcricao_manual.txt',
        projeto: payload.projeto || 'GERAL',
        sprint: payload.sprint || '',
        participantes: Array.isArray(payload.participantes) ? payload.participantes : [],
        transcript_text: payload.transcriptText || '',
        destinatarios: Array.isArray(payload.destinatarios) ? payload.destinatarios : [],
        meeting_title: payload.meetingTitle || '',
        meeting_date: payload.meetingDate || '',
        metadata: {
            source: 'gemini-whisper',
        },
    };

    fs.writeFileSync(eventFile, JSON.stringify(eventPayload, null, 2), 'utf-8');

    const pythonExecutable = resolvePythonExecutable();

    return await new Promise((resolve) => {
        const child = spawn(
            pythonExecutable,
            ['-m', 'ata_multiagent_pipeline.cli', eventFile],
            {
                cwd: workspaceRoot,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',
                },
                windowsHide: true,
            }
        );

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            resolve({
                success: false,
                message: `Falha ao iniciar Python: ${error.message}`,
                stderr,
                stdout,
                pythonExecutable,
            });
        });

        child.on('close', (code) => {
            let parsed = null;
            try {
                parsed = stdout ? JSON.parse(stdout) : null;
            } catch (_error) {
                parsed = null;
            }

            if (code === 0 || code === 2) {
                resolve({
                    success: Boolean(parsed?.success),
                    message: parsed?.success
                        ? 'Pipeline de ATA executado com sucesso.'
                        : 'Pipeline executado, mas retornou validação incompleta.',
                    stdout,
                    stderr,
                    pythonExecutable,
                    result: parsed,
                });
                return;
            }

            resolve({
                success: false,
                message: stderr.trim() || `Pipeline falhou com código ${code}.`,
                stdout,
                stderr,
                pythonExecutable,
                result: parsed,
            });
        });
    });
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
