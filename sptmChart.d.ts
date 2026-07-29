/**
 * sptmChart - 频谱控件类型声明
 */

// ==================== 配置接口 ====================

/** 网格配置 */
export interface GridConfig {
  left?: number;              // 左边距（像素）
  top?: number;               // 上边距（像素）
  bottom?: number;            // 下边距（像素）
  right?: number;             // 右边距（像素）
  color?: string;             // 网格线颜色
  background?: string;        // 网格背景色
  width?: number;             // 网格线宽度
  xgrid_show?: boolean;       // 是否显示X轴网格线
  xgrid_line_dash?: number[]; // X轴网格线虚线样式 [实线长, 虚线长]
  ygrid_show?: boolean;       // 是否显示Y轴网格线
  ygrid_line_dash?: number[]; // Y轴网格线虚线样式
  center_line_show?: boolean; // 是否显示中心线
  center_color?: string;      // 中心线颜色
  center_width?: number;      // 中心线宽度
}

/** X轴配置 */
export interface XAxisConfig {
  number?: number;            // X轴刻度标签数量
  unit?: string;            // 单位（如 'MHz'）
  unit_two_line?: boolean;  // X轴单位是否换行显示
  unit_right?: number;      // 单位距离图表左侧距离
  decimals?: string | number; // X轴刻度值小数位数
  dscan_freq?: Array<[number, number]>; // DScan模式下的频率范围数组
  dscan_space?: number;     // DScan模式下的频段间隔像素
  text_color?: string;      // X轴文本颜色
  text_font_size?: number;   // X轴文本字体大小
  text_font_family?: string; // X轴文本字体
  color?: string;            // X轴线颜色
  width?: number;            // X轴线宽度
  labels?: Array<Array<{ text: number; offsetx: number }>>; // X轴刻度标签
  label_two_line?: boolean;  // DScan模式下分段数据第一个是否换行
  label_angle?: number;      // X轴刻度标签旋转角度
  onXRangeChange?: (info: XRangeChangeInfo) => void; // X轴范围变化回调
}

/** Y轴配置 */
export interface YAxisConfig {
  number?: number;           // Y轴刻度标签数量
  unit?: string;             // 单位（如 'dBμV'）
  decimals?: string | number; // Y轴刻度值小数位数
  fixedStep?: number;        // Y轴刻度值间隔
  init_min_value?: number;   // Y轴初始最小值
  init_max_value?: number;   // Y轴初始最大值
  min_value?: number;        // Y轴当前最小值
  max_value?: number;        // Y轴当前最大值
  floor_value?: number;       // Y轴最小值范围下限
  ceiling_value?: number;    // Y轴最大值范围上限
  text_color?: string;        // Y轴文本颜色
  text_font_size?: number;   // Y轴文本字体大小
  text_font_family?: string;  // Y轴文本字体
  color?: string;            // Y轴线颜色
  width?: number;            // Y轴线宽度
  axis_function?: (value: number) => number; // Y轴刻度值计算函数
  onYRangeChange?: (info: YRangeChangeInfo) => void; // Y轴范围变化回调
}

/** Marker配置 */
export interface MarkerConfig {
  visible?: boolean;         // 是否显示Marker
  autoAdd?: boolean;         // 是否自动添加默认Marker
  defaultCount?: number;     // 默认添加Marker数量
  maxCount?: number;         // 最大Marker数量
  shape?: number;            // Marker形状（0:常规, 1:倒置）
  verticalLine?: boolean;    // 是否显示垂直线
  crossLine?: boolean;       // 是否显示十字线
  scutchonVisible?: boolean; // 是否显示标牌
  followTraceY?: boolean;    // Marker是否跟随谱线Y轴位置
  traceYOffset?: number;     // 谱线Y轴偏移量（像素）
  colorGroup?: {             // 颜色配置
    activeForeground?: string;
    inactiveForeground?: string;
    noFocusBackground?: string;
    focusBackground?: string;
    crossBorderText?: string;
    lineColor?: string;
    scutchonBackground?: string;
    scutchonForeground?: string;
  };
  clickBlankToExit?: boolean; // 点击空白区域是否退出焦点
}

/** 右键菜单配置 */
export interface ContextMenuConfig {
  enabled?: boolean;         // 是否启用右键菜单
  actions?: Array<{ type: string; label: string; handler?: (...args: any[]) => void }>;
  onCustomAction?: (action: any, event: MouseEvent, context: any) => void;
  onGetPosition?: (positionInfo: any, event: MouseEvent, context: any) => void;
}

/** 中心信息框配置 */
export interface CenterInfoConfig {
  visible?: boolean;         // 是否显示信息框
  position?: string;          // 位置（如 'top-center'）
  offsetX?: number;           // X方向偏移量
  offsetY?: number;           // Y方向偏移量
  background?: string;        // 背景颜色
  text_color?: string;        // 文本颜色
  font_size?: number;        // 字体大小
  padding?: number;           // 内边距
  border_radius?: number;     // 圆角半径
  show_center_freq?: boolean; // 是否显示中心频率
  show_current_freq?: boolean; // 是否显示当前频率（Marker频率）
  show_level?: boolean;       // 是否显示当前强度
}

/** FPS统计配置 */
export interface FpsConfig {
  visible?: boolean;          // 是否显示FPS
  position?: string;          // 位置
  offsetX?: number;           // X方向偏移量
  offsetY?: number;           // Y方向偏移量
  background?: string;        // 背景颜色
  text_color?: string;        // 文本颜色
  font_size?: number;         // 字体大小
  padding?: number;            // 内边距
  border_radius?: number;      // 圆角半径
}

/** 门限配置 */
export interface ThresholdConfig {
  visible?: boolean;           // 是否显示门限
  is_darg?: boolean;          // 是否可拖拽门限
  level?: number;              // 门限强度值
  decimals?: number;           // 门限值小数位数
  color?: string;             // 门限线颜色
  width?: number;              // 门限线宽度
  drag_color?: string;        // 拖拽时门限线颜色
  drag_width?: number;         // 拖拽时门限线宽度
  text_color?: string;        // 门限文本颜色
  text_font_size?: number;     // 门限文本字体大小
  drag_text_color?: string;    // 拖拽门限文本颜色
  drag_text_font_size?: number; // 拖拽门限文本字体大小
  icon_url?: string;           // 门限图标URL
  drag_icon_url?: string;      // 拖拽门限图标URL
  icon_size?: [number, number]; // 门限图标大小 [宽, 高]
}

/** 提示线配置 */
export interface LevelTipLineConfig {
  visible?: boolean;           // 是否显示提示线
  freq_visible?: boolean;      // 是否显示频率
  color?: string;              // 提示线颜色
  width?: number;               // 提示线宽度
  text_color?: string;          // 提示文本颜色
  text_size?: number;           // 提示文本大小
  tip_background?: string;     // 提示框背景色
  tip_text_color?: string;      // 提示框文本颜色
  tip_font_size?: number;       // 提示框字体大小
  tip_padding?: number;          // 提示框内边距
  tip_border_radius?: number;   // 提示框圆角半径
}

/** 选框配置 */
export interface SelectionBoxConfig {
  enabled?: boolean;            // 是否启用选框功能
  fillStyle?: string;            // 选框填充色
  strokeStyle?: string;           // 选框边框色
  lineWidth?: number;            // 选框边框宽度
  minWidth?: number;             // 触发选框的最小宽度（像素）
  longPressDelay?: number;       // 长按触发选框的延迟（毫秒）
  onSelect?: (info: SelectionBoxInfo, event?: MouseEvent) => void;
}

/** 瀑布图配置 */
export interface WaterfallConfig {
  max_rows?: number;             // 最大存储数据条数
  time_interval?: number;        // 当前时间刻度间隔（秒）
  time_interval_min?: number;     // 时间刻度最小间隔（秒）
  time_interval_max?: number;     // 时间刻度最大间隔（秒）
  color_min?: number;            // 色系对应的强度最小值
  color_max?: number;            // 色系对应的强度最大值
  colormap?: string;             // 色系类型
  draggable?: boolean;           // 色系条是否可拖拽
  color_wheel_enabled?: boolean; // 色系条滚轮是否启用
  time_wheel_enabled?: boolean;  // 时间轴滚轮是否启用
  use_image_data?: boolean;      // 是否使用ImageData高性能绘制
  row_height_mode?: 'fill' | 'time'; // 行高计算模式
  px_per_second?: number;        // 每秒对应的像素高度
  row_height_min?: number;       // 行高最小值（px）
  row_height_max?: number;       // 行高最大值（px）
  process_first_only?: boolean;  // 是否只处理第一条数据
  time_axis_visible?: boolean;   // 是否显示Y轴时间标线和标签
  time_format?: string;           // 时间格式
  time_label_interval?: number;    // Y轴时间标签显示间隔（秒）
}

/** 频谱区域配置 */
export interface SptmAreaConfig {
  visible?: boolean;             // 是否显示频谱区域
  background?: string;            // 频谱区域背景色
  drag_background?: string;        // 拖拽频谱区域背景色
  start_freq?: number;             // 频谱区域起始频率
  end_freq?: number;               // 频谱区域结束频率
}

/** 图例配置 */
export interface LegendConfig {
  visible?: boolean;             // 是否显示图例
  color?: string;                  // 图例文本颜色
}

/** 整体配置 */
export interface sptmChartOptions {
  type?: 'FFT' | 'DScan';          // 图表类型
  duration?: number;               // 一帧持续时间（ms）
  width?: string | number;          // 画布宽度
  height?: string | number;         // 画布高度
  background?: string;              // 背景色
  center_freq?: number | string;    // 中心频率（Hz）
  span?: number | string;           // 显宽（Hz）
  is_drag_zoom?: boolean;           // 是否启用拖拽缩放
  grid?: GridConfig;                // 网格样式
  legend?: LegendConfig;            // 图例样式
  xaxis?: XAxisConfig;              // X轴样式
  yaxis?: YAxisConfig;              // Y轴样式
  marker?: MarkerConfig;             // Marker样式
  contextMenu?: ContextMenuConfig;   // 右键菜单配置
  centerinfo?: CenterInfoConfig;    // 中心频率信息框
  fps?: FpsConfig;                  // FPS统计信息框
  threshold?: ThresholdConfig;       // 门限样式
  sptm_area?: SptmAreaConfig;       // 频谱区域
  level_tipline?: LevelTipLineConfig; // 提示线配置
  chart_type?: 'line' | 'waterfall'; // 图表绘制类型
  waterfall?: WaterfallConfig;        // 瀑布图配置
  selectionBox?: SelectionBoxConfig; // 选框功能配置
}

// ==================== 回调信息接口 ====================

/** X轴范围变化信息 */
export interface XRangeChangeInfo {
  type: 'zoom' | 'pan';            // 操作类型
  source: 'wheel' | 'drag' | 'touch'; // 触发来源
  order: number;                   // 多段索引
  startFreq: number;               // 当前显示起始频率（Hz）
  endFreq: number;                 // 当前显示结束频率（Hz）
  centerFreq: number;              // 中心频率（Hz）
  span: number;                    // 当前显示带宽（Hz）
  drawZoom: number;                // 当前缩放倍数
  startX: number;                  // 段起始像素坐标
  endX: number;                    // 段结束像素坐标
  bandStartFreq: number;           // 原始频段起始频率（Hz）
  bandEndFreq: number;             // 原始频段结束频率（Hz）
}

/** Y轴范围变化信息 */
export interface YRangeChangeInfo {
  type: 'zoom' | 'pan';            // 操作类型
  source: 'wheel' | 'drag' | 'touch'; // 触发来源
  minValue: number;                // 当前Y轴最小值
  maxValue: number;                // 当前Y轴最大值
  centerValue: number;             // 中心值
  span: number;                    // 范围跨度
  zoomLevel: number;               // 当前缩放级别
}

/** 选框结果信息 */
export interface SelectionBoxInfo {
  startFreq: number;               // 选框起始频率（Hz）
  endFreq: number;                 // 选框结束频率（Hz）
  centerFreq: number;              // 中心频率（Hz）
  bandwidth: number;               // 带宽（Hz）
  span: number;                    // 同bandwidth
  startX: number;                   // 选框起始X坐标
  endX: number;                    // 选框结束X坐标
  startY: number;                  // 选框起始Y坐标
  endY: number;                    // 选框结束Y坐标
  centerY: number;                 // 选框中心Y坐标
}

/** 鼠标位置信息 */
export interface MousePositionInfo {
  x: number;                       // 频率值（Hz）
  y: number;                        // 强度值
  freq: string;                     // 格式化频率字符串（如 '200.000000 MHz'）
  level: string;                    // 格式化强度字符串（如 '-20.00 dBμV'）
  rawFreq: number;                  // 原始频率值（Hz）
  rawLevel: number | null;          // 原始强度值
}

// ==================== 谱线相关 ====================

/** 数据段信息 */
export interface DataInfo {
  point: number;                  // 数据点数量
  start_freq: number;              // 起始频率（Hz）
  end_freq: number;                // 结束频率（Hz）
  data: number[];                   // 强度数据数组
  freq_data?: number[];             // 真实频率数组（可选，单位Hz）
}

/** 谱线配置 */
export interface TraceConfig {
  id: number;                      // 谱线唯一ID
  type?: string;                   // 谱线类型（如 'FFT'）
  visible?: boolean;                // 是否可见
  point?: number;                  // 数据点数量
  name?: string;                    // 谱线名称
  color?: string;                   // 谱线颜色
  width?: number;                   // 谱线宽度
  datainfo?: DataInfo[];            // 数据段信息数组
}

// ==================== 主类 ====================

/** sptmChart 频谱控件 */
export class sptmChart {
  constructor(id: string, options?: sptmChartOptions);

  // 配置
  /** 更新图表配置 */
  setOptions(options: Partial<sptmChartOptions>): void;
  /** 获取当前图表配置 */
  getOptions(): sptmChartOptions;

  // 绘制
  /** 绘制/刷新图表 */
  drawChart(): void;
  /** 停止图表更新 */
  stopChart(): void;
  /** 清空画布 */
  clearDraw(): void;

  // Canvas 尺寸
  /** 设置图表大小 */
  setCanvasSize(width?: string | number, height?: string | number): void;
  /** 根据容器自动调整大小 */
  resizeCanvas(): void;

  // 谱线管理
  /** 添加谱线 */
  addTrace(option: Partial<TraceConfig>): void;
  /** 更新指定谱线数据 */
  setTraceData(id: number, data: DataInfo[]): void;
  /** 获取所有谱线列表 */
  getTraces(): TraceConfig[];
  /** 删除指定谱线 */
  removeTrace(id: number): boolean;
  /** 设置谱线可见性（兼容旧版拼写） */
  setTranceVisible(id: number, visible: boolean): void;
  /** 设置谱线可见性（正确拼写） */
  setTraceVisibility(id: number, visible: boolean): void;

  // Marker 操作
  /** 添加Marker，返回Marker ID */
  addMarker(isShow?: boolean, isFocus?: boolean, traceId?: number): number;
  /** 删除Marker */
  deleteMarker(id: number): void;
  /** 清除所有Marker */
  clearAllMarkers(): void;
  /** 获取当前焦点Marker ID */
  getMarkerFocusId(): number;
  /** 设置Marker焦点 */
  setMarkerFocus(id: number): void;
  /** 移动Marker到指定频率（Hz） */
  moveMarkerByFreq(id: number, freqHz: number): void;

  // 图表模式
  /** 切换图表模式（线图/瀑布图） */
  setChartType(type: 'line' | 'waterfall', extraOptions?: Partial<sptmChartOptions>): void;
  /** 获取当前图表模式 */
  getChartType(): 'line' | 'waterfall';

  // 瀑布图
  /** 清空瀑布图数据 */
  clearWaterfallData(): void;
  /** 获取瀑布图色系范围 */
  getWaterfallColorRange(): { min: number; max: number };
  /** 设置瀑布图色系范围 */
  setWaterfallColorRange(min: number, max: number): void;
  /** 设置瀑布图行高模式 */
  setWaterfallRowHeightMode(mode: 'fill' | 'time'): void;
  /** 设置瀑布图行缩放比 */
  setWaterfallRowScale(scale: number): void;

  // 频率相关
  /** 设置FFT中心频率和显宽 */
  setFFTCenterFreAndSpan(centerFre: number, span: number): void;
  /** 获取FFT中心频率和显宽 */
  getFFTCenterFreAndSpan(): { center_freq: number; span: number };

  // 鼠标位置信息
  /** 获取鼠标位置对应的值 */
  getMouseVal(event: MouseEvent | TouchEvent, digit?: number): { x: number | null; y: number | null; order: number | null };
  /** 获取鼠标当前位置详细信息 */
  getMousePositionInfo(event: MouseEvent | TouchEvent): MousePositionInfo;
  /** 获取鼠标当前像素坐标 */
  getMousePoint(event: MouseEvent | TouchEvent): { pointx: number; pointy: number };
  /** 获取鼠标当前位置的强度信息 */
  getMousePositionLevel(data: { pointx: number; pointy: number }): { x: number | null; y: number[]; xorder: number | null; order: number | null; pointx: number; pointy: number };

  // 选框
  /** 设置选框结束回调 */
  setSelectionBoxCallback(callback: (info: SelectionBoxInfo, event?: MouseEvent) => void): void;

  // 事件处理
  /** 销毁图表，清理事件监听 */
  destroy(): void;
}

// ==================== 导出 ====================

/** 默认导出 */
export default sptmChart;
