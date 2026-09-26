# 思维导图组件库与沙箱 (Mindmap Toolkit & Sandbox)

本目录为仓库内**独立的思维导图与大纲双视图组件库及沙箱实现**。
专注于提供成熟、稳定、高质感的树状节点拖拽、原位富文本/公式编辑与视口交互体验，既可独立在沙箱运行，也可作为工具依赖供题库主应用（`O` 键全局认知导图）调用。

---

## 核心特性与架构设计

1. **组件化与作用域隔离**：
   * 独立宿主入口 (`index.html`)、独立样式表 (`css/sandbox.css`、`css/outliner.css`)、模块化组件 (`js/mindmap_*.js`)；
   * 各组件均支持指定挂载容器 (`options.container`) 与激活态检查 (`options.isActiveCheck`)，可被外部应用按需调用且实现严格的键盘隔离。
2. **离线高可用 Vendor 库**：
   * 内置官方打包的 `simpleMindMap.umd.min.js` 与 `simpleMindMap.min.css`，纯离线秒级加载，不受外网波动影响。
3. **原生高品质拖拽 (Drag & Drop)**：
   * 100% 委托成熟 `Drag` 插件与磁吸增强器 (`MindMapDragEnhancer`)；
   * **兄弟节点重排**：拖至节点上下边缘自动浮现蓝色插槽线指示；
   * **父子关系迁移 (Reparenting)**：拖入目标节点主体区域高亮提示，平滑转为目标子节点；
   * **子树原子迁移 (Subtree Integrity)**：携带全部子孙节点同步移动，分支连线自动重排；
   * **视口边缘自动卷滚**：当拖拽节点靠近屏幕边缘时自动平移画布；
   * **防成环保护**：原生拓扑层级校验，杜绝将祖先节点移入子孙分支。
4. **全键盘快捷键与操作质感**：
   * `Tab`：在当前选中节点下插入子节点
   * `Enter`：在当前选中节点后插入同级兄弟节点
   * `Delete` / `Backspace`：删除当前选中的节点及其整棵子树
   * `Ctrl + Z` / `Ctrl + Y`：撤销 / 重做操作
   * `Space + 鼠标左键拖拽` 或 `鼠标右键拖拽`：平移漫游画布
   * `Ctrl + 滚轮`：以鼠标光标所在点为中心缩放视口
   * `双击节点` 或 `选中按 Space`：就地调出输入框编辑文本内容
   * `Alt + .` / `Alt + Shift + .` / `Alt + 1/2/3`：单节点折叠、全部展开/折叠、按层级展开（一览全局）

---

## 启动与体验方式

### 方式 1：本地极简静态服务器启动（推荐）
在仓库根目录下运行：
```bash
# 使用 Python 启动
python -m http.server 8080

# 或使用 Node 启动
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((q,s)=>{let p=path.join('.',decodeURIComponent(q.url.split('?')[0]));if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)){s.writeHead(404);s.end();return;}s.writeHead(200);fs.createReadStream(p).pipe(s);}).listen(8080,()=>console.log('http://127.0.0.1:8080/mindmap-sandbox/index.html'));"
```
打开浏览器访问：`http://127.0.0.1:8080/mindmap-sandbox/index.html`

### 方式 2：直接双击打开
在浏览器中直接通过 `file://` 协议打开本目录下的 `index.html` 即可完整体验。

---

## 自动化回归测试套件 (CDP E2E)

沙箱配套提供全流程端到端自动化测试脚本 `test_runner.js`，基于 Chrome DevTools 协议对核心指标进行全自动断言：

```bash
# 在仓库根目录运行测试套件
node mindmap-sandbox/test_runner.js
```
