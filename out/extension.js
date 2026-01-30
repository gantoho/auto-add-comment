"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// 防循环标记
const processingFiles = new Set();
const PROCESS_DELAY = 1000; // 延长防循环延迟
// 注释的唯一标识（核心：通过这个标识定位注释）
const COMMENT_MARKER = 'vantagemarekts';
// 格式化时间
function formatCurrentTime() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}
// 根据文件后缀获取注释内容（直接硬编码，避免配置解析问题）
function getCommentContentByExt(fileExt) {
    const time = formatCurrentTime();
    switch (fileExt) {
        case 'php':
            return `<?php # ${COMMENT_MARKER}|${time} ?>`;
        case 'js':
            return `// ! ${COMMENT_MARKER}|${time} !`;
        case 'css':
            return `/* ! ${COMMENT_MARKER}|${time} ! */`;
        default:
            return null;
    }
}
// 查找文件中所有包含唯一标识的注释行
function findMarkerCommentLine(document) {
    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        // 核心：只要行中包含唯一标识，就判定为我们的注释行
        if (lineText.includes(COMMENT_MARKER)) {
            return i; // 返回行号
        }
    }
    return null; // 未找到
}
// 激活插件
function activate(context) {
    const disposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        const document = event.document;
        const filePath = document.uri.fsPath;
        // 1. 防循环：同一文件短时间内只处理一次
        if (processingFiles.has(filePath)) {
            console.log(`[防循环] 跳过重复处理文件: ${filePath}`);
            return;
        }
        // 2. 获取文件后缀（.php → php）
        const fileExt = path.extname(document.fileName).replace(/^\./, '');
        if (!fileExt) {
            return;
        }
        // 3. 获取当前文件对应的注释内容
        const commentContent = getCommentContentByExt(fileExt);
        if (!commentContent) {
            return;
        }
        try {
            processingFiles.add(filePath);
            const edit = new vscode.WorkspaceEdit();
            let needAutoSave = false;
            // 4. 查找已有注释行
            const commentLineNum = findMarkerCommentLine(document);
            if (commentLineNum !== null) {
                // 4.1 找到注释行 → 替换整行内容
                console.log(`[替换注释] 文件${filePath}的第${commentLineNum}行`);
                const commentLine = document.lineAt(commentLineNum);
                edit.replace(document.uri, commentLine.range, commentContent);
                needAutoSave = true;
            }
            else {
                // 4.2 未找到 → 在文件末尾添加
                console.log(`[新增注释] 文件${filePath}末尾`);
                const lastLine = document.lineAt(document.lineCount - 1);
                // 处理最后一行空行，避免多换行
                const insertText = lastLine.text.trim() === ''
                    ? commentContent
                    : `\n${commentContent}`;
                const insertPos = lastLine.text.trim() === ''
                    ? new vscode.Position(document.lineCount - 1, 0)
                    : new vscode.Position(document.lineCount, 0);
                edit.insert(document.uri, insertPos, insertText);
                needAutoSave = true;
            }
            // 5. 应用编辑并自动保存
            const editSuccess = await vscode.workspace.applyEdit(edit);
            if (editSuccess && needAutoSave) {
                // 延迟保存，避免立即触发新的保存事件
                await new Promise(resolve => setTimeout(resolve, 50));
                await document.save();
                console.log(`[自动保存] 文件${filePath}完成`);
            }
        }
        catch (error) {
            console.error(`[错误] 处理文件${filePath}失败:`, error);
            vscode.window.showErrorMessage(`File Auto Comment: 处理${fileExt}文件失败，请查看控制台！`);
        }
        finally {
            // 延迟移除标记，确保防循环生效
            setTimeout(() => {
                processingFiles.delete(filePath);
                console.log(`[释放标记] 文件${filePath}`);
            }, PROCESS_DELAY);
        }
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map