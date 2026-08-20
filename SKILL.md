# sptmChart 项目技能文件

> 本文件用于新会话快速了解 sptmChart 项目，并规范开发行为。
> **适用范围**: `f:\lingma\sptmCharts` 目录及其子目录。

---

## 1. 项目概述

`sptmChart` 是一个基于 **HTML5 Canvas 2D** 的频谱图/瀑布图可视化组件库，用于频谱数据（FFT / DScan）的可视化呈现。

### 核心特性
- **FFT 单频模式**: 单频段快速傅里叶变换频谱可视化，支持大数据量抽点优化
- **DScan 频段模式**: 多段非连续频率数据分段显示，支持频段合并与分界线绘制
- **瀑布图 (Waterfall)**: 基于 Canvas ImageData 高性能像素绘制，支持 Jet 色系映射
- **Marker 标记**: 可拖拽频谱标记，支持跟随谱线 Y 轴位置、自动吸附（吸附到最近/最大/最小数据点）
- **交互操作**: 滚轮缩放、拖拽平移、选框、右键菜单、门限线拖拽、X/Y 轴范围变化回调

---

## 2. 项目结构

```
sptmCharts/                          # 项目根目录
  src/
    index.js              # 主类 sptmChart，核心绘图引擎（~4827 行）
    index.css             # 基础样式（门限图标、弹窗样式）
    module/
      Waterfall.js        # 瀑布图/频谱图模块（~1000 行）
      MarkerItem.js       # 频谱 Marker 标记组件（~1200 行）
    utils/
      index.js            # 工具函数（深合并、深拷贝、数值计算、抽点算法）
  dist/                   # 构建产物目录（UMD / ESM / CJS 三种格式）
    sptmChart.js          # UMD 格式，浏览器直接使用
    sptmChart.esm.js      # ESM 格式，现代模块化引入
    sptmChart.cjs.js      # CommonJS 格式，Node.js 环境
    sptmChart.css         # 提取后的 CSS
  examples/
    index.html            # 测试示例页面（含 FFT、DScan、Marker、Y 轴范围调整等）
    waterfall.html        # 瀑布图测试页面
  images/                 # 图片资源（门限图标等）
  rollup.config.js        # Rollup 打包配置
  tsconfig.json           # TypeScript 配置（当前未实际使用）
  .babelrc                # Babel 配置
  package.json
  sptmChart.d.ts          # TypeScript 类型声明文件
  README.md               # 项目 README
  PROJECT.md              # 项目速查手册（API 概览）
  API.md                  # 完整 API 文档
```

---

## 3. 技术栈

| 技术 | 说明 |
|------|------|
| **JavaScript (ES6+)** | 面向对象设计，Canvas 2D 直接绘制 |
| **Rollup** | 模块打包，输出 UMD / ESM / CJS 三种格式 |
| **Babel** | ES6+ 转译兼容代码 |
| **Terser** | 代码压缩，构建时移除 console（开发模式保留） |
| **PostCSS** | CSS 提取与压缩 |

---

## 4. 核心文件说明

### `src/index.js`
- 主类 `sptmChart` 的实现
- 包含：频谱绘制、Marker 管理、门限线、选框、缩放/平移、X/Y 轴管理、事件处理等
- 关键方法：`drawChart()`, `addTrace()`, `setTraceData()`, `addMarker()`, `moveMarkerByFreq()`, `setOptions()`, `zoomIn()`, `zoomOut()`, `resetZoom()`
- **Marker 自动吸附逻辑** (`_snapMarker`): 拖动结束后根据配置自动吸附到附近强度最大或最小的数据点

### `src/module/MarkerItem.js`
- Marker 标记组件类
- 包含：Marker 绘制（形状、标牌、十字线、垂直线）、碰撞检测、跟随谱线 Y 轴

### `src/module/Waterfall.js`
- 瀑布图绘制模块
- 使用 `ImageData` 直接操作像素缓冲区，高性能绘制
- 支持 Jet 色系映射、行高缩放

### `src/utils/index.js`
- 工具函数：深合并、深拷贝、数值计算、大数据量抽点（保留极值）、频率/像素坐标转换

### `examples/index.html`
- 主要测试示例页面
- 包含：图表配置面板、Y 轴范围调整、Marker 控制面板、谱线管理、频段配置、绘制控制
- 使用 `dist/sptmChart.js` 构建产物

---

## 5. 构建命令

```bash
# 安装依赖
npm i

# 生产构建（输出到 dist/）
npm run build

# 开发模式（监听文件变化并启动本地服务器）
npm run dev

# 发布前构建
npm run prepublishOnly
```

### Rollup 输出产物

| 文件 | 格式 | 用途 |
|------|------|------|
| `dist/sptmChart.js` | UMD | 浏览器直接使用 (`<script>` 标签引入) |
| `dist/sptmChart.esm.js` | ESM | 现代模块化引入 (`import`) |
| `dist/sptmChart.cjs.js` | CommonJS | Node.js 环境 (`require`) |

---

## 6. 操作限制

> **重要**: 所有文件操作（读取、修改、创建、删除）**仅限于当前项目目录 `f:\lingma\sptmCharts` 及其子目录**。
>
> **禁止**:
> - 修改或读取项目外的任何文件或目录
> - 访问 `f:\lingma\UAVhub` 或其他目录下的文件
> - 跨项目引用或修改
>
> **允许的目录**:
> - `f:\lingma\sptmCharts\src\`
> - `f:\lingma\sptmCharts\dist\`
> - `f:\lingma\sptmCharts\examples\`
> - `f:\lingma\sptmCharts\images\`
> - `f:\lingma\sptmCharts\lib\`

---

## 7. 代码注释规范

> **所有代码注释必须使用中文**。

### 7.1 注释风格

- **单行注释**: 使用 `//`，注释内容紧跟代码逻辑
- **多行注释**: 使用 `/* ... */`，用于解释复杂逻辑
- **JSDoc 注释**: 用于类、方法、参数说明

### 7.2 注释要求

- **函数注释**: 必须包含功能说明、参数说明、返回值说明
- **复杂逻辑**: 必须解释其工作原理
- **常量/配置**: 必须说明含义和用途
- **TODO/FIXME**: 标注待办或待修复问题

### 7.3 示例

```javascript
/**
 * 添加一条谱线
 * @param {Object} option - 谱线配置
 * @param {number} option.id - 谱线唯一标识
 * @param {string} option.name - 谱线名称
 * @param {string} option.color - 谱线颜色
 * @param {Array} option.datainfo - 谱线数据数组
 */
addTrace(option) {
  // 校验参数合法性
  if (!option.id || !option.datainfo) {
    console.warn('谱线参数不完整');
    return;
  }
  // ... 后续逻辑
}
```

---

## 8. 关键 API 速查

### 初始化
```javascript
const chart = new sptmChart('mycanvas', {
  type: 'DScan',               // 图表类型: 'FFT' | 'DScan'
  center_freq: 200000000,      // 中心频率 (Hz)
  span: 2000000,               // 显宽 (Hz)
  yaxis: { min_value: -20, max_value: 100, unit: 'dBμV' },
  xaxis: { unit: 'MHz', decimals: 4 },
  marker: {
    visible: true,
    autoAdd: true,
    snap: { enabled: false, range: 2, mode: 'peak', pixelPerPointThreshold: 20 }
  }
});
```

### 谱线管理
```javascript
chart.addTrace({ id: 1, type: 'FFT', name: 'Trace1', color: 'blue', datainfo: [...] });
chart.setTraceData(1, datainfo);
chart.setTraceVisibility(1, false);
chart.removeTrace(1);
```

### Marker 管理
```javascript
chart.addMarker(true, true);               // 添加 Marker（自动显示，设为焦点）
chart.moveMarkerByFreq(id, freq);           // 移动 Marker 到指定频率
chart.deleteMarker(0);                      // 删除最后一个 Marker
chart.clearAllMarkers();                    // 清除所有 Marker
```

### 动态更新
```javascript
chart.setOptions({ center_freq: 500000000, span: 10000000 });
chart.setChartType('waterfall');            // 'line' | 'waterfall'
```

---

## 9. 注意事项

1. **Canvas DPI 适配**: 项目根据 `window.devicePixelRatio` 自动适配高分辨率屏幕，所有绘制尺寸均乘以 DPR
2. **性能优化**:
   - 大数据量时自动启用极值抽点（保留最大最小值）
   - 瀑布图使用 `ImageData` 直接操作像素缓冲区
   - 绘制使用 `requestAnimationFrame` 调度，避免一帧内多次重绘
3. **内存管理**: 瀑布图通过 `max_rows` 限制帧缓冲大小，超出自动移除旧数据
4. **构建配置**: `rollup.config.js` 中 Terser 配置 `comments: false`，生产构建会删除所有注释（包括中文注释）
5. **依赖说明**: `package.json` 中声明了 `ol` 和 `undici`，但源码中未实际使用，可考虑移除

---

## 10. 近期规范更新（本次会话）

### 10.1 externalDataCrop 模式下数据裁剪与缩放控制

**背景**：在 `externalDataCrop` 模式下，外部传入的数据需要根据当前显示范围自动裁剪，避免全量数据绘制导致性能问题。

**实现要点**：
- `setTraceData` 中检测 `externalDataCrop` 模式，根据数据真实频率范围同步 `show_start_freq` / `show_end_freq`
- `draw_zoom` 仅同步 `draw_zoom_freq` 和 `draw_zoom_span`，**不可覆盖** `draw_zoom`（用户缩放等级）
- 测试页面（`examples/index.html`）中根据当前显示范围在全量数据中查找索引并裁剪

### 10.2 X轴缩放阈值配置（`zoom_threshold`）

**配置项**：`options.xaxis.zoom_threshold`（默认值 **20**，单位 px）

**作用**：放大时检查点间像素距离 `labelInfo.drawStepPx`，当 `drawStepPx > zoom_threshold` 时阻止继续放大，避免点太少出现"一条线"。

**注意**：
- 字段使用下划线命名风格：`zoom_threshold`（注意：不是 `x_zoom_threshold`）
- 直接使用 `labelInfo.drawStepPx`（绘制时已计算），**不要**手动用 `_getDrawPointCount()` 重新计算
- 逻辑为**大于阈值时阻止**，不是小于


