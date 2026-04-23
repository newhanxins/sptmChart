import './index.css'
import {deepMerge,deepCopy,calculateStepValues,calculateWidths,truncateNumber} from './utils'
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
    this.initOptions(options);
    this.setCanvasSize();
    this.refreshInterval=null;
    this.isDraw=true
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
    this.throttleDelay=options.throttleDelay||100;//节流延迟
    this.lastCallTime=0//用于节流时间
    this.wheelListener=this.handleWheel.bind(this)
    this.init();
    this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
    this.canvas.addEventListener('mouseup',this.mouseup.bind(this))
    this.canvas.addEventListener('mousemove', this.mousemove.bind(this));
    this.canvas.addEventListener('mouseout',this.mouseout.bind(this))
    this.canvas.addEventListener('wheel', this.wheelListener);
    this.canvas.addEventListener('dblclick', this.handleDblClick.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    window.addEventListener('keydown', this.handleKeydown.bind(this));
    window.addEventListener('keyup', this.handleKeyup.bind(this));
    // 监听窗口调整大小
    window.addEventListener('resize', () => this.resizeCanvas());
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
    //初始门限滑块
    this.initthreshold();
    //初始化提示框
    this.initFredTip();
    
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
  _updateMarkerDatas(marker){
    const pt=marker.markerPt();
    const freq=this._xToFreq(pt.x);
    
    if(freq===null)return;
    
    const traceLevels=[];
    let targetY=null;
    let targetTraceIndex = -1;  // 目标谱线索引
    
    // 获取 Marker 跟随的谱线 ID
    const followTraceId = marker.getTraceId() || 0;
    
    // 第一次遍历：找到目标谱线的数据
    for(let i=0;i<this.tracesData.length;i++){
      const trace=this.tracesData[i];
      if(!trace.visible||!trace.datainfo)continue;
      
      // 如果指定了谱线 ID，只处理该谱线
      //if(followTraceId > 0 && trace.id !== followTraceId)continue;
      
      for(let j=0;j<this.xLabelGridInfo.length;j++){
        const info=this.xLabelGridInfo[j];
        if(freq<info.show_start_freq||freq>info.show_end_freq)continue;
        
        const dataInfo=trace.datainfo[j];
        if(!dataInfo||!dataInfo.data)continue;
        
        const ratio=(freq-info.start_freq)/(info.end_freq-info.start_freq);
        const index=Math.round(ratio*(dataInfo.data.length-1));
        
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
          
          // 计算谱线 Y 轴坐标
          if(targetY===null && marker.isFollowTraceY()){
            const yPixel=this.height - this.options.grid.bottom - ((level - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
            targetY=yPixel+marker.getTraceYOffset();
          }
        }
      }
    }
    
    marker.setFrequency(freq);
    
    //构建标牌文本
    const scutchonList=[];
    const freqMHz=(freq/1000000).toFixed(6);
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
        
        const ratio=(freq-info.start_freq)/(info.end_freq-info.start_freq);
        const index=Math.round(ratio*(dataInfo.data.length-1));
        
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
    
    marker.setFrequency(freq);
    
    //构建标牌文本
    const scutchonList=[];
    const freqMHz=(freq/1000000).toFixed(6);
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
    
    this.draw();
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
  initOptions(options) {
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
          "activeForeground": "#239ee7",
          "inactiveForeground": "#535353",
          "noFocusBackground": "#bfbfbf",
          "focusBackground": "#ff9800",
          "crossBorderText": "#ff0000",
          "lineColor": "#9e9e9e",
          "scutchonBackground": "rgba(49, 52, 69, 0.9)",
          "scutchonForeground": "#ffffff"
        },
        "clickBlankToExit": false  // 点击空白区域退出焦点
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
      }
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

  
  init(){
    this.clearCanvas();
    this.initBackground();
    this.drawAxis();
    this.drawGrid();
  }
  
  /*
   *初始化门限div
  */
  initthreshold(){
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
    this.thresholdDiv.addEventListener('mousedown', this.thresholdMousedown.bind(this));
    this.thresholdDiv.addEventListener('mousemove', this.thresholdMousemove.bind(this));
    this.thresholdDiv.addEventListener('mouseout', this.thresholdMouseout.bind(this));
    this.thresholdDiv.addEventListener('mouseup', this.thresholdMouseout.bind(this));
  }
  
  initFredTip(){
    const freqTip= document.createElement('span');
    freqTip.className = 'sptmchart_freqtip';
    freqTip.style.display = 'none';
    freqTip.style.position = 'absolute';
    freqTip.style.color=this.options.level_tipline.text_color;
    freqTip.style.fontSize = `${this.options.level_tipline.text_size*this.devicePixelRatio}px`;
    this.canvas.parentNode.appendChild(freqTip);
    this.fretipDiv =freqTip
  }
  
  /**
   *清空画布
   */
  clearCanvas(){
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
  
  /**
   * 初始化背景
   */
  initBackground(){
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  /**
   * 初始化图表
   */
  drawAxis(){
    //计算x轴y轴坐标
    this.cumputeLabels();
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
  drawLegend() {
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
  drawGrid(){
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
  draw(){
    this.clearCanvas();
    this.drawAxis();
    this.drawGrid();
    this.drawLegend();
    this.drawTraces();
    this.drawOther();
    //绘制Markers
    this._drawMarkers();
    // 绘制中心频率信息框
    this.drawCenterInfoBox();
  }
  
  /*
  * 清除画布绘制
  */
  clearDraw(){
    this.clearCanvas();
  }
  clearData(){
    this.clearCanvas();
    this.drawAxis();
    this.drawGrid();
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
    this.drawChart();
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
    this.drawChart();
  }
  /**
   * 绘制图表
   */
  drawChart(){
    if(this.refreshInterval){
      clearInterval(this.refreshInterval);
      this.refreshInterval=null;
    }
    if(this.options.duration&&this.options.duration>0&&this.isDraw){
      this.refreshInterval=setInterval(()=>{
        this.draw();
      },this.options.duration)
    }else{
      this.draw();
    }
  }
  
  /**
   * 绘制门限
   */
  drawThreshold(){
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
  drawTipLine(){
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
        this.tipFreqLevel(mouselevel)
      }else{
        this.options.level_tipline.is_draw=false;
        this.fretipDiv.style.display="none";
      }
      
    }else{
      this.options.level_tipline.is_draw=false;
      this.fretipDiv.style.display="none";
    }
  }
  
  drawOther(){
    //绘制门限
    this.drawThreshold();
    //绘制提示线
    this.drawTipLine();
  }
  
    /**
   * 绘制中心频率信息框
   */
  drawCenterInfoBox(){
    if(!this.options.centerinfo.visible)return;
    
    const info = this.options.centerinfo;
    const padding = info.padding * this.devicePixelRatio;
    const fontSize = info.font_size * this.devicePixelRatio;
    const lineHeight = fontSize * 1.4;
    
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
    
    // 计算文本框大小
    this.ctx.font = `${fontSize}px Arial`;
    let maxWidth = 0;
    for(const line of lines){
      const metrics = this.ctx.measureText(line);
      if(metrics.width > maxWidth)maxWidth = metrics.width;
    }
    
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;
    const borderRadius = info.border_radius * this.devicePixelRatio;
    
    // 计算位置
    let boxX, boxY;
    const baseOffsetX = info.offsetX * this.devicePixelRatio;
    const baseOffsetY = info.offsetY * this.devicePixelRatio;
    
    switch(info.position){
      case 'top-left':
        boxX = baseOffsetX;
        boxY = baseOffsetY;
        break;
      case 'top-center':
        boxX = (this.width - boxWidth) / 2 + baseOffsetX;
        boxY = baseOffsetY;
        break;
      case 'top-right':
        boxX = this.width - boxWidth + baseOffsetX;
        boxY = baseOffsetY;
        break;
      case 'bottom-left':
        boxX = baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      case 'bottom-center':
        boxX = (this.width - boxWidth) / 2 + baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      case 'bottom-right':
        boxX = this.width - boxWidth + baseOffsetX;
        boxY = this.height - boxHeight + baseOffsetY;
        break;
      default:
        boxX = (this.width - boxWidth) / 2;
        boxY = baseOffsetY;
    }
    
    // 绘制背景
    this.ctx.save();
    this.ctx.fillStyle = info.background;
    
    // 绘制圆角矩形
    const r = borderRadius;
    this.ctx.beginPath();
    this.ctx.moveTo(boxX + r, boxY);
    this.ctx.lineTo(boxX + boxWidth - r, boxY);
    this.ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
    this.ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
    this.ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
    this.ctx.lineTo(boxX + r, boxY + boxHeight);
    this.ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
    this.ctx.lineTo(boxX, boxY + r);
    this.ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    this.ctx.closePath();
    this.ctx.fill();
    
    // 绘制文本
    this.ctx.fillStyle = info.text_color;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    for(let i=0; i<lines.length; i++){
      const textY = boxY + padding + i * lineHeight;
      this.ctx.fillText(lines[i], boxX + padding, textY);
    }
    
    this.ctx.restore();
  }

  


  /**
   *停止绘制
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
    this.drawChart();
  }

  /**
   * 设置瀑布图行缩放比
   * @param {number} scale 行缩放比（0.1 - 5.0）
   */
  setWaterfallRowScale(scale){
    if (this.options.chart_type !== 'waterfall') return;
    this._waterfall.setRowScale(scale);
    this.drawChart();
  }
  
  /**
   * 绘制谱线
   */
  drawTraces(){
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
          this.drawTypeLine(this.tracesData[i],j);
        }
      }
    }
  }


  /**
   * 判断绘制图表线类型
   * @param {*} datas 
   */
  drawTypeLine(lineData,order){
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
    }
    
    //数据抽点处理
    if(data.drawData.length>drawWidth){
      data.lineType='pointline';
      let pointdata=this.extractTwoPolesTraceLine(data.data,data.data.length,drawWidth);
      data.drawData=pointdata;
    }else if(data.drawData.length===drawWidth){
      data.lineType='line';
      data.drawData=data.data;
    }else{
      data.lineType='step';
    }
    
    this.drawLine(data);
  }
  
  /**
   * 绘制线
   * @param {*} datas 谱线数据
   */
  drawLine(data){
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
        let x = startx + i * drawStepPx;
        if(x>this.width-this.options.grid.right||x<this.options.grid.left)break;
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
        let x1 = startx + j * drawStepPx-drawStepPx/2;
        let x2 = startx+ j * drawStepPx+drawStepPx/2;
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
        let x = startx+ i * drawStepPx;
        if(x>this.width-this.options.grid.right||x<this.options.grid.left)break;
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
   * 保留最大最小方式抽点
   * @param {*} data 源数据
   * @param {*} dataLen 源数据长度
   * @param {*} targetLen 目标长度
   */
  extractTwoPolesTraceLine(data,dataLen,targetLen){
    let targetData=[];
    let dataIndex=[];
    let targetCout=0;
    let selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen);
    let isMaxSelected=false;
    let maxValue=0,minValue=0;
    let maxIndex=-1,minIndex=-1;
    
    for(let j=0;j<dataLen;j++){
      if(isMaxSelected){
        if(data[j]>maxValue){
          maxValue=data[j];
          maxIndex=j;
        }
        if(data[j]<minValue){
          minValue=data[j];
          minIndex=j;
        }
      }else{
        maxValue=data[j];
        minValue=data[j];
        maxIndex=j;
        minIndex=j;
        isMaxSelected=true;
      }
      
      if(selectIndex==j){
        targetData[targetCout]=[maxValue,minValue];
        dataIndex[targetCout]=[maxIndex,minIndex];
        targetCout++;
        isMaxSelected=false;
        selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen);
      }
    }
    return {targetData,dataIndex};
  }
  
  /**
   * 频谱源数据索引值
   * @param {*} dataLen 源数据长度
   * @param {*} targetIndex 目标索引值
   * @param {*} targetLen 目标长度
   */
  selectDataIndex(dataLen,targetIndex,targetLen){
    if(targetIndex>=dataLen||dataLen==0||targetLen==0)return 0;
    if(targetLen==1)return Math.floor(dataLen/2);
    if(targetLen==dataLen)return targetIndex;
    if(dataLen>targetLen){
      return Math.floor((targetIndex+1)*dataLen/targetLen)-1;
    }else{
      return Math.floor(targetIndex*dataLen/targetLen);
    }
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
    this.drawChart();
  }
  
  /**
   * 设置谱线数据
   * @param {*} id 谱线id
   * @param {*} data 谱线数据
   */
  setTraceData(id,data){
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].id === id) {
        if (this.options.chart_type === 'waterfall') {
          // 瀑布图模式：将数据追加到帧缓冲区（而非覆盖）
          // data 格式：{ point, step, start_freq, end_freq, width, data: [], time }
          const maxRows = this.options.waterfall?.max_rows || 100;
          this._waterfall.pushRow(data, maxRows);
          this.isDraw = true;
          this.drawChart();
          return;
        } else {
          this.tracesData[i].datainfo=data;
        }
        break;
      }
    }
    this.isDraw=true;
    this.drawChart();
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
    this.drawChart();
  }
  /**
   * 计算标签
   */
  cumputeLabels(){
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
  mousedown(event) {
    //先检查是否点击了Marker
    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };
    
    const dpiPair={x:96*this.devicePixelRatio,y:96*this.devicePixelRatio};
    
    for(const [id,marker] of this._markerList){
      if(marker.isVisible() && marker.containsPoint(point,dpiPair)){
        this._markerDragState.isDragging=true;
        this._markerDragState.dragMarkerId=id;
        this._markerDragState.lastX=point.x;
        this._markerDragState.lastY=point.y;
        this.setMarkerFocus(id);
        marker.handlePressEvent(point);
        return;
      }
    }
    
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
  mouseup(event) {
    // 瀑布图模式：结束色系拖动
    if (this.options.chart_type === 'waterfall') {
      this._waterfall.endDrag();
    }
    if(this._markerDragState.isDragging){
      const marker=this._markerList.get(this._markerDragState.dragMarkerId);
      if(marker){
        marker.handleReleaseEvent({
          x:this._markerDragState.lastX,
          y:this._markerDragState.lastY
        });
      }
      this._markerDragState.isDragging=false;
      this._markerDragState.dragMarkerId=0;
      this.draw();
      return;
    }
    
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
    this.ctx.canvas.style.cursor = 'default';
  }
  
    /**
   * 鼠标移动
   * @param {*} event 
   */
  mousemove(event) {
    //拖动
    if(this._markerDragState.isDragging){
      const rect=this.canvas.getBoundingClientRect();
      const point={
        x:event.clientX-rect.left,
        y:event.clientY-rect.top
      };
      
      const clampedX=Math.max(this.options.grid.left,Math.min(this.width-this.options.grid.right,point.x));
      const clampedY=Math.max(this.options.grid.top,Math.min(this.height-this.options.grid.bottom,point.y));
      
      const marker=this._markerList.get(this._markerDragState.dragMarkerId);
      if(marker){
        marker.handleMoveEvent({x:clampedX,y:clampedY});
        this._updateMarkerData(marker);
        // 更新标牌锚点位置，确保拖动时标牌跟随
        marker.setScutchonAnchor({x:clampedX,y:clampedY});
      }
      
      this._markerDragState.lastX=clampedX;
      this._markerDragState.lastY=clampedY;
      this.draw();
      return;
    }
    
    let x = event.offsetX;
    let y = event.offsetY;
    
    if (this.mousedownInfo.isMouseDown) {
      // 瀑布图色系条拖动
      if (this.options.chart_type === 'waterfall' && this._waterfall._colorBarDrag.active) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseY = event.clientY - rect.top;
        this._waterfall.handleColorBarDrag(mouseY, false);
        this.drawChart();
        return;
      }

      if(this.moveInfo.preX==0){
        this.moveInfo.preX = this.mousedownInfo.startX;
        this.moveInfo.preY = this.mousedownInfo.startY;
      }
      const moveX = event.offsetX - this.moveInfo.preX;
      const moveY = this.moveInfo.preY-event.offsetY;
      
      if (Math.abs(moveX) > Math.abs(moveY)) {
        let mouseVal=this.getMouseVal(event);
        let order=mouseVal.order;
        if(order!==null){
          let labelInfo=this.xLabelGridInfo[order];
          let moveVal=Math.ceil(Math.abs(labelInfo.show_end_freq-labelInfo.show_start_freq)/labelInfo.width*moveX);
          if(moveVal==0)moveVal=Math.sign(moveX);
          let minval=labelInfo.show_start_freq-moveVal;
          let maxval=labelInfo.show_end_freq-moveVal;
          if(minval>=labelInfo.start_freq&&maxval<=labelInfo.end_freq){
            this.xLabelGridInfo[order].show_start_freq=minval;
            this.xLabelGridInfo[order].show_end_freq=maxval;
            let newCenter=minval+Math.floor((maxval-minval)/2);
            this.xLabelGridInfo[order].draw_zoom_freq=newCenter;
            // 频率范围改变时，更新 Marker 位置
            this._updateMarkersPositionByFreq();
            this.drawChart();
          }
        }
      } else {
        let moveVal=Math.ceil(Math.abs(this.options.yaxis.max_value-this.options.yaxis.min_value)/this.chartHeight*moveY);
        if(moveVal==0)moveVal=Math.sign(moveY);
        let minval=this.options.yaxis.min_value-moveVal;
        let maxval=this.options.yaxis.max_value-moveVal;
        if(minval>=this.options.yaxis.floor_value&&maxval<=this.options.yaxis.ceiling_value){
          this.options.yaxis.min_value=minval;
          this.options.yaxis.max_value=maxval;
          // Y 轴范围改变时，如果 Marker 跟随谱线，也需要更新位置
          this._updateMarkersPositionByFreq();
          this.drawChart();
        }
      }
    }else{
      let type=this.getMousePosition(event);
      if(type=="grid"){
        let point=this.getMousePoint(event);
        this.options.level_tipline.point=point;
        // 使用 throttle 节流，避免频繁重绘导致卡顿
        this.throttle(()=>{
          this.draw();
        });
      }
    }
    
    this.moveInfo={
      isMove:true,
      preX:event.offsetX,
      preY:event.offsetY,
      moveX:event.offsetX,
      moveY:event.offsetY
    }
  }

  
  
  /**
   * 鼠标移出控件
   * @param {*} event 
   */
  mouseout(event){
    event.preventDefault();
    this.mousedownInfo.isMouseDown=false;
    this.moveInfo={
      isMove:false,
      preX:0,
      preY:0,
      moveX:0,
      moveY:0
    }
  }
  
  /**
   * 鼠标滚轮事件
   * @param {*} event
   * 
   */
  handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    this.throttle(()=>{
      this.handleZoom(event,delta);
    });
  }
  
  throttle(callback){
    const now=Date.now();
    if(!this.lastCallTime)this.lastCallTime=0;
    if(now-this.lastCallTime>=this.throttleDelay){
      this.lastCallTime=now;
      callback();
    }
  }
  
  /**
   * 双击事件
   * @param {*} event 
   */
  handleDblClick(event) {
    console.log("handleDblClick", event);
    // 获取当前频率
    const mouseVal=this.getMouseVal(event);
  }
  
  /**
   * 点击事件
   * @param {*} event 
   */
  handleClick(event) {
    const rect=this.canvas.getBoundingClientRect();
    const point={
      x:event.clientX-rect.left,
      y:event.clientY-rect.top
    };
    
    //先尝试点击Marker
    if(this._handleMarkerClick(point)){
      return;
    }
    
    //如果没有点击Marker，且在网格区域，移动焦点Marker
    const type=this.getMousePosition(event);
    if(type=="grid" && this._focusMarkerId>0){
      this._moveFocusMarkerToPoint(point);
    }else if(type !== "grid" && this._focusMarkerId>0 && this.options.marker?.clickBlankToExit){
      // 如果点击了空白区域且配置了点击空白退出焦点
      this.exitMarkerFocus();
    }
  }
  
  /*
   * 鼠标右键事件
   * @param {*} event
   */
  handleContextMenu(event) {
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
  handleKeydown(event) {
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
  handleKeyup(event) {
    console.log("handleKeyup按键松开事件", event);
  }
  
  /**
   * 门限图标鼠标按下事件
   * @param {*} event 
   */
  thresholdMousedown(event) {
    this.focusType="threshold";
    this.thresholdFouce=true;
  }
  
  /**
   * 门限拖动事件
   * @param {*} event 
   */
  thresholdMousemove(event) {
    if(this.thresholdFouce){
      const leves=this.getMouseVal(event,2).y;
      this.options.threshold.level=leves;
      this.drawChart();
    }
  }
  
  /**
   * 门限拖动结束事件
   * @param {*} event 
   */
  thresholdMouseout(event) {
    this.thresholdFouce=false;
  }
  
  /*
  *显示强度提示框
  */
  tipFreqLevel(data){
    if(this.options.level_tipline.is_draw){
      this.fretipDiv.style.display="block";
      if(data.pointx - this.options.grid.left > this.chartWidth/2){
        this.fretipDiv.style.left="";
        this.fretipDiv.style.right=`${this.width-data.pointx+10}px`;
      }else{
        this.fretipDiv.style.right="";
        this.fretipDiv.style.left=`${data.pointx+10}px`;
      }
      this.fretipDiv.style.top=`${this.options.grid.top+40}px`;
      let levels=Math.max(...data.y);
      let centtext=this.options.yaxis.axis_function(levels);
      if(isNaN(centtext)){
        centtext="--";
      }
      if(this.options.level_tipline.freq_visible){
        this.fretipDiv.innerText=`强度：${centtext}${this.options.yaxis.unit} \n频率：${data.x/1000000} MHz`;
      }else{
        this.fretipDiv.innerText=`强度：${centtext}${this.options.yaxis.unit}`;
      }
    }else{
      this.fretipDiv.style.display="none";
    }
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
    this.draw();
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
    this.draw();
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
  handleZoom(event,delta) {
    // 瀑布图模式：色系条 / 时间轴 / 行缩放 + X轴缩放
    if (this.options.chart_type === 'waterfall') {
      let type=this.getMousePosition(event);
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
          let newZoom=labelInfo.draw_zoom+delta*4;
          let zoomSpan = Math.floor(initSpan /newZoom/2)*2;
          if(zoomSpan<=initSpan&&zoomSpan>=6){
            let centerVal=mouseVal.x;
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
            }
          }
        }
      }
      if (handled) this.drawChart();
      return;
    }

    let type=this.getMousePosition(event);
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
      }
    }else if(type=="bottom" || type=="grid"){
      let mouseVal=this.getMouseVal(event,0);
      if(mouseVal.order!==null){
        let order=mouseVal.order;
        let labelInfo=this.xLabelGridInfo[order];
        let initSpan=labelInfo.span;
        let newZoom=labelInfo.draw_zoom+delta*4;
        let zoomSpan = Math.floor(initSpan /newZoom/2)*2;
        if(zoomSpan>initSpan)return false;
        if(zoomSpan < 6)return false;
        let centerVal=mouseVal.x;
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
        }
      }
    }
    
    this.drawChart();
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
    
    return {
      x: mouseVal.x,
      y: mouseVal.y,
      freq: mouseVal.x ? (mouseVal.x / 1000000).toFixed(6) + ' MHz' : '--',
      level: mouseLevel.y && mouseLevel.y.length > 0 
        ? Math.max(...mouseLevel.y).toFixed(2) + ' ' + (this.options.yaxis.unit || 'dBμV')
        : '--',
      rawFreq: mouseVal.x,
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
  getMousePosition(events) {
    var event = window.event||events;
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
    this.initOptions(newoptions);
    // 同步瀑布图配置
    this._waterfall.applyConfig(this.options.waterfall);
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
      this.draw();
    });
    
    marker.onVisibleChanged(()=>this.draw());
    marker.onMarkerPtChanged(()=>this.draw());
    
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
    
    this.draw();
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
        this.draw();
        return true;
      }
      return false;
    }
    
    if(!this._markerList.has(id))return false;
    this._markerList.delete(id);
    if(this._focusMarkerId===id){
      this._focusMarkerId=0;
    }
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
  }
  
    /**
   * 设置 Marker 全局可见性
   * @param {boolean} visible - 是否可见
   */
  setMarkerGlobalVisible(visible){
    if(this.options.marker){
      this.options.marker.visible=visible;
    }
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
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
    this.draw();
  }
  
  /**
   * 设置中心频率信息框背景颜色
   * @param {string} color - 颜色值
   */
  setCenterInfoBackground(color){
    if(this.options.centerinfo){
      this.options.centerinfo.background = color;
    }
    this.draw();
  }
  
  /**
   * 设置中心频率信息框文本颜色
   * @param {string} color - 颜色值
   */
  setCenterInfoTextColor(color){
    if(this.options.centerinfo){
      this.options.centerinfo.text_color = color;
    }
    this.draw();
  }
  
  /**
   * 设置中心频率信息框字体大小
   * @param {number} size - 字体大小（像素）
   */
  setCenterInfoFontSize(size){
    if(this.options.centerinfo){
      this.options.centerinfo.font_size = size;
    }
    this.draw();
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
    this.draw();
  }




}

// Compatibility for ES5 environments
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = sptmChart;
// }
export {MarkerItem, sptmChart};
export default sptmChart;