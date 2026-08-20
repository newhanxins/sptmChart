# sptmChart API 文档

## 目录

- [配置项说明](#配置项说明)
- [实例化与配置](#实例化与配置)
- [谱线管理](#谱线管理)
- [Marker 操作](#marker-操作)
- [图表模式](#图表模式)
- [瀑布图](#瀑布图)
- [频率相关](#频率相关)
- [鼠标位置信息](#鼠标位置信息)
- [选框功能](#选框功能)
- [图表绘制控制](#图表绘制控制)
- [画布尺寸](#画布尺寸)
- [生命周期](#生命周期)
- [回调事件](#回调事件)
- [配置项速查表](#配置项速查表)

---

## 配置项说明

### sptmChartOptions

实例化控件时的配置对象：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'FFT' \| 'DScan'` | `'FFT'` | 图表类型。`FFT`=单频模式，`DScan`=频段模式（多段非连续频率） |
| `duration` | `number` | `50` | 一帧持续时间(ms) |
| `width` | `string \| number` | `400` | 画布宽度，传`"100%"`表示自适应 |
| `height` | `string \| number` | `300` | 画布高度，传`"100%"`表示自适应 |
| `background` | `string` | `'#CCCCCC'` | 画布背景色 |
| `center_freq` | `number \| string` | `''` | 中心频率(Hz) |
| `span` | `number \| string` | `''` | 显宽(Hz) |
| `is_drag_zoom` | `boolean` | `true` | 是否启用拖拽缩放 |
| `grid` | `GridConfig` | - | 网格样式配置 |
| `legend` | `LegendConfig` | - | 图例配置 |
| `xaxis` | `XAxisConfig` | - | X轴样式配置 |
| `yaxis` | `YAxisConfig` | - | Y轴样式配置 |
| `marker` | `MarkerConfig` | - | Marker样式配置 |
| `contextMenu` | `ContextMenuConfig` | - | 右键菜单配置 |
| `centerinfo` | `CenterInfoConfig` | - | 中心频率信息框配置 |
| `fps` | `FpsConfig` | - | FPS统计信息框配置 |
| `threshold` | `ThresholdConfig` | - | 门限样式配置 |
| `sptm_area` | `SptmAreaConfig` | - | 频谱区域配置 |
| `level_tipline` | `LevelTipLineConfig` | - | 提示线配置 |
| `chart_type` | `'line' \| 'waterfall'` | `'line'` | 图表绘制类型 |
| `waterfall` | `WaterfallConfig` | - | 瀑布图配置 |
| `selectionBox` | `SelectionBoxConfig` | - | 选框功能配置 |

---

## 实例化与配置

### 构造函数

```typescript
new sptmChart(id: string, options?: sptmChartOptions)
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | DOM元素ID |
| `options` | `sptmChartOptions` | 否 | 初始化配置 |

**示例：**

```javascript
const chart = new sptmChart('mycanvas', {
  type: 'DScan',
  center_freq: 200000000,
  span: 2000000,
  width: '100%',
  height: 300,
  yaxis: {
    min_value: -20,
    max_value: 20,
    unit: 'dBμV'
  },
  xaxis: {
    unit: 'MHz',
    decimals: 4
  }
});
```

### setOptions(options)

更新图表配置。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `options` | `Partial<sptmChartOptions>` | 是 | 部分配置，会深度合并到现有配置 |

```javascript
chart.setOptions({
  center_freq: 500000000,
  span: 10000000
});
```

### getOptions()

获取当前图表配置。

| 返回 | 说明 |
|------|------|
| `sptmChartOptions` | 当前完整配置对象（深拷贝） |

```javascript
const options = chart.getOptions();
```

---

## 谱线管理

### addTrace(option)

添加一条谱线。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `option` | `Partial<TraceConfig>` | 是 | 谱线配置 |

**TraceConfig 参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `number` | 是 | - | 谱线唯一ID |
| `type` | `string` | 否 | `'FFT'` | 谱线类型 |
| `visible` | `boolean` | 否 | `true` | 是否可见 |
| `name` | `string` | 否 | `''` | 谱线名称 |
| `color` | `string` | 否 | `'#000'` | 谱线颜色 |
| `width` | `number` | 否 | `1` | 谱线宽度 |
| `datainfo` | `DataInfo[]` | 否 | `[]` | 数据段数组 |

**DataInfo 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `point` | `number` | 是 | 数据点数量 |
| `start_freq` | `number` | 是 | 原始完整范围起始频率(Hz)。**注意**：始终表示数据的原始完整范围，非裁剪后的显示范围 |
| `end_freq` | `number` | 是 | 原始完整范围结束频率(Hz)。**注意**：始终表示数据的原始完整范围，非裁剪后的显示范围 |
| `show_start_freq` | `number` | 否 | 当前显示范围起始频率(Hz)。仅在 `sync_axis_range` 关闭时生效，用于指定裁剪后的显示范围 |
| `show_end_freq` | `number` | 否 | 当前显示范围结束频率(Hz)。仅在 `sync_axis_range` 关闭时生效，用于指定裁剪后的显示范围 |
| `data` | `number[]` | 是 | 强度数据数组 |
| `freq_data` | `number[]` | 否 | 真实频率数组(Hz)，可选 |

```javascript
chart.addTrace({
  id: 1,
  type: 'FFT',
  name: '频谱线1',
  color: 'blue',
  width: 1,
  datainfo: [{
    point: 1600,
    start_freq: 200000000,
    end_freq: 1000000000,
    data: [/* 1600个强度值 */]
  }]
});
```

### setTraceData(id, data)

更新指定谱线的数据。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 谱线ID |
| `data` | `DataInfo[]` | 是 | 新的数据段数组 |

**字段语义说明：**

- `start_freq`/`end_freq`：**始终表示数据的原始完整范围**，用于控件内部坐标映射的基准。即使数据已被裁剪，这两个字段也应保持原始范围不变
- `show_start_freq`/`show_end_freq`：**表示当前显示范围**（裁剪后的范围），仅在 `sync_axis_range` 关闭时生效。`sync_axis_range` 开启时，会根据数据实际频率范围自动覆盖

```javascript
chart.setTraceData(1, [{
  point: 1600,
  start_freq: 200000000,      // 原始完整范围起始频率
  end_freq: 1000000000,       // 原始完整范围结束频率
  show_start_freq: 300000000, // 当前显示范围起始频率（可选）
  show_end_freq: 800000000,   // 当前显示范围结束频率（可选）
  data: [/* 强度数据 */]
}]);
```

### getTraces()

获取所有谱线列表。

| 返回 | 说明 |
|------|------|
| `TraceConfig[]` | 谱线数据副本数组 |

```javascript
const traces = chart.getTraces();
```

### removeTrace(id)

删除指定谱线。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 谱线ID |

| 返回 | 说明 |
|------|------|
| `boolean` | 是否删除成功 |

```javascript
chart.removeTrace(1);
```

### setTraceVisibility(id, visible)

设置谱线可见性。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 谱线ID |
| `visible` | `boolean` | 是 | 是否可见 |

```javascript
chart.setTraceVisibility(1, false);  // 隐藏
chart.setTraceVisibility(1, true); // 显示
```

---

## Marker 操作

### addMarker(isShow, isFocus, traceId)

添加一个 Marker。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `isShow` | `boolean` | 否 | `true` | 是否显示 |
| `isFocus` | `boolean` | 否 | `true` | 是否设为焦点 |
| `traceId` | `number` | 否 | `0` | 跟随的谱线ID |

| 返回 | 说明 |
|------|------|
| `number` | 新Marker的ID，失败返回0 |

```javascript
const markerId = chart.addMarker(true, true, 1);
```

### moveMarkerByFreq(id, freqHz)

移动Marker到指定频率。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | Marker ID |
| `freqHz` | `number` | 是 | 目标频率(Hz) |

```javascript
chart.moveMarkerByFreq(markerId, 500000000);
```

### deleteMarker(id)

删除Marker。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | Marker ID，`0`表示删除最后一个 |

```javascript
chart.deleteMarker(0);  // 删除最后一个
```

### clearAllMarkers()

清除所有Marker。

```javascript
chart.clearAllMarkers();
```

### getMarkerFocusId()

获取当前焦点Marker ID。

| 返回 | 说明 |
|------|------|
| `number` | 焦点Marker ID，无焦点返回0 |

```javascript
const focusId = chart.getMarkerFocusId();
```

### setMarkerFocus(id)

设置Marker焦点。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | Marker ID |

```javascript
chart.setMarkerFocus(markerId);
```

---

## 图表模式

### setChartType(type, extraOptions)

切换图表模式（线图/瀑布图）。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `type` | `'line' \| 'waterfall'` | 是 | - | 目标模式 |
| `extraOptions` | `Partial<sptmChartOptions>` | 否 | `{}` | 额外配置，会合并到当前配置 |

```javascript
// 切换为瀑布图
chart.setChartType('waterfall');

// 切换回线图并更新配置
chart.setChartType('line', {
  center_freq: 300000000
});
```

### getChartType()

获取当前图表模式。

| 返回 | 说明 |
|------|------|
| `'line' \| 'waterfall'` | 当前图表模式 |

```javascript
const type = chart.getChartType();
```

---

## 瀑布图

### clearWaterfallData()

清空瀑布图帧缓冲数据。

```javascript
chart.clearWaterfallData();
```

### getWaterfallColorRange()

获取瀑布图色系范围。

| 返回 | 说明 |
|------|------|
| `{ min: number, max: number }` | 当前色系范围 |

```javascript
const { min, max } = chart.getWaterfallColorRange();
```

### setWaterfallColorRange(min, max)

设置瀑布图色系范围。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `min` | `number` | 是 | 最小强度值 |
| `max` | `number` | 是 | 最大强度值 |

```javascript
chart.setWaterfallColorRange(-30, 60);
```

### setWaterfallRowHeightMode(mode)

设置瀑布图行高模式。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mode` | `'fill' \| 'time'` | 是 | `fill`动态铺满 / `time`固定时间 |

```javascript
chart.setWaterfallRowHeightMode('fill');
```

### setWaterfallRowScale(scale)

设置瀑布图行缩放比。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scale` | `number` | 是 | 缩放比(0.1-5.0) |

```javascript
chart.setWaterfallRowScale(2.0);
```

---

## 频率相关

### setFFTCenterFreAndSpan(centerFre, span)

设置FFT中心频率和显宽。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `centerFre` | `number` | 是 | 中心频率(Hz) |
| `span` | `number` | 是 | 显宽(Hz) |

```javascript
chart.setFFTCenterFreAndSpan(100000000, 50000000);
```

### getFFTCenterFreAndSpan()

获取FFT中心频率和显宽。

| 返回 | 说明 |
|------|------|
| `{ center_freq: number, span: number }` | 中心频率和显宽 |

```javascript
const { center_freq, span } = chart.getFFTCenterFreAndSpan();
```

---

## 鼠标位置信息

### getMouseVal(event, digit)

获取鼠标位置对应的值。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `event` | `MouseEvent \| TouchEvent` | 是 | - | 鼠标/触摸事件 |
| `digit` | `number` | 否 | `0` | 小数位数 |

| 返回 | 说明 |
|------|------|
| `{ x: number\|null, y: number\|null, order: number\|null }` | 频率值、强度值、段索引 |

```javascript
const mouseVal = chart.getMouseVal(event, 2);
console.log(mouseVal.x, mouseVal.y, mouseVal.order);
```

### getMousePositionInfo(event)

获取鼠标当前位置的详细信息。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `event` | `MouseEvent \| TouchEvent` | 是 | 鼠标/触摸事件 |

| 返回 | 说明 |
|------|------|
| `MousePositionInfo` | 包含频率、强度、原始值等信息 |

**MousePositionInfo 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `x` | `number` | 频率值(Hz) |
| `y` | `number` | 强度值 |
| `freq` | `string` | 格式化频率（如`'200.000000 MHz'`） |
| `level` | `string` | 格式化强度（如`'-20.00 dBμV'`） |
| `rawFreq` | `number` | 原始频率(Hz) |
| `rawLevel` | `number \| null` | 原始强度 |

```javascript
const info = chart.getMousePositionInfo(event);
console.log(info.freq, info.level);
```

### getMousePoint(event)

获取鼠标当前像素坐标。

| 返回 | 说明 |
|------|------|
| `{ pointx: number, pointy: number }` | 像素坐标 |

```javascript
const { pointx, pointy } = chart.getMousePoint(event);
```

### getMousePositionLevel(data)

获取指定像素位置的强度信息。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `{ pointx: number, pointy: number }` | 是 | 像素坐标 |

| 返回 | 说明 |
|------|------|
| `{ x, y, xorder, order, pointx, pointy }` | 频率、强度数组、段索引等 |

```javascript
const level = chart.getMousePositionLevel({ pointx: 100, pointy: 200 });
```

---

## 选框功能

### setSelectionBoxCallback(callback)

设置选框结束回调。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `callback` | `(info: SelectionBoxInfo, event?: MouseEvent) => void` | 是 | 选框结束回调 |

**SelectionBoxInfo 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `startFreq` | `number` | 选框起始频率(Hz) |
| `endFreq` | `number` | 选框结束频率(Hz) |
| `centerFreq` | `number` | 中心频率(Hz) |
| `bandwidth` | `number` | 带宽(Hz) |
| `span` | `number` | 同bandwidth |
| `startX` | `number` | 选框起始X坐标(像素) |
| `endX` | `number` | 选框结束X坐标(像素) |
| `startY` | `number` | 选框起始Y坐标(像素) |
| `endY` | `number` | 选框结束Y坐标(像素) |
| `centerY` | `number` | 选框中心Y坐标(像素) |

```javascript
chart.setSelectionBoxCallback((info, event) => {
  console.log('选框范围:', info.startFreq, '~', info.endFreq);
});
```

---

## 图表绘制控制

### stopChart()

停止绘制循环，清除定时器。

```javascript
chart.stopChart();
```

### clearData()

清空所有谱线数据并重绘。瀑布图模式下同时清空帧缓冲区。

```javascript
chart.clearData();
```

---

## 画布尺寸

### setCanvasSize(width, height)

设置图表画布尺寸。支持传入 `"100%"` 自适应容器大小。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `width` | `string \| number` | 否 | 宽度，`"100%"` 或像素值，不传则用当前配置 |
| `height` | `string \| number` | 否 | 高度，`"100%"` 或像素值，不传则用当前配置 |

```javascript
chart.setCanvasSize('100%', 400);
chart.setCanvasSize(800, 600);
```

### resizeCanvas()

根据父容器当前尺寸自动调整画布大小。已内置窗口 resize 和 ResizeObserver 监听，通常无需手动调用。

```javascript
chart.resizeCanvas();
```

---

## 生命周期

### destroy()

销毁图表实例，移除所有事件监听器，清理定时器。调用后实例不可再使用。

```javascript
chart.destroy();
```

---

## 回调事件

### X轴范围变化回调 (xaxis.onXRangeChange)

当用户滚轮缩放或拖动平移X轴时触发。

```javascript
const chart = new sptmChart('mycanvas', {
  xaxis: {
    onXRangeChange: (info) => {
      console.log('X轴变化:', info);
    }
  }
});
```

**XRangeChangeInfo：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `'zoom' \| 'pan'` | 操作类型：缩放/平移 |
| `source` | `'wheel' \| 'drag' \| 'touch'` | 触发来源 |
| `order` | `number` | 多段索引 |
| `startFreq` | `number` | 当前显示起始频率(Hz) |
| `endFreq` | `number` | 当前显示结束频率(Hz) |
| `centerFreq` | `number` | 中心频率(Hz) |
| `span` | `number` | 当前显示带宽(Hz) |
| `drawZoom` | `number` | 当前缩放倍数 |
| `startX` | `number` | 段起始像素坐标 |
| `endX` | `number` | 段结束像素坐标 |
| `bandStartFreq` | `number` | 原始频段起始频率(Hz) |
| `bandEndFreq` | `number` | 原始频段结束频率(Hz) |

### Y轴范围变化回调 (yaxis.onYRangeChange)

当用户滚轮缩放或拖动平移Y轴时触发。

```javascript
const chart = new sptmChart('mycanvas', {
  yaxis: {
    onYRangeChange: (info) => {
      console.log('Y轴变化:', info);
    }
  }
});
```

**YRangeChangeInfo：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `'zoom' \| 'pan'` | 操作类型 |
| `source` | `'wheel' \| 'drag' \| 'touch'` | 触发来源 |
| `minValue` | `number` | 当前Y轴最小值 |
| `maxValue` | `number` | 当前Y轴最大值 |
| `centerValue` | `number` | 中心值 |
| `span` | `number` | 范围跨度 |
| `zoomLevel` | `number` | 当前缩放级别 |

---

## 配置项速查表

### GridConfig（网格样式）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `left` | `number` | `50` | 左边距 |
| `top` | `number` | `40` | 上边距 |
| `bottom` | `number` | `50` | 下边距 |
| `right` | `number` | `40` | 右边距 |
| `color` | `string` | `'#B7B7B7'` | 网格线颜色 |
| `background` | `string` | `'transparent'` | 网格背景色 |
| `width` | `number` | `1` | 网格线宽度 |
| `xgrid_show` | `boolean` | `true` | 是否显示X轴网格线 |
| `xgrid_line_dash` | `number[]` | `[]` | X轴网格线虚线样式，如 `[5, 5]` |
| `ygrid_show` | `boolean` | `true` | 是否显示Y轴网格线 |
| `ygrid_line_dash` | `number[]` | `[]` | Y轴网格线虚线样式 |
| `center_line_show` | `boolean` | `false` | 是否显示中心线 |
| `center_color` | `string` | `'#FF0000'` | 中心线颜色 |
| `center_width` | `number` | `1` | 中心线宽度 |

### XAxisConfig（X轴配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `number` | `number` | `5` | 刻度标签数量 |
| `unit` | `string` | `''` | 单位 |
| `unit_two_line` | `boolean` | `true` | X轴单位是否换行显示 |
| `unit_right` | `number` | `10` | 单位距离图表左侧距离 |
| `decimals` | `string\|number` | `''` | 小数位数 |
| `dscan_freq` | `Array<[number, number]>` | `[]` | DScan模式频率范围数组，如 `[[200e6, 400e6], [600e6, 800e6]]` |
| `dscan_space` | `number` | `10` | DScan模式下频段间隔像素 |
| `dscan_merge_data` | `boolean` | `false` | DScan模式下单条完整数据自动按 `dscan_freq` 分段 |
| `dscan_divider` | `Object` | - | DScan频段分界线样式（见下文） |
| `text_color` | `string` | `'#343434'` | 文本颜色 |
| `text_font_size` | `number` | `12` | 字体大小 |
| `text_font_family` | `string` | `'Arial'` | 字体 |
| `color` | `string` | `'#333'` | 轴线颜色 |
| `width` | `number` | `1` | 轴线宽度 |
| `labels` | `Array` | `[]` | 刻度标签 |
| `label_two_line` | `boolean` | `true` | DScan模式下分段数据第一个是否换行 |
| `label_angle` | `number` | `0` | 刻度标签旋转角度 |
| `zoom_threshold` | `number` | `20` | X轴缩放点间像素距离阈值（px），大于该值时阻止继续放大 |
| `sync_axis_range` | `boolean` | `false` | X轴范围同步模式。开启后，X轴显示范围会根据 `setTraceData` 传入数据的实际频率范围自动同步更新。权重高于 `show_start_freq`/`show_end_freq` |
| `externalDataCrop` | `boolean` | `false` | 外部数据裁剪模式。开启后控件跳过内部数据裁剪，由外部传入裁剪后的数据 |
| `onXRangeChange` | `Function` | `null` | 范围变化回调 |

#### dscan_divider 子配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `true` | 是否显示分界线 |
| `line_dash` | `number[]` | `[]` | 虚线样式，`[]` 表示实线 |
| `color` | `string` | `'green'` | 分界线颜色 |
| `width` | `number` | `2` | 分界线宽度 |
| `label_two_line` | `boolean` | `false` | 分界线频率标签是否两行显示 |
| `label_position` | `string` | `'top'` | 标签位置 `'top'` / `'bottom'` |

### YAxisConfig（Y轴配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `number` | `number` | `5` | 刻度标签数量 |
| `unit` | `string` | `''` | 单位 |
| `decimals` | `string\|number` | `''` | 刻度值小数位数 |
| `fixedStep` | `number` | `20` | 刻度值间隔 |
| `init_min_value` | `number` | `-30` | 初始最小值（用于重置） |
| `init_max_value` | `number` | `60` | 初始最大值（用于重置） |
| `min_value` | `number` | `-30` | 当前最小值 |
| `max_value` | `number` | `60` | 当前最大值 |
| `floor_value` | `number` | `-60` | 最小值下限 |
| `ceiling_value` | `number` | `140` | 最大值上限 |
| `text_color` | `string` | `'#343434'` | 文本颜色 |
| `text_font_size` | `number` | `12` | 字体大小 |
| `text_font_family` | `string` | `'Arial'` | 字体 |
| `color` | `string` | `'#333'` | 轴线颜色 |
| `width` | `number` | `1` | 轴线宽度 |
| `axis_function` | `(value: number) => number` | `v=>v` | Y轴刻度值计算函数 |
| `labels` | `Array` | `[]` | 自定义刻度标签 |
| `onYRangeChange` | `Function` | `null` | 范围变化回调 |

### MarkerConfig（Marker配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `true` | 是否显示Marker |
| `autoAdd` | `boolean` | `true` | 是否自动添加 |
| `defaultCount` | `number` | `1` | 默认数量 |
| `maxCount` | `number` | `10` | 最大数量 |
| `shape` | `number` | `0` | 形状（0常规/1倒置） |
| `verticalLine` | `boolean` | `true` | 是否显示垂直线 |
| `crossLine` | `boolean` | `false` | 是否显示十字线 |
| `scutchonVisible` | `boolean` | `true` | 是否显示标牌 |
| `followTraceY` | `boolean` | `false` | 是否跟随谱线Y轴位置 |
| `traceYOffset` | `number` | `-10` | Y轴偏移量 |
| `clickBlankToExit` | `boolean` | `true` | 点击空白退出焦点 |
| `colorGroup` | `Object` | - | 颜色配置（见下文） |
| `snap` | `Object` | - | 自动吸附配置（见下文） |

#### colorGroup 子配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `activeForeground` | `string` | `'#239ee7'` | Marker激活时前景色 |
| `inactiveForeground` | `string` | `'#535353'` | Marker非激活时前景色 |
| `noFocusBackground` | `string` | `'#bfbfbf'` | 未获得焦点时背景色 |
| `focusBackground` | `string` | `'#ff9800'` | 获得焦点时背景色 |
| `crossBorderText` | `string` | `'#ff0000'` | 越界文本颜色 |
| `lineColor` | `string` | `'#9e9e9e'` | 准线颜色 |
| `scutchonBackground` | `string` | `'rgba(49,52,69,0.9)'` | 标牌背景色 |
| `scutchonForeground` | `string` | `'#ffffff'` | 标牌文字颜色 |

#### snap 子配置（Marker自动吸附）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否开启自动吸附 |
| `range` | `number` | `2` | 吸附范围（左右各几个数据点），0 表示仅吸附到最近点 |
| `mode` | `'peak' \| 'valley'` | `'peak'` | 吸附模式：`peak` 找强度最大 / `valley` 找强度最小 |
| `pixelPerPointThreshold` | `number` | `20` | 每数据点像素阈值（px），超过此值不吸附（放大到足够精细时跳过） |

### ThresholdConfig（门限配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示门限 |
| `is_darg` | `boolean` | `true` | 是否可拖拽 |
| `level` | `number` | `30` | 门限强度值 |
| `decimals` | `number` | `2` | 小数位数 |
| `color` | `string` | `'#19A9EB'` | 门限线颜色 |
| `width` | `number` | `1` | 门限线宽度 |
| `drag_color` | `string` | `'#3FFDB1'` | 拖拽时颜色 |
| `drag_width` | `number` | `2` | 拖拽时线宽 |
| `text_color` | `string` | `'#333'` | 文本颜色 |
| `text_font_size` | `number` | `12` | 文本字体大小 |
| `drag_text_color` | `string` | `'#333'` | 拖拽时文本颜色 |
| `drag_text_font_size` | `number` | `14` | 拖拽时文本字体大小 |
| `icon_url` | `string` | `''` | 门限图标URL |
| `drag_icon_url` | `string` | `''` | 拖拽时门限图标URL |
| `icon_size` | `[number, number]` | `[30, 20]` | 图标大小 |

### SelectionBoxConfig（选框配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 |
| `fillStyle` | `string` | `'rgba(0,212,255,0.15)'` | 填充色 |
| `strokeStyle` | `string` | `'#00d4ff'` | 边框色 |
| `lineWidth` | `number` | `1` | 边框宽度 |
| `minWidth` | `number` | `5` | 触发最小宽度(像素) |
| `longPressDelay` | `number` | `200` | 长按延迟(ms) |
| `onSelect` | `Function` | `null` | 选框结束回调 |

### WaterfallConfig（瀑布图配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_rows` | `number` | `100` | 最大存储数据条数 |
| `time_interval` | `number` | `5` | 时间刻度间隔(秒) |
| `time_interval_min` | `number` | `1` | 时间刻度最小间隔(秒) |
| `time_interval_max` | `number` | `5` | 时间刻度最大间隔(秒) |
| `color_min` | `number` | `-30` | 色系强度最小值 |
| `color_max` | `number` | `60` | 色系强度最大值 |
| `color_min_limit` | `number` | `-120` | 色系最小值下限 |
| `color_max_limit` | `number` | `120` | 色系最大值上限 |
| `colormap` | `string` | `'jet'` | 色系类型 |
| `draggable` | `boolean` | `false` | 色系条是否可拖拽 |
| `color_wheel_enabled` | `boolean` | `true` | 色系条滚轮是否启用 |
| `time_wheel_enabled` | `boolean` | `true` | 时间轴滚轮是否启用 |
| `use_image_data` | `boolean` | `true` | 是否使用ImageData绘制 |
| `row_height_mode` | `string` | `'fill'` | 行高模式(fill/time) |
| `px_per_second` | `number` | `200` | time模式下每秒像素高度 |
| `row_height_min` | `number` | `0.1` | 行高最小值(px) |
| `row_height_max` | `number` | `10` | 行高最大值(px) |
| `process_first_only` | `boolean` | `true` | 是否只处理第一条数据 |
| `time_axis_visible` | `boolean` | `true` | 是否显示Y轴时间标线和标签 |
| `time_format` | `string` | `'mm:ss'` | 时间格式 `'mm:ss'` / `'HH:mm:ss'` / `'ss'` |
| `time_label_interval` | `number` | `1` | Y轴时间标签显示间隔(秒) |

### ContextMenuConfig（右键菜单配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用右键菜单 |
| `actions` | `Array` | `[]` | 菜单动作列表，每项含 `type`/`label`/`handler` |
| `onCustomAction` | `Function` | `null` | 自定义动作回调 `(action, event, context) => void` |
| `onGetPosition` | `Function` | `null` | 自定义菜单位置回调 `(positionInfo, event, context) => void` |

### CenterInfoConfig（中心频率信息框）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示信息框 |
| `position` | `string` | `'top-center'` | 位置 `'top-left'`/`'top-center'`/`'top-right'`/`'bottom-*'` |
| `offsetX` | `number` | `0` | X方向偏移量 |
| `offsetY` | `number` | `0` | Y方向偏移量 |
| `background` | `string` | `'rgba(0,0,0,0.7)'` | 背景颜色 |
| `text_color` | `string` | `'#fff'` | 文本颜色 |
| `font_size` | `number` | `12` | 字体大小 |
| `padding` | `number` | `8` | 内边距 |
| `border_radius` | `number` | `4` | 圆角半径 |
| `show_center_freq` | `boolean` | `true` | 是否显示中心频率 |
| `show_current_freq` | `boolean` | `true` | 是否显示当前频率（Marker频率） |
| `show_level` | `boolean` | `true` | 是否显示当前强度 |

### FpsConfig（FPS统计信息框）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示FPS |
| `position` | `string` | `'top-right'` | 位置 |
| `offsetX` | `number` | `0` | X方向偏移量 |
| `offsetY` | `number` | `0` | Y方向偏移量 |
| `background` | `string` | `'rgba(0,0,0,0.7)'` | 背景颜色 |
| `text_color` | `string` | `'#0f0'` | 文本颜色 |
| `font_size` | `number` | `12` | 字体大小 |
| `padding` | `number` | `6` | 内边距 |
| `border_radius` | `number` | `4` | 圆角半径 |

### SptmAreaConfig（频谱区域配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示频谱区域 |
| `background` | `string` | `'rgba(0,100,255,0.1)'` | 频谱区域背景色 |
| `drag_background` | `string` | `'rgba(0,100,255,0.2)'` | 拖拽时频谱区域背景色 |
| `start_freq` | `number` | - | 频谱区域起始频率(Hz) |
| `end_freq` | `number` | - | 频谱区域结束频率(Hz) |

### LevelTipLineConfig（提示线配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示提示线 |
| `freq_visible` | `boolean` | `true` | 是否显示频率 |
| `color` | `string` | `'#999'` | 提示线颜色 |
| `width` | `number` | `1` | 提示线宽度 |
| `text_color` | `string` | `'#333'` | 提示文本颜色 |
| `text_size` | `number` | `12` | 提示文本大小 |
| `tip_background` | `string` | `'rgba(255,255,255,0.9)'` | 提示框背景色 |
| `tip_text_color` | `string` | `'#333'` | 提示框文本颜色 |
| `tip_font_size` | `number` | `12` | 提示框字体大小 |
| `tip_padding` | `number` | `6` | 提示框内边距 |
| `tip_border_radius` | `number` | `4` | 提示框圆角半径 |

### LegendConfig（图例配置）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示图例 |
| `color` | `string` | `'#343434'` | 图例文本颜色 |
