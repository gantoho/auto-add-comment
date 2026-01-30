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
const PROCESS_DELAY = 1000;
/**
 * 获取配置的自定义注释标识
 * @returns 自定义标识字符串
 */
function getCommentMarker() {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    return config.get('commentMarker', 'vantagemarekts');
}
/**
 * 获取配置的时间偏移分钟数
 * @returns 偏移分钟数（正数往后，负数往前）
 */
function getTimeOffset() {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    return config.get('timeOffset', 0);
}
/**
 * 格式化时间（含偏移）
 * @returns 格式化后的时间字符串 YYYY-MM-DD HH:mm:ss
 */
function formatOffsetTime() {
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
function getCommentContentByConfig(fileExt) {
    const config = vscode.workspace.getConfiguration('fileAutoComment');
    const templates = config.get('templates', {});
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
function findMarkerCommentLine(document) {
    // 获取自定义标识
    const marker = getCommentMarker();
    if (!marker) {
        return null;
    }
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
function activate(context) {
    const disposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        const document = event.document;
        const filePath = document.uri.fsPath;
        // 防循环：同一文件短时间内只处理一次
        if (processingFiles.has(filePath)) {
            console.log(`[防循环] 跳过重复处理文件: ${filePath}`);
            return;
        }
        // 获取文件后缀（.php → php）
        const fileExt = path.extname(document.fileName).replace(/^\./, '');
        if (!fileExt) {
            return;
        }
        // 获取配置的注释内容
        const commentContent = getCommentContentByConfig(fileExt);
        if (!commentContent) {
            return;
        }
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
            }
            else {
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
        }
        catch (error) {
            console.error(`[错误] 处理文件${filePath}失败:`, error);
            vscode.window.showErrorMessage(`File Auto Comment: 处理${fileExt}文件失败，请查看控制台！`);
        }
        finally {
            // 延迟释放防循环标记
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