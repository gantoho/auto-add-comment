# auto add comment
## Hi
auto add comment

## Build Plugin
install tool
```sh
$ npm install -g @vscode/vsce
```
build
```sh
$ npm install
$ vsce package
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

