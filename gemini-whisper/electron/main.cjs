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

    return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'ata_multiagent_pipeline'))) || path.resolve(__dirname, '..', '..');
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

function buildPipelineSuccessMessage(parsed) {
    const deliveryError = parsed?.state?.delivery_result?.error || '';
    const deliverySuccess = Boolean(parsed?.state?.delivery_result?.success);
    const auditPassed = Boolean(parsed?.state?.audit_result?.passed);

    if (!auditPassed) {
        return 'ATA gerada, mas a auditoria final encontrou pendencias.';
    }
    if (deliverySuccess) {
        return 'ATA gerada e e-mail enviado com sucesso.';
    }
    if (deliveryError === 'smtp_not_configured') {
        return 'ATA gerada com sucesso. O e-mail ficou pendente porque o SMTP nao esta configurado.';
    }
    if (deliveryError === 'missing_recipients') {
        return 'ATA gerada com sucesso. O e-mail nao foi enviado porque faltam destinatarios.';
    }
    if (deliveryError) {
        return `ATA gerada, mas o envio do e-mail falhou: ${deliveryError}`;
    }
    return 'Pipeline de ATA executado com sucesso.';
}

function buildReprocessSuccessMessage(parsed) {
    const deliveryError = parsed?.state?.delivery_result?.error || '';
    const deliverySuccess = Boolean(parsed?.state?.delivery_result?.success);

    if (deliveryError === 'dry_run') {
        return 'Ultimo evento reprocessado com sucesso em modo dry-run.';
    }
    if (deliverySuccess) {
        return 'Ultimo evento reprocessado e e-mail enviado com sucesso.';
    }
    if (deliveryError) {
        return `Ultimo evento reprocessado, mas o envio retornou: ${deliveryError}`;
    }
    return 'Ultimo evento reprocessado com sucesso.';
}

function runPythonCommand(workspaceRoot, args) {
    const pythonExecutable = resolvePythonExecutable();

    return new Promise((resolve) => {
        const child = spawn(
            pythonExecutable,
            args,
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
                parsed: null,
                code: -1,
            });
        });

        child.on('close', (code) => {
            let parsed = null;
            try {
                parsed = stdout ? JSON.parse(stdout) : null;
            } catch (_error) {
                parsed = null;
            }

            resolve({
                success: code === 0 || code === 2,
                stdout,
                stderr,
                pythonExecutable,
                parsed,
                code,
            });
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            backgroundThrottling: false,
        },
        icon: path.join(__dirname, '../public/vite.svg'),
    });

    mainWindow.setMenuBarVisibility(false);

    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            if (sources.length > 0) {
                callback({ video: sources[0], audio: 'loopback' });
                return;
            }

            desktopCapturer.getSources({ types: ['window'] }).then((wins) => {
                if (wins.length > 0) {
                    callback({ video: wins[0], audio: 'loopback' });
                } else {
                    callback({ video: null, audio: null });
                }
            });
        }).catch((error) => {
            console.error('Error selecting display media:', error);
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

ipcMain.on('register-shortcut', (_event, shortcut) => {
    globalShortcut.unregisterAll();
    if (!shortcut) return;

    try {
        const registered = globalShortcut.register(shortcut, () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('trigger-screenshot');
            }
        });

        if (!registered) {
            console.log('Registration failed', shortcut);
        } else {
            console.log('Global shortcut registered:', shortcut);
        }
    } catch (error) {
        console.error('Failed to register shortcut:', error);
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

    const execution = await runPythonCommand(workspaceRoot, ['-m', 'ata_multiagent_pipeline.cli', eventFile]);

    if (execution.code === 0 || execution.code === 2) {
        return {
            success: Boolean(execution.parsed?.success),
            message: execution.parsed?.success ? buildPipelineSuccessMessage(execution.parsed) : 'Pipeline executado, mas retornou validacao incompleta.',
            stdout: execution.stdout,
            stderr: execution.stderr,
            pythonExecutable: execution.pythonExecutable,
            result: execution.parsed,
            operation: 'run',
        };
    }

    return {
        success: false,
        message: execution.stderr?.trim() || `Pipeline falhou com codigo ${execution.code}.`,
        stdout: execution.stdout,
        stderr: execution.stderr,
        pythonExecutable: execution.pythonExecutable,
        result: execution.parsed,
        operation: 'run',
    };
});

ipcMain.handle('ata-pipeline:preflight', async () => {
    const workspaceRoot = resolveWorkspaceRoot();
    const execution = await runPythonCommand(workspaceRoot, ['-m', 'ata_multiagent_pipeline.preflight']);

    if (execution.code === 0) {
        return {
            success: true,
            message: execution.parsed?.smtp_ready
                ? 'Preflight concluido: pipeline pronto para operacao.'
                : 'Preflight concluido: pipeline exige ajustes antes do envio real.',
            stdout: execution.stdout,
            stderr: execution.stderr,
            pythonExecutable: execution.pythonExecutable,
            preflight: execution.parsed,
            operation: 'preflight',
        };
    }

    return {
        success: false,
        message: execution.stderr?.trim() || `Preflight falhou com codigo ${execution.code}.`,
        stdout: execution.stdout,
        stderr: execution.stderr,
        pythonExecutable: execution.pythonExecutable,
        preflight: execution.parsed,
        operation: 'preflight',
    };
});

ipcMain.handle('ata-pipeline:reprocess-latest', async (_event, payload) => {
    const workspaceRoot = resolveWorkspaceRoot();
    const args = ['-m', 'ata_multiagent_pipeline.cli', 'reprocess-latest'];
    if (payload?.dryRunEmail) {
        args.push('--dry-run-email');
    }

    const execution = await runPythonCommand(workspaceRoot, args);

    if (execution.code === 0 || execution.code === 2) {
        return {
            success: Boolean(execution.parsed?.success),
            message: execution.parsed?.success ? buildReprocessSuccessMessage(execution.parsed) : 'Reprocessamento executado, mas retornou validacao incompleta.',
            stdout: execution.stdout,
            stderr: execution.stderr,
            pythonExecutable: execution.pythonExecutable,
            result: execution.parsed,
            operation: 'reprocess-latest',
        };
    }

    return {
        success: false,
        message: execution.stderr?.trim() || `Reprocessamento falhou com codigo ${execution.code}.`,
        stdout: execution.stdout,
        stderr: execution.stderr,
        pythonExecutable: execution.pythonExecutable,
        result: execution.parsed,
        operation: 'reprocess-latest',
    };
});

app.whenReady().then(createWindow);

app.on('will-quit', () => {
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
