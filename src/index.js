import './index.css'
import {deepMerge,deepCopy,calculateStepValues,calculateWidths,truncateNumber,extractTwoPolesTraceLine,extractTwoPolesTraceLine2,debounce,throttle} from './utils'
import { MarkerItem } from './module/MarkerItem.js'
import { Waterfall } from './module/Waterfall.js'

/**
 * sptmChart 频谱控件
 *
 * @class sptmChart
 */
class sptmChart {
  constructor(id,options) {
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.loadOptions=options;
    this.box = document.getElementById(id);
    this.box.style.position = "relative"
    this.box.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = "absolute";
    this.box.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true; // 启用抗锯齿
    this._initOptions(options);
    this.setCanvasSize();
    this.refreshInterval=null;
    this.isDraw=true
    //移动端触控支持
    this._isTouchActive=false;      // 标记当前是touch交互，屏蔽mouse事件重复触发
    this._touchStartTime=0;         // touch开始时间（用于长按检测）
    this._longPressTimer=null;      // 长按定时器
    this._lastTouchDist=0;          // 双指缩放时的上次距离
    this._touchStartPos={x:0,y:0}; // 触控起始位置
    this._longPressTriggered=false; // 长按是否已触发
    //门限信息
    this.thresholdDiv=null;
    this.thresholdFouce=false;
    //弹窗tip强度
    this.fretipDiv=null;
    this.ceiling_value=null//y轴最大门限值
    //========== Marker相关初始化 ==========
    this._markerList=new Map();        // Marker列表 Map<id, MarkerItem>
    this._nextMarkerId=1;              // 下一个Marker ID
    this._focusMarkerId=0;             // 当前焦点Marker ID
    this._markerDragState={             // Marker拖动状态
      isDragging:false,
      dragMarkerId:0,
      lastX:0,
      lastY:0
    };
    
    //========== 交互状态机 ==========
    this._currentOperation=null;       // 当前操作类型 'markerDrag'|'selectionBox'|'pan'|'thresholdDrag'|null
    this._mouseDownPos={x:0,y:0};      // mousedown位置
    this._mouseDownTime=0;             // mousedown时间
    this._dragThreshold=5;             // 拖动判定阈值（像素）
    //=====================================

    // 瀑布图模块初始化
    this._waterfall = new Waterfall(this);
    this._waterfall.applyConfig(this.options.waterfall);
    //=====================================
    
    this.chartWidth = 0;//图表宽度
    this.chartHeight = 0;//图表高度
    this.ygridStep=0//图表网格步进宽度
    this.yZoom=1//y轴缩放比例
    this.tracesData=[];//数据
    this.focusType="";//聚焦类型 grid|left|right|bottom|threshold|marker
    this.wheelListener=this._handleWheel.bind(this)

    // 绘制调度优化：使用 requestAnimationFrame 避免一帧内多次重绘
    this._drawRafId = null;      // 当前挂起的 raf id
    this._drawPending = false;   // 是否有待执行的绘制
    this._resizeTimer = null;    // resize debounce 定时器
    //========== FPS帧数统计初始化 ==========
    this._fpsTimestamps = [];    // 记录最近1秒内的数据接收时间戳
    this._fpsCurrentValue = 0;   // 当前计算的FPS值
    this._fpsLastCalcTime = 0;   // 上次计算FPS的时间
    this._fpsLastDataSig = null; // DScan模式下data[0].data的上一帧签名
    //=====================================
    this._init();
    // 绑定并保存事件回调引用，以便 destroy() 时正确移除
    this._boundHandleMousedown = this._handleMousedown.bind(this);
    this._boundHandleMouseup = this._handleMouseup.bind(this);
    this._boundHandleMousemove = this._handleMousemove.bind(this);
    this._boundHandleMouseout = this._handleMouseout.bind(this);
    this._boundHandleDblClick = this._handleDblClick.bind(this);
    this._boundHandleClick = this._handleClick.bind(this);
    this._boundHandleContextMenu = this._handleContextMenu.bind(this);
    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleKeyup = this._handleKeyup.bind(this);
    this._boundResizeHandler = debounce(() => {
      this.resizeCanvas();
    }, 200);
    // 节流处理：限制重绘频率（16ms ≈ 60FPS，保证流畅度）
    this._throttledScheduleDraw = throttle(() => this._scheduleDraw(), 16);
    this._throttledHandleZoom = throttle((event, delta) => this._handleZoom(event, delta), 16);

    this.canvas.addEventListener('mousedown', this._boundHandleMousedown);
    this.canvas.addEventListener('mouseup', this._boundHandleMouseup);
    this.canvas.addEventListener('mousemove', this._boundHandleMousemove);
    this.canvas.addEventListener('mouseout', this._boundHandleMouseout);
    this.canvas.addEventListener('wheel', this.wheelListener);
    this.canvas.addEventListener('dblclick', this._boundHandleDblClick);
    this.canvas.addEventListener('click', this._boundHandleClick);
    this.canvas.addEventListener('contextmenu', this._boundHandleContextMenu);
    window.addEventListener('keydown', this._boundHandleKeydown);
    window.addEventListener('keyup', this._boundHandleKeyup);
    // 监听窗口调整大小（添加 debounce，避免拖拽窗口时频繁重绘）
    window.addEventListener('resize', this._boundResizeHandler);
    // 移动端触控事件绑定（passive: false 以允许 preventDefault）
    this._boundHandleTouchStart = this._handleTouchStart.bind(this);
    this._boundHandleTouchMove = this._handleTouchMove.bind(this);
    this._boundHandleTouchEnd = this._handleTouchEnd.bind(this);
    this._boundHandleTouchCancel = this._handleTouchCancel.bind(this);
    this.canvas.addEventListener('touchstart', this._boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._boundHandleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._boundHandleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this._boundHandleTouchCancel, { passive: false });
    //鼠标按下事件
    this.mousedownInfo={
      isMouseDown:false,
      startX:0,
      startY:0,
      mouseupx:0,
      mouseupy:0,
      button:0
    }
    //鼠标移动事件
    this.moveInfo={
      isMove:false,
      preX:0,
      preY:0,
      moveX:0,
      moveY:0
    }
    // 鼠标移动像素级脏检查
    this._lastMouseX = -1;
    this._lastMouseY = -1;
    //选框功能状态
    this._selectionBox={
      active:false,
      pending:false,
      startX:0,
      startY:0,
      currentX:0,
      currentY:0,
      timer:null
    }
    this._suppressClick=false;
    //初始门限滑块
    this._initThreshold();
    //初始化提示框
    this._initFredTip();
    
    //根据配置初始化Marker
    if(this.options.marker?.visible!==false && this.options.marker?.autoAdd!==false){
      const defaultCount=this.options.marker?.defaultCount||0;
      for(let i=0;i<defaultCount;i++){
        this.addMarker(true,i===defaultCount-1);
      }
    }
  }
  
  /**
   * 频率转X坐标
   * @private
   */
  _freqToX(freq){
    if(!this.xLabelGridInfo||this.xLabelGridInfo.length===0)return null;
    
    for(let i=0;i<this.xLabelGridInfo.length;i++){
      const info=this.xLabelGridInfo[i];
      if(freq>=info.show_start_freq && freq<=info.show_end_freq){
        const ratio=(freq-info.show_start_freq)/(info.show_end_freq-info.show_start_freq);
        return this.options.grid.left+info.start_x+ratio*info.width;
      }
    }
    return null;
  }
  
  /**
   * X坐标转频率
   * @private
   */
  _xToFreq(x){
    if(!this.xLabelGridInfo||this.xLabelGridInfo.length===0)return null;
    
    const relativeX=x-this.options.grid.left;
    
    for(let i=0;i<this.xLabelGridInfo.length;i++){
      const info=this.xLabelGridInfo[i];
      if(relativeX>=info.start_x && relativeX<=info.end_x){
        const ratio=(relativeX-info.start_x)/info.width;
        return info.show_start_freq+ratio*(info.show_end_freq-info.show_start_freq);
      }
    }
    return null;
  }

  /**
   * 绘制圆角矩形路径
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {number} x - 左上角X坐标
   * @param {number} y - 左上角Y坐标
   * @param {number} width - 矩形宽度
   * @param {number} height - 矩形高度
   * @param {number} radius - 圆角半径
   * @private
   */
  _drawRoundRect(ctx, x, y, width, height, radius){
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * 绘制信息提示框（通用）
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {Object} config - 配置对象
   * @param {Array<string>} config.lines - 文本行数组
   * @param {string} config.position - 位置枚举 'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'
   * @param {number} config.offsetX - X方向偏移（像素，会被DPR缩放）
   * @param {number} config.offsetY - Y方向偏移（像素，会被DPR缩放）
   * @param {number} config.padding - 内边距（像素，会被DPR缩放）
   * @param {number} config.fontSize - 字体大小（像素，会被DPR缩放）
   * @param {number} config.borderRadius - 圆角半径（像素，会被DPR缩放）
   * @param {string} config.background - 背景色
   * @param {string} config.textColor - 文本颜色
   * @private
   */
  _drawInfoBox(ctx, config) {
    const { lines, position, offsetX, offsetY, padding, fontSize, borderRadius, background, textColor } = config;
    const scaledPadding = padding * this.devicePixelRatio;
    const scaledFontSize = fontSize * this.devicePixelRatio;
    const scaledBorderRadius = borderRadius * this.devicePixelRatio;

    // 计算文本框大小
    const {width: boxWidth, height: boxHeight, lineHeight} = this._measureTextBox(lines, scaledFontSize, scaledPadding);

    // 计算位置
    let boxX, boxY;
    const baseOffsetX = offsetX * this.devicePixelRatio;
    const baseOffsetY = offsetY * this.devicePixelRatio;

    switch (position) {
      case 'top-left':
        boxX = baseOffsetX;
        boxY = baseOffsetY;
        break;
      case "top-center":
        boxX = (this.width - boxWidth) / 2 + baseOffsetX;
        boxY = baseOffsetY;
        break;
      case "top-right":
        boxX = this.width - boxWidth + baseOffsetX;
        boxY = baseOffsetY;
        break;
      case "bottom-left":
        boxX = baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      case "bottom-center":
        boxX = (this.width - boxWidth) / 2 + baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      case "bottom-right":
        boxX = this.width - boxWidth + baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      default:
        boxX = (this.width - boxWidth) / 2;
        boxY = baseOffsetY;
    }

    // 绘制背景
    ctx.save();
    ctx.fillStyle = background;
    this._drawRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, scaledBorderRadius);
    ctx.fill();

    // 绘制文本
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let i = 0; i < lines.length; i++) {
      const textY = boxY + scaledPadding + i * lineHeight;
      ctx.fillText(lines[i], boxX + scaledPadding, textY);
    }

    ctx.restore();
  }

  /**
   * 根据频率查找最近的真实频率索引和对应的真实频率值
   * @param {Object} dataInfo - 数据信息对象
   * @param {number} freq - 目标频率
   * @param {Object} [labelInfo] - 标签网格信息（等间隔计算索引时使用）
   * @returns {Object} {index: 数据索引, realFreq: 真实频率}
   * @private
   */
  /**
   * 测量文本框尺寸
   * @param {Array<string>} lines - 文本行数组
   * @param {number} fontSize - 字体大小（已缩放DPR）
   * @param {number} padding - 内边距（已缩放DPR）
   * @returns {Object} {width, height, lineHeight}
   * @private
   */
  _measureTextBox(lines, fontSize, padding){
    this.ctx.font = `${fontSize}px Arial`;
    let maxWidth = 0;
    for(const line of lines){
      const metrics = this.ctx.measureText(line);
      if(metrics.width > maxWidth) maxWidth = metrics.width;
    }
    const lineHeight = fontSize * 1.4;
    return {
      width: maxWidth + padding * 2,
      height: lines.length * lineHeight + padding * 2,
      lineHeight
    };
  }

  /**
   * 边界约束：将box限制在指定矩形范围内
   * @param {Object} box - 待约束的矩形 {x, y, width, height}
   * @param {Object} container - 容器矩形 {x, y, width, height}
   * @param {number} margin - 边距
   * @returns {Object} 约束后的矩形
   * @private
   */
  _clampBoxPosition(box, container, margin = 10){
    let x = box.x;
    let y = box.y;
    const containerRight = container.x + container.width;
    const containerBottom = container.y + container.height;
    
    // 右侧超出
    if (x + box.width > containerRight - margin) {
      x = containerRight - margin - box.width;
    }
    // 下方超出
    if (y + box.height > containerBottom - margin) {
      y = containerBottom - margin - box.height;
    }
    // 左侧超出
    if (x < container.x + margin) {
      x = container.x + margin;
    }
    // 上方超出
    if (y < container.y + margin) {
      y = container.y + margin;
    }
    return { x, y, width: box.width, height: box.height };
  }

  /**
   * 触发X轴范围变化回调
   * @param {string} type - 'zoom' | 'pan'
   * @param {string} source - 'wheel' | 'drag' | 'touch'
   * @param {number} order - 多段索引
   * @param {number} [startFreqOverride] - 强制使用的起始频率
   * @param {number} [endFreqOverride] - 强制使用的结束频率
   * @private
   */
  _triggerXRangeChange(type, source, order, startFreqOverride, endFreqOverride) {
    if (typeof this.options.xaxis.onXRangeChange !== 'function') return;
    const labelInfo = this.xLabelGridInfo[order];
    if (!labelInfo) return;
    const startFreq = startFreqOverride !== undefined ? startFreqOverride : labelInfo.show_start_freq;
    const endFreq = endFreqOverride !== undefined ? endFreqOverride : labelInfo.show_end_freq;
    const span = endFreq - startFreq;
    this.options.xaxis.onXRangeChange({
      type,                           // 操作类型: 'zoom'(缩放) | 'pan'(平移)
      source,                         // 触发来源: 'wheel'(滚轮) | 'drag'(拖动) | 'touch'(触控)
      order,                          // 多段索引(DScan多段场景)
      startFreq,                      // 当前显示起始频率(Hz)
      endFreq,                        // 当前显示结束频率(Hz)
      centerFreq: startFreq + Math.floor(span / 2),  // 中心频率(Hz)
      span,                           // 当前显示带宽/显宽(Hz)
      drawZoom: labelInfo.draw_zoom || 1,             // 当前缩放倍数
      startX: labelInfo.start_x,     // 段起始像素坐标
      endX: labelInfo.end_x,         // 段结束像素坐标
      bandStartFreq: labelInfo.start_freq,  // 原始频段起始频率(Hz)
      bandEndFreq: labelInfo.end_freq       // 原始频段结束频率(Hz)
    });
  }

  /**
   * 触发Y轴范围变化回调
   * @param {string} type - 'zoom' | 'pan'
   * @param {string} source - 'wheel' | 'drag' | 'touch'
   * @private
   */
  _triggerYRangeChange(type, source) {
    if (typeof this.options.yaxis.onYRangeChange !== 'function') return;
    const minValue = this.options.yaxis.min_value;
    const maxValue = this.options.yaxis.max_value;
    const span = maxValue - minValue;
    this.options.yaxis.onYRangeChange({
      type,                           // 操作类型: 'zoom'(缩放) | 'pan'(平移)
      source,                         // 触发来源: 'wheel'(滚轮) | 'drag'(拖动) | 'touch'(触控)
      minValue,                       // 当前Y轴最小值
      maxValue,                       // 当前Y轴最大值
      centerValue: minValue + span / 2,  // 中心值
      span,                           // 范围跨度
      zoomLevel: this.yZoom          // 当前缩放级别
    });
  }

  _findNearestFreqIndex(dataInfo, freq, labelInfo){
    if(dataInfo._freqs && dataInfo._freqs.length > 0){
      const arr = dataInfo._freqs;
      // 边界处理
      if (freq <= arr[0]) return { index: 0, realFreq: arr[0] };
      if (freq >= arr[arr.length - 1]) return { index: arr.length - 1, realFreq: arr[arr.length - 1] };
      let left = 0, right = arr.length - 1;
      // 二分查找确定目标频率所在区间
      while (left < right) {
        const mid = (left + right) >> 1;
        if (arr[mid] < freq) left = mid + 1;
        else right = mid;
      }
      // 比较左右邻近点，返回最近的索引
      let nearestIdx = left;
      if (left > 0 && Math.abs(arr[left - 1] - freq) <= Math.abs(arr[left] - freq)) {
        nearestIdx = left - 1;
      }
      return { index: nearestIdx, realFreq: arr[nearestIdx] };
    }
    // 没有真实频率时，基于等间隔计算索引
    let startFreq = labelInfo ? labelInfo.start_freq : dataInfo.start_freq;
    let endFreq = labelInfo ? labelInfo.end_freq : dataInfo.end_freq;
    const ratio = (freq - startFreq) / (endFreq - startFreq);
    const index = Math.round(ratio * (dataInfo.data.length - 1));
    return { index: index, realFreq: freq };
  }

  /**
   * 绘制选框
   * @private
   */
  _drawSelectionBox() {
    if (!this._selectionBox.active) return;
    const sb = this.options.selectionBox;
    const ctx = this.ctx;
    const grid = this.options.grid;
    const startX = this._selectionBox.startX;
    const startY = this._selectionBox.startY;
    const currentX = this._selectionBox.currentX;
    const currentY = this._selectionBox.currentY;

    // 限制在网格绘制区域内
    const minX = Math.max(grid.left, Math.min(startX, currentX));
    const maxX = Math.min(this.width - grid.right, Math.max(startX, currentX));
    const minY = Math.max(grid.top, Math.min(startY, currentY));
    const maxY = Math.min(this.height - grid.bottom, Math.max(startY, currentY));

    const width = maxX - minX;
    const height = maxY - minY;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.fillStyle = sb?.fillStyle || 'rgba(0, 212, 255, 0.15)';
    ctx.strokeStyle = sb?.strokeStyle || '#00d4ff';
    ctx.lineWidth = sb?.lineWidth || 1;
    ctx.fillRect(minX, minY, width, height);
    ctx.strokeRect(minX, minY, width, height);
    ctx.restore();
  }

  /**
   * 结束选框并触发回调
   * @private
   */
  _endSelectionBox(event) {
    const sb = this.options.selectionBox;
    const startX = this._selectionBox.startX;
    const startY = this._selectionBox.startY;
    const currentX = this._selectionBox.currentX;
    const currentY = this._selectionBox.currentY;

    // 清理状态
    clearTimeout(this._selectionBox.timer);
    this._selectionBox.timer = null;
    this._selectionBox.active = false;
    this._selectionBox.pending = false;

    // 限制在网格绘制区域内计算频率
    const grid = this.options.grid;
    const minX = Math.max(grid.left, Math.min(startX, currentX));
    const maxX = Math.min(this.width - grid.right, Math.max(startX, currentX));
    const minW = sb?.minWidth || 5;
    if (maxX - minX < minW) {
      this._scheduleDraw();
      return;
    }

    const rawStartFreq = this._xToFreq(minX);
    const rawEndFreq = this._xToFreq(maxX);
    if (rawStartFreq === null || rawEndFreq === null) {
      this._scheduleDraw();
      return;
    }

    const startFreq = Math.round(rawStartFreq);
    const endFreq = Math.round(rawEndFreq);
    const centerFreq = Math.round((startFreq + endFreq) / 2);
    const bandwidth = Math.abs(endFreq - startFreq);

    this._scheduleDraw();

    if (typeof sb?.onSelect === 'function') {
      sb.onSelect({
        startFreq,
        endFreq,
        centerFreq,
        bandwidth,
        span: bandwidth,
        startX: minX,
        endX: maxX,
        startY,
        endY:currentY,
        centerY: (startY + currentY) / 2
      },event);
    }
  }

  /**
   * 更新Marker场景矩形
   * @private
   */
  _updateMarkerSceneRect(){
    const sceneRect={
      x:this.options.grid.left,
      y:this.options.grid.top,
      width:this.chartWidth,
      height:this.chartHeight
    };
    
    this._markerList.forEach(marker=>{
      marker.setRect(sceneRect);
    });
  }

  /**
   * 更新 Marker 数据
   * @private
   */
  _updateMarkerData(marker){
    const pt=marker.markerPt();
    const freq=this._xToFreq(pt.x);
    
    if(freq===null)return;
    
    const traceLevels=[];
    let targetY=null;
    let targetTraceIndex = -1;  // 目标谱线索引
    let realFreqValue = freq;   // 跟踪真实频率
    
    // 获取 Marker 跟随的谱线 ID
    const followTraceId = marker.getTraceId() || 0;
    
    // 遍历所有谱线，收集数据
    for(let i=0;i<this.tracesData.length;i++){
      const trace=this.tracesData[i];
      if(!trace.visible||!trace.datainfo)continue;
      
      for(let j=0;j<this.xLabelGridInfo.length;j++){
        const info=this.xLabelGridInfo[j];
        if(freq<info.show_start_freq||freq>info.show_end_freq)continue;
        
        const dataInfo=trace.datainfo[j];
        if(!dataInfo||!dataInfo.data)continue;
        
        // 优先使用真实频率
        let realFreq = freq;
        let index;
        const nearestResult = this._findNearestFreqIndex(dataInfo, freq, info);
        index = nearestResult.index;
        realFreq = nearestResult.realFreq;
        realFreqValue = realFreq;
        
        if(index>=0&&index<dataInfo.data.length){
          const level=dataInfo.data[index];
          const traceInfo = {
            name:trace.name||`谱线${i+1}`,
            level:level,
            unit:this.options.yaxis.unit||'dBμV',
            traceId: trace.id,
            originalIndex: i  // 原始索引
          };
          
          // 如果是指定谱线，记录为目标谱线
          if(followTraceId > 0 && trace.id === followTraceId){
            targetTraceIndex = traceLevels.length;
          }
          
          traceLevels.push(traceInfo);
          
          // 计算谱线 Y 轴坐标（只使用目标谱线或第一条谱线）
          if(targetY===null && marker.isFollowTraceY()){
            // 如果指定了谱线 ID，只在遍历到目标谱线时计算 Y 坐标
            // 如果没有指定，则使用第一条谱线
            if(followTraceId === 0 || trace.id === followTraceId){
              const yPixel=this.height - this.options.grid.bottom - ((level - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
              targetY=yPixel+marker.getTraceYOffset();
            }
          }
        }
      }
    }
    
    marker.setFrequency(realFreqValue);
    
    //构建标牌文本
    const scutchonList=[];
    const freqMHz=(realFreqValue/1000000).toFixed(6);
    scutchonList.push([{text:`频率：${freqMHz} MHz`,format:''}]);
    
    // 如果有目标谱线，将其移到最前面
    if(targetTraceIndex >= 0 && targetTraceIndex < traceLevels.length){
      const targetTrace = traceLevels[targetTraceIndex];
      // 将目标谱线移到数组第一位
      traceLevels.unshift(traceLevels.splice(targetTraceIndex, 1)[0]);
    }
    
    // 构建标牌内容
    traceLevels.forEach((trace,index)=>{
      const levelText=trace.level!==undefined?trace.level.toFixed(2):'--';
      const lineText = `${trace.name}: ${levelText} ${trace.unit}`;
      
      scutchonList.push([{
        text:lineText,
        format:''
      }]);
    });
    
    marker.setScutchonList(scutchonList);
    
    // 如果跟随谱线 Y 轴位置，更新 Marker 的 Y 坐标
    if(targetY!==null && marker.isFollowTraceY()){
      const currentPt=marker.markerPt();
      if(currentPt.y!==targetY){
        marker.setMarkerPt({x:currentPt.x,y:targetY});
      }
    }
  }

  
  /**
   * 绘制Markers
   * @private
   */
  _drawMarkers(){
    if(this.options.marker?.visible===false)return;
    
    this._updateMarkerSceneRect();
    
    //更新所有Marker数据
    this._markerList.forEach(marker=>{
      if(marker.isVisible()){
        this._updateMarkerData(marker);
      }
    });
    
    const dpiPair={x:96*this.devicePixelRatio,y:96*this.devicePixelRatio};
    const fontPixelPair={min:10,max:16};
    
    // 将 Marker 分为两组：无焦点的和有焦点的
    const markersWithoutFocus = [];
    let focusedMarker = null;

    //先绘制所有Marker的线
    this._markerList.forEach(marker=>{
      if(marker.isVisible()){
        if(marker.hasFocus()){
          focusedMarker = marker;
        }else{
          markersWithoutFocus.push(marker);
        }
      }
    });
    
    // 1. 先绘制所有无焦点 Marker 的线
    markersWithoutFocus.forEach(marker=>{
      marker.paintLine(this.ctx);
    });
    
    // 2. 绘制有焦点 Marker 的线（如果存在）
    if(focusedMarker){
      focusedMarker.paintLine(this.ctx);
    }
    
    // 3. 再绘制所有无焦点 Marker 的图标和标牌
    markersWithoutFocus.forEach(marker=>{
      marker.paint(this.ctx,dpiPair,fontPixelPair,false);
    });
    
    // 4. 最后绘制有焦点 Marker 的图标和标牌（确保在最上层）
    if(focusedMarker){
      focusedMarker.paint(this.ctx,dpiPair,fontPixelPair,true);
    }
  }
  
  /**
   * 处理Marker点击
   * @private
   */
  _handleMarkerClick(point){
    const dpiPair={x:96*this.devicePixelRatio,y:96*this.devicePixelRatio};
    
     // 优先检查有焦点的 Marker（如果在重叠区域，优先选中上层的）
    if(this._focusMarkerId > 0){
      const focusedMarker = this._markerList.get(this._focusMarkerId);
      if(focusedMarker && focusedMarker.isVisible() && focusedMarker.containsPoint(point,dpiPair)){
        return true; // 已经点击了有焦点的 Marker，不需要改变
      }
    }
    
    // 然后检查其他 Marker
    for(const [id,marker] of this._markerList){
      if(id === this._focusMarkerId)continue; // 跳过已检查的焦点 Marker
      if(marker.isVisible() && marker.containsPoint(point,dpiPair)){
        this.setMarkerFocus(id);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 移动焦点 Marker 到指定点
   * @private
   */
  _moveFocusMarkerToPoint(point){
    const focusId=this._focusMarkerId;
    if(focusId===0)return;
    
    const marker=this._markerList.get(focusId);
    if(!marker)return;
    
    const clampedX=Math.max(this.options.grid.left,Math.min(this.width-this.options.grid.right,point.x));
    const clampedY=Math.max(this.options.grid.top,Math.min(this.height-this.options.grid.bottom,point.y));
    
    marker.setMarkerPt({x:clampedX,y:clampedY});
    marker.setScutchonAnchor({x:clampedX,y:clampedY});
    this._updateMarkerData(marker);

    this._draw();
  }

  /**
   * 更新所有 Marker 的位置（当频率范围改变时调用）
   * @private
   */
  _updateMarkersPositionByFreq(){
    this._markerList.forEach(marker=>{
      if(!marker.isVisible())return;
      
      const freq=marker.getFrequency();
      if(freq<=0)return;
      
      // 根据频率重新计算 X 坐标
      const newX=this._freqToX(freq);
      if(newX===null)return;
      
      const currentPt=marker.markerPt();
      let newY=currentPt.y;
      
      // 如果跟随谱线 Y 轴位置，重新计算 Y 坐标
      if(marker.isFollowTraceY()){
        const traceLevels=[];
        for(let i=0;i<this.tracesData.length;i++){
          const trace=this.tracesData[i];
          if(!trace.visible||!trace.datainfo)continue;
          
          for(let j=0;j<this.xLabelGridInfo.length;j++){
            const info=this.xLabelGridInfo[j];
            if(freq<info.show_start_freq||freq>info.show_end_freq)continue;
            
            const dataInfo=trace.datainfo[j];
            if(!dataInfo||!dataInfo.data)continue;
            
            const ratio=(freq-info.start_freq)/(info.end_freq-info.start_freq);
            const index=Math.round(ratio*(dataInfo.data.length-1));
            
            if(index>=0&&index<dataInfo.data.length){
              const level=dataInfo.data[index];
              newY=this.height - this.options.grid.bottom - ((level - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
              newY+=marker.getTraceYOffset();
              break;
            }
          }
          if(newY!==currentPt.y)break;
        }
      }
      
      // 限制 Y 轴范围
      newY=Math.max(this.options.grid.top,Math.min(this.height-this.options.grid.bottom,newY));
      
      if(newX!==currentPt.x || newY!==currentPt.y){
        marker.setMarkerPt({x:newX,y:newY});
        marker.setScutchonAnchor({x:newX,y:newY});
        this._updateMarkerData(marker);
      }
    });
  }
  
  /**
   * 设置图表大小
   */
  setCanvasSize(widths, heights) {
    const width = widths||this.options.width;
    const height = heights||this.options.height;
    const containerWidth = this.box.clientWidth||200;
    const containerHeight = this.box.clientHeight||160;
    if(width === "100%"&&this.box.clientWidth===0){
      console.error("setCanvasSize图表宽度失败width is 100%,but containerWidth is 0")
      return;
    }
    // 使用实际像素大小设置 Canvas
    this.canvas.width = width === "100%" ? containerWidth : width;
    this.canvas.height = height === "100%" ? containerHeight: height;

    // 设置 CSS 样式，确保 Canvas 在视觉上保持相应比例
    console.warn("setCanvasSize",width === "100%" ? `containerWidth==${containerWidth}px` : `pptions==${width}px`,"this.canvas.width:"+this.canvas.width);
    this.canvas.style.width = width === "100%" ? `${containerWidth}px` : `${width}px`;
    this.canvas.style.height = height === "100%" ? `${containerHeight}px`: `${height}px`;
    this.width =this.canvas.width;
    this.height =this.canvas.height;
  }
  
  /**
   * 初始化配置
   * @param {*} options
   * @memberof sptmChart
   */
  _initOptions(options) {
    let defaultOptions = {
      "type": "FFT",//图表类型 "FFT" "DScan"
      "duration": 50,//一帧持续时间
      "width": 400,//画布宽度
      "height": 300,//画布背景
      "background": "#CCCCCC",//背景色
      "center_freq": "",//中心频率
      "span": "",//显宽
      "is_drag_zoom": true,//是否拖拽缩放
      "grid":{//网格样式
        "left": 50,//左边距
        "top": 40,//上边距
        "bottom": 50,//下边距
        "right": 40,//右边距
        "color": "#B7B7B7",//网格线颜色
        "background":"transparent",//网格背景色
        "width": 1,//网格线宽度
        "xgrid_show": true,//是否显示 X 轴网格线
        "xgrid_line_dash":[],//X 轴网格线虚线样式 [5, 5] 实，虚
        "ygrid_show": true,//是否显示 Y 轴网格线
        "ygrid_line_dash":[],//Y 轴网格线虚线样式
        "center_line_show": false,//是否显示中心线
        "center_color": "#FF0000",//X 轴中心线颜色
        "center_width": 1 //X 轴中心线宽度
      },
      "legend":{
        "visible": false,//是否显示图例
      },
      "xaxis":{ //X 轴样式
        "number": 5,//X 轴网格线数量
        "unit":"",//单位 MHz 为空不显示 
        "unit_two_line": true, // x 轴单位是否需要换行
        "unit_right": 10, // x 轴单位距离图表左侧距离
        "decimals": "",//X 轴刻度标签小数位数
        "dscan_freq":[//DScan 模式下的频率范围 [起始频率，结束频率] 传入多个范围时，则分段显示
        ],
        "dscan_space": 10,//DScan 模式下的频段间隔像素
        "text_color": "#343434",//X 轴文本颜色
        "text_font_size": 12,//X 轴文本字体大小
        "text_font_family": "Arial",//X 轴文本字体
        "color": "#333",//X 轴线颜色
        "width": 1,//X 轴线宽度
        "labels":[//*X 轴刻度标签
        ],
        "label_two_line": true, // Dscan 模式下分段数据第一个是否需要换行 
        "label_angle":0,//*X 轴刻度标签角度
        "draw_zoom_freq":"",//*X 轴绘制缩放基准频率
        "draw_zoom_span":"",//*X 轴绘制缩放基准显宽
        "onXRangeChange": null,         // X轴范围变化回调 function({type, source, order, startFreq, endFreq, centerFreq, span, drawZoom, startX, endX})
      
      },
      "yaxis":{ //Y 轴样式
        "number": 5,//Y 轴网格线数量
        "unit":"",//单位 dBμV dBm dBμV/m 为空不显示 
        "decimals": "",//X 轴刻度标签小数位数
        "fixedStep": 20,//Y 轴刻度值间隔
        "init_min_value": -30,//*Y 轴最小值
        "init_max_value": 60,//*Y 轴最大值
        "min_value": -30,//Y 轴最小值
        "max_value": 60,//Y 轴最大值
        "floor_value": -60,//Y 轴最小值范围
        "ceiling_value": 140,//Y 轴最大值范围
        "text_color": "#343434",//Y 轴文本颜色
        "text_font_size": 12,//Y 轴文本字体大小
        "text_font_family": "Arial",//Y 轴文本字体
        "color": "#333",//Y 轴线颜色
        "width": 1,//Y 轴线宽度
        "axis_function":function(value){
          return value
        },//Y 轴刻度值计算函数
        "onYRangeChange": null,          // Y轴范围变化回调 function({type, source, minValue, maxValue, centerValue, span, zoomLevel})
        "zoom_value": "",//*Y 轴缩放基准值
        "labels":[],//*Y 轴刻度标签
      },
      "marker":{ //Marker 样式 - 新增
        "visible": true,//是否显示 marker
        "autoAdd": true,//是否自动添加默认 marker 否则按照谱线id 添加
        "defaultCount": 1,//默认添加数量
        "maxCount": 10,//最大 marker 数量
        "shape": 0,//形状 0-常规 1-倒置
        "verticalLine": true,//是否显示垂直线
        "crossLine": false,//是否显示十字线
        "scutchonVisible": true,//是否显示标牌
        "colorGroup":{//颜色配置
          "activeForeground": "#239ee7",//Marker激活时前景色
          "inactiveForeground": "#535353",//Marker非激活时前景色
          "noFocusBackground": "#bfbfbf",//Marker未获得焦点时背景色
          "focusBackground": "#ff9800",//Marker获得焦点时背景色
          "crossBorderText": "#ff0000",//Marker边界文字颜色
          "lineColor": "#9e9e9e",//Marker线条颜色
          "scutchonBackground": "rgba(49, 52, 69, 0.9)",//标牌背景色
          "scutchonForeground": "#ffffff"//标牌文字颜色
        },
        "clickBlankToExit": true  // 点击空白区域退出焦点
      },
      "contextMenu":{ //全局右键菜单配置 - 新增
        "enabled": true,//是否启用右键菜单
        "actions":[],//右键菜单动作列表
      //"exitFocus","getPosition"'exitFocus',
      // {
      //   type: 'getPosition',
      //   label: '查看位置',
      //   handler: (positionInfo, event, context) => {
      //     // 自定义处理逻辑
      //     console.log('自定义位置处理:', positionInfo);
      //     showCustomTooltip(positionInfo);
      //   }
      // },
      // {
      //   type: 'custom',
      //   label: '重置视图',
      //   handler: (event, context) => {
      //     context.chart.setFFTCenterFreAndSpan(100000000, 50000000);
      //     context.chart.drawChart();
      //   }
      // }
        "onCustomAction": null,//自定义动作回调
        "onGetPosition": null//自定义菜单位置回调
      },
      "centerinfo":{ //中心频率信息框 - 新增
        "visible": false,//是否显示信息框
        "position": "top-center",//位置：top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
        "offsetX": 0,//X 方向偏移量
        "offsetY": 0,//Y 方向偏移量
        "background": "rgba(0, 0, 0, 0.7)",//背景颜色
        "text_color": "#FFFFFF",//文本颜色
        "font_size": 12,//字体大小
        "padding": 8,//内边距
        "border_radius": 4,//圆角半径
        "show_center_freq": true,//显示中心频率
        "show_current_freq": true,//显示当前频率（Marker 频率）
        "show_level": true,//显示当前强度
      },
      "fps":{ //帧数统计信息框 - 新增
        "visible": false,//是否显示帧数统计
        "position": "top-right",//位置：top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
        "offsetX": 0,//X 方向偏移量
        "offsetY": 0,//Y 方向偏移量
        "background": "rgba(0, 0, 0, 0.7)",//背景颜色
        "text_color": "#00FF00",//文本颜色
        "font_size": 12,//字体大小
        "padding": 4,//内边距
        "border_radius": 2,//圆角半径
      },
      "threshold":{ //门限样式
        "visible": false,//是否显示门限
        "is_darg":true,//是否可以拖拽门限
        "is_mouse":false,//是否移动中
        "level": 30,//门限强度值 dbuv
        "decimals": 2,//门限值小数位数
        "color": "#19A9EB",//门限线颜色
        "width": 1,//门限线宽度
        "drag_color": "#3FFDB1",//拖拽门限线颜色
        "drag_width": 1,//拖拽门限线宽度
        "text_color": "#333",//门限文本颜色
        "text_font_size":12,//门限文本字体大小
        "drag_text_color": "#3FFDB1",//拖拽门限文本颜色
        "drag_text_font_size": 14,//拖拽门限文本字体大小
        "icon_url":"",//门限图标
        "drag_icon_url":"",//拖拽门限图标
        "icon_size": [30,20],//门限图标大小
      },
      "sptm_area":{ //FFT 频谱区域
        "visible": false,//频谱是否显示区域
        "background": "ragb(0,0,0,0.5)",//频谱区域背景色
        "drag_background": "ragb(0,0,0,0.5)",//拖拽频谱区域背景色
        "start_freq": 0,//频谱区域起始频率
        "end_freq": 0,//频谱区域结束频率
      },
      "level_tipline":{//移动鼠标频谱值提示
        "visible": false,//是否显示频谱值
        "freq_visible":false,//是否显示频谱值频率
        "color": "#00afff",//谱值提示线颜色
        "width": 1,//谱值提示线宽度
        "text_color": "#333",//谱值提示文本颜色
        "text_size": 12,//谱值提示文本字体大小
        "is_draw":false,//*是否绘制鼠标在网格区域内，有数据值
        "point": {//*鼠标所在 x 轴坐标
          "pointx": 0,//鼠标所在 x 轴坐标
          "pointy": 0,//鼠标所在 y 轴坐标
        },
        "tip_background": "rgba(0, 0, 0, 0.7)",//提示框背景色
        "tip_text_color": "#ffffff",//提示框文本颜色
        "tip_font_size": 12,//提示框字体大小
        "tip_padding": 8,//提示框内边距
        "tip_border_radius": 4,//提示框圆角半径
      },
      // 图表绘制类型：'line'（默认，传统线图）| 'waterfall'（瀑布图）
      "chart_type": "line",
      // 瀑布图配置（仅 chart_type='waterfall' 时生效）
      "waterfall": {
        "max_rows": 100,               // 最大存储数据条数，默认 100
        "time_interval": 5,            // 当前时间刻度间隔（秒）
        "time_interval_min": 1,        // 时间刻度最小间隔（秒）
        "time_interval_max": 5,        // 时间刻度最大间隔（秒）
        "color_min": -30,              // 色系对应的强度最小值
        "color_max": 60,               // 色系对应的强度最大值
        "colormap": "jet",             // 色系类型，暂时只支持 'jet'
        "draggable": false,            // 色系条是否可拖拽调整范围
        "color_wheel_enabled": true,   // 色系条滚轮是否启用
        "time_wheel_enabled": true,    // 时间轴滚轮是否启用
        "use_image_data": true,        // 是否使用 ImageData 高性能绘制（true 推荐，false 回退 fillRect）
        // 行高计算模式：
        //   'fill'  - 动态模式（默认）：让 max_rows 帧始终铺满图表高度，Y轴刻度对应实际时间
        //   'time'  - 固定时间模式：每秒对应 px_per_second 像素，行高由帧间隔决定
        "row_height_mode": "fill",
        "px_per_second": 50,           // row_height_mode='time' 时每秒对应的像素高度
        // fill 模式下行高像素限制（防止初始帧少时行高/时间刻度间隔过大）
        "row_height_min": 0.1,         // 行高最小值（px），默认 0.1
        "row_height_max": 10,          // 行高最大值（px），默认 10
        "process_first_only": true,    // pushRow 是否只处理第一条数据（向后兼容）
        "time_axis_visible": true,     // 是否显示 Y 轴时间标线和标签
        "time_format": "mm:ss",        // 时间格式：'mm:ss' | 'HH:mm:ss' | 'ss'
        "time_label_interval": 1,      // Y 轴时间标签显示间隔（秒），默认1秒
      },
      "selectionBox": {                // 选框功能配置 - 新增
        "enabled": false,              // 是否启用选框功能
        "fillStyle": "rgba(0, 212, 255, 0.15)", // 选框填充色
        "strokeStyle": "#00d4ff",      // 选框边框色
        "lineWidth": 1,                // 选框边框宽度
        "minWidth": 5,                 // 触发选框的最小宽度（像素）
        "longPressDelay": 200,         // 长按触发选框的延迟（毫秒）
        "onSelect": null               // 选框结束回调 function({startFreq, endFreq, centerFreq, bandwidth, startX, endX})
      },
    }
    const mergedOptions = deepMerge({}, defaultOptions);
    this.options = deepMerge(mergedOptions,options);
    //初始化参数和 DPR 计算
    this.options.grid.left=Math.floor(this.options.grid.left*this.devicePixelRatio);
    this.options.grid.bottom=Math.floor(this.options.grid.bottom*this.devicePixelRatio);
    this.options.grid.top=Math.floor(this.options.grid.top*this.devicePixelRatio);
    this.options.grid.right=Math.floor(this.options.grid.right*this.devicePixelRatio);
    this.options.yaxis.init_min_value=this.options.yaxis.min_value
    this.options.yaxis.init_max_value=this.options.yaxis.max_value
    this.yLabelGridInfo={}//y 轴标签网格信息
    this.xLabelGridInfo=[]//x 轴标签网格信息
    
    this.options.yaxis.fixedStep=(this.options.yaxis.ceiling_value-this.options.yaxis.floor_value)/(this.options.yaxis.number-1)
    if(this.ceiling_value&&this.ceiling_value!==this.options.yaxis.ceiling_value){
      console.warn("图表y轴最大值已改变，请重新设置图表数据",this.options.yaxis.ceiling_value,this.ceiling_value)
    }
    this.ceiling_value=this.options.yaxis.ceiling_value;
    console.warn("图表y轴最大值：",this.ceiling_value)
  }

  
  _init(){
    this._clearCanvas();
    this._initBackground();
    this._drawAxis();
    this._drawGrid();
  }
  
  /*
   *初始化门限div
  */
  _initThreshold(){
    const thresholdDiv = document.createElement('div');
    thresholdDiv.className = 'sptmchart_threshold';
    thresholdDiv.style.position = 'absolute';
    thresholdDiv.style.width = `${this.options.threshold.icon_size[0]*this.devicePixelRatio}px`;
    thresholdDiv.style.height = `${this.options.threshold.icon_size[1]*this.devicePixelRatio}px`;
    thresholdDiv.style.backgroundImage = `url(${this.options.threshold.icon_url})`;
    thresholdDiv.style.backgroundSize = '100% 100%';
    let iconLeft=this.options.grid.left-this.options.threshold.icon_size[0]*this.devicePixelRatio;
    thresholdDiv.style.left = `${iconLeft}px`;
    thresholdDiv.style.display = 'none';
    this.canvas.parentNode.appendChild(thresholdDiv);
    this.thresholdDiv = thresholdDiv;
    this._boundHandleThresholdMousedown = this._handleThresholdMousedown.bind(this);
    this._boundHandleThresholdMousemove = this._handleThresholdMousemove.bind(this);
    this._boundHandleThresholdMouseout = this._handleThresholdMouseout.bind(this);
    this.thresholdDiv.addEventListener('mousedown', this._boundHandleThresholdMousedown);
    this.thresholdDiv.addEventListener('mousemove', this._boundHandleThresholdMousemove);
    this.thresholdDiv.addEventListener('mouseout', this._boundHandleThresholdMouseout);
    this.thresholdDiv.addEventListener('mouseup', this._boundHandleThresholdMouseout);
    // 移动端触控支持：门限图标
    this._boundHandleThresholdTouchStart = this._handleThresholdTouchStart.bind(this);
    this._boundHandleThresholdTouchMove = this._handleThresholdTouchMove.bind(this);
    this._boundHandleThresholdTouchEnd = this._handleThresholdTouchEnd.bind(this);
    this.thresholdDiv.addEventListener('touchstart', this._boundHandleThresholdTouchStart, { passive: false });
    this.thresholdDiv.addEventListener('touchmove', this._boundHandleThresholdTouchMove, { passive: false });
    this.thresholdDiv.addEventListener('touchend', this._boundHandleThresholdTouchEnd, { passive: false });
  }
  
  _initFredTip(){
    // 提示框已改为Canvas绘制，不再创建DOM元素
    this.fretipDiv = null;
  }
  
  /**
   *清空画布
   */
  _clearCanvas(){
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
  
  /**
   * 初始化背景
   */
  _initBackground(){
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  /**
   * 初始化图表
   */
  _drawAxis(){
    //计算x轴y轴坐标
    this._computeLabels();
    // 绘制x轴
    this.ctx.strokeStyle = this.options.xaxis.color;
    this.ctx.lineWidth = this.options.xaxis.width||1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.options.grid.left, this.height - this.options.grid.bottom);
    this.ctx.lineTo(this.width - this.options.grid.right, this.height - this.options.grid.bottom);
    this.ctx.stroke();

    // 绘制x轴标签
    this.ctx.fillStyle = this.options.xaxis.text_color; 
    this.ctx.textBaseline = 'top';
    this.ctx.font = `${this.options.xaxis.text_font_size*this.devicePixelRatio}px ${this.options.xaxis.text_font_family}`;
    
    this.options.xaxis.labels.forEach((data, index) => {
      for (let j = 0; j < data.length; j++) {
        const items = data[j];
        const texts = truncateNumber(items.text, this.options.xaxis.decimals);
        let angleInRadians = this.options.xaxis.label_angle * Math.PI / 180;

        var x = this.options.grid.left + items.offsetx ;
        var y = this.height - this.options.grid.bottom + 8;

        if (this.options.xaxis.label_two_line) {
          this.ctx.textAlign = 'center';
          if (index > 0 && j == 0) {
            y = this.height - this.options.grid.bottom + this.options.grid.bottom / 2;
          }
          this.ctx.fillText(texts, x, y);
        } else {
          if (this.options.xaxis.label_angle > 0) {
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angleInRadians);
            this.ctx.fillText(texts, 0, 0);
            this.ctx.restore();
          } else {
            this.ctx.textAlign = 'center';
            let halfWidth = this.ctx.measureText(texts).width / 2

            if (j === data.length - 1 && index < this.options.xaxis.labels.length - 1) {
              x = this.options.grid.left + items.offsetx - halfWidth;
            }
            if (index > 0 && j == 0) {
              x = this.options.grid.left + items.offsetx + halfWidth;
            }
            this.ctx.fillText(texts, x, y);
          }
        } 
      }
    });

    //绘制X轴单位
    if(this.options.xaxis.unit!==""){
      if(this.options.xaxis.unit_two_line){
        this.ctx.fillText(this.options.xaxis.unit, this.width-this.options.grid.right-4, this.height - this.options.grid.bottom + this.options.grid.bottom/2);
      }else{
        this.ctx.fillText(this.options.xaxis.unit, this.width-this.options.grid.right+this.options.xaxis.unit_right, this.height - this.options.grid.bottom + 8);
      }
    }
    
    // 绘制y轴
    this.ctx.strokeStyle = this.options.yaxis.color;
    this.ctx.lineWidth = this.options.yaxis.width||1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.options.grid.left, this.options.grid.top);
    this.ctx.lineTo(this.options.grid.left, this.height - this.options.grid.bottom);
    this.ctx.stroke();

    // 绘制y轴标签（瀑布图模式由 Waterfall 模块绘制时间轴，这里跳过）
    if (this.options.chart_type !== 'waterfall') {
      this.ctx.fillStyle = this.options.yaxis.text_color||'#343434';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${this.options.yaxis.text_font_size*this.devicePixelRatio}px ${this.options.yaxis.text_font_family}`;
      this.options.yaxis.labels.forEach((label, index) => {
        const y = this.height - this.options.grid.bottom - label.offsetY;
        const centtext=this.options.yaxis.axis_function(label.text)
        const texts=truncateNumber(centtext,this.options.yaxis.decimals);
        this.ctx.fillText(texts, this.options.grid.left - 5, y);
      });
      
      //绘制Y轴单位
      if(this.options.yaxis.unit!==""){
        this.ctx.fillText(this.options.yaxis.unit, this.options.grid.left - 5, this.options.grid.top/2);
      }
    }
  }
  
  /**
   * 绘制图例
   */
  _drawLegend() {
    const { grid, legend } = this.options;
    if(!legend.visible)return false;
    
    const legendItems = this.tracesData.map((data, index) => {
        if(data.visible){
          const label = data.name || `数据 ${index + 1}`;
          const color=data.color;
          const width = this.ctx.measureText(label).width + 20;
          return { label, width ,color};
        }
    }).filter(item=>item);

    const totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width + 15, 0)-20;
    const legendX = (this.width - totalLegendWidth) / 2;
    const legendY = grid.top/2;

    let currentX = legendX;
    legendItems.forEach((item, index) => {
        this.ctx.fillStyle = item.color;
        this.ctx.fillRect(currentX, legendY-5, 10, 10);
        this.ctx.fillStyle = legend.color||'#333';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(item.label, currentX + 20, legendY);
        currentX += item.width+15;
    });
  }
  
  /**
   * 绘制网格
   */
  _drawGrid(){
    // 瀑布图模式：不在网格区域绘制背景和网格线（由 Waterfall 模块接管）
    if (this.options.chart_type === 'waterfall') {
      // 仍然绘制背景
      this.ctx.fillStyle = this.options.grid.background;
      this.ctx.fillRect(this.options.grid.left, this.options.grid.top, this.chartWidth, this.chartHeight);
      return;
    }
    this.ctx.fillStyle = this.options.grid.background;
    this.ctx.fillRect(this.options.grid.left, this.options.grid.top, this.chartWidth, this.chartHeight);
    this.ctx.strokeStyle = this.options.grid.color;
    this.ctx.lineWidth =  this.options.grid.width;
    this.ctx.setLineDash(this.options.grid.ygrid_line_dash);
    
    // 绘制网格Y轴线
    if(this.options.grid.ygrid_show&&this.options.xaxis.labels.length>0){
      this.options.xaxis.labels.forEach((data,indexs)=>{
        for (let index = 0; index < data.length; index++) {
          let colors=this.options.grid.color
          if(this.options.xaxis.labels.length>1&&indexs==0&&index==(data.length-1)){
            colors="green"
          }else if(this.options.xaxis.labels.length>1&&indexs>0&&(index==0||index==(data.length-1))){
            colors="green"
          }
          this.ctx.beginPath();
          this.ctx.strokeStyle = colors;
          const items = data[index];
          this.ctx.moveTo(this.options.grid.left+items.offsetx, this.options.grid.top);
          this.ctx.lineTo(this.options.grid.left+items.offsetx, this.height - this.options.grid.bottom);
          this.ctx.stroke();
        }
      })
    }
    
    // 绘制网格x轴线
    const gridLength = this.yLabelGridInfo.gridLabels?.length||0;
    this.ctx.strokeStyle = this.options.grid.color;
    this.ctx.setLineDash(this.options.grid.xgrid_line_dash);
    this.ctx.beginPath();
    
    if(this.options.grid.xgrid_show&&gridLength>0){
      for (let j = 0; j <= gridLength; j ++) {
        let items=this.yLabelGridInfo.gridLabels[j];
        if(items===undefined)continue;
        let y=(items-this.options.yaxis.min_value)*this.yLabelGridInfo.pxStep;
        this.ctx.moveTo(this.options.grid.left, this.height - this.options.grid.bottom - y);
        this.ctx.lineTo(this.width - this.options.grid.right, this.height - this.options.grid.bottom - y);
        this.ctx.stroke();
      }
    }

    //恢复线样式
    this.ctx.setLineDash([]);
    
    // 绘制中心线
    if(this.options.grid.center_line_show){
      this.ctx.strokeStyle = this.options.grid.center_color;
      this.ctx.lineWidth = this.options.grid.center_width;
      this.ctx.beginPath();
      this.ctx.moveTo(this.options.grid.left+this.chartWidth/2, this.options.grid.top);
      this.ctx.lineTo(this.options.grid.left+this.chartWidth/2, this.height - this.options.grid.bottom);
      this.ctx.stroke();
    }
  }
  
  /**
   * 绘制画布
  */
  _draw(){
    this._clearCanvas();
    this._drawAxis();
    this._drawGrid();
    this._drawLegend();
    this._drawTraces();
    this._drawOther();
    //绘制Markers
    this._drawMarkers();
    // 绘制中心频率信息框
    this._drawCenterInfoBox();
    // 绘制 FPS 帧数统计
    this._drawFps();
    // 绘制选框
    this._drawSelectionBox();
  }
  
  /*
  * 清除画布绘制
  */
  clearDraw(){
    this._clearCanvas();
  }
  clearData(){
    this._clearCanvas();
    this._drawAxis();
    this._drawGrid();
    // 瀑布图模式：同时清空帧缓冲
    if (this.options.chart_type === 'waterfall') {
      this._waterfall.clearData();
    }
  }

  /**
   * 清空瀑布图帧缓冲数据（公开方法）
   */
  clearWaterfallData(){
    this._waterfall.clearData();
    this._draw();
  }

  /**
   * 获取色系范围（公开方法）
   * @returns {{ min: number, max: number }}
   */
  getWaterfallColorRange(){
    return this._waterfall.getColorRange();
  }

  /**
   * 设置色系范围（公开方法）
   * @param {number} min 最小强度值
   * @param {number} max 最大强度值
   */
  setWaterfallColorRange(min, max){
    this._waterfall.setColorRange(min, max);
    this._draw();
  }
  /**
   * 绘制图表
   */
  drawChart(){
    // if(this.refreshInterval){
    //   clearInterval(this.refreshInterval);
    //   this.refreshInterval=null;
    // }
    // if(this.options.duration&&this.options.duration>0&&this.isDraw){
    //   this.refreshInterval=setInterval(()=>{
    //     this._draw();
    //   },this.options.duration)
    // }
    this._draw();
  }
  
  /**
   * 绘制门限
   */
  _drawThreshold(){
    if(this.options.threshold.visible){
      let colors=this.options.threshold.color;
      let widhts=this.options.threshold.width;
      if(this.options.threshold.is_mouse||this.thresholdFouce){
        colors=this.options.threshold.drag_color;
        widhts=this.options.threshold.drag_width;
        this.thresholdDiv.style.cursor = 'pointer';
        this.thresholdDiv.style.backgroundImage = `url(${this.options.threshold.drag_icon_url})`;
      }else{
        this.thresholdDiv.style.cursor = 'default';
        this.thresholdDiv.style.backgroundImage = `url(${this.options.threshold.icon_url})`;
      }
      this.ctx.strokeStyle = colors;
      this.ctx.lineWidth = widhts;
      this.ctx.beginPath();
      let y=this.height - this.options.grid.bottom - ((this.options.threshold.level - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
      if(y<this.options.grid.top){
        y=this.options.grid.top;
      }
      if(y>this.height-this.options.grid.bottom){
        y=this.height-this.options.grid.bottom;
      }
      const centtext=this.options.yaxis.axis_function(this.options.threshold.level)
      const texts=truncateNumber(centtext,this.options.threshold.decimals);
      let labeltext="门限:"+texts+this.options.yaxis.unit;
      this.ctx.moveTo(this.options.grid.left, y);
      this.ctx.lineTo(this.width-this.options.grid.right, y);
      this.ctx.stroke();
      const textwidth=this.ctx.measureText(labeltext).width+20;
      this.ctx.fillStyle = "rgba(0,0,0,0.4)";
      this.ctx.fillRect( this.options.grid.left+this.chartWidth/3-10, y-34, textwidth, 24);
      this.ctx.fillStyle = colors;
      this.ctx.textAlign = 'left';
      this.ctx.font=`${this.options.threshold.text_font_size*this.devicePixelRatio}px Arial`
      this.ctx.textBaseline = 'middle';
      
      this.ctx.fillText(labeltext, this.options.grid.left+this.chartWidth/3, y-20);
      //门限图标位置
      this.thresholdDiv.style.display = 'block';
      let iconTop=y-this.options.threshold.icon_size[1]/2;
      this.thresholdDiv.style.top = `${iconTop}px`;
    }else{
      this.thresholdDiv.style.display = 'none';
    }
  }
  
  /**
   * 绘制提示线
   */
  _drawTipLine(){
    if(this.options.level_tipline.visible&&this.options.level_tipline.point.pointx&&this.tracesData.length>0){
      let point=this.options.level_tipline.point
      let mouselevel=this.getMousePositionLevel(point)

      if(mouselevel.y.length>0){
        this.options.level_tipline.is_draw=true;
        let colors=this.options.level_tipline.color;
        let widhts=this.options.level_tipline.width;
        this.ctx.strokeStyle = colors;
        this.ctx.lineWidth = widhts;
        this.ctx.beginPath();
        this.ctx.moveTo(point.pointx,this.options.grid.top);
        this.ctx.lineTo(point.pointx, this.height-this.options.grid.bottom);
        this.ctx.stroke();
        this._tipFreqLevel(mouselevel)
      }else{
        this.options.level_tipline.is_draw=false;
      }
      
    }else{
      this.options.level_tipline.is_draw=false;
    }
  }
  
  _drawOther(){
    //绘制门限
    this._drawThreshold();
    //绘制提示线
    this._drawTipLine();
  }
  
    /**
   * 绘制中心频率信息框
   */
  _drawCenterInfoBox(){
    if(!this.options.centerinfo.visible)return;
    
    const info = this.options.centerinfo;
    
    // 构建显示内容
    const lines = [];
    
    // 中心频率
    if(info.show_center_freq && this.options.center_freq){
      const centerFreqMHz = (this.options.center_freq / 1000000).toFixed(2);
      lines.push(`中心频率：${centerFreqMHz} MHz`);
    }
    
    // 当前频率和强度（如果有焦点 Marker）
    if(info.show_current_freq && this._focusMarkerId > 0){
      const marker = this._markerList.get(this._focusMarkerId);
      if(marker){
        const freq = marker.getFrequency();
        if(freq > 0){
          const freqMHz = (freq / 1000000).toFixed(6);
          lines.push(`频率：${freqMHz} MHz`);
          
          // 获取当前强度（从 Marker 的标牌数据中获取）
          const scutchonList = marker.getScutchonList();
          if(scutchonList.length > 1){
            // 第二行通常是第一条谱线的强度
            const levelText = scutchonList[1][0]?.text || '';
            const match = levelText.match(/:\s*([\d.-]+)/);
            if(match){
              const level = parseFloat(match[1]);
              lines.push(`强度：${level.toFixed(2)} ${this.options.yaxis.unit||'dBμV'}`);
            }
          }
        }
      }
    }
    
    if(lines.length === 0)return;
    
    this._drawInfoBox(this.ctx, {
      lines,
      position: info.position,
      offsetX: info.offsetX,
      offsetY: info.offsetY,
      padding: info.padding,
      fontSize: info.font_size,
      borderRadius: info.border_radius,
      background: info.background,
      textColor: info.text_color
    });
  }

  /**
   * 绘制 FPS 帧数统计信息框
   */
  _drawFps(){
    if (!this.options.fps?.visible) return;
    if (this._fpsCurrentValue <= 0) return;

    const info = this.options.fps;
    const lines = [`FPS: ${this._fpsCurrentValue}`];

    this._drawInfoBox(this.ctx, {
      lines,
      position: info.position,
      offsetX: info.offsetX,
      offsetY: info.offsetY,
      padding: info.padding,
      fontSize: info.font_size,
      borderRadius: info.border_radius,
      background: info.background,
      textColor: info.text_color
    });
  }

  /**
   * 停止绘制
   */
  stopChart(){
    this.isDraw=false;
    if(this.refreshInterval){
      clearInterval(this.refreshInterval);
      this.refreshInterval=null;
    }
  }



  /**
   * 切换瀑布图行高模式
   * @param {string} mode 'fill' | 'time'
   */
  setWaterfallRowHeightMode(mode){
    if (this.options.chart_type !== 'waterfall') return;
    this._waterfall.setRowHeightMode(mode);
    this._draw();
  }

  /**
   * 设置瀑布图行缩放比
   * @param {number} scale 行缩放比（0.1 - 5.0）
   */
  setWaterfallRowScale(scale){
    if (this.options.chart_type !== 'waterfall') return;
    this._waterfall.setRowScale(scale);
    this._draw();
  }
  
  /**
   * 绘制谱线
   */
  _drawTraces(){
    // 瀑布图模式
    if (this.options.chart_type === 'waterfall') {
      const useImageData = this.options.waterfall?.use_image_data !== false;
      this._waterfall.draw(useImageData);
      return;
    }
    // 传统线图模式
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].datainfo?.length>0&&this.tracesData[i].visible) {
        let linedata=this.tracesData[i].datainfo
        for (let j = 0; j < linedata.length; j++) {
          this._drawTypeLine(this.tracesData[i],j);
        }
      }
    }
  }


  /**
   * 判断绘制图表线类型
   * @param {*} datas 
   */
  _drawTypeLine(lineData,order){
    let data={...lineData.datainfo[order]};
    data.width=lineData.width;
    data.color=lineData.color;
    data.type=lineData.type;
    data.drawData=data.data?[...data.data]:[];
    data.order=order;
    // 出力点数undefined
    data.point=data.drawData.length||0;
    let labelInfo=this.xLabelGridInfo[data.order];
    if(!labelInfo)return;
    
    let drawWidth=labelInfo.width;

    //截取区域内点数
    if(labelInfo.start_freq!==labelInfo.show_start_freq||labelInfo.end_freq!==labelInfo.show_end_freq){
      let startOrder=Math.floor((labelInfo.show_start_freq-labelInfo.start_freq)*data.point/(labelInfo.end_freq-labelInfo.start_freq));
      let endOrder=Math.floor((labelInfo.show_end_freq-labelInfo.start_freq)*data.point/(labelInfo.end_freq-labelInfo.start_freq));
      data.drawData=data.data.slice(startOrder,endOrder);
      // 同步截取 _freqs
      if(data._freqs&&data._freqs.length>0){
        data._freqs=data._freqs.slice(startOrder,endOrder);
      }
    }
    
    //数据抽点处理
    if(data.drawData.length>drawWidth){
      data.lineType='pointline';
      let pointdata=extractTwoPolesTraceLine(data.drawData,data.drawData.length,drawWidth);
      data.drawData=pointdata;
      // data._freqs 保持原始一维数组，不抽点
    }else if(data.drawData.length===drawWidth){
      data.lineType='line';
    }else{
      data.lineType='step';
    }
    
    this._drawLine(data);
  }

  /**
   * 绘制线
   * @param {*} datas 谱线数据
   */
  _drawLine(data){
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(
        this.options.grid.left,
        this.options.grid.top,
        this.chartWidth,
        this.chartHeight
    );
    this.ctx.clip();
    this.ctx.beginPath();
    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth = data.width || 1;
    
    let linedata=data.drawData;
    if(data.lineType=='pointline'){
      linedata=data.drawData.targetData;
    }
    
    let labelInfo=this.xLabelGridInfo[data.order];
    let drawStepPx=labelInfo.width/(linedata.length-1);
    labelInfo.drawStepPx=drawStepPx;
    labelInfo.lineType=data.lineType;
    
    if(data.lineType=='line'){
      for (let i = 0; i < linedata.length; i++) {
        let point = linedata[i];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        let x;
        if(data._freqs&&data._freqs.length>0){
          x = startx + (data._freqs[i]-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*labelInfo.width;
        }else{
          x = startx + i * drawStepPx;
        }
        let rightBoundary = this.width - this.options.grid.right;
        let leftBoundary = this.options.grid.left;
        let epsilon = 0.5;
        if(x > rightBoundary + epsilon || x < leftBoundary - epsilon){
          break
        };
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        if(i==0){
          this.ctx.moveTo(x, y);
        }else{
          this.ctx.lineTo(x, y);
        }
      }
    }else if(data.lineType=='step'){
      for (let j = 0; j < data.drawData.length; j++) {
        let point = data.drawData[j];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        let x1, x2;
        if(data._freqs&&data._freqs.length>0){
          let centerX = startx + (data._freqs[j]-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*labelInfo.width;
          let prevX = j>0 ? startx + (data._freqs[j-1]-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*labelInfo.width : startx;
          let nextX = j<data._freqs.length-1 ? startx + (data._freqs[j+1]-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*labelInfo.width : startx + labelInfo.width;
          x1 = centerX - (nextX - prevX) / 4;
          x2 = centerX + (nextX - prevX) / 4;
        }else{
          x1 = startx + j * drawStepPx-drawStepPx/2;
          x2 = startx+ j * drawStepPx+drawStepPx/2;
        }
        if(x1<this.options.grid.left)x1=this.options.grid.left;
        if(x2>this.width-this.options.grid.right)x2=this.width-this.options.grid.right;
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        if(j==0){
          this.ctx.moveTo(startx, y);
          this.ctx.lineTo(x2, y);
        }else{
          this.ctx.lineTo(x1, y);
          this.ctx.lineTo(x2, y);
        }
      }
    }else if(data.lineType=='pointline'){
      for (let i = 0; i < linedata.length; i++) {
        let point = linedata[i][0];
        let minpoint = linedata[i][1];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        let x = startx + i * drawStepPx;
        let rightBoundary = this.width - this.options.grid.right;
        let leftBoundary = this.options.grid.left;
        let epsilon = 0.5;
        if(x > rightBoundary + epsilon || x < leftBoundary - epsilon){
          break
        };
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        let y1 = this.height - this.options.grid.bottom - ((minpoint - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        if(i==0){
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x, y1);
        }else{
          this.ctx.lineTo(x, y);
          this.ctx.lineTo(x, y1);
        }
      }
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }
  
  
  /**
   * 添加谱线
   */
  addTrace(option){
    let defaultOption={
      "id":1,
      "type":"FFT",
      "visible":true,
      "point":100,
      "name":"",
      "color":"#000",
      "datainfo":[],
      "width":1
    }
    const options = deepMerge(defaultOption, option);
    this.tracesData.push(options);
    // 瀑布图模式：初始化帧缓冲区
    if (this.options.chart_type === 'waterfall') {
      this._waterfall.clearData();
      this._waterfall.applyConfig(this.options.waterfall);
    }
    this.isDraw=true;
    this._draw();
  }
  
  /**
   * 设置谱线数据
   * @param {*} id 谱线id
   * @param {*} data 谱线数据
   */
  setTraceData(id,data){
    // FPS 帧数统计：按 setTraceData 接收次数统计每秒帧数
    if (this.options.fps?.visible) {
      let shouldCount = false;
      // DScan 模式下 data 是数组，基于第一段数据做统计
      if (this.options.type === 'DScan') {
        if (this.tracesData.length > 0 && id === this.tracesData[0].id && Array.isArray(data) && data.length > 0 && data[0] && Array.isArray(data[0].data) && data[0].data.length > 0) {
          const d = data[0].data;
          // 轻量签名：长度 + 首元素 + 尾元素，内容变化时判定为新帧
          const sig = d.length + ',' + d[0] + ',' + d[d.length - 1];
          if (sig !== this._fpsLastDataSig) {
            shouldCount = true;
            this._fpsLastDataSig = sig;
          }
        }
      }else{
        shouldCount = true;
      }
      if (shouldCount) {
        const now = Date.now();
        this._fpsTimestamps.push(now);
        // 清理 1 秒前的旧记录（使用 while+shift 避免频繁创建新数组）
        const oneSecondAgo = now - 1000;
        while (this._fpsTimestamps.length > 0 && this._fpsTimestamps[0] < oneSecondAgo) {
          this._fpsTimestamps.shift();
        }
        this._fpsCurrentValue = this._fpsTimestamps.length;
      }
    }
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].id === id) {
        if (this.options.chart_type === 'waterfall') {
          // 瀑布图模式：将数据追加到帧缓冲区（而非覆盖）
          // data 格式：{ point, step, start_freq, end_freq, width, data: [], time }
          // 获取图表绘制区域高度
          const chartHeight = this.height - this.options.grid.top - this.options.grid.bottom;
          console.log('chartHeight', chartHeight);
          const maxRows = this.options.waterfall?.max_rows || 100;
          this._waterfall.pushRow(data, maxRows);
          this.isDraw = true;
          this._draw();
          return;
        } else {
          // 解析 freq_data（如果存在）
          if (Array.isArray(data)) {
            for (let d of data) {
              if (d.freq_data && Array.isArray(d.freq_data) && d.freq_data.length > 0) {
                d._freqs = [...d.freq_data];
                d._hasRealFreq = true;
              } else if (d.data && d.data.length > 0 && d.start_freq !== undefined && d.end_freq !== undefined) {
                // 没有 freq_data 时，根据频率范围自动生成等间隔频率点
                const step = (d.end_freq - d.start_freq) / (d.data.length - 1);
                d._freqs = [];
                for (let j = 0; j < d.data.length; j++) {
                  d._freqs.push(Math.round(d.start_freq + j * step));
                }
                d._hasRealFreq = true;
              }
            }
          }
          this.tracesData[i].datainfo=data;
        }
        break;
      }
    }
    this.isDraw=true;
    this._draw();
  }
  
  /**
   * 设置谱线可见
   * @param {*} id 谱线id
   * @param {*} visible 谱线可见
   */
  setTranceVisible(id,visible){
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].id === id) {
        this.tracesData[i].visible=visible;
        break;
      }
    }
    this.isDraw=true;
    this._draw();
  }

  /**
   * 设置谱线可见（正确拼写）
   * @param {number} id - 谱线id
   * @param {boolean} visible - 是否可见
   */
  setTraceVisibility(id,visible){
    this.setTranceVisible(id,visible);
  }

  /**
   * 获取谱线列表
   * @returns {Array} 谱线数据副本
   */
  getTraces(){
    return this.tracesData.map(t => ({ ...t }));
  }

  /**
   * 删除指定谱线
   * @param {number} id - 谱线id
   * @returns {boolean} 是否删除成功
   */
  removeTrace(id){
    const idx = this.tracesData.findIndex(t => t.id === id);
    if (idx > -1) {
      // 释放 datainfo 中的大数组引用，帮助 GC
      const trace = this.tracesData[idx];
      if (trace.datainfo) {
        trace.datainfo.forEach(d => {
          if (d.data) d.data = null;
          if (d._freqs) d._freqs = null;
        });
      }
      this.tracesData.splice(idx, 1);
      this.isDraw=true;
      this._draw();
      return true;
    }
    return false;
  }
  /**
   * 计算标签
   */
  _computeLabels(){
    this.options.xaxis.labels=[];
    this.options.yaxis.labels=[];
    
    this.chartWidth=Math.floor(this.width - this.options.grid.left - this.options.grid.right);
    this.chartHeight=Math.floor(this.height - this.options.grid.top - this.options.grid.bottom);
    
    const yWidth=this.chartHeight/(this.options.yaxis.number-1);
    const yStepLabels=calculateStepValues(
      yWidth,
      this.options.yaxis.min_value,
      this.options.yaxis.max_value,
      this.options.yaxis.fixedStep,
      this.yZoom,
      this.options.yaxis.floor_value,
      this.options.yaxis.ceiling_value,
      this.options.yaxis.number
    );
    
    this.yLabelGridInfo=yStepLabels;
    this.options.yaxis.min_value=yStepLabels.minValue;
    this.options.yaxis.max_value=yStepLabels.maxValue;
    
    this.options.grid.right = this.width - this.options.grid.left - this.chartWidth;
    this.options.grid.bottom = this.height - this.options.grid.top - this.chartHeight;
    this.ygridStep=yStepLabels.labelStep;
    
    if(this.options.type=="DScan"){
      this._computeDScanLabels();
    }else{
      this._computeFFTLabels();
    }
    
    if(this.options.yaxis.min_value!==""){
      if(this.options.yaxis.zoom_value==""){
        this.options.yaxis.init_min_value=this.options.yaxis.min_value;
        this.options.yaxis.init_max_value=this.options.yaxis.max_value;
        this.options.yaxis.zoom_value=this.options.yaxis.min_value+(this.options.yaxis.max_value-this.options.yaxis.min_value)/2;
      }
      for(var i=0;i<yStepLabels.labels.length;i++){
        let yVal=yStepLabels.labels[i];
        let labelObj={
          "text":yVal,
          "offsetY":(yVal-this.options.yaxis.min_value)*yStepLabels.pxStep
        };
        this.options.yaxis.labels.push(labelObj);
      }
    }
  }
  
  /**
   * 计算FFT标签
   * @private
   */
  _computeFFTLabels(){
    if(this.options.center_freq===""||this.options.span==="")return;
    
    let zoom=1;
    let centerFreq=this.options.center_freq;
    
    if(this.xLabelGridInfo.length>0){
      const drawInfo=this.xLabelGridInfo[0];
      if(drawInfo.draw_zoom_freq!=="")centerFreq=drawInfo.draw_zoom_freq;
      if(drawInfo.draw_zoom!=="")zoom=drawInfo.draw_zoom;
    }
    
    const xspan=Math.floor(this.options.span/zoom/2)*2;
    const startFreq=centerFreq-xspan/2;
    const endFreq=startFreq+xspan;
    const labelCout=this.options.xaxis.number;
    const freqStep=xspan/(labelCout-1);
    const labelStepPx=this.chartWidth/(labelCout-1);
    
    if(startFreq&&freqStep){
      let labels=[];
      for(let j=0;j<labelCout;j++){
        const xVal=startFreq+j*freqStep;
        labels.push({
          text:xVal/1000000,
          offsetx:labelStepPx*j
        });
      }
      this.options.xaxis.labels.push(labels);
    }
    
    this.xLabelGridInfo=[{
      start_freq:this.options.center_freq-this.options.span/2,
      end_freq:this.options.center_freq+this.options.span/2,
      width:this.chartWidth,
      span:this.options.span,
      freqStep:freqStep,
      labelStepPx:labelStepPx,
      show_start_freq:startFreq,
      show_end_freq:endFreq,
      start_x:0,
      end_x:this.chartWidth,
      drawStepPx:"",
      draw_zoom:zoom,
      draw_zoom_freq:centerFreq,
      draw_zoom_span:xspan
    }];
  }
  
  /**
   * 计算DScan标签
   * @private
   */
  _computeDScanLabels(){
    const dscan_freq=this.options.xaxis.dscan_freq;
    const dscan_space=this.options.xaxis.dscan_space;
    
    if(!dscan_freq||dscan_freq.length===0)return;
    
    const widths=dscan_freq.map(item=>item.width);
    const widthVal=calculateWidths(this.chartWidth,widths,dscan_space);
    const xCoutWidth=widthVal.widths;
    
    let startPointPx=0;
    const drawArray=[];
    
    for(let i=0;i<dscan_freq.length;i++){
      const itemdata=dscan_freq[i];
      const datastartFreq=itemdata.start_freq;
      const dataendFreq=itemdata.end_freq;
      const datacenterFreq=datastartFreq+(dataendFreq-datastartFreq)/2;
      const dataspan=dataendFreq-datastartFreq;
      
      let centerFreq=datacenterFreq;
      let span=dataspan;
      let zoom=1;
      
      if(this.xLabelGridInfo.length>0){
        const drawInfo=this.xLabelGridInfo[i];
        if(drawInfo.draw_zoom_freq!=="")centerFreq=drawInfo.draw_zoom_freq;
        if(drawInfo.draw_zoom!=="")zoom=drawInfo.draw_zoom;
      }
      
      const xspan=Math.floor(span/zoom/2)*2;
      const startFreq=centerFreq-xspan/2;
      const endFreq=startFreq+xspan;
      const labelCout=this.options.xaxis.number;
      const freqStep=xspan/(labelCout-1);
      const labelStepPx=xCoutWidth[i]/(labelCout-1);
      
      if(startFreq&&freqStep){
        let labels=[];
        for(let j=0;j<labelCout;j++){
          const xVal=startFreq+j*freqStep;
          labels.push({
            text:xVal/1000000,
            offsetx:startPointPx+labelStepPx*j
          });
        }
        this.options.xaxis.labels.push(labels);
      }
      
      drawArray.push({
        start_freq:datastartFreq,
        end_freq:dataendFreq,
        width:xCoutWidth[i],
        span:dataspan,
        freqStep:freqStep,
        labelStepPx:labelStepPx,
        show_start_freq:startFreq,
        show_end_freq:endFreq,
        start_x:startPointPx,
        end_x:startPointPx+xCoutWidth[i],
        drawStepPx:"",
        draw_zoom:zoom,
        draw_zoom_freq:centerFreq,
        draw_zoom_span:xspan
      });
      //增加初始位置
      startPointPx+=xCoutWidth[i]+widthVal.spacing;
    }
    
    this.xLabelGridInfo=drawArray;
  }
  
  //监听事件
  /**
   * 鼠标按下事件
   * @param {*} event 
   */
  _handleMousedown(event) {
    // 如果当前是touch交互，且是浏览器自动触发的真实mouse事件，则忽略避免重复
    if(this._isTouchActive && event instanceof MouseEvent)return;
    
    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };
    
    // 记录mousedown位置和时间，用于区分点击和拖动
    this._mouseDownPos={x:point.x,y:point.y};
    this._mouseDownTime=Date.now();
    
    const dpiPair={x:96*this.devicePixelRatio,y:96*this.devicePixelRatio};
    
    // 优先级1：检测Marker（最高优先级）
    for(const [id,marker] of this._markerList){
      if(marker.isVisible() && marker.containsPoint(point,dpiPair)){
        this._currentOperation='markerDrag';
        this._markerDragState.dragMarkerId=id;
        this._markerDragState.lastX=point.x;
        this._markerDragState.lastY=point.y;
        this.setMarkerFocus(id);
        marker.handlePressEvent(point);
        return;
      }
    }
    
    // 优先级2：检测门限图标
    // 门限图标有独立的事件监听，这里不处理
    
    // 优先级3：检测选区功能
    const sb = this.options.selectionBox;
    if (sb && sb.enabled && event.button === 0) {
      const posType = this._getMousePosition(event);
      if (posType === 'grid') {
        this._currentOperation='selectionBox';
        this._selectionBox.pending = true;
        this._selectionBox.startX = event.offsetX;
        this._selectionBox.startY = event.offsetY;
        this._selectionBox.currentX = event.offsetX;
        this._selectionBox.currentY = event.offsetY;
        this._selectionBox.active = false;
        // 长按延迟后自动激活选框
        const delay = sb.longPressDelay || 200;
        this._selectionBox.timer = setTimeout(() => {
          if (this._selectionBox.pending) {
            this._selectionBox.active = true;
            this._selectionBox.pending = false;
            this._scheduleDraw();
          }
        }, delay);
        return;
      }
    }
    
    // 优先级4：图表平移
    this._currentOperation='pan';
    this.mousedownInfo={
      isMouseDown:true,
      startX:event.offsetX,
      startY:event.offsetY,
      mouseupx:0,
      mouseupy:0,
      button:event.button
    }

    // 瀑布图模式：在色系条区域按下鼠标，开始色系拖动
    if (this.options.chart_type === 'waterfall') {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (this._waterfall.isInColorBar(mouseX)) {
        this._waterfall.handleColorBarDrag(mouseY, true);
        return;
      }
    }
    
    if (event.button === 0) {
      this.ctx.canvas.style.cursor = 'grabbing';
    } else if (event.button === 2) {
      this.ctx.canvas.style.cursor = 'grab';
    }
  }
  
  /**
   * 鼠标松开事件
   * @param {*} event
   */
  _handleMouseup(event) {
    // 如果当前是touch交互，且是浏览器自动触发的真实mouse事件，则忽略避免重复
    if(this._isTouchActive && event instanceof MouseEvent)return;
    
    // 取消可能挂起的 raf 绘制，避免交互结束后再执行一次多余绘制
    this._cancelScheduledDraw();
    
    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };
    
    // 计算移动距离和时间差，区分点击和拖动
    const dx=point.x-this._mouseDownPos.x;
    const dy=point.y-this._mouseDownPos.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const timeDiff=Date.now()-this._mouseDownTime;
    const isClick=dist<this._dragThreshold&&timeDiff<300; // 移动距离<5px且时间<300ms视为点击
    
    // 根据操作类型处理mouseup
    switch(this._currentOperation){
      case 'markerDrag':
        // Marker拖动结束
        if(isClick){
          // 点击：设置焦点（已在mousedown时设置）
          console.log('Marker clicked');
        }else{
          // 拖动：释放
          const marker=this._markerList.get(this._markerDragState.dragMarkerId);
          if(marker){
            marker.handleReleaseEvent({
              x:this._markerDragState.lastX,
              y:this._markerDragState.lastY
            });
          }
          this._scheduleDraw();
        }
        this._markerDragState.isDragging=false;
        this._markerDragState.dragMarkerId=0;
        break;
        
      case 'selectionBox':
        // 选框结束
        if(this._selectionBox.active){
          this._endSelectionBox(event);
          this._suppressClick=true;
        }
        if(this._selectionBox.pending){
          clearTimeout(this._selectionBox.timer);
          this._selectionBox.timer=null;
          this._selectionBox.pending=false;
        }
        break;
        
      case 'pan':
        // 平移结束
        let mousedowinfo={
          isMouseDown:false,
          mouseupx:event.offsetX,
          mouseupy:event.offsetY,
          button:event.button
        }
        this.mousedownInfo={
          ...this.mousedownInfo,
          ...mousedowinfo
        }
        this.ctx.canvas.style.cursor='default';
        break;
    }
    
    // 清理操作状态
    this._currentOperation=null;
  }
  
    /**
   * 鼠标移动
   * @param {*} event 
   */
  _handleMousemove(event) {
    // 如果当前是touch交互，且是浏览器自动触发的真实mouse事件，则忽略避免重复
    if(this._isTouchActive && event instanceof MouseEvent)return;
    
    // 像素级脏检查：仅在非拖动模式下生效，避免高频mousemove造成性能损耗
    const currentX = Math.round(event.offsetX);
    const currentY = Math.round(event.offsetY);
    if(this._currentOperation !== 'markerDrag' && this._currentOperation !== 'selectionBox'){
      if(this._lastMouseX === currentX && this._lastMouseY === currentY){
        return;
      }
    }
    this._lastMouseX = currentX;
    this._lastMouseY = currentY;
    
    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };
    
    // 根据当前操作类型分发处理
    switch(this._currentOperation){
      case 'markerDrag':
        // Marker拖动模式
        this._markerDragState.isDragging=true;
        const clampedX=Math.max(this.options.grid.left,Math.min(this.width-this.options.grid.right,point.x));
        const clampedY=Math.max(this.options.grid.top,Math.min(this.height-this.options.grid.bottom,point.y));
        const marker=this._markerList.get(this._markerDragState.dragMarkerId);
        if(marker){
          marker.handleMoveEvent({x:clampedX,y:clampedY});
          this._updateMarkerData(marker);
          marker.setScutchonAnchor({x:clampedX,y:clampedY});
        }
        this._markerDragState.lastX=clampedX;
        this._markerDragState.lastY=clampedY;
        this._scheduleDraw();
        return;
        
      case 'selectionBox':
        // 选框模式
        if(this._selectionBox.active){
          this._selectionBox.currentX=event.offsetX;
          this._selectionBox.currentY=event.offsetY;
          this._scheduleDraw();
          return;
        }
        if(this._selectionBox.pending){
          const dx=event.offsetX-this._selectionBox.startX;
          const dy=event.offsetY-this._selectionBox.startY;
          const dist=Math.sqrt(dx*dx+dy*dy);
          const minW=this.options.selectionBox?.minWidth||5;
          if(dist>minW){
            clearTimeout(this._selectionBox.timer);
            this._selectionBox.timer=null;
            this._selectionBox.active=true;
            this._selectionBox.pending=false;
            this._selectionBox.currentX=event.offsetX;
            this._selectionBox.currentY=event.offsetY;
            this._scheduleDraw();
            return;
          }
          return;
        }
        return;
        
      case 'pan':
        // 图表平移模式
        if(this.mousedownInfo.isMouseDown){
          // 瀑布图色系条拖动
          if(this.options.chart_type==='waterfall'&&this._waterfall._colorBarDrag.active){
            const mouseY=event.clientY-rect.top;
            this._waterfall.handleColorBarDrag(mouseY,false);
            this._scheduleDrawChart();
            return;
          }

          if(this.moveInfo.preX==0){
            this.moveInfo.preX=this.mousedownInfo.startX;
            this.moveInfo.preY=this.mousedownInfo.startY;
          }
          const moveX=event.offsetX-this.moveInfo.preX;
          const moveY=this.moveInfo.preY-event.offsetY;
          
          if(Math.abs(moveX)>Math.abs(moveY)){
            let mouseVal=this.getMouseVal(event);
            let order=mouseVal.order;
            if(order!==null){
              let labelInfo=this.xLabelGridInfo[order];
              let moveVal=(labelInfo.show_end_freq-labelInfo.show_start_freq)/labelInfo.width*moveX;
              if(moveVal==0)moveVal=Math.sign(moveX);
              let minval=labelInfo.show_start_freq-moveVal;
              let maxval=labelInfo.show_end_freq-moveVal;
              if(minval>=labelInfo.start_freq&&maxval<=labelInfo.end_freq){
                this.xLabelGridInfo[order].show_start_freq=minval;
                this.xLabelGridInfo[order].show_end_freq=maxval;
                let newCenter=minval+Math.floor((maxval-minval)/2);
                this.xLabelGridInfo[order].draw_zoom_freq=newCenter;
                this._updateMarkersPositionByFreq();
                this._scheduleDrawChart();
                this._triggerXRangeChange('pan', 'drag', order);
              }
            }
          }else{
            let moveVal=(this.options.yaxis.max_value-this.options.yaxis.min_value)/this.chartHeight*moveY;
            if(moveVal==0)moveVal=Math.sign(moveY);
            let minval=this.options.yaxis.min_value-moveVal;
            let maxval=this.options.yaxis.max_value-moveVal;
            if(minval>=this.options.yaxis.floor_value&&maxval<=this.options.yaxis.ceiling_value){
              this.options.yaxis.min_value=minval;
              this.options.yaxis.max_value=maxval;
              this._updateMarkersPositionByFreq();
              this._scheduleDrawChart();
              this._triggerYRangeChange('pan', 'drag');
            }
          }
        }
        break;
    }
    
    // 非拖动状态下的鼠标移动：更新hover状态
    let type=this._getMousePosition(event);
    if(type=="grid"){
      let point=this.getMousePoint(event);
      this.options.level_tipline.point=point;
      this._throttledScheduleDraw();
    }
    
    // 鼠标移动时打印频率和强度信息
    if(type=="grid"||type=="bottom"){
      let mouseVal=this.getMouseVal(event,2);
      if(mouseVal.x!==null){
        let realFreq=mouseVal.x;
        let intensity=null;
        let sourceInfo=[];
        // 查找真实频率和强度
        if(this.tracesData.length>0){
          for(let i=0;i<this.tracesData.length;i++){
            const trace=this.tracesData[i];
            if(!trace.visible||!trace.datainfo)continue;
            for(let j=0;j<trace.datainfo.length;j++){
              const dataInfo=trace.datainfo[j];
              if(!dataInfo||!dataInfo.data)continue;
              // 只处理鼠标当前所在频段范围内的数据段
              if(mouseVal.x < dataInfo.start_freq || mouseVal.x > dataInfo.end_freq) continue;
              const nearestResult = this._findNearestFreqIndex(dataInfo, mouseVal.x);
              realFreq = nearestResult.realFreq;
              if(nearestResult.index>=0 && nearestResult.index<dataInfo.data.length){
                intensity=dataInfo.data[nearestResult.index];
              }
              // 记录源数据信息
              const freqOffset = realFreq - mouseVal.x;
              sourceInfo.push({
                traceName: trace.name || `谱线${trace.id}`,
                hasRealFreq: dataInfo._freqs && dataInfo._freqs.length > 0,
                nearestIdx: nearestResult.index,
                xAxisFreq: `${(mouseVal.x/1e6).toFixed(6)} MHz`,
                realFreq: `${(realFreq/1e6).toFixed(6)} MHz`,
                freqOffset: `${(freqOffset/1e3).toFixed(3)} kHz`,
                intensity: intensity !== null ? `${intensity.toFixed(2)} dBμV` : 'N/A',
                freqRange: dataInfo._freqs && dataInfo._freqs.length > 0 
                  ? `${(Math.min(...dataInfo._freqs)/1e6).toFixed(3)}~${(Math.max(...dataInfo._freqs)/1e6).toFixed(3)} MHz` 
                  : undefined
              });
            }
          }
        }
        this._mouseRealFreq = realFreq;
        //console.log(`[MouseMove] X轴频率: ${(mouseVal.x/1000000).toFixed(6)} MHz, 真实频率: ${(realFreq/1000000).toFixed(6)} MHz, 强度: ${intensity!==null?intensity.toFixed(2):'--'} dBμV`);
        if(sourceInfo.length>0){
          //console.table(sourceInfo);
        }
      }
    }
    
    // 直接修改属性，避免每帧mousemove都创建新对象
    this.moveInfo.isMove = true;
    this.moveInfo.preX = event.offsetX;
    this.moveInfo.preY = event.offsetY;
    this.moveInfo.moveX = event.offsetX;
    this.moveInfo.moveY = event.offsetY;
  }

  
  
  /**
   * 鼠标移出控件
   * @param {*} event 
   */
  _handleMouseout(event){
    // 如果当前是touch交互，且是浏览器自动触发的真实mouse事件，则忽略避免重复
    if(this._isTouchActive && event instanceof MouseEvent)return;
    event.preventDefault();
    this._cancelScheduledDraw();
    this.mousedownInfo.isMouseDown=false;
    this.moveInfo.isMove=false;
    this.moveInfo.preX=0;
    this.moveInfo.preY=0;
    this.moveInfo.moveX=0;
    this.moveInfo.moveY=0;
  }

  // ========== 移动端触控事件处理（Touch事件映射到Mouse事件）==========

  /**
   * 将Touch事件转换为模拟MouseEvent对象
   * @private
   */
  _createMouseEvent(touch, type, button = 0) {
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      offsetX: offsetX,
      offsetY: offsetY,
      button: button,
      preventDefault: () => {},
      stopPropagation: () => {}
    };
  }

  /**
   * 计算双指触控距离
   * @private
   */
  _getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * touchstart事件处理
   * @private
   */
  _handleTouchStart(event) {
    event.preventDefault();
    this._isTouchActive = true;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this._touchStartPos = { x: touch.clientX, y: touch.clientY };
      this._touchStartTime = Date.now();
      this._longPressTriggered = false;

      // 创建mousedown事件并触发
      const mouseEvent = this._createMouseEvent(touch, 'mousedown');
      this._handleMousedown(mouseEvent);

      // 长按检测（500ms）
      this._longPressTimer = setTimeout(() => {
        this._longPressTimer = null;
        this._longPressTriggered = true;
        // 触发右键菜单
        if (this.options.contextMenu?.enabled) {
          const ctxEvent = this._createMouseEvent(touch, 'contextmenu');
          this._handleContextMenu(ctxEvent);
        }
      }, 500);
    } else if (event.touches.length === 2) {
      // 双指缩放：取消长按，记录初始距离
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
      }
      this._lastTouchDist = this._getTouchDistance(event.touches);
    }
  }

  /**
   * touchmove事件处理
   * @private
   */
  _handleTouchMove(event) {
    event.preventDefault();

    if (event.touches.length === 1) {
      const touch = event.touches[0];

      // 如果移动距离超过阈值，取消长按
      if (this._longPressTimer && this._touchStartPos) {
        const dx = touch.clientX - this._touchStartPos.x;
        const dy = touch.clientY - this._touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(this._longPressTimer);
          this._longPressTimer = null;
        }
      }

      // 判断是否为拖动模式（移动距离 >= 10px）
      let isDragging = false;
      if (this._touchStartPos) {
        const dx = touch.clientX - this._touchStartPos.x;
        const dy = touch.clientY - this._touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) >= 10) {
          isDragging = true;
        }
      }

      if (isDragging) {
        // 拖动模式：设置 isMouseDown 并调用 mousemove
        this.mousedownInfo.isMouseDown = true;
        const mouseEvent = this._createMouseEvent(touch, 'mousemove');
        this._handleMousemove(mouseEvent);
      } else {
        // 轻触 hover 模式：模拟鼠标在 grid 区域 hover，显示频率提示
        const mouseEvent = this._createMouseEvent(touch, 'mousemove');
        const type = this._getMousePosition(mouseEvent);
        if (type === 'grid') {
          const point = this.getMousePoint(mouseEvent);
          this.options.level_tipline.point = point;
          this._throttledScheduleDraw();
        }
      }
    } else if (event.touches.length === 2) {
      // 双指缩放
      const dist = this._getTouchDistance(event.touches);
      if (this._lastTouchDist > 0) {
        const delta = dist > this._lastTouchDist ? 1 : -1;
        const diff = Math.abs(dist - this._lastTouchDist);
        if (diff > 5) {
          // 根据双指连线方向决定缩放轴：
          // 水平方向(dx>dy) → 缩放X轴（模拟网格区域滚轮）
          // 垂直方向(dy>dx) → 缩放Y轴（模拟左侧Y轴区域滚轮）
          const touchDx = Math.abs(event.touches[0].clientX - event.touches[1].clientX);
          const touchDy = Math.abs(event.touches[0].clientY - event.touches[1].clientY);
          const zoomEvent = this._createMouseEvent(event.touches[0], 'wheel');
          if (touchDy > touchDx) {
            // 主要垂直方向：将位置移到左侧Y轴区域，触发Y轴缩放
            const rect = this.canvas.getBoundingClientRect();
            zoomEvent.clientX = rect.left + this.options.grid.left - 5;
            zoomEvent.offsetX = this.options.grid.left - 5;
          }
          this._throttledHandleZoom(zoomEvent, delta);
          this._lastTouchDist = dist;
        }
      }
    }
  }

  /**
   * touchend事件处理
   * @private
   */
  _handleTouchEnd(event) {
    // 清理长按定时器
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    // 如果长按已触发，不执行mouseup（避免和右键菜单冲突）
    if (this._longPressTriggered) {
      this._longPressTriggered = false;
      this._isTouchActive = false;
      return;
    }

    // 创建mouseup事件并触发
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const mouseEvent = this._createMouseEvent(touch, 'mouseup');
      this._handleMouseup(mouseEvent);

      // 判断是否为点击（非拖动），模拟 click 以支持 clickBlankToExit 等逻辑
      if (this._touchStartPos) {
        const dx = touch.clientX - this._touchStartPos.x;
        const dy = touch.clientY - this._touchStartPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const timeDiff = Date.now() - this._touchStartTime;
        if (dist < this._dragThreshold && timeDiff < 300) {
          const clickEvent = this._createMouseEvent(touch, 'click');
          this._handleClick(clickEvent);
        }
      }
    }

    // 延迟重置_isTouchActive，避免浏览器后续触发的mouse事件重复执行
    setTimeout(() => {
      this._isTouchActive = false;
    }, 100);
  }

  /**
   * touchcancel事件处理
   * @private
   */
  _handleTouchCancel(event) {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    this._isTouchActive = false;
    this._lastTouchDist = 0;
    // 触发mouseout以清理状态
    this._handleMouseout(event);
  }

  /**
   * 鼠标滚轮事件
   * @param {*} event
   *
   */
  _handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    this._throttledHandleZoom(event, delta);
  }
  
  /**
   * 使用 requestAnimationFrame 调度一次 draw()，避免一帧内多次重绘
   * 适合高频交互场景（Marker 拖动、选框、平移等）
   * @private
   */
  _scheduleDraw() {
    if (this._drawPending) return;
    this._drawPending = true;
    this._drawRafId = requestAnimationFrame(() => {
      this._drawPending = false;
      this._drawRafId = null;
      this._draw();
    });
  }

  /**
   * 使用 requestAnimationFrame 调度一次 draw()，避免一帧内多次重绘
   * 注意：交互绘制直接调用 draw()，不经过 drawChart()，避免干扰自动刷新定时器
   * @private
   */
  _scheduleDrawChart() {
    if (this._drawPending) return;
    this._drawPending = true;
    this._drawRafId = requestAnimationFrame(() => {
      this._drawPending = false;
      this._drawRafId = null;
      this._draw();
    });
  }

  /**
   * 取消待执行的 raf 绘制（用于鼠标抬起等场景）
   * @private
   */
  _cancelScheduledDraw() {
    if (this._drawRafId !== null) {
      cancelAnimationFrame(this._drawRafId);
      this._drawRafId = null;
      this._drawPending = false;
    }
  }

  /**
   * 双击事件
   * @param {*} event
   */
  _handleDblClick(event) {
    console.log("handleDblClick", event);
    // 获取当前频率
    const mouseVal=this.getMouseVal(event);
  }
  
  /**
   * 点击事件
   * @param {*} event 
   */
  _handleClick(event) {
    // 如果刚刚完成了选框操作，抑制本次 click 避免误触发
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }

    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };

    //先尝试点击Marker
    if(this._handleMarkerClick(point)){
      return;
    }
    
    // 如果没有点击Marker，根据配置处理焦点和频率提示
    const type=this._getMousePosition(event);
    if(this._focusMarkerId>0 && this.options.marker?.clickBlankToExit){
      this.exitMarkerFocus();
    }
    
    // 如果在grid区域，显示频率提示
    if(type=="grid"){
      this.options.level_tipline.point={
        pointx: point.x,
        pointy: point.y
      };
      this._scheduleDraw();
    }
  }
  
  /*
   * 鼠标右键事件
   * @param {*} event
   */
  _handleContextMenu(event) {
    event.preventDefault();

    // 检查是否启用了右键菜单
    if(!this.options.contextMenu?.enabled)return;
    
    // 获取右键菜单配置的动作
    const actions = this.options.contextMenu.actions || ['exitFocus'];
    
    // 执行右键菜单动作
    this._handleContextMenuActions(actions,event);
  }
  
  /**
   * 按键按下事件
   * @param {*} event
   */
  _handleKeydown(event) {
    switch (event.keyCode) {
      case 37:
        console.log("左箭头");
        break;
      case 38:
        console.log("上箭头");
        break;
      case 39:
        console.log("右箭头");
        break;
      case 40:
        console.log("下箭头");
        break;
    }
  }
  
  /**
   * 按键松开事件
   * @param {*} event 
   */
  _handleKeyup(event) {
    console.log("handleKeyup按键松开事件", event);
  }
  
  /**
   * 门限图标鼠标按下事件
   * @param {*} event 
   */
  _handleThresholdMousedown(event) {
    this.focusType="threshold";
    this.thresholdFouce=true;
  }
  
  /**
   * 门限拖动事件
   * @param {*} event 
   */
  _handleThresholdMousemove(event) {
    if(this.thresholdFouce){
      const leves=this.getMouseVal(event,2).y;
      this.options.threshold.level=leves;
      this._scheduleDrawChart();
    }
  }
  
  /**
   * 门限拖动结束事件
   * @param {*} event 
   */
  _handleThresholdMouseout(event) {
    this.thresholdFouce=false;
  }

  // ========== 门限图标移动端触控支持 ==========

  /**
   * 门限图标touchstart事件
   * @private
   */
  _handleThresholdTouchStart(event) {
    event.preventDefault();
    this._isTouchActive = true;
    this.focusType = "threshold";
    this.thresholdFouce = true;
  }

  /**
   * 门限图标touchmove事件
   * @private
   */
  _handleThresholdTouchMove(event) {
    event.preventDefault();
    if (this.thresholdFouce && event.touches.length > 0) {
      const touch = event.touches[0];
      const mouseEvent = this._createMouseEvent(touch, 'mousemove');
      const leves = this.getMouseVal(mouseEvent, 2).y;
      this.options.threshold.level = leves;
      this._scheduleDrawChart();
    }
  }

  /**
   * 门限图标touchend事件
   * @private
   */
  _handleThresholdTouchEnd(event) {
    this.thresholdFouce = false;
    setTimeout(() => {
      this._isTouchActive = false;
    }, 100);
  }

  // ========== 强度提示框（Canvas绘制）
  _tipFreqLevel(data){
    if(!this.options.level_tipline.is_draw) return;
    
    const point = data;
    const tipConfig = this.options.level_tipline;
    const levels = Math.max(...data.y);
    let centtext = this.options.yaxis.axis_function(levels);
    if(isNaN(centtext)){
      centtext = "--";
    }
    
    // 构建文本内容
    const lines = [];
    // 真实频率显示（如果有）
    const hasRealFreq = this._mouseRealFreq !== undefined && this._mouseRealFreq !== null && Math.abs(this._mouseRealFreq - data.x) > 0.1;
    if(tipConfig.freq_visible){
      lines.push(`强度：${centtext}${this.options.yaxis.unit}`);
      lines.push(`频率：${(data.x/1000000).toFixed(6)} MHz`);
      // if(hasRealFreq){
      //   const freqOffset = this._mouseRealFreq - data.x;
      //   lines.push(`真实频率：${(this._mouseRealFreq/1000000).toFixed(6)} MHz`);
      //   lines.push(`频偏：${(freqOffset/1000).toFixed(3)} kHz`);
      // }
    }else{
      lines.push(`强度：${centtext}${this.options.yaxis.unit}`);
    }
    
    // 计算文本框尺寸
    const padding = tipConfig.tip_padding * this.devicePixelRatio;
    const fontSize = tipConfig.tip_font_size * this.devicePixelRatio;
    const {width: boxWidth, height: boxHeight, lineHeight} = this._measureTextBox(lines, fontSize, padding);
    const borderRadius = tipConfig.tip_border_radius * this.devicePixelRatio;
    
    // 计算提示框位置（参考Marker标牌位置计算方式：先计算默认位置，再边界检测调整）
    const MARGIN = 10; // 与Marker标牌保持一致，使用边距
    const gridRight = this.options.grid.left + this.chartWidth;
    const gridBottom = this.options.grid.top + this.chartHeight;
    
    // 默认位置：位于pointx右侧，顶部对齐
    let boxX = point.pointx + MARGIN;
    let boxY = point.pointy + MARGIN;
    
    // 边界约束
    const clamped = this._clampBoxPosition(
      { x: boxX, y: boxY, width: boxWidth, height: boxHeight },
      { x: this.options.grid.left, y: this.options.grid.top, width: this.chartWidth, height: this.chartHeight },
      MARGIN
    );
    boxX = clamped.x;
    boxY = clamped.y;
    
    // 绘制背景
    this.ctx.save();
    this.ctx.fillStyle = tipConfig.tip_background;
    this._drawRoundRect(this.ctx, boxX, boxY, boxWidth, boxHeight, borderRadius);
    this.ctx.fill();
    
    // 绘制文本
    this.ctx.fillStyle = tipConfig.tip_text_color;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    for(let i = 0; i < lines.length; i++){
      const textY = boxY + padding + i * lineHeight;
      this.ctx.fillText(lines[i], boxX + padding, textY);
    }
    this.ctx.restore();
  }
  
  /**
   * 单频设置中心频率和显宽
   * @param {*} centerFre 
   * @param {*} span 
   */
  setFFTCenterFreAndSpan(centerFre, span) {
    this.options.center_freq = centerFre;
    this.options.span = span;
  }
  
  /**
   * 单频
   * @returns 获取中心频率和显宽
   */
  getFFTCenterFreAndSpan(){
    return {
      center_freq:this.options.center_freq,
      span:this.options.span
    }
  }
  
  /**
   * 窗口大小改变事件
   */
  resizeCanvas() {
    this.setCanvasSize();
    this._draw();
  }
  
  /**
   * 设置选框回调函数
   * @param {Function} callback - 选框结束回调 function({startFreq, endFreq, centerFreq, bandwidth, span, startX, endX})
   */
  setSelectionBoxCallback(callback){
    if(!this.options.selectionBox){
      this.options.selectionBox = {};
    }
    this.options.selectionBox.onSelect = callback;
  }

  /**
   * 设置选框功能开关
   * @param {boolean} enabled - 是否启用选框
   */
  setSelectionBoxEnabled(enabled){
    if(!this.options.selectionBox){
      this.options.selectionBox = {};
    }
    this.options.selectionBox.enabled = !!enabled;
  }

  /**
   * 获取当前选框配置
   * @returns {Object} 选框配置对象
   */
  getSelectionBoxConfig(){
    return this.options.selectionBox || { enabled: false };
  }

  /**
   * 设置图表大小
   * @param {*} widhts 宽度
   *  @param {*} heights 高度
   */
  setChartSize(widths, heights){
    if(widths&&heights){
      this.options.width=widths;
      this.options.height=heights;
    }
    this.setCanvasSize(widths, heights);
    this._draw();
  }
  
  /**
   * 修改门限值
   * @param {*} num
   */
  changeThreshold(num){
    if(this.options.threshold.visible){
      let newLevel = this.options.threshold.level+num;
      this.options.threshold.is_mouse=true;
      if(newLevel<=this.options.yaxis.max_value&&newLevel>=this.options.yaxis.min_value){
        this.options.threshold.level = newLevel;
      }
    }
  }
  
  /**
   * 设置门限值
   * @param {*} level 
   */
  setThresholdLevel(level){
    this.options.threshold.level=level;
  }
  
  /**
   * 获取门限值
   * @returns 门限值
   */
  getThresholdLevel(){
    return this.options.threshold.level;
  }
  
  /**
   * 门限是否显示
   * @param {*} isShow 
   */
  setThresholdShow(isShow){
    this.options.threshold.visible=isShow;
  }
  
  /**
   * 设置门限属性
   * @param {*} options
   */
  setThresholdAttribute(options){
    let oldattr = deepMerge({},this.options.threshold);
    this.options.threshold = deepMerge(oldattr,options);
  }
  
  /**
   * 缩放事件
   * @param {*} event 
   * @param {*} types 
   * @param {*} delta 
   * @returns 
   */
  _handleZoom(event,delta) {
    // 瀑布图模式：色系条 / 时间轴 / 行缩放 + X轴缩放
    if (this.options.chart_type === 'waterfall') {
      let type=this._getMousePosition(event);
      let handled = false;
      if (type === 'right') {
        // 色系条区域：调整色系范围
        handled = this._waterfall.handleColorWheel(event, delta);
      } else if (type === 'left') {
        // Y 轴区域：调整时间刻度间隔
        handled = this._waterfall.handleTimeWheel(event, delta);
      } else if (type === 'grid') {
        // 网格区域：只做 Y 轴行缩放
        handled = this._waterfall.handleRowScaleWheel(event, delta);
      } else if (type === 'bottom') {
        // X轴标签区域：X轴缩放（复用线图逻辑）
        let mouseVal=this.getMouseVal(event,0);
        if(mouseVal.order!==null){
          let order=mouseVal.order;
          let labelInfo=this.xLabelGridInfo[order];
          let initSpan=labelInfo.span;
          let newZoom=labelInfo.draw_zoom+delta;
          let zoomSpan = Math.max(6, Math.floor(initSpan / newZoom));
          if(zoomSpan<=initSpan&&zoomSpan>=6){
            let pointx = event.offsetX - this.options.grid.left;
            let centerVal = labelInfo.show_start_freq + (pointx - labelInfo.start_x) / labelInfo.width * (labelInfo.show_end_freq - labelInfo.show_start_freq);
            let minValue=Math.floor(centerVal-(centerVal-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*zoomSpan);
            let maxValue=Math.floor(minValue+zoomSpan);
            if(minValue<labelInfo.start_freq){
              minValue=labelInfo.start_freq;
              maxValue=Math.floor(minValue+zoomSpan);
            }
            if(maxValue>labelInfo.end_freq){
              maxValue=labelInfo.end_freq;
              minValue=Math.ceil(maxValue-zoomSpan);
            }
            if(minValue>=labelInfo.start_freq&&maxValue<=labelInfo.end_freq){
              this.xLabelGridInfo[order].draw_zoom = newZoom;
              let newCenter=minValue+Math.floor((maxValue-minValue)/2);
              this.xLabelGridInfo[order].draw_zoom_freq =newCenter;
              this.xLabelGridInfo[order].show_start_freq=minValue;
              this.xLabelGridInfo[order].show_end_freq=maxValue;
              handled = true;
              this._triggerXRangeChange('zoom', 'wheel', order, minValue, maxValue);
            }
          }
        }
      }
      if (handled) this._scheduleDraw();
      return;
    }

    let type=this._getMousePosition(event);
    const zoomFactor = 1.1;
    
    if(type=="left"){
      let newZoom = this.yZoom+delta;
      let maxZoom = this.options.yaxis.fixedStep;
      let initMaxStep = (this.options.yaxis.ceiling_value-this.options.yaxis.floor_value)/(this.options.yaxis.number-1);
      if(newZoom<1){
        newZoom=1;
        return false;
      }
      if(newZoom>initMaxStep){
        newZoom=initMaxStep;
      }
      let stepVal=Math.round(initMaxStep/newZoom);
      if(stepVal<1)return false;
      let nowCout=stepVal*(this.options.yaxis.number-1);
      let mouseVal=this.getMouseVal(event,0).y;
      let minValue=Math.round(mouseVal-(mouseVal-this.options.yaxis.min_value)/(this.options.yaxis.max_value-this.options.yaxis.min_value)*nowCout);
      let maxValue=Math.floor(minValue+nowCout);
      if(minValue<this.options.yaxis.floor_value){
        minValue=this.options.yaxis.floor_value;
        maxValue=minValue+nowCout;
      }
      if(maxValue>this.options.yaxis.ceiling_value){
        maxValue=this.options.yaxis.ceiling_value;
        minValue=maxValue-nowCout;
      }
      if(minValue>=this.options.yaxis.floor_value&&maxValue<=this.options.yaxis.ceiling_value&&maxValue-minValue>=(this.options.yaxis.number-1)){
        this.options.yaxis.min_value=minValue;
        this.options.yaxis.max_value=maxValue;
        this.yZoom=newZoom;
        this._triggerYRangeChange('zoom', 'wheel');
      }
    }else if(type=="bottom" || type=="grid"){
      let mouseVal=this.getMouseVal(event,0);
      if(mouseVal.order!==null){
        let order=mouseVal.order;
        let labelInfo=this.xLabelGridInfo[order];
        let initSpan=labelInfo.span;
        let newZoom=labelInfo.draw_zoom+delta;
        let zoomSpan = Math.max(6, Math.floor(initSpan / newZoom));
        if(zoomSpan>initSpan)return false;
        if(zoomSpan < 6)return false;
        let pointx = event.offsetX - this.options.grid.left;
        let centerVal = labelInfo.show_start_freq + (pointx - labelInfo.start_x) / labelInfo.width * (labelInfo.show_end_freq - labelInfo.show_start_freq);
        let minValue=Math.floor(centerVal-(centerVal-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*zoomSpan);
        let maxValue=Math.floor(minValue+zoomSpan);
        if(minValue<labelInfo.start_freq){
          minValue=labelInfo.start_freq;
          maxValue=Math.floor(minValue+zoomSpan);
        }
        if(maxValue>labelInfo.end_freq){
          maxValue=labelInfo.end_freq;
          minValue=Math.ceil(maxValue-zoomSpan);
        }
        if(minValue>=labelInfo.start_freq&&maxValue<=labelInfo.end_freq){
          this.xLabelGridInfo[order].draw_zoom = newZoom;
          let newCenter=minValue+Math.floor((maxValue-minValue)/2);
          this.xLabelGridInfo[order].draw_zoom_freq =newCenter;
          this.xLabelGridInfo[order].show_start_freq=minValue;
          this.xLabelGridInfo[order].show_end_freq=maxValue;
          this._triggerXRangeChange('zoom', 'wheel', order);
        }
      }
    }
    
    this._scheduleDraw();
  }
  
  /**
   * 获取鼠标位置对应的值
   * @param {*} event 
   * @returns 
   */
  getMouseVal(event,digit=0){
    const rect = this.canvas.getBoundingClientRect();
    let pointx = event.clientX - rect.left;
    let pointy = event.clientY - rect.top;
    let x=null;
    let y=null;
    let order =null;
    
    if(pointy<this.options.grid.top){
      y=this.options.yaxis.max_value;
    }else if(pointy>this.height-this.options.grid.bottom){
      y=this.options.yaxis.min_value;
    }else{
      y=this.options.yaxis.max_value-(pointy-this.options.grid.top)/this.chartHeight*(this.options.yaxis.max_value-this.options.yaxis.min_value);
    }

    if(pointx<this.options.grid.left){
      x=this.xLabelGridInfo[0]?.show_start_freq||0;
      order=0;
    }else{
      pointx=pointx-this.options.grid.left;
      for(let i=0;i<this.xLabelGridInfo.length;i++){
        if(pointx>=this.xLabelGridInfo[i].start_x&&pointx<=this.xLabelGridInfo[i].end_x){
          x=this.xLabelGridInfo[i].show_start_freq+(pointx-this.xLabelGridInfo[i].start_x)/this.xLabelGridInfo[i].width*(this.xLabelGridInfo[i].show_end_freq-this.xLabelGridInfo[i].show_start_freq);
          x=Math.floor(x);
          order=i;
          break;
        }
      }
    }
    
    if(digit==0){
      y=Math.floor(y);
    }else{
      y=parseFloat(y.toFixed(digit));
    }
    
    return {x,y,order};
  }
  
  /**
   * 获取当前鼠标位置信息
   * @param {Object} event - 鼠标事件
   * @returns {Object} 位置信息 {x, y, freq, level, rawFreq, rawLevel}
   */
  getMousePositionInfo(event){
    const mouseVal = this.getMouseVal(event, 2);
    const mouseLevel = this.getMousePositionLevel({
      pointx: event.offsetX,
      pointy: event.offsetY
    });
    
    let rawFreq = mouseVal.x;
    
    // 优先使用真实频率
    if(this.tracesData.length>0 && rawFreq!==null){
      for(let i=0;i<this.tracesData.length;i++){
        const trace=this.tracesData[i];
        if(!trace.visible||!trace.datainfo)continue;
        for(let j=0;j<trace.datainfo.length;j++){
          const dataInfo=trace.datainfo[j];
          if(dataInfo._freqs && dataInfo._freqs.length>0){
            let minDiff=Infinity,nearestIdx=0;
            for(let k=0;k<dataInfo._freqs.length;k++){
              let diff=Math.abs(dataInfo._freqs[k]-rawFreq);
              if(diff<minDiff){minDiff=diff;nearestIdx=k;}
            }
            rawFreq=dataInfo._freqs[nearestIdx];
            break;
          }
        }
        if(rawFreq!==mouseVal.x)break;
      }
    }
    
    return {
      x: rawFreq,
      y: mouseVal.y,
      freq: rawFreq ? (rawFreq / 1000000).toFixed(6) + ' MHz' : '--',
      level: mouseLevel.y && mouseLevel.y.length > 0 
        ? Math.max(...mouseLevel.y).toFixed(2) + ' ' + (this.options.yaxis.unit || 'dBμV')
        : '--',
      rawFreq: rawFreq,
      rawLevel: mouseLevel.y && mouseLevel.y.length > 0 ? Math.max(...mouseLevel.y) : null
    };
  }
  /**
   * 获取当前鼠标所在位置频率和强度
   * @param {*} event 
   */
  getMousePoint(event,digit=0){
    const rect = this.canvas.getBoundingClientRect();
    return {
      pointx:event.clientX-rect.left,
      pointy:event.clientY-rect.top
    };
  }
  
  /**
   * 获取鼠标当前强度
   * @param {*} data 点坐标
   * @returns 
   */
  getMousePositionLevel(data){
    let pointx=data.pointx;
    let pointy=data.pointy;
    let x=null;
    let xorder =null;
    let y=[];
    let order =null;
    
    if(pointx<this.options.grid.left||pointx>this.options.grid.left+this.chartWidth){
      return {x,y,xorder,order,pointx,pointy};
    }else{
      let diff_x=pointx-this.options.grid.left;
      for(let i=0;i<this.xLabelGridInfo.length;i++){
        if(diff_x>=this.xLabelGridInfo[i].start_x&&diff_x<=this.xLabelGridInfo[i].end_x){
          if(this.xLabelGridInfo[i].lineType=="step"){
            diff_x=diff_x-this.xLabelGridInfo[i].drawStepPx/2;
            if(diff_x<0)diff_x=0;
          }
          x=this.xLabelGridInfo[i].show_start_freq+(diff_x-this.xLabelGridInfo[i].start_x)/this.xLabelGridInfo[i].width*(this.xLabelGridInfo[i].show_end_freq-this.xLabelGridInfo[i].show_start_freq);
          x=Math.floor(x);
          order=i;
          if(this.tracesData[0]?.datainfo[i]==undefined||this.tracesData[0].datainfo[i]?.data==undefined){
            y=[];
            break;
          }
          xorder=Math.round((x-this.xLabelGridInfo[i].start_freq)/(this.xLabelGridInfo[i].end_freq-this.xLabelGridInfo[i].start_freq)*(this.tracesData[0].datainfo[i]?.data.length-1));
          if(xorder!==undefined&&xorder!==null){
            for (let j = 0; j < this.tracesData.length; j++){
              let linedata=this.tracesData[j].datainfo[order]?.data;
              if(linedata)y.push(linedata[xorder]);
            }
          }else{
            y=[];
          }
          break;
        }
      }
      return {x,y,xorder,order,pointx,pointy};
    }
  }
  
  /**
   * 获取鼠标当前区域
   * @param {*} event 
   * @returns 
   */
  _getMousePosition(events) {
    // 优先使用传入的事件对象，避免 window.event 干扰（移动端 touch 事件中 window.event 是 TouchEvent，没有 clientX）
    var event = events || window.event;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    var result="";
    
    if (x < 0 || x > this.width || y < 0 || y > this.height) {
      result=null;
    }else if (x < this.options.grid.left) {
      result="left";
    } else if (y < this.options.grid.top) {
      result="top";
    } else if (x > this.canvas.width - this.options.grid.right) {
      result="right";
    } else if (y > this.canvas.height - this.options.grid.bottom) {
      result="bottom";
    } else {
      result="grid";
    }
    this.focusType=result;
    return result;
  }
  
  /**
   * 获取配置
   */
  getOptions(){
    return this.options;
  }
  
  /**
   * 设置配置项
   * @param {*} options 
   */
  setOptions(options){
    let newoptions = deepMerge(this.options,options);
    this._initOptions(newoptions);
    // 同步瀑布图配置
    this._waterfall.applyConfig(this.options.waterfall);
  }

  /**
   * 切换图表类型（瀑布图 <-> 折线图）
   * @param {'line'|'waterfall'} type - 目标图表类型
   * @param {Object} [extraOptions] - 可选的额外配置，会与当前 options 合并（如 center_freq、span 等）
   */
  setChartType(type, extraOptions = {}) {
    if (type !== 'line' && type !== 'waterfall') {
      console.warn('[sptmChart] setChartType: 不支持的类型，只接受 "line" 或 "waterfall"');
      return;
    }
    if (this.options.chart_type === type) return;

    // 停止当前刷新
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // 合并新 chart_type 及额外配置
    const patchOptions = deepMerge({ chart_type: type }, extraOptions);
    const mergedOptions = deepMerge(this.options, patchOptions);
    this._initOptions(mergedOptions);

    // 同步瀑布图模块配置
    this._waterfall.applyConfig(this.options.waterfall);

    // 切换到瀑布图时，清空旧帧缓冲，避免历史数据干扰
    if (type === 'waterfall') {
      this._waterfall.clearData();
    }

    // 重新绘制
    this._draw();
  }
  
  /*
  * 获取类型
  */
  getChartType() {
    return this.options.chart_type;
  }










  //========== Marker公共API ==========
  
    /**
   * 添加 Marker
   * @param {boolean} isShow - 是否显示
   * @param {boolean} isFocus - 是否获取焦点
   * @param {number} traceId - 跟随的谱线 ID，不传或 0 表示第一条谱线
   * @returns {number} Marker ID
   */
  addMarker(isShow=true, isFocus=true, traceId=0){
    const maxCount=this.options.marker?.maxCount||10;
    if(this._markerList.size>=maxCount){
      return 0;
    }
    
    const id=this._nextMarkerId++;
    
    const sceneRect={
      x:this.options.grid.left,
      y:this.options.grid.top,
      width:this.chartWidth,
      height:this.chartHeight
    };
    
    const markerOptions={
      shape:this.options.marker?.shape||0,
      verticalLine:this.options.marker?.verticalLine!==false,
      crossLine:this.options.marker?.crossLine||false,
      scutchonVisible:this.options.marker?.scutchonVisible!==false,//是否显示标牌
      followTraceY:this.options.marker?.followTraceY||false,  // 跟随谱线 Y 轴位置
      traceYOffset:this.options.marker?.traceYOffset||-10,    // 谱线 Y 轴偏移
      traceId: traceId || 0,  // 跟随的谱线 ID，0 表示第一条
      colorGroup:this.options.marker?.colorGroup
    };
    
    const marker=new MarkerItem(id,sceneRect,markerOptions);
    marker.setVisible(isShow);
    
    //设置碰撞检测
    marker.setCollidingFunc((m,sourceRect,advisedRect)=>{
      const otherMarkers=this.getMarkerList(true).filter(item=>item!==m);
      const result=MarkerItem.getAdvisedRect(sourceRect,otherMarkers,sceneRect);
      Object.assign(advisedRect,result);
    });
    
    //事件回调
    marker.onFocusChanged((focus)=>{
      if(focus){
        this._focusMarkerId=id;
        this._markerList.forEach((item,mid)=>{
          if(mid!==id && item.hasFocus()){
            item.setFocus(false);
          }
        });
      }
      this._scheduleDraw();
    });

    marker.onVisibleChanged(()=>this._scheduleDraw());
    marker.onMarkerPtChanged(()=>this._scheduleDraw());
    
    this._markerList.set(id,marker);
    
    if(isFocus){
      this.setMarkerFocus(id);
    }
    
    //初始化位置（中心）
    if(this.chartWidth>0 && this.chartHeight>0){
      const centerX=this.options.grid.left+this.chartWidth/2;
      const centerY=this.options.grid.top+this.chartHeight/2;
      marker.setMarkerPt({x:centerX,y:centerY});
      marker.setScutchonAnchor({x:centerX,y:centerY});
    }
    
    this._draw();
    return id;
  }

  
  /**
   * 删除Marker
   * @param {number} id - Marker ID，0表示删除最后添加的
   * @returns {boolean} 是否成功
   */
  deleteMarker(id=0){
    if(id===0){
      const lastId=Math.max(...this._markerList.keys(),0);
      if(lastId>0){
        this._markerList.delete(lastId);
        if(this._focusMarkerId===lastId){
          this._focusMarkerId=0;
        }
        this._draw();
        return true;
      }
      return false;
    }
    
    if(!this._markerList.has(id))return false;
    this._markerList.delete(id);
    if(this._focusMarkerId===id){
      this._focusMarkerId=0;
    }
    this._draw();
    return true;
  }
  
  /**
   * 设置Marker显示状态
   * @param {number} id - Marker ID
   * @param {boolean} isShow - 是否显示
   * @returns {boolean} 是否成功
   */
  setMarkerShow(id,isShow){
    const marker=this._markerList.get(id);
    if(!marker)return false;
    marker.setVisible(isShow);
    this._draw();
    return true;
  }
  
  /**
   * 设置Marker焦点
   * @param {number} id - Marker ID
   * @returns {boolean} 是否成功
   */
  setMarkerFocus(id){
    const marker=this._markerList.get(id);
    if(!marker)return false;
    
    for(const [mid,m] of this._markerList){
      if(mid!==id){
        m.setFocus(false);
      }
    }
    
    marker.setFocus(true);
    this._focusMarkerId=id;
    this._draw();
    return true;
  }
  
  /**
   * 获取焦点Marker ID
   * @returns {number} 焦点Marker ID
   */
  getMarkerFocusId(){
    return this._focusMarkerId;
  }
  
  /**
   * 移动Marker到指定频率
   * @param {number} id - Marker ID
   * @param {number} freqHz - 目标频率(Hz)
   * @returns {boolean} 是否成功
   */
  moveMarkerByFreq(id,freqHz){
    const marker=this._markerList.get(id);
    if(!marker)return false;
    
    const x=this._freqToX(freqHz);
    if(x===null)return false;
    
    const currentPt=marker.markerPt();
    marker.setMarkerPt({x,y:currentPt.y});
    marker.setScutchonAnchor({x,y:currentPt.y});
    marker.setFrequency(freqHz);
    
    this._updateMarkerData(marker);
    this._draw();
    return true;
  }
  
  /**
   * 获取Marker当前频率
   * @param {number} id - Marker ID，0表示获取焦点Marker
   * @returns {number} 频率(Hz)
   */
  getMarkerFreq(id=0){
    if(id===0)id=this._focusMarkerId;
    const marker=this._markerList.get(id);
    return marker?marker.getFrequency():0;
  }
  
  /**
   * 设置Marker颜色
   * @param {number} id - Marker ID，0表示所有
   * @param {number} colorType - 颜色类型 0-7
   * @param {string} color - 颜色值
   * @returns {boolean} 是否成功
   */
  setMarkerColor(id,colorType,color){
    const colorMap={
      0:'noFocusBackground',
      1:'activeForeground',
      2:'inactiveForeground',
      3:'crossBorderText',
      4:'scutchonBackground',
      5:'scutchonForeground',
      6:'lineColor',
      7:'focusBackground'
    };
    
    const colorKey=colorMap[colorType];
    if(!colorKey)return false;
    
    if(id===0){
      this._markerList.forEach(marker=>{
        const colorGroup=marker.getColorGroup();
        colorGroup[colorKey]=color;
        marker.setColorGroup(colorGroup);
      });
    }else{
      const marker=this._markerList.get(id);
      if(!marker)return false;
      const colorGroup=marker.getColorGroup();
      colorGroup[colorKey]=color;
      marker.setColorGroup(colorGroup);
    }
    this._draw();
    return true;
  }
  
  /**
   * 获取所有Marker列表
   * @param {boolean} onlyVisible - 是否仅显示可见的
   * @returns {Array} Marker数组
   */
  getMarkerList(onlyVisible=false){
    const list=[];
    for(const [id,marker] of this._markerList){
      if(!onlyVisible || marker.isVisible()){
        list.push(marker);
      }
    }
    return list;
  }
  
  /**
   * 清除所有Marker
   */
  clearAllMarkers(){
    this._markerList.clear();
    this._focusMarkerId=0;
    this._nextMarkerId=1;
    this._draw();
  }
  
    /**
   * 设置 Marker 全局可见性
   * @param {boolean} visible - 是否可见
   */
  setMarkerGlobalVisible(visible){
    if(this.options.marker){
      this.options.marker.visible=visible;
    }
    this._draw();
  }
  
  /**
   * 设置 Marker 跟随的谱线 ID
   * @param {number} markerId - Marker ID
   * @param {number} traceId - 谱线 ID，0 表示第一条谱线
   * @returns {boolean} 是否成功设置
   */
  setMarkerTraceId(markerId, traceId=0){
    const marker = this._markerList.get(markerId);
    if(!marker) return false;
    
    marker.setTraceId(traceId || 0);
    this._updateMarkerData(marker);
    this._draw();
    return true;
  }

  /**
   * 获取 Marker 当前跟随的谱线 ID
   * @param {number} markerId - Marker ID，0 表示焦点 Marker
   * @returns {number} 谱线 ID，失败返回 -1
   */
  getMarkerTraceId(markerId=0){
    if(markerId === 0) markerId = this._focusMarkerId;
    if(markerId === 0) return -1;
    
    const marker = this._markerList.get(markerId);
    return marker ? marker.getTraceId() : -1;
  }

  /**
   * 获取所有可用谱线 ID 列表
   * @returns {Array} 谱线 ID 数组
   */
  getAvailableTraceIds(){
    return this.tracesData
      .filter(trace => trace.visible)
      .map(trace => trace.id);
  }

  /**
   * 退出 Marker 焦点
   * @returns {boolean} 是否成功退出
   */
  exitMarkerFocus(){
    if(this._focusMarkerId === 0)return false;
    
    const marker = this._markerList.get(this._focusMarkerId);
    if(marker){
      marker.setFocus(false);
    }
    
    this._focusMarkerId = 0;
    this._draw();
    return true;
  }
  
  /**
   * 检查是否有焦点 Marker
   * @returns {boolean} 是否有焦点
   */
  hasMarkerFocus(){
    return this._focusMarkerId > 0;
  }

    /**
   * 处理右键菜单动作
   * @private
   */
  _handleContextMenuActions(actions,event){
    if(!actions || !Array.isArray(actions))return;
    
    actions.forEach(action => {
      // 支持字符串类型的内置动作
      if(typeof action === 'string'){
        switch(action){
          case 'exitFocus':
            this.exitMarkerFocus();
            break;
          case 'clearMarkers':
            this.clearAllMarkers();
            break;
          case 'getPosition':
            // 获取当前鼠标位置信息
            const mouseVal = this.getMouseVal(event, 2);
            const mouseLevel = this.getMousePositionLevel({
              pointx: event.offsetX,
              pointy: event.offsetY
            });
            
            const positionInfo = {
              x: mouseVal.x,
              y: mouseVal.y,
              freq: mouseVal.x ? (mouseVal.x / 1000000).toFixed(6) + ' MHz' : '--',
              level: mouseLevel.y && mouseLevel.y.length > 0 
                ? Math.max(...mouseLevel.y).toFixed(2) + ' ' + (this.options.yaxis.unit || 'dBμV')
                : '--',
              rawFreq: mouseVal.x,
              rawLevel: mouseLevel.y && mouseLevel.y.length > 0 ? Math.max(...mouseLevel.y) : null
            };
            
            // 如果配置了回调，则调用回调
            if(this.options.contextMenu?.onGetPosition){
              this.options.contextMenu.onGetPosition(positionInfo, event);
            }
            console.log('当前位置信息:', positionInfo);
            break;
          case 'custom':
            // 触发自定义事件
            if(this.options.contextMenu?.onCustomAction){
              this.options.contextMenu.onCustomAction(null, event, {
                chart: this,
                mouseVal: this.getMouseVal(event),
                focusMarkerId: this._focusMarkerId
              });
            }
            break;
        }
      }
      // 支持对象类型的自定义动作
      else if(typeof action === 'object' && action !== null){
        const { type, label, handler } = action;
        
        // 如果是 getPosition 类型，自动获取位置信息
        if(type === 'getPosition'){
          const mouseVal = this.getMouseVal(event, 2);
          const mouseLevel = this.getMousePositionLevel({
            pointx: event.offsetX,
            pointy: event.offsetY
          });
          
          const positionInfo = {
            x: mouseVal.x,
            y: mouseVal.y,
            freq: mouseVal.x ? (mouseVal.x / 1000000).toFixed(6) + ' MHz' : '--',
            level: mouseLevel.y && mouseLevel.y.length > 0 
              ? Math.max(...mouseLevel.y).toFixed(2) + ' ' + (this.options.yaxis.unit || 'dBμV')
              : '--',
            rawFreq: mouseVal.x,
            rawLevel: mouseLevel.y && mouseLevel.y.length > 0 ? Math.max(...mouseLevel.y) : null
          };
          
          // 如果有自定义 handler，调用它
          if(handler && typeof handler === 'function'){
            handler(positionInfo, event, { chart: this });
          }
          // 否则使用默认回调
          else if(this.options.contextMenu?.onGetPosition){
            this.options.contextMenu.onGetPosition(positionInfo, event);
          }
        }
        // 其他自定义类型
        else if(handler && typeof handler === 'function'){
          handler(event, {
            chart: this,
            mouseVal: this.getMouseVal(event),
            focusMarkerId: this._focusMarkerId
          });
        }
      }
    });
  }

  // ========== 中心频率信息框 API ==========
  
  /**
   * 设置中心频率信息框显示状态
   * @param {boolean} visible - 是否显示
   */
  setCenterInfoVisible(visible){
    if(this.options.centerinfo){
      this.options.centerinfo.visible = visible;
    }
    this._draw();
  }
  
  /**
   * 获取中心频率信息框显示状态
   * @returns {boolean} 是否显示
   */
  isCenterInfoVisible(){
    return this.options.centerinfo?.visible || false;
  }
  
  /**
   * 设置中心频率信息框位置
   * @param {string} position - 位置：top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
   */
  setCenterInfoPosition(position){
    if(this.options.centerinfo){
      this.options.centerinfo.position = position;
    }
    this._draw();
  }
  
  /**
   * 设置中心频率信息框偏移量
   * @param {number} offsetX - X 方向偏移
   * @param {number} offsetY - Y 方向偏移
   */
  setCenterInfoOffset(offsetX, offsetY){
    if(this.options.centerinfo){
      this.options.centerinfo.offsetX = offsetX;
      this.options.centerinfo.offsetY = offsetY;
    }
    this._draw();
  }
  
  /**
   * 设置中心频率信息框背景颜色
   * @param {string} color - 颜色值
   */
  setCenterInfoBackground(color){
    if(this.options.centerinfo){
      this.options.centerinfo.background = color;
    }
    this._draw();
  }
  
  /**
   * 设置中心频率信息框文本颜色
   * @param {string} color - 颜色值
   */
  setCenterInfoTextColor(color){
    if(this.options.centerinfo){
      this.options.centerinfo.text_color = color;
    }
    this._draw();
  }
  
  /**
   * 设置中心频率信息框字体大小
   * @param {number} size - 字体大小（像素）
   */
  setCenterInfoFontSize(size){
    if(this.options.centerinfo){
      this.options.centerinfo.font_size = size;
    }
    this._draw();
  }
  
  /**
   * 设置中心频率信息框显示内容
   * @param {Object} config - 配置对象
   * @param {boolean} config.show_center_freq - 显示中心频率
   * @param {boolean} config.show_current_freq - 显示当前频率
   * @param {boolean} config.show_level - 显示强度
   */
  setCenterInfoContent(config){
    if(this.options.centerinfo){
      if(config.show_center_freq !== undefined){
        this.options.centerinfo.show_center_freq = config.show_center_freq;
      }
      if(config.show_current_freq !== undefined){
        this.options.centerinfo.show_current_freq = config.show_current_freq;
      }
      if(config.show_level !== undefined){
        this.options.centerinfo.show_level = config.show_level;
      }

    }
    this._draw();
  }

  /**
   * 销毁插件实例，清理事件监听器、定时器和 DOM 元素，避免内存泄漏
   * @public
   */
  destroy() {
    // 1. 取消挂起的 requestAnimationFrame
    this._cancelScheduledDraw();

    // 2. 清理自动刷新定时器
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // 3. 清理选框定时器
    if (this._selectionBox && this._selectionBox.timer) {
      clearTimeout(this._selectionBox.timer);
      this._selectionBox.timer = null;
    }

    // 4. 清理 resize debounce 定时器
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }

    // 5. 移除 canvas 事件监听器
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._boundHandleMousedown);
      this.canvas.removeEventListener('mouseup', this._boundHandleMouseup);
      this.canvas.removeEventListener('mousemove', this._boundHandleMousemove);
      this.canvas.removeEventListener('mouseout', this._boundHandleMouseout);
      this.canvas.removeEventListener('wheel', this.wheelListener);
      this.canvas.removeEventListener('dblclick', this._boundHandleDblClick);
      this.canvas.removeEventListener('click', this._boundHandleClick);
      this.canvas.removeEventListener('contextmenu', this._boundHandleContextMenu);
      // 移除移动端触控事件
      this.canvas.removeEventListener('touchstart', this._boundHandleTouchStart);
      this.canvas.removeEventListener('touchmove', this._boundHandleTouchMove);
      this.canvas.removeEventListener('touchend', this._boundHandleTouchEnd);
      this.canvas.removeEventListener('touchcancel', this._boundHandleTouchCancel);
    }

    // 6. 移除 window 事件监听器
    window.removeEventListener('keydown', this._boundHandleKeydown);
    window.removeEventListener('keyup', this._boundHandleKeyup);
    window.removeEventListener('resize', this._boundResizeHandler);

    // 7. 移除 thresholdDiv 事件监听器
    if (this.thresholdDiv) {
      this.thresholdDiv.removeEventListener('mousedown', this._boundHandleThresholdMousedown);
      this.thresholdDiv.removeEventListener('mousemove', this._boundHandleThresholdMousemove);
      this.thresholdDiv.removeEventListener('mouseout', this._boundHandleThresholdMouseout);
      this.thresholdDiv.removeEventListener('mouseup', this._boundHandleThresholdMouseout);
      // 移除移动端触控事件
      this.thresholdDiv.removeEventListener('touchstart', this._boundHandleThresholdTouchStart);
      this.thresholdDiv.removeEventListener('touchmove', this._boundHandleThresholdTouchMove);
      this.thresholdDiv.removeEventListener('touchend', this._boundHandleThresholdTouchEnd);
      this.thresholdDiv.remove();
      this.thresholdDiv = null;
    }

    // 清理长按定时器
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    // 8. 移除 freqTip DOM 元素（已改为Canvas绘制，无需移除）
    this.fretipDiv = null;

    // 9. 移除 canvas 和容器
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }

    // 10. 清空 Marker 列表（先清理每个 Marker 的回调引用，避免闭包泄漏）
    if (this._markerList) {
      this._markerList.forEach(marker => {
        marker.onFocusChanged = null;
        marker.onVisibleChanged = null;
        marker.onMarkerPtChanged = null;
      });
      this._markerList.clear();
      this._markerList = null;
    }

    // 11. 清理 waterfall 模块
    if (this._waterfall) {
      this._waterfall.clear?.();
      this._waterfall = null;
    }

    // 12. 断开对 box 的引用
    if (this.box) {
      this.box.innerHTML = '';
      this.box = null;
    }

    // 13. 释放上下文引用
    this.ctx = null;
  }

}

// Compatibility for ES5 environments
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = sptmChart;
// }
export {MarkerItem, sptmChart};
export default sptmChart;