const vscode = acquireVsCodeApi();

// 配置修改状态
let hasUnsavedChanges = false;

// 切换描述内容的显示/隐藏
function toggleDescription() {
    const content = document.getElementById('descriptionContent');
    const icon = document.getElementById('toggleIcon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}

// 标记配置已修改
function markAsChanged() {
    hasUnsavedChanges = true;
    // 更新保存按钮样式，提示用户有未保存的更改
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.classList.add('has-changes');
    }
}

// 标记配置已保存
function markAsSaved() {
    hasUnsavedChanges = false;
    // 恢复保存按钮样式
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.classList.remove('has-changes');
    }
}

// 切换启用状态
document.getElementById('enableToggle').addEventListener('change', function(e) {
    markAsChanged();
    vscode.postMessage({
        command: 'toggleEnable',
        enabled: e.target.checked
    });
});

// 监听配置项变化
document.getElementById('commentMarker').addEventListener('input', markAsChanged);
document.getElementById('timeOffset').addEventListener('input', markAsChanged);
document.getElementById('enableWorkspaceFilter').addEventListener('change', markAsChanged);
document.getElementById('workspacePath').addEventListener('input', markAsChanged);

// 监听模板变化
document.getElementById('templatesContainer').addEventListener('input', function(event) {
    if (event.target.classList.contains('language-input') || event.target.classList.contains('template-input')) {
        markAsChanged();
    }
});

document.getElementById('templatesContainer').addEventListener('change', function(event) {
    if (event.target.classList.contains('template-checkbox')) {
        markAsChanged();
    }
});

// 添加新模板
document.getElementById('addTemplate').addEventListener('click', function() {
    const container = document.getElementById('templatesContainer');
    const newItem = document.createElement('div');
    newItem.className = 'template-item';
    newItem.innerHTML = `
        <div class="template-toggle">
            <label class="toggle-switch">
                <input type="checkbox" class="template-checkbox">
                <span class="toggle-slider"></span>
            </label>
        </div>
        <input type="text" class="language-input" value="new" placeholder="Language">
        <input type="text" class="template-input" value="" placeholder="Comment template">
        <button class="delete-template">Delete</button>
    `;
    container.appendChild(newItem);
    markAsChanged();
});

// 统一用事件委托处理所有删除按钮点击（核心修复）
document.getElementById('templatesContainer').addEventListener('click', function(event) {
    // 只处理删除按钮的点击
    if (event.target.classList.contains('delete-template')) {
        // 为模板项设置唯一ID
        const templateItem = event.target.closest('.template-item');
        if (templateItem) {
            if (!templateItem.id) {
                templateItem.id = 'template_' + Date.now();
            }
            
            // 发送删除确认请求
            vscode.postMessage({
                command: 'confirmDelete',
                templateId: templateItem.id
            });
            
            // 标记配置已修改
            markAsChanged();
        }
    }
});

// 保存设置
document.getElementById('saveButton').addEventListener('click', function() {
    const commentMarker = document.getElementById('commentMarker').value || '';
    const timeOffset = parseInt(document.getElementById('timeOffset').value) || 0;
    const enableWorkspaceFilter = document.getElementById('enableWorkspaceFilter').checked;
    const workspacePath = document.getElementById('workspacePath').value || '';
    
    // 收集所有模板及其启用状态
    const templates = {};
    const enabledTemplates = {};
    document.querySelectorAll('.template-item').forEach(item => {
        const checkbox = item.querySelector('.template-checkbox');
        const langInput = item.querySelector('.language-input');
        const templateInput = item.querySelector('.template-input');
        if (checkbox && langInput && templateInput) {
            const lang = langInput.value.trim();
            const template = templateInput.value.trim();
            if (lang && template) {
                templates[lang] = template;
                enabledTemplates[lang] = checkbox.checked;
            }
        }
    });
    
    vscode.postMessage({
        command: 'updateConfig',
        commentMarker: commentMarker,
        timeOffset: timeOffset,
        enableWorkspaceFilter: enableWorkspaceFilter,
        workspacePath: workspacePath,
        templates: templates,
        enabledTemplates: enabledTemplates
    });
    
    // 标记配置已保存
    markAsSaved();
});

// 打开VS Code设置
document.getElementById('openSettingsButton').addEventListener('click', function() {
    vscode.postMessage({
        command: 'openSettings'
    });
});

// 恢复默认设置
document.getElementById('resetButton').addEventListener('click', function() {
    vscode.postMessage({
        command: 'resetSettings'
    });
});

// 接收来自插件的消息
window.addEventListener('message', event => {
    const message = event.data;
    console.log(event.data, event, message, '----')
    if (message.command === 'updateStatus') {
        // 更新Status显示
        const statusElement = document.querySelector('.toggle-info .status');
        const containerElement = document.querySelector('.container');
        if (statusElement) {
            statusElement.classList.remove('enabled', 'disabled');
            statusElement.classList.add(message.enabled ? 'enabled' : 'disabled');
            containerElement.classList.remove('enabled', 'disabled');
            containerElement.classList.add(message.enabled ? 'enabled' : 'disabled');
            statusElement.innerHTML = `${message.enabled ? 'Enabled' : 'Disabled'}`;
        }
    } else if (message.command === 'deleteConfirmed') {
        // 执行删除操作
        const templateItem = document.getElementById(message.templateId);
        if (templateItem) {
            templateItem.remove();
        }
    }
});