# sptmChart

频谱控件，支持 FFT 频谱图、DScan 分段频谱图及瀑布图模式。

## 安装

```bash
npm i
npm run build
```

## 使用方式

### 方式一：npm link

```bash
# 在插件库目录
npm link

# 在项目目录
npm link sptmChart
```

```javascript
import sptmChart from 'sptmChart';
const chart = new sptmChart('id', options);
```

### 方式二：直接引用构建产物

适用于插件库与项目不在同一目录的场景：

```javascript
// vite.config.js
import { resolve } from 'path';

export default {
  resolve: {
    alias: {
      'sptmChart': resolve('F:/lingma/sptmCharts/dist/sptmChart.esm.js'),
    },
  },
  optimizeDeps: {
    exclude: ['sptmChart'],
  },
};
```

### TypeScript 支持

项目中引用根目录的 `sptmChart.d.ts` 类型声明文件：

```typescript
import sptmChart, { sptmChartOptions, XRangeChangeInfo } from 'sptmChart';
```

## 快速入门

### 初始化图表

```javascript
import sptmChart from 'sptmChart';

const chart = new sptmChart('mycanvas', {
  type: 'DScan',
  center_freq: 200000000,
  span: 2000000,
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

### 使用真实频率数据

```javascript
chart.addTrace({
  id: 2,
  type: 'FFT',
  name: '真实频率谱线',
  color: '#00bcd4',
  datainfo: [{
    point: 1600,
    start_freq: 200000000,
    end_freq: 1000000000,
    data: [/* 强度数据 */],
    freq_data: [200000000, 200000100, 200000300, ...]
  }]
});
```

### 更新谱线数据

```javascript
chart.setTraceData(1, [{
  point: 1600,
  start_freq: 200000000,
  end_freq: 1000000000,
  data: [/* 新的强度数据 */]
}]);
```

### Marker 操作

```javascript
const markerId = chart.addMarker(true, true);
chart.moveMarkerByFreq(markerId, 500000000);
chart.deleteMarker(0);
chart.clearAllMarkers();
```

### 谱线管理

```javascript
const traces = chart.getTraces();
chart.setTraceVisibility(1, false);
chart.removeTrace(1);
```

### 图表模式切换

```javascript
chart.setChartType('waterfall');
chart.setChartType('line');
```

### 动态更新配置

```javascript
chart.setOptions({ center_freq: 500000000, span: 10000000 });
const options = chart.getOptions();
```

### X轴/Y轴范围变化回调

```javascript
const chart = new sptmChart('mycanvas', {
  xaxis: {
    onXRangeChange: (info) => {
      console.log('X轴变化:', info.startFreq, '~', info.endFreq);
    }
  },
  yaxis: {
    onYRangeChange: (info) => {
      console.log('Y轴变化:', info.minValue, '~', info.maxValue);
    }
  }
});
```

## 完整 API 文档

详见 [API.md](./API.md)

## 真实频率数据格式

```javascript
datainfo: [{
  point: 1600,
  start_freq: 200000000,
  end_freq: 1000000000,
  data: [/* 1600个强度值 */],
  freq_data: [200000000, 200000100, 200000300, ...]
}]
```
