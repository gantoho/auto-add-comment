import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 防循环标记
const processingFiles = new Set<string>();
const PROCESS_DELAY = 1000;

// 插件启用状态
let isEnabled = false;

/**
 * 获取配置的自定义注释标识
 * @returns 自定义标识字符串
 */
function getCommentMarker(): string {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    return config.get<string>('commentMarker', 'vantagemarekts');
}

/**
 * 获取配置的时间偏移分钟数
 * @returns 偏移分钟数（正数往后，负数往前）
 */
function getTimeOffset(): number {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    return config.get<number>('timeOffset', 0);
}

/**
 * 格式化时间（含偏移）
 * @returns 格式化后的时间字符串 YYYY-MM-DD HH:mm:ss
 */
function formatOffsetTime(): string {
    // 获取当前时间
    const now = new Date();
    // 获取偏移分钟数并转换为毫秒
    const offsetMinutes = getTimeOffset();
    const offsetMs = offsetMinutes * 60 * 1000;
    // 计算偏移后的时间
    const offsetTime = new Date(now.getTime() + offsetMs);

    // 格式化（补零确保两位数）
    const year = offsetTime.getFullYear();
    const month = String(offsetTime.getMonth() + 1).padStart(2, '0');
    const day = String(offsetTime.getDate()).padStart(2, '0');
    const hours = String(offsetTime.getHours()).padStart(2, '0');
    const minutes = String(offsetTime.getMinutes()).padStart(2, '0');
    const seconds = String(offsetTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 读取配置的注释模板并替换占位符
 * @param fileExt 文件后缀（如php、js、vue）
 * @returns 带自定义标识和偏移时间的注释内容
 */
function getCommentContentByConfig(fileExt: string): string | null {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    const templates = config.get<Record<string, string>>('templates', {});
    const enabledTemplates = config.get<Record<string, boolean>>('enabledTemplates', {});
    
    // 获取对应后缀的模板
    let template = templates[fileExt];
    
    // 如果模板不存在，使用默认模板
    if (!template) {
        const defaultTemplates = {};
        template = defaultTemplates[fileExt as keyof typeof defaultTemplates];
        if (!template) {
            return null;
        }
    } else {
        // 检查模板是否被启用
        const isEnabled = enabledTemplates[fileExt] !== false; // 默认启用
        if (!isEnabled) {
            return null;
        }
    }

    // 获取自定义标识和偏移时间
    const marker = getCommentMarker();
    const offsetTime = formatOffsetTime();

    // 替换模板中的占位符
    let commentContent = template.replace('{marker}', marker);
    commentContent = commentContent.replace('{time}', offsetTime);

    return commentContent;
}

/**
 * 查找包含自定义标识的注释行
 * @param document 文本文档
 * @returns 注释行号（null=未找到）
 */
function findMarkerCommentLine(document: vscode.TextDocument): number | null {
    // 获取自定义标识
    const marker = getCommentMarker();
    if (!marker) { return null; }

    // 遍历所有行查找包含标识的注释
    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        if (lineText.includes(marker)) {
            return i;
        }
    }
    return null;
}

// 激活插件
export function activate(context: vscode.ExtensionContext) {
    // 存储webview面板引用
    let webviewPanel: vscode.WebviewPanel | undefined;

    // 注册命令：显示弹出面板
    const toggleCommand = vscode.commands.registerCommand('auto-add-comment.toggle', () => {
        showWebviewPanel(context);
    });

    // 创建状态栏按钮
    let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'auto-add-comment.toggle';
    statusBarItem.text = isEnabled ? `$(pass-filled) 开启` : `$(circle-large-outline) 关闭`;
    statusBarItem.tooltip = `Click to open Auto Add Comment panel`;
    statusBarItem.show();

    // 设置初始上下文值
    vscode.commands.executeCommand('setContext', 'autoAddComment:enabled', isEnabled);

    // 更新状态栏按钮状态
    function updateStatusBarItem() {
        statusBarItem.text = isEnabled ? `$(pass-filled) 开启` : `$(circle-large-outline) 关闭`;
        statusBarItem.tooltip = `Click to open Auto Add Comment panel`;
    }

    // 显示webview面板
    function showWebviewPanel(context: vscode.ExtensionContext) {
        // 如果面板已经打开，就关闭它
        if (webviewPanel) {
            webviewPanel.dispose();
        }

        // 创建新的webview面板
        webviewPanel = vscode.window.createWebviewPanel(
            'autoAddCommentPanel',
            'Auto Add Comment',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)],
                enableCommandUris: true,
                enableFindWidget: true,
                enableForms: true
            }
        );

        // 更新webview内容
        updateWebviewContent();

        // 处理webview消息
        webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'toggleEnable':
                        isEnabled = message.enabled;
                        updateStatusBarItem();
                        vscode.commands.executeCommand('setContext', 'autoAddComment:enabled', isEnabled);
                        vscode.window.showInformationMessage(`Auto Add Comment is now ${isEnabled ? 'enabled' : 'disabled'}`);
                        // 实时更新webview中的状态
                        if (webviewPanel) {
                            webviewPanel.webview.postMessage({
                                command: 'updateStatus',
                                enabled: isEnabled
                            });
                        }
                        break;
                    case 'updateConfig':
                        // 更新配置
                        const config = vscode.workspace.getConfiguration('fileAutoComment');
                        const updatePromises = [];
                        if (message.commentMarker !== undefined) {
                            updatePromises.push(config.update('commentMarker', message.commentMarker, vscode.ConfigurationTarget.Global));
                        }
                        if (message.timeOffset !== undefined) {
                            updatePromises.push(config.update('timeOffset', message.timeOffset, vscode.ConfigurationTarget.Global));
                        }
                        if (message.enableWorkspaceFilter !== undefined) {
                            updatePromises.push(config.update('enableWorkspaceFilter', message.enableWorkspaceFilter, vscode.ConfigurationTarget.Global));
                        }
                        if (message.workspacePath !== undefined) {
                            updatePromises.push(config.update('workspacePath', message.workspacePath, vscode.ConfigurationTarget.Global));
                        }
                        if (message.templates !== undefined) {
                            updatePromises.push(config.update('templates', message.templates, vscode.ConfigurationTarget.Global));
                        }
                        if (message.enabledTemplates !== undefined) {
                            console.log('Saving enabledTemplates:', message.enabledTemplates);
                            updatePromises.push(config.update('enabledTemplates', message.enabledTemplates, vscode.ConfigurationTarget.Global));
                        }
                        
                        if (updatePromises.length > 0) {
                            Promise.all(updatePromises).then(() => {
                                // 验证保存是否成功
                                const savedEnabledTemplates = config.get<Record<string, boolean>>('enabledTemplates', {});
                                console.log('Saved enabledTemplates:', savedEnabledTemplates);
                                vscode.window.showInformationMessage('自动添加注释设置已更新');

                            }).catch(error => {
                                console.error('Error updating config:', error);
                                vscode.window.showErrorMessage('更新设置失败');

                            });
                        }
                        break;
                    case 'openSettings':
                        // 打开扩展设置
                        vscode.commands.executeCommand('workbench.action.openSettings', 'fileAutoComment');
                        break;
                    case 'confirmDelete':
                        // 显示删除确认对话框
                        vscode.window.showInformationMessage(
                            '确定要删除此模板吗？',
                            { modal: true },
                            '是',
                            '否'
                        ).then(answer => {
                            if (answer === '是' && webviewPanel) {
                                // 获取当前配置
                                const config = vscode.workspace.getConfiguration('fileAutoComment');
                                const templates = config.get<Record<string, string>>('templates', {});
                                const enabledTemplates = config.get<Record<string, boolean>>('enabledTemplates', {});
                                
                                // 从webview获取要删除的模板语言
                                // 注意：这里需要从模板项中获取语言名称
                                // 由于我们只有templateId，需要通过其他方式获取语言
                                // 这里我们采用一种简单的方法：让webview在发送confirmDelete消息时包含语言名称
                                // 但为了保持兼容性，我们先尝试从界面中获取
                                
                                // 发送确认删除消息到webview
                                webviewPanel.webview.postMessage({
                                    command: 'deleteConfirmed',
                                    templateId: message.templateId
                                });
                                
                                // 注意：实际的删除操作需要在webview端完成后，通过save按钮保存
                                // 因为只有在保存时才会更新配置
                            }
                        });
                        break;
                    case 'resetSettings':
                        // 恢复默认设置
                        vscode.window.showInformationMessage(
                            '确定要将所有设置恢复为默认值吗？',
                            { modal: true },
                            '是',
                            '否'
                        ).then(answer => {
                            if (answer === '是') {
                                const config = vscode.workspace.getConfiguration('fileAutoComment');
                                // 恢复默认配置
                                Promise.all([
                                    config.update('commentMarker', 'project', vscode.ConfigurationTarget.Global),
                                    config.update('timeOffset', 5, vscode.ConfigurationTarget.Global),
                                    config.update('enableWorkspaceFilter', false, vscode.ConfigurationTarget.Global),
                                    config.update('workspacePath', '', vscode.ConfigurationTarget.Global),
                                    config.update('templates', {}, vscode.ConfigurationTarget.Global),
                                    config.update('enabledTemplates', {}, vscode.ConfigurationTarget.Global)
                                ]).then(() => {
                                    // 配置更新完成后，重新加载webview内容
                                    updateWebviewContent();
                                    vscode.window.showInformationMessage('自动添加注释设置已恢复为默认值');

                                });
                            }
                        });
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // 当面板关闭时，清除引用
        webviewPanel.onDidDispose(() => {
            webviewPanel = undefined;
        });
    }

    // 更新webview内容
    function updateWebviewContent() {
        if (!webviewPanel) {
            return;
        }

        // 读取webview.html文件
        const htmlPath = path.join(context.extensionPath, 'webview.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // 生成webview资源URI
        const cssPath = vscode.Uri.file(path.join(context.extensionPath, 'webview.css'));
        const jsPath = vscode.Uri.file(path.join(context.extensionPath, 'webview.js'));
        const cssUri = webviewPanel.webview.asWebviewUri(cssPath);
        const jsUri = webviewPanel.webview.asWebviewUri(jsPath);

        // 替换资源路径
        htmlContent = htmlContent.replace('./webview.css', cssUri.toString());
        htmlContent = htmlContent.replace('./webview.js', jsUri.toString());

        // 获取当前配置
        const config = vscode.workspace.getConfiguration('fileAutoComment');
        const commentMarker = config.get<string>('commentMarker', 'project');
        const timeOffset = config.get<number>('timeOffset', 5);
        const enableWorkspaceFilter = config.get<boolean>('enableWorkspaceFilter', false);
        const workspacePath = config.get<string>('workspacePath', '');
        const templates = config.get<Record<string, string>>('templates', {});
        const enabledTemplates = config.get<Record<string, boolean>>('enabledTemplates', {});

        // 生成模板HTML
        const templatesHtml = Object.entries(templates).map(([lang, template]) => {
            const isEnabled = enabledTemplates[lang] !== false; // 默认启用
            return `
            <div class="template-item">
                <div class="template-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" class="template-checkbox" ${isEnabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <input type="text" class="language-input" value="${lang}" placeholder="Language">
                <input type="text" class="template-input" value="${template}">
                <button class="delete-template">Delete</button>
            </div>
            `;
        }).join('');

        // 替换占位符
        htmlContent = htmlContent.replace('{{enabled}}', isEnabled ? 'checked' : '');
        htmlContent = htmlContent.replace('{{status}}', isEnabled ? 'Enabled' : 'Disabled');
        // 替换状态类名
        htmlContent = htmlContent.replace(/class="status \{\{status === 'Enabled' \? 'enabled' : 'disabled'\}\}"/g, `class="status ${isEnabled ? 'enabled' : 'disabled'}"`);
        htmlContent = htmlContent.replace(/class="container \{\{status === 'Enabled' \? 'enabled' : 'disabled'\}\}"/g, `class="container ${isEnabled ? 'enabled' : 'disabled'}"`);
        htmlContent = htmlContent.replace('{{commentMarker}}', commentMarker);
        htmlContent = htmlContent.replace('{{timeOffset}}', String(timeOffset));
        htmlContent = htmlContent.replace('{{enableWorkspaceFilter}}', enableWorkspaceFilter ? 'checked' : '');
        htmlContent = htmlContent.replace('{{workspacePath}}', workspacePath);
        htmlContent = htmlContent.replace('{{templates}}', templatesHtml);

        // 设置webview内容
        webviewPanel.webview.html = htmlContent;
    }

    const disposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        // 检查插件是否启用
        if (!isEnabled) {
            return;
        }

        const document = event.document;
        const filePath = document.uri.fsPath;

        // 检查工作区路径配置
        const config = vscode.workspace.getConfiguration('fileAutoComment');
        const enableWorkspaceFilter = config.get<boolean>('enableWorkspaceFilter', false);
        const workspacePath = config.get<string>('workspacePath', '');
        
        if (enableWorkspaceFilter && workspacePath) {
            try {
                // 标准化路径并确保末尾有路径分隔符
                const normalizedFilePath = path.normalize(filePath);
                let normalizedWorkspacePath = path.normalize(workspacePath);
                
                // 确保工作区路径末尾有路径分隔符，避免子路径误判
                if (!normalizedWorkspacePath.endsWith(path.sep)) {
                    normalizedWorkspacePath += path.sep;
                }
                
                console.log(`[工作区检查] 检查文件 ${normalizedFilePath} 是否在工作区 ${normalizedWorkspacePath} 内`);
                
                // 在Windows上进行大小写不敏感的比较
                const isInWorkspace = process.platform === 'win32' 
                    ? normalizedFilePath.toLowerCase().startsWith(normalizedWorkspacePath.toLowerCase())
                    : normalizedFilePath.startsWith(normalizedWorkspacePath);
                
                if (!isInWorkspace) {
                    console.log(`[工作区检查] 文件 ${filePath} 不在配置的工作区内，跳过处理`);
                    return;
                }
                console.log(`[工作区检查] 文件 ${filePath} 在配置的工作区内，继续处理`);
            } catch (error) {
                console.error('[工作区检查] 路径检查出错:', error);
                // 出错时继续处理，避免插件完全失效
            }
        } else if (enableWorkspaceFilter) {
            console.log('[工作区检查] 工作区过滤已启用，但未设置工作区路径，跳过处理');
            return;
        }

        if (event.reason !== vscode.TextDocumentSaveReason.Manual) {
            return;
        }

        if (!document.isDirty) {
            return;
        }

        // 防循环：同一文件短时间内只处理一次
        if (processingFiles.has(filePath)) {
            console.log(`[防循环] 跳过重复处理文件: ${filePath}`);
            return;
        }

        // 获取文件后缀（.php → php）
        const fileExt = path.extname(document.fileName).replace(/^\./, '');
        if (!fileExt) { return; }

        // 获取配置的注释内容
        const commentContent = getCommentContentByConfig(fileExt);
        if (!commentContent) { return; }

        try {
            processingFiles.add(filePath);
            const edit = new vscode.WorkspaceEdit();
            let needAutoSave = false;

            // 查找已有注释行
            const commentLineNum = findMarkerCommentLine(document);
            if (commentLineNum !== null) {
                // 找到注释行 → 替换整行
                console.log(`[替换注释] 文件${filePath}的第${commentLineNum}行`);
                const commentLine = document.lineAt(commentLineNum);
                edit.replace(document.uri, commentLine.range, commentContent);
                needAutoSave = true;
            } else {
                // 未找到 → 末尾添加（处理空行）
                console.log(`[新增注释] 文件${filePath}末尾`);
                const lastLine = document.lineAt(document.lineCount - 1);
                const insertText = lastLine.text.trim() === '' 
                    ? commentContent 
                    : `\n${commentContent}`;
                const insertPos = lastLine.text.trim() === '' 
                    ? new vscode.Position(document.lineCount - 1, 0) 
                    : new vscode.Position(document.lineCount, 0);
                
                edit.insert(document.uri, insertPos, insertText);
                needAutoSave = true;
            }

            // 应用编辑并自动保存
            const editSuccess = await vscode.workspace.applyEdit(edit);
            if (editSuccess && needAutoSave) {
                await new Promise(resolve => setTimeout(resolve, 50));
                await document.save();
                console.log(`[自动保存] 文件${filePath}完成`);
            }
        } catch (error) {
            console.error(`[错误] 处理文件${filePath}失败:`, error);
            vscode.window.showErrorMessage(`File Auto Comment: 处理${fileExt}文件失败，请查看控制台！`);
        } finally {
            // 延迟释放防循环标记
            setTimeout(() => {
                processingFiles.delete(filePath);
                console.log(`[释放标记] 文件${filePath}`);
            }, PROCESS_DELAY);
        }
    });

    // 检查是否需要自动打开 README
    checkAndOpenReadme(context);

    context.subscriptions.push(disposable);
    context.subscriptions.push(toggleCommand);
    context.subscriptions.push(statusBarItem);
}

/**
 * 检查版本并自动打开 README
 */
async function checkAndOpenReadme(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    const lastVersion = context.globalState.get<string>('lastVersion');
    const currentVersion = context.extension.packageJSON.version;

    // 如果是新安装或版本更新
    if (lastVersion !== currentVersion) {
        // 更新存储的版本号
        await context.globalState.update('lastVersion', currentVersion);

        // 询问用户是否查看更新说明
        const selection = await vscode.window.showInformationMessage(
            `Auto Add Comment 已更新至 v${currentVersion}，是否查看更新说明？`,
            '查看 README',
            '忽略'
        );

        if (selection === '查看 README') {
            // 打开 README 文件
            const readmePath = path.join(context.extensionPath, 'README.md');
            const uri = vscode.Uri.file(readmePath);
            await vscode.commands.executeCommand('markdown.showPreview', uri);
        }
    }
}


export function deactivate() {}
