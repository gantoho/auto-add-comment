# auto add comment
## Hi
auto add comment

## Build Plugin
install tool
```sh
$ npm install -g @vscode/vsce
```
compile
```sh
$ npm run compile
```
tsc
```sh
$ npx tsc
```
build
```sh
$ npm install
$ vsce package
```

## Release

### 创建 Tag
```sh
# 查看当前分支
$ git branch

# 确保在主分支
$ git checkout main

# 拉取最新代码
$ git pull origin main

# 创建标签（版本号根据实际情况修改）
$ git tag -a v0.0.1 -m "Release v0.0.1"

# 推送标签到远程仓库
$ git push origin v0.0.1
```

### 更新插件版本号
#### 手动更新
```sh
# 打开 extension.json 文件
$ code extension.json

# 更新 version 字段为新版本号
"version": "0.0.1"

# 推送代码
$ git push origin main
```
#### 使用npm version patch 更新版本号
```sh
# 更新版本号，自动追加版本号
$ npm version patch

# 推送代码
$ git push origin main
```

### 发布插件
1. 确保已安装 `@vscode/vsce` 工具
   ```sh
   $ npm install -g @vscode/vsce
   ```

2. 编译插件
   ```sh
   $ npm run compile
   ```

3. 打包插件
   ```sh
   $ vsce package
   ```

4. 发布插件（需要 VS Code Marketplace 账号）
   ```sh
   $ vsce publish
   ```


## 参考常用配置
```
"php": "<?php # {marker}|{time} ?>",
"js": "// ! {marker}|{time} !",
"css": "/* ! {marker}|{time} ! */",
"vue": "<!-- ! {marker}|{time} ! -->",
"html": "<!-- ! {marker}|{time} ! -->",
"yaml": "# ! {marker}|{time} !"
```

## 规范提交代码
| 提交类型 | 用途                           | 推荐 emoji                    | 示例                               |
| -------- | ------------------------------ | ----------------------------- | ---------------------------------- |
| feat     | 新增功能                       | ✨ (sparkles)                  | feat: ✨ 新增Vue文件注释配置        |
| fix      | 修复 bug                       | 🐛 (bug)                       | fix: 🐛 修复Vue文件重复添加注释问题 |
| docs     | 仅文档修改                     | 📝 (memo)                      | docs: 📝 更新插件打包说明           |
| style    | 代码格式（不影响逻辑）         | 🎨 (art)                       | style: 🎨 格式化extension.ts代码    |
| refactor | 重构（既不是 feat 也不是 fix） | ♻️ (recycle)                   | refactor: ♻️ 优化注释匹配逻辑       |
| test     | 添加 / 修改测试                | 🧪 (test_tube)                 | test: 🧪 新增插件功能测试用例       |
| chore    | 构建 / 工具配置修改            | 🔧 (wrench)                    | chore: 🔧 配置插件icon图片路径      |
| perf     | 性能优化                       | ⚡ (zap)                       | perf: ⚡ 优化防循环延迟逻辑         |
| revert   | 回滚提交                       | ↩️ (leftwards_arrow_with_hook) | revert: ↩️ 回滚到v0.0.1版本         |

