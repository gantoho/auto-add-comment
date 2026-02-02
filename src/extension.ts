import * as vscode from 'vscode';
import * as path from 'path';

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
    // 获取对应后缀的模板
    const template = templates[fileExt];
    if (!template) {
        return null;
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
    // 注册切换插件状态的命令
    const toggleCommand = vscode.commands.registerCommand('auto-add-comment.toggle', () => {
        isEnabled = !isEnabled;
        vscode.window.showInformationMessage(`Auto Add Comment is now ${isEnabled ? 'enabled' : 'disabled'}`);
        // 更新状态栏按钮
        updateStatusBarItem();
        // 更新上下文值，用于状态栏按钮的显示条件
        vscode.commands.executeCommand('setContext', 'autoAddComment:enabled', isEnabled);
    });

    // 创建状态栏按钮
    let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'auto-add-comment.toggle';
    statusBarItem.text = isEnabled ? `$(check)` : `$(x)`;
    statusBarItem.tooltip = `Click to ${isEnabled ? 'disable' : 'enable'} Auto Add Comment`;
    statusBarItem.show();

    // 设置初始上下文值
    vscode.commands.executeCommand('setContext', 'autoAddComment:enabled', isEnabled);

    // 更新状态栏按钮状态
    function updateStatusBarItem() {
        statusBarItem.text = isEnabled ? `$(check)` : `$(x)`;
        statusBarItem.tooltip = `Click to ${isEnabled ? 'disable' : 'enable'} Auto Add Comment`;
    }

    const disposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        // 检查插件是否启用
        if (!isEnabled) {
            return;
        }

        const document = event.document;
        const filePath = document.uri.fsPath;

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
