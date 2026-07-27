import { extractTwoPolesTraceLine } from '../utils'

/**
 * @brief Waterfall 瀑布图模块
 * @description 实现瀑布图（Waterfall/Spectrogram）功能，支持色系条、时间轴、帧缓冲管理
 * @date 2026-04-03
 */

// ============================================
// Jet 彩色映射颜色表
// ============================================

// Jet 彩色的基础颜色点（蓝→青→绿→黄→红）
const WF_COLORS = [
  { r: 0,   g: 0,   b: 128 },   // 深蓝
  { r: 0,   g: 0,   b: 255 },   // 蓝
  { r: 0,   g: 127, b: 255 },   // 浅蓝
  { r: 0,   g: 255, b: 255 },   // 青
  { r: 0,   g: 255, b: 127 },   // 蓝绿
  { r: 0,   g: 255, b: 0   },   // 绿
  { r: 127, g: 255, b: 0   },   // 浅绿
  { r: 255, g: 255, b: 0   },   // 黄
  { r: 255, g: 127, b: 0   },   // 橙
  { r: 255, g: 0,   b: 0   },   // 红
  { r: 128, g: 0,   b: 0   }    // 深红
];

/**
 * 生成 256 色 Jet 颜色查找表
 * 存储格式为 Uint32Array，顺序为 RGBA（小端：0xAABBGGRR）
 * @returns {Uint32Array} 256 色颜色表
 */
function generateJetColorTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const scaledT = t * (WF_COLORS.length - 1);
    const index = Math.floor(scaledT);
    const remainder = scaledT - index;
    const c1 = WF_COLORS[Math.min(index, WF_COLORS.length - 1)];
    const c2 = WF_COLORS[Math.min(index + 1, WF_COLORS.length - 1)];
    const r = Math.round(c1.r + (c2.r - c1.r) * remainder);
    const g = Math.round(c1.g + (c2.g - c1.g) * remainder);
    const b = Math.round(c1.b + (c2.b - c1.b) * remainder);
    // Canvas ImageData 使用小端：R=byte0, G=byte1, B=byte2, A=byte3
    table[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return table;
}

// 预生成颜色表
const WF_COLOR_TABLE = generateJetColorTable();

/**
 * 将强度值映射到颜色表索引
 * @param {number} value 强度值
 * @param {number} minVal 色系最小值
 * @param {number} range 色系范围（maxVal - minVal）
 * @returns {number} 颜色索引 [0-255]
 */
function mapValueToColorIndex(value, minVal, range) {
  if (range <= 0) return 128;
  const ratio = (value - minVal) / range;
  return Math.max(0, Math.min(255, Math.round(ratio * 255)));
}

// ============================================
// Waterfall 主类
// ============================================

/**
 * Waterfall 瀑布图类
 * 负责帧缓冲管理、瀑布图绘制、色系条绘制、时间轴绘制
 */
class Waterfall {
  /**
   * 构造函数
   * @param {sptmChart} chart 父级图表实例（用于访问 ctx、options 等）
   */
  constructor(chart) {
    this.chart = chart;

    // 帧缓冲区：存储所有历史帧，每帧 { time: ms时间戳, datainfo: [...] }
    this._rows = [];

    // 色系范围（强度值，对应 yaxis 的单位 dBμV/dBm）
    this._colorMin = -30;
    this._colorMax = 60;
    this._colorMinLimit = -120; // 色系最小值下限
    this._colorMaxLimit = 120;  // 色系最大值上限

    // 时间轴配置
    this._timeInterval = 5;    // 当前时间刻度间隔（秒）
    this._timeIntervalMin = 1;  // 最小间隔（秒）
    this._timeIntervalMax = 5;  // 最大间隔（秒）

    // 当前行高缩放比（用于 Y 轴滚轮缩放）
    // rowHeight = baseRowHeight * _rowScale；_rowScale > 1 则行高增加（可见行数减少）
    this._rowScale = 1.0;

    // 色系条拖动状态
    this._colorBarDrag = {
      active: false,
      mode: null,   // 'min' | 'max'
      startY: 0,
      startMin: 0,
      startMax: 0
    };

    // 交互开关（由 options.waterfall.* 控制）
    this._dragEnabled = false;
    this._colorWheelEnabled = true;
    this._timeWheelEnabled = true;

    // 行高计算模式：'fill'（动态铺满）| 'time'（固定px/s）
    this._rowHeightMode = 'fill';

    // 数据处理方式：true=只处理第一条数据（向后兼容），false=处理所有传入的数据段
    this._processFirstOnly = true;

    // 时间轴显示控制
    this._timeAxisVisible = true;   // 是否显示 Y 轴时间标线和标签
    this._timeFormat = 'mm:ss';     // 时间格式：'mm:ss' | 'HH:mm:ss' | 'ss'
    this._timeLabelInterval = 1;    // Y 轴时间标签显示间隔（秒），默认1秒
    // 固定时间模式下每秒对应的像素高度（'time' 模式）
    this._pxPerSecond = 200;
    // fill 模式下行高像素限制（px），防止初始帧少时行高过大
    this._rowHeightMin = 0.1;  // 行高最小值（px）
    this._rowHeightMax = 10;  // 行高最大值（px）

    // ========================================
    // 绘制缓存（减少每帧内存分配）
    // ========================================
    // ImageData 对象池：按尺寸缓存，避免每行重复 createImageData
    this._imgDataCache = null;  // { width, height, imgData }
    // 行颜色数组缓存：预分配，避免每行重复 new Uint32Array
    this._rowColorCache = null; // Uint32Array
    // ImageData 模式允许的最大行高（px），超过则回退 fillRect 以避免巨量内存分配
    this._maxImageDataHeight = 64;
    // 色系条渐变缓存：在色系范围/尺寸不变时复用 LinearGradient
    this._colorBarCache = null; // { min, max, height, y, gradient }
    // rgba 字符串缓存：预生成 256 色，避免每帧重复拼接字符串
    this._rgbaCache = null;     // string[256]
  }

  // ========================================
  // 公开方法
  // ========================================

  /**
   * 获取当前色系范围
   * @returns {{ min: number, max: number }}
   */
  getColorRange() {
    return { min: this._colorMin, max: this._colorMax };
  }

  /**
   * 设置色系范围
   * @param {number} min 最小值
   * @param {number} max 最大值
   */
  setColorRange(min, max) {
    this._colorMin = min;
    this._colorMax = max;
  }

  /**
   * 获取当前时间刻度间隔（秒）
   * @returns {number}
   */
  getTimeInterval() {
    return this._timeInterval;
  }

  /**
   * 清空所有帧数据
   */
  clearData() {
    this._rows = [];
  }

  /**
   * 获取当前帧数量
   * @returns {number}
   */
  getRowCount() {
    return this._rows.length;
  }

  /**
   * 切换行高计算模式
   * @param {string} mode 'fill' | 'time'
   */
  setRowHeightMode(mode) {
    if (mode !== 'fill' && mode !== 'time') return;
    if (this._rowHeightMode === mode) return; // 模式没变不处理
    this._rowHeightMode = mode;
    // 切换模式时清空数据，重新开始绘制
    this._rows = [];
  }

  /**
   * 设置行缩放比（_rowScale）
   * @param {number} scale
   */
  setRowScale(scale) {
    this._rowScale = Math.max(0.1, Math.min(5.0, scale));
  }

  /**
   * 应用瀑布图配置（从 chart.options.waterfall 同步）
   * @param {object} opts waterfall 配置块
   */
  applyConfig(opts) {
    if (!opts) return;
    if (opts.max_rows !== undefined) {
      // 同步最大行数，超出则裁剪旧数据
      while (this._rows.length > opts.max_rows) {
        this._rows.pop();
      }
    }
    if (opts.color_min !== undefined) this._colorMin = opts.color_min;
    if (opts.color_max !== undefined) this._colorMax = opts.color_max;
    if (opts.color_min_limit !== undefined) this._colorMinLimit = opts.color_min_limit;
    if (opts.color_max_limit !== undefined) this._colorMaxLimit = opts.color_max_limit;
    if (opts.time_interval !== undefined) this._timeInterval = opts.time_interval;
    if (opts.time_interval_min !== undefined) this._timeIntervalMin = opts.time_interval_min;
    if (opts.time_interval_max !== undefined) this._timeIntervalMax = opts.time_interval_max;
    if (opts.draggable !== undefined) this._dragEnabled = opts.draggable;
    if (opts.color_wheel_enabled !== undefined) this._colorWheelEnabled = opts.color_wheel_enabled;
    if (opts.time_wheel_enabled !== undefined) this._timeWheelEnabled = opts.time_wheel_enabled;
    if (opts.row_height_mode !== undefined) this._rowHeightMode = opts.row_height_mode;
    if (opts.px_per_second !== undefined) this._pxPerSecond = opts.px_per_second;
    if (opts.row_height_min !== undefined) this._rowHeightMin = opts.row_height_min;
    if (opts.row_height_max !== undefined) this._rowHeightMax = opts.row_height_max;
    if (opts.process_first_only !== undefined) this._processFirstOnly = opts.process_first_only;
    if (opts.time_axis_visible !== undefined) this._timeAxisVisible = opts.time_axis_visible;
    if (opts.time_format !== undefined) this._timeFormat = opts.time_format;
    if (opts.time_label_interval !== undefined) this._timeLabelInterval = Math.max(1, opts.time_label_interval);
  }

  // ========================================
  // 帧缓冲管理
  // ========================================

  /**
   * 添加一帧数据到瀑布图缓冲区
   * @param {Array} datas datainfo 数据数组（单段或多段频率数据）
   * @param {number} maxRows 最大存储条数
   */
  pushRow(datas, maxRows) {
    let datainfo;
    if (this._processFirstOnly) {
      // 向后兼容：只处理第一条数据
      let data = datas[0];
      datainfo = data.datainfo ? data.datainfo : [data];
    } else {
      // 处理所有传入的数据段（兼容 DScan 多段频率数据）
      datainfo = [];
      for (let i = 0; i < datas.length; i++) {
        let d = datas[i];
        if (d.datainfo && Array.isArray(d.datainfo)) {
          datainfo = datainfo.concat(d.datainfo);
        } else {
          datainfo.push(d);
        }
      }
    }
    const time = datainfo[0]?.time !== undefined ? datainfo[0].time : Date.now();
    // 构造帧记录：合并 datainfo 并附加 time
    const frame = {
      time: time,
      datainfo: datainfo
    };
    // 头部追加新帧
    this._rows.unshift(frame);
    // 超出上限则移除最旧帧
    if (this._rows.length > maxRows) {
      this._rows.pop();
    }
  }

  // ========================================
  // 绘制方法
  // ========================================

  // ========================================
  // 绘制缓存管理
  // ========================================

  /**
   * 获取缓存的 ImageData（按尺寸复用，避免每行重复 createImageData）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   * @returns {ImageData}
   * @private
   */
  _getCachedImageData(ctx, width, height) {
    const cache = this._imgDataCache;
    if (cache && cache.width === width && cache.height === height) {
      return cache.imgData;
    }
    const imgData = ctx.createImageData(width, height);
    this._imgDataCache = { width, height, imgData };
    return imgData;
  }

  /**
   * 获取缓存的行颜色数组（按需扩容，避免每行重复分配）
   * @param {number} length 所需最小长度
   * @returns {Uint32Array}
   * @private
   */
  _getRowColorArray(length) {
    if (!this._rowColorCache || this._rowColorCache.length < length) {
      this._rowColorCache = new Uint32Array(length);
    }
    // 缓存长度大于需求时返回截断视图，确保 u32.set() 不会越界
    if (this._rowColorCache.length > length) {
      return this._rowColorCache.subarray(0, length);
    }
    return this._rowColorCache;
  }

  /**
   * 清空绘制缓存（窗口尺寸变化等场景调用）
   * @private
   */
  _clearDrawCache() {
    this._imgDataCache = null;
    this._rowColorCache = null;
  }

  /**
   * 绘制完整瀑布图区域
   * @param {boolean} useImageData 是否使用 ImageData 高性能绘制（默认 true）
   */
  draw(useImageData = true) {
    if (this._rows.length === 0) return;

    const ctx = this.chart.ctx;
    const opts = this.chart.options;
    const grid = opts.grid;
    const chartWidth = this.chart.chartWidth;
    const chartHeight = this.chart.chartHeight;

    // 绘制瀑布图行
    this._drawWaterfallRows(useImageData);

    // 绘制色系条（右侧）
    this._drawColorBar();

    // 绘制时间 Y 轴（覆盖原有 Y 轴标签区域）
    this._drawTimeYAxis();
  }

  /**
   * 绘制所有瀑布图行
   * @param {boolean} useImageData 是否使用 ImageData
   * @private
   */
  /**
   * 计算坐标参数，行绘制和时间轴共用同一套坐标基准
   *
   * 返回对象:
   *   mode       - 当前模式 'fill' | 'time'
   *   heightPerMs - px/ms（两种模式都返回，时间轴用此值）
   *   getRowY(frame, i) - 返回该帧顶部的 Y 像素（相对 canvas）
   *   getRowH(frame, i) - 返回该帧的行高（像素）
   *
   * fill 模式：按 max_rows 均分 chartHeight，每行高度 = chartHeight / max_rows * _rowScale
   *            heightPerMs 由 chartHeight / totalSpan 计算（用于时间轴），若帧数<2用平均估算
   * time 模式：每秒 = _pxPerSecond * _rowScale 像素，行高 = 帧时间差 * px/ms
   *
   * @returns {{ mode, heightPerMs, newestTime, getRowY, getRowH }}
   * @private
   */
  _getCoordParams() {
    const chart = this.chart;
    const opts = chart.options;
    const grid = opts.grid;
    const chartHeight = chart.chartHeight;
    const rowCount = this._rows.length;
    const configMaxRows = opts.waterfall?.max_rows || 100;
    const newestTime = rowCount > 0 ? this._rows[0].time : Date.now();
    const mode = this._rowHeightMode || 'fill';

    // 动态计算最大行数：根据容器高度和最大行高，确保能铺满并多留余量
    // 当默认行高（_rowScale=1）超过 _rowHeightMax 时，增加行数避免底部空白
    const baseRowH = chartHeight / configMaxRows;
    let dynamicMaxRows = configMaxRows;
    if (baseRowH > this._rowHeightMax) {
      const neededRows = Math.ceil(chartHeight / this._rowHeightMax);
      dynamicMaxRows = Math.max(configMaxRows, neededRows + 50); // 多加点行数
    }

    if (mode === 'time') {
      // === time 模式：固定 px/s，但保证 max_rows 帧能铺满 chartHeight ===
      let heightPerMs = (this._pxPerSecond * this._rowScale) / 1000;

      // 动态放大：当基础 px/s 不足以让 max_rows 帧铺满图表时，自动提升
      // 假设标准帧间隔 20ms（50fps），max_rows 帧总时长 = max_rows * 20ms
      const assumedFrameMs = 20;
      const minHeightPerMs = chartHeight / dynamicMaxRows / assumedFrameMs;
      if (heightPerMs < minHeightPerMs) {
        heightPerMs = minHeightPerMs;
      }

      const getRowY = (frame) => {
        return grid.top + (newestTime - frame.time) * heightPerMs;
      };

      const getRowH = (frame, i) => {
        let frameMs;
        if (i < rowCount - 1) {
          frameMs = Math.abs(frame.time - this._rows[i + 1].time);
        } else {
          frameMs = rowCount > 1
            ? Math.abs(this._rows[rowCount - 2].time - this._rows[rowCount - 1].time)
            : 1000;
        }
        frameMs = Math.max(10, frameMs);
        // 动态最小行高：根据 chartHeight 调整，避免容器很小时行高被过度限制
        const minRowH = Math.min(1, chartHeight / dynamicMaxRows / 2);
        return Math.max(minRowH, frameMs * heightPerMs);
      };

      return { mode, heightPerMs, newestTime, getRowY, getRowH, maxRows: dynamicMaxRows };

    } else {
      // === fill 模式：帧按索引均匀铺满（grid.top + i * rowH），确保图表底部无黑色 ===
      // 行高 = chartHeight / maxRows * _rowScale，最多绘制 maxRows 帧
      const maxRows = dynamicMaxRows;
      const baseRowH = chartHeight / maxRows;
      const rowH = Math.max(
        this._rowHeightMin,
        Math.min(this._rowHeightMax, baseRowH * this._rowScale)
      );

      // heightPerMs：确保刻度间距与行高匹配（固定不变，避免帧数变化时跳动）
      // 每秒对应 rowH 像素高度，即 time_interval=1s 时刻度间距 = rowH
      const heightPerMs = rowH / 1000;

      // 帧按索引定位（i=0 在顶部），与刻度用相同的 heightPerMs
      const getRowY = (frame, i) => {
        return grid.top + i * rowH;
      };

      const getRowH = () => rowH;

      return { mode, heightPerMs, newestTime, getRowY, getRowH, maxRows: dynamicMaxRows };
    }
  }

  _drawWaterfallRows(useImageData) {
    const chart = this.chart;
    const opts = chart.options;
    const grid = opts.grid;
    const xLabelGridInfo = chart.xLabelGridInfo;

    if (this._rows.length === 0 || xLabelGridInfo.length === 0) return;

    const rowCount = this._rows.length;
    const gridBottom = chart.height - grid.bottom;
    const cp = this._getCoordParams();
    const maxRows = cp.maxRows;

    // 最多绘制 maxRows 帧（与 heightPerMs 计算保持一致）
    const drawRows = Math.min(rowCount, maxRows);
    for (let i = 0; i < drawRows; i++) {
      const frame = this._rows[i];
      const yTop = cp.getRowY(frame, i);  // 索引定位
      const rowHeight = cp.getRowH(frame, i);

      if (yTop >= gridBottom) break;
      if (yTop + rowHeight <= grid.top) continue;

      const drawY = Math.max(yTop, grid.top);
      const drawHeight = Math.min(rowHeight - (drawY - yTop), gridBottom - drawY);
      if (drawHeight <= 0) continue;

      this._drawWaterfallRow(frame, drawY, drawHeight, useImageData);
    }
  }

  /**
   * 固定行高绘制模式
   * @param {number} rowHeight 每行像素高度
   * @param {boolean} useImageData
   * @private
   */
  _drawWaterfallRowsFixedHeight(rowHeight, useImageData) {
    const chart = this.chart;
    const ctx = chart.ctx;
    const opts = chart.options;
    const grid = opts.grid;
    const chartHeight = chart.chartHeight;
    const maxRows = opts.waterfall?.max_rows || 100;

    for (let i = 0; i < Math.min(this._rows.length, maxRows); i++) {
      const frame = this._rows[i];
      const y = grid.top + i * rowHeight;
      if (y > chart.height - grid.bottom) break;
      const drawHeight = Math.min(rowHeight, chart.height - grid.bottom - y);
      if (drawHeight <= 0) break;
      this._drawWaterfallRow(frame, y, drawHeight, useImageData);
    }
  }

  /**
   * 计算所有帧的总时间跨度
   * @returns {number} 总时间跨度（ms）
   * @private
   */
  _calculateTimeSpan() {
    if (this._rows.length < 2) return 0;
    const newest = this._rows[0].time;
    const oldest = this._rows[this._rows.length - 1].time;
    return Math.abs(newest - oldest);
  }

  /**
   * 绘制单行瀑布图数据
   * @param {object} frame 帧数据 { time, datainfo }
   * @param {number} y 行的顶部 Y 坐标（像素）
   * @param {number} rowHeight 行高（像素）
   * @param {boolean} useImageData 是否使用 ImageData
   * @private
   */
  _drawWaterfallRow(frame, y, rowHeight, useImageData) {
    const chart = this.chart;
    const ctx = chart.ctx;
    const opts = chart.options;
    const grid = opts.grid;
    const xLabelGridInfo = chart.xLabelGridInfo;

    // 遍历所有 datainfo（支持多段频率）
    for (let segIdx = 0; segIdx < frame.datainfo.length; segIdx++) {
      const dataInfo = frame.datainfo[segIdx];
      const labelInfo = xLabelGridInfo[segIdx];
      if (!labelInfo || !dataInfo || !dataInfo.data) continue;

      const drawX = grid.left + labelInfo.start_x;
      const segWidth = labelInfo.width;
      if (segWidth <= 0) continue;

      // ===== 数据截取（与线图 drawTypeLine 逻辑一致） =====
      let drawData = dataInfo.data;
      const labelStart = labelInfo.start_freq;
      const labelEnd = labelInfo.end_freq;
      const showStart = labelInfo.show_start_freq;
      const showEnd = labelInfo.show_end_freq;

      // 如果 X 轴有缩放/平移，需要截取数据范围
      if (showStart !== labelStart || showEnd !== labelEnd) {
        const point = dataInfo.point || dataInfo.data.length;
        const startOrder = Math.floor((showStart - labelStart) * point / (labelEnd - labelStart));
        const endOrder = Math.floor((showEnd - labelStart) * point / (labelEnd - labelStart));
        drawData = dataInfo.data.slice(startOrder, endOrder);
      }

      const dataLen = drawData.length;

      // ===== 数据抽点（与线图逻辑一致） =====
      let targetData = drawData;
      if (dataLen > segWidth) {
        // 保留最大最小抽点
        targetData = extractTwoPolesTraceLine(drawData, dataLen, segWidth);
        if (targetData && targetData.targetData) {
          // 抽点结果用于映射
          const pts = targetData.targetData;
          this._drawWaterfallRowWithPoints(ctx, drawX, y, rowHeight, segWidth, pts, useImageData);
          continue;
        }
      } else if (dataLen < segWidth) {
        // 数据点数少于像素宽度，用原始数据（步进填充）
        targetData = drawData;
      }

      this._drawWaterfallRowWithPoints(ctx, drawX, y, rowHeight, segWidth, targetData, useImageData);
    }
  }

  /**
   * 使用处理好的数据点绘制一行瀑布图
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} drawX 起始 X 坐标
   * @param {number} y 行的顶部 Y 坐标
   * @param {number} rowHeight 行高
   * @param {number} segWidth 像素宽度
   * @param {Array} dataPoints 数据点数组（抽点后或原始）
   * @param {boolean} useImageData
   * @private
   */
  _drawWaterfallRowWithPoints(ctx, drawX, y, rowHeight, segWidth, dataPoints, useImageData) {
    const colorMin = this._colorMin;
    const colorRange = this._colorMax - this._colorMin;
    const colorTable = WF_COLOR_TABLE;
    const len = dataPoints.length;
    const ceilRowHeight = Math.ceil(rowHeight);

    // ImageData 模式：复用缓存对象，限制最大行高以避免巨量内存分配
    if (useImageData && len > 0 && segWidth > 0 && ceilRowHeight <= this._maxImageDataHeight) {
      const imgData = this._getCachedImageData(ctx, segWidth, ceilRowHeight);
      const u32 = new Uint32Array(imgData.data.buffer);
      // createImageData 会自动截断为整数，所有 ImageData 操作必须基于 imgData.width/height
      const imgWidth = imgData.width;
      const imgHeight = imgData.height;

      // 预计算一行像素的颜色值（复用缓存数组，避免每行 new Uint32Array）
      const rowColors = this._getRowColorArray(imgWidth);
      const indexMul = len / segWidth;
      let dataIdxAcc = 0;

      for (let px = 0; px < imgWidth; px++) {
        const dataIdx = Math.min(Math.floor(dataIdxAcc), len - 1);
        dataIdxAcc += indexMul;
        const rawValue = dataPoints[dataIdx];
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        const colorIdx = mapValueToColorIndex(value, colorMin, colorRange);
        rowColors[px] = colorTable[colorIdx]; // 已为小端 ABGR 格式
      }

      // 按行批量填充：使用内联循环替代 u32.set，避免浮点/截断导致的越界风险
      for (let py = 0; py < imgHeight; py++) {
        const offset = py * imgWidth;
        for (let px = 0; px < imgWidth; px++) {
          u32[offset + px] = rowColors[px];
        }
      }

      ctx.putImageData(imgData, drawX, y);
    } else {
      // 回退：逐段 fillRect 模式（对连续相同颜色段合并绘制，减少 Canvas 状态切换）
      const pointWidth = len > 0 ? segWidth / len : 1;

      if (pointWidth >= 1 && len > 0) {
        // 数据点粒度绘制：合并连续同色段，减少 fillStyle 切换和 fillRect 调用
        let segStart = 0;
        let prevColor = null;

        for (let i = 0; i < len; i++) {
          const rawValue = dataPoints[i];
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
          const colorIdx = mapValueToColorIndex(value, colorMin, colorRange);
          const color = this._indexToRgba(colorIdx);

          if (color !== prevColor) {
            // 绘制前一段
            if (prevColor !== null) {
              ctx.fillStyle = prevColor;
              const segPx = drawX + segStart * pointWidth;
              const segW = (i - segStart) * pointWidth;
              ctx.fillRect(segPx, y, segW, rowHeight);
            }
            segStart = i;
            prevColor = color;
          }
        }
        // 绘制最后一段
        if (prevColor !== null) {
          ctx.fillStyle = prevColor;
          const segPx = drawX + segStart * pointWidth;
          const segW = (len - segStart) * pointWidth;
          ctx.fillRect(segPx, y, segW, rowHeight);
        }
      } else {
        // 超细分像素（pointWidth < 1）：逐像素宽度绘制
        const effectiveWidth = Math.max(1, pointWidth);
        for (let i = 0; i < len; i++) {
          const rawValue = dataPoints[i];
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
          const colorIdx = mapValueToColorIndex(value, colorMin, colorRange);
          ctx.fillStyle = this._indexToRgba(colorIdx);
          const px = drawX + i * pointWidth;
          ctx.fillRect(px, y, effectiveWidth, rowHeight);
        }
      }
    }
  }

  /**
   * 颜色索引转 rgba 字符串（使用预生成缓存，避免每帧重复拼接字符串）
   * @param {number} idx 颜色索引 [0-255]
   * @returns {string} rgba 字符串
   * @private
   */
  _indexToRgba(idx) {
    if (!this._rgbaCache) {
      this._rgbaCache = new Array(256);
      for (let i = 0; i < 256; i++) {
        const color = WF_COLOR_TABLE[i];
        const r = color & 0xff;
        const g = (color >> 8) & 0xff;
        const b = (color >> 16) & 0xff;
        this._rgbaCache[i] = `rgb(${r},${g},${b})`;
      }
    }
    return this._rgbaCache[idx];
  }

  /**
   * 绘制右侧色系条
   * @private
   */
  _drawColorBar() {
    const chart = this.chart;
    const ctx = chart.ctx;
    const opts = chart.options;
    const grid = opts.grid;
    const chartHeight = chart.chartHeight;

    const barWidth = grid.right;
    const barX = chart.width - barWidth;
    const barY = grid.top;
    const barHeight = chartHeight;

    if (barWidth <= 0) return;

    // 绘制色系渐变背景（使用 LinearGradient，缓存复用）
    // 数字大在上（热色/红），数字小在下（冷色/蓝）
    // t=0(顶部) → colorIdx=255(红), t=1(底部) → colorIdx=0(蓝)
    const cache = this._colorBarCache;
    let gradient;
    if (cache && cache.min === this._colorMin && cache.max === this._colorMax &&
        cache.height === barHeight && cache.y === barY) {
      gradient = cache.gradient;
    } else {
      gradient = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const colorIdx = Math.round((1 - t) * 255);
        gradient.addColorStop(t, this._indexToRgba(colorIdx));
      }
      this._colorBarCache = { min: this._colorMin, max: this._colorMax, height: barHeight, y: barY, gradient };
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 绘制色系条边框
    ctx.strokeStyle = opts.grid.color || '#B7B7B7';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // 绘制刻度文字（色条内部水平居中显示）
    ctx.font = `${(opts.yaxis.text_font_size || 12) * chart.devicePixelRatio}px ${opts.yaxis.text_font_family || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const decimals = opts.yaxis.decimals !== undefined ? opts.yaxis.decimals : 2;
    const unit = opts.yaxis.unit || '';
    const range = this._colorMax - this._colorMin;
    const tickCount = 5;

    for (let i = 0; i <= tickCount; i++) {
      const t = i / tickCount;
      // 数字大在上（顶部），数字小在下（底部）
      const value = this._colorMax - t * range;
      const ty = barY + t * barHeight;
      // 刻度小短线（色条左侧外侧）
      ctx.strokeStyle = opts.grid.color || '#B7B7B7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX - 3, ty);
      ctx.lineTo(barX, ty);
      ctx.stroke();
      // 数值文字（在色条内部水平居中，带阴影保证渐变背景上的可读性）
      const text = value.toFixed(decimals);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#fff';
      ctx.fillText(text, barX + barWidth / 2, ty);
      ctx.restore();
    }

    // 单位文字显示在色系条顶部
    if (unit) {
      ctx.save();
      ctx.fillStyle = opts.yaxis.text_color || '#343434';
      ctx.font = `${(opts.yaxis.text_font_size || 12) * chart.devicePixelRatio}px ${opts.yaxis.text_font_family || 'Arial'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const unitX = barX + barWidth / 2;
      const unitY = barY - 4;
      ctx.fillText(unit, unitX, unitY);
      ctx.restore();
    }
  }

  /**
   * 绘制时间轴 Y 轴（与 _drawWaterfallRows 使用完全相同的坐标系）
   * @private
   */
  _drawTimeYAxis() {
    const chart = this.chart;
    const ctx = chart.ctx;
    const opts = chart.options;
    const grid = opts.grid;
    const chartHeight = chart.chartHeight;

    if (this._rows.length === 0) return;

    // 与 _drawWaterfallRows 完全一致的坐标基准
    const cp = this._getCoordParams();
    const newestTime = cp.newestTime;
    const maxRows = cp.maxRows;
    const gridBottom = chart.height - grid.bottom;

    // 时间刻度间隔（秒）
    const intervalSec = this._timeInterval;
    const intervalMs = intervalSec * 1000;
    // 标签显示间隔（秒）
    const labelIntervalSec = this._timeLabelInterval || 1;
    const labelIntervalMs = labelIntervalSec * 1000;

    // 绘制 Y 轴竖线
    ctx.strokeStyle = opts.yaxis.color || '#333';
    ctx.lineWidth = opts.yaxis.width || 1;
    ctx.beginPath();
    ctx.moveTo(grid.left, grid.top);
    ctx.lineTo(grid.left, grid.top + chartHeight);
    ctx.stroke();

    // 刻度文字样式
    ctx.fillStyle = opts.yaxis.text_color || '#343434';
    ctx.font = `${(opts.yaxis.text_font_size || 12) * chart.devicePixelRatio}px ${opts.yaxis.text_font_family || 'Arial'}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // 时间格式化（支持 'mm:ss' | 'HH:mm:ss' | 'ss'）
    const timeFormat = this._timeFormat || 'mm:ss';
    const formatTime = (ms) => {
      const d = new Date(ms);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      if (timeFormat === 'HH:mm:ss') return `${h}:${m}:${s}`;
      if (timeFormat === 'ss') return s;
      return `${m}:${s}`;
    };

    const drawRows = Math.min(this._rows.length, maxRows);

    // 计算图表覆盖的总时间跨度
    // newestTime 始终是最新帧的时间
    // oldestTime 是最旧可见帧的时间
    const oldestTime = drawRows > 0 ? this._rows[drawRows - 1].time : newestTime;

    // 从 newestTime 向下取整到 labelIntervalSec 秒边界
    let tickTime = Math.floor(newestTime / labelIntervalMs) * labelIntervalMs;

    // 如果 tickTime > newestTime（刚好是整数秒），从上一个刻度开始
    if (tickTime > newestTime) {
      tickTime -= labelIntervalMs;
    }

    // 跟踪已画的秒索引（用于去重）：使用普通对象替代 Set，减少每帧对象创建开销
    const drawnSeconds = {};

    // 遍历所有整数秒刻度，从最新到最旧
    while (tickTime >= oldestTime - labelIntervalMs) {
      // 计算刻度索引
      const secondIndex = Math.floor(tickTime / labelIntervalMs);
      if (drawnSeconds[secondIndex]) {
        tickTime -= labelIntervalMs;
        continue;
      }
      drawnSeconds[secondIndex] = true;

      // 找到最接近 tickTime 的帧
      let closestFrameIdx = -1;
      let closestDiff = Infinity;
      let closestFrame = null;
      for (let i = 0; i < drawRows; i++) {
        const diff = Math.abs(this._rows[i].time - tickTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestFrameIdx = i;
          closestFrame = this._rows[i];
        }
      }

      // 如果找到了接近的帧，且差距小于 intervalMs/2
      if (closestFrameIdx >= 0 && closestDiff < intervalMs / 2 && closestFrame) {
        // 使用与行绘制一致的坐标计算（fill模式用索引，time模式用时间差）
        const yTop = cp.getRowY(closestFrame, closestFrameIdx);

        // 边界裁剪
        if (yTop >= grid.top && yTop <= gridBottom) {
          if (this._timeAxisVisible !== false) {
            // 绘制刻度短线
            ctx.strokeStyle = opts.grid.color || '#B7B7B7';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(grid.left, yTop);
            ctx.lineTo(grid.left + 5, yTop);
            ctx.stroke();

            // 绘制时间文字
            ctx.fillStyle = opts.yaxis.text_color || '#343434';
            ctx.fillText(formatTime(tickTime), grid.left - 5, yTop);
          }
        }
      }

      tickTime -= labelIntervalMs;

      // 避免无限循环
      if (drawnSeconds.size > 1000) break;
    }

    // Y 轴单位文字（旋转）
    ctx.save();
    ctx.translate(opts.yaxis.text_font_size * chart.devicePixelRatio, grid.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.yaxis.text_color || '#343434';
    ctx.font = `${(opts.yaxis.text_font_size || 12) * chart.devicePixelRatio}px ${opts.yaxis.text_font_family || 'Arial'}`;
    ctx.fillText('时间', 0, 0);
    ctx.restore();
  }

  // ========================================
  // 交互处理
  // ========================================

  /**
   * 色系条滚轮处理
   * @param {WheelEvent} event 滚轮事件
   * @param {number} delta 滚轮方向（1=向下/缩小，-1=向上/放大）
   * @returns {boolean} 是否处理了事件
   * @private
   */
  handleColorWheel(event, delta) {
    if (!this._colorWheelEnabled) return false;

    const chart = this.chart;
    const grid = chart.options.grid;
    const chartHeight = chart.chartHeight;

    // 判断鼠标在色条的上半部还是下半部
    const rect = chart.canvas.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const barY = grid.top;
    const barHeight = chartHeight;
    const barMid = barY + barHeight / 2;

    const range = this._colorMax - this._colorMin;
    const change = range * 0.05; // 每次滚动变化范围的 5%

    if (mouseY < barMid) {
      // 上半部：调整最大值
      if (delta > 0) {
        // 向下滚动 → 最大值减小（范围缩小，整体上移）
        this._colorMax = Math.max(this._colorMin + 1, Math.max(this._colorMinLimit, this._colorMax - change));
      } else {
        // 向上滚动 → 最大值增大（范围扩大，整体下移）
        this._colorMax = Math.min(this._colorMaxLimit, this._colorMax + change);
      }
    } else {
      // 下半部：调整最小值
      if (delta > 0) {
        // 向下滚动 → 最小值增大（范围缩小，色条整体上移）
        this._colorMin = Math.min(this._colorMax - 1, Math.min(this._colorMaxLimit, this._colorMin + change));
      } else {
        // 向上滚动 → 最小值减小（范围扩大，色条整体下移）
        this._colorMin = Math.max(this._colorMinLimit, this._colorMin - change);
      }
    }

    return true;
  }

  /**
   * 时间轴滚轮处理（Y 轴区域）
   * @param {WheelEvent} event 滚轮事件
   * @param {number} delta 滚轮方向
   * @returns {boolean} 是否处理了事件
   * @private
   */
  handleTimeWheel(event, delta) {
    if (!this._timeWheelEnabled) return false;

    // 调整时间间隔
    if (delta > 0) {
      // 向下滚动：间隔增大（时间刻度变稀疏）
      this._timeInterval = Math.min(this._timeIntervalMax, this._timeInterval + 1);
    } else {
      // 向上滚动：间隔减小（时间刻度变密集）
      this._timeInterval = Math.max(this._timeIntervalMin, this._timeInterval - 1);
    }

    // 清空数据，重新从顶部第一帧开始绘制
    this._rows = [];
    return true;
  }

  /**
   * 时间轴缩放滚轮（调整行高缩放比）
   * @param {WheelEvent} event 滚轮事件
   * @param {number} delta 滚轮方向
   * @returns {boolean}
   * @private
   */
  handleRowScaleWheel(event, delta) {
    // 在 grid 区域滚轮调整行高缩放
    const scaleFactor = 0.1;
    if (delta > 0) {
      // 向下滚动：行高增大（可见行数减少）
      this._rowScale = Math.min(5.0, this._rowScale + scaleFactor);
    } else {
      // 向上滚动：行高减小（可见行数增加）
      this._rowScale = Math.max(0.1, this._rowScale - scaleFactor);
    }
    // 清空数据，重新开始绘制
    this._rows = [];
    return true;
  }

  /**
   * 色系条拖动处理
   * @param {number} mouseY 当前鼠标 Y 坐标（相对于 canvas）
   * @param {boolean} isStart 是否开始拖动
   * @private
   */
  handleColorBarDrag(mouseY, isStart) {
    if (!this._dragEnabled) return false;

    const chart = this.chart;
    const grid = chart.options.grid;
    const chartHeight = chart.chartHeight;

    const barY = grid.top;
    const barHeight = chartHeight;
    const barMid = barY + barHeight / 2;

    if (isStart) {
      this._colorBarDrag.active = true;
      this._colorBarDrag.startY = mouseY;
      this._colorBarDrag.mode = mouseY < barMid ? 'max' : 'min';
      this._colorBarDrag.startMin = this._colorMin;
      this._colorBarDrag.startMax = this._colorMax;
    } else {
      if (!this._colorBarDrag.active) return false;
      const deltaY = mouseY - this._colorBarDrag.startY;
      const range = this._colorMax - this._colorMin;
      const change = (deltaY / chartHeight) * range * 2;

      if (this._colorBarDrag.mode === 'max') {
        this._colorMax = Math.max(this._colorMin + 1, this._colorBarDrag.startMax + change);
      } else {
        this._colorMin = Math.min(this._colorMax - 1, this._colorBarDrag.startMin + change);
      }
    }
    return true;
  }

  /**
   * 结束拖动
   * @private
   */
  endDrag() {
    this._colorBarDrag.active = false;
    this._colorBarDrag.mode = null;
  }

  /**
   * 判断鼠标是否在色系条区域
   * @param {number} x 鼠标 X（相对于 canvas）
   * @returns {boolean}
   */
  isInColorBar(x) {
    const chart = this.chart;
    const grid = chart.options.grid;
    const barX = chart.width - grid.right;
    return x >= barX;
  }
}

export { Waterfall, mapValueToColorIndex, WF_COLOR_TABLE };
