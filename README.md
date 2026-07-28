## 安装依赖
```javaScript
  npm i
```

## 本地打包
```javaScript
  npm run build
```

## 打包后执行
```javaScript
  npm link
```
## 使用
```javaScript
  //链接库
  npm link sptmChart
  //引入库
  import sptmChart from 'sptmChart'
  // 实例化
  let sptmCharts = new sptmChart('id',options)
```

## 快速入门

### 初始化图表
```javaScript
const chart = new sptmChart('mycanvas', {
  type: 'DScan',
  center_freq: 200000000,  // 中心频率 200MHz
  span: 2000000,           // 显宽 2MHz
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

### 添加谱线
```javaScript
chart.addTrace({
  id: 1,
  type: 'FFT',
  name: '频谱线1',
  color: 'blue',
  width: 1,
  datainfo: [{
    point: 1600,
    step: 200000000,
    start_freq: 200000000,
    end_freq: 1000000000,
    width: 1,
    data: [/* 1600个强度值 */]
  }]
});
```

### 使用真实频率数据（freq_data）
真实频率模式下，每个数据点可指定独立的频率值，提升绘制精度：
```javaScript
const pointCount = 1600;
const startFreq = 200000000;
const endFreq = 1000000000;
const freqStep = (endFreq - startFreq) / (pointCount - 1);

// 生成真实频率数据（可带偏移）
const freqData = [];
for (let i = 0; i < pointCount; i++) {
  const baseFreq = startFreq + i * freqStep;
  // 加入正弦偏移 + 随机噪声
  const offset = Math.sin(i / pointCount * Math.PI * 12) * 250000 + (Math.random() - 0.5) * 150000;
  freqData.push(Math.round(baseFreq + offset));
}

chart.addTrace({
  id: 2,
  type: 'FFT',
  name: '真实频率谱线',
  color: '#00bcd4',
  datainfo: [{
    point: pointCount,
    start_freq: startFreq,
    end_freq: endFreq,
    data: [/* 强度数据 */],
    freq_data: freqData  // 真实频率数组（单位Hz）
  }]
});
```

### 更新谱线数据
```javaScript
chart.setTraceData(1, [{
  point: 1600,
  start_freq: 200000000,
  end_freq: 1000000000,
  data: [/* 新的强度数据 */]
}]);
```

### Marker 操作
```javaScript
// 添加 Marker（跟随Y轴，设为焦点）
const markerId = chart.addMarker(true, true);

// 移动 Marker 到指定频率（Hz）
chart.moveMarkerByFreq(markerId, 500000000);  // 移动到 500MHz

// 获取焦点 Marker ID
const focusId = chart.getMarkerFocusId();

// 删除 Marker（id=0 表示删除最后一个）
chart.deleteMarker(0);

// 清除所有 Marker
chart.clearAllMarkers();
```

### 谱线管理
```javaScript
// 获取所有谱线
const traces = chart.getTraces();

// 设置谱线可见性
chart.setTraceVisibility(1, false);  // 隐藏 id=1 的谱线
chart.setTraceVisibility(1, true);   // 显示 id=1 的谱线

// 删除谱线
chart.removeTrace(1);
```

### 图表模式切换
```javaScript
// 切换为瀑布图模式
chart.setChartType('waterfall');

// 切换回线图模式
chart.setChartType('line');
```

### 动态更新配置
```javaScript
// 更新中心频率和显宽
chart.setOptions({
  center_freq: 500000000,
  span: 10000000
});

// 获取当前配置
const options = chart.getOptions();
```

## 常用 API 一览

| 方法 | 参数 | 说明 |
|------|------|------|
| `addTrace(option)` | `option: Object` | 添加谱线 |
| `setTraceData(id, data)` | `id: number, data: Array` | 更新指定谱线数据 |
| `getTraces()` | - | 获取所有谱线列表 |
| `removeTrace(id)` | `id: number` | 删除指定谱线 |
| `setTraceVisibility(id, visible)` | `id: number, visible: boolean` | 设置谱线可见性 |
| `addMarker(followY, focus)` | `followY: boolean, focus: boolean` | 添加 Marker，返回 Marker ID |
| `moveMarkerByFreq(id, freqHz)` | `id: number, freqHz: number` | 移动 Marker 到指定频率 |
| `deleteMarker(id)` | `id: number` | 删除 Marker（id=0 删除最后一个） |
| `clearAllMarkers()` | - | 清除所有 Marker |
| `getMarkerFocusId()` | - | 获取当前焦点 Marker ID |
| `setOptions(options)` | `options: Object` | 更新图表配置 |
| `getOptions()` | - | 获取当前图表配置 |
| `setChartType(type)` | `type: 'line' \| 'waterfall'` | 切换图表模式 |
| `stopChart()` | - | 停止图表更新 |

## 真实频率数据格式

当谱线数据包含 `freq_data` 字段时，图表将基于真实频率绘制：
- `freq_data` 为纯频率数组，单位 **Hz**
- 数组长度需与 `data` 长度一致
- 每个点可独立指定频率值，支持非均匀分布

```javaScript
datainfo: [{
  point: 1600,
  start_freq: 200000000,
  end_freq: 1000000000,
  data: [/* 1600个强度值 */],
  freq_data: [200000000, 200000100, 200000300, ...]  // 真实频率（Hz）
}]
```
