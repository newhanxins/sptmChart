import './index.css'
import {deepMerge,deepCopy,calculateStepValues,calculateWidths,truncateNumber} from './utils'
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
    // if (window.devicePixelRatio) {
    //   this.canvas.style.width = this.width + "px";
    //   this.canvas.style.height = this.height + "px";
    //   this.canvas.height = this.height * window.devicePixelRatio;
    //   this.canvas.width = this.width * window.devicePixelRatio;
    //   this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // }
    this.chartWidth = 0;//图表宽度
    this.chartHeight = 0;//图表高度
    // this.yLabelGridInfo={}//y轴标签网格信息
    // this.xLabelGridInfo=[]//x轴标签网格信息
    this.ygridStep=0//图表网格步进宽度
    // this.zoomMax=10//缩放最大值
    // this.zoomMin=1//缩放最小值
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
  }
  /**
   * 设置图表大小
   */
  setCanvasSize(widths, heights) {
    
    const width = widths||this.options.width;
    const height = heights||this.options.height;
    const containerWidth = this.box.clientWidth||400;
    const containerHeight = this.box.clientHeight||300;
    // 使用实际像素大小设置 Canvas
    this.canvas.width = width === "100%" ? containerWidth : width;
    this.canvas.height = height === "100%" ? containerHeight: height;

    // 设置 CSS 样式，确保 Canvas 在视觉上保持相应比例
    this.canvas.style.width = width === "100%" ? `${containerWidth}px` : `${width}px`;
    this.canvas.style.height = height === "100%" ? `${containerHeight}px`: `${height}px`;
    this.width =this.canvas.width;
    this.height =this.canvas.height;
    // 更新字体大小以适应高分辨率
    //this.options.fontSize = `${parseInt(this.options.fontSize) * window.devicePixelRatio}px`;
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
      "height": 300,//画布高度
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
        "xgrid_show": true,//是否显示X轴网格线
        "xgrid_line_dash":[],//X轴网格线虚线样式[5, 5]实，虚
        "ygrid_show": true,//是否显示Y轴网格线
        "ygrid_line_dash":[],//Y轴网格线虚线样式
        "center_line_show": false,//是否显示中心线
        "center_color": "#FF0000",//X轴中心线颜色
        "center_width": 1 //X轴中心线宽度
      },
      "legend":{
        "visible": false,//是否显示图例
      },
      "xaxis":{ //X轴样式
        "number": 5,//X轴网格线数量
        "unit":"",//单位MHz 为空不显示 
        "unit_two_line": true, // x轴单位是否需要换行
        "unit_right": 10, // x轴单位距离图表左侧距离
        "decimals": "",//X轴刻度标签小数位数
        "dscan_freq":[//DScan模式下的频率范围 [起始频率，结束频率] 传入多个范围时，则分段显示
          // {
          //   "start_freq": 0,//X轴起始频率
          //   "end_freq": 0,//X轴结束频率
          //   "width":1,//X轴线宽度 1多条时等比宽度
          // }
        ],
        "dscan_space": 10,//DScan模式下的频段间隔像素
        "text_color": "#343434",//X轴文本颜色
        "text_font_size": 12,//X轴文本字体大小
        "text_font_family": "Arial",//X轴文本字体
        "color": "#333",//X轴线颜色
        "width": 1,//X轴线宽度
        "labels":[//*X轴刻度标签
          [{
              "offsetx": 0,//X轴刻度标签值
              "text": 19,//X轴刻度标签
            },
            {
              "offsetx": 30,//X轴刻度标签值
              "text": 20,//X轴刻度标签
            }
          ]
        ],
        "label_two_line": true, // Dscan模式下分段数据第一个是否需要换行 
        "label_angle":0,//*X轴刻度标签角度
        "draw_zoom_freq":"",//*X轴绘制缩放基准频率
        "draw_zoom_span":"",//*X轴绘制缩放基准显宽
      },
      "yaxis":{ //Y轴样式
        "number": 5,//Y轴网格线数量
        "unit":"",//单位 dBμV dBm dBμV/m 为空不显示 
        "decimals": "",//X轴刻度标签小数位数
        "fixedStep": 20,//Y轴刻度值间隔
        "init_min_value": -30,//*Y轴最小值
        "init_max_value": 60,//*Y轴最大值
        "min_value": -30,//Y轴最小值
        "max_value": 60,//Y轴最大值
        "floor_value": -60,//Y轴最小值范围
        "ceiling_value": 140,//Y轴最大值范围
        "text_color": "#343434",//Y轴文本颜色
        "text_font_size": 12,//Y轴文本字体大小
        "text_font_family": "Arial",//Y轴文本字体
        "color": "#333",//Y轴线颜色
        "width": 1,//Y轴线宽度
        "axis_function":function(value){
          return value
        },//Y轴刻度值计算函数
        "zoom_value": "",//*Y轴缩放基准值
        "labels":[],//*Y轴刻度标签
      },
      "marker":{ //marker样式
        "visible": true,//是否显示marker
        "tip_show": true,//是否显示提示框
        "freqdiff_show": true,//是否显示频率差弹窗
        "is_add": true,//是否可以添加marker
        "color": "#FF0000",//marker颜色
        "width": 1,//marker宽度
        "focus_color": "#FF0000",//marker选中颜色
        "focus_width": 1,//marker选中宽度
        "text_color": "#FFFFFF",//提示框文本颜色
        "text_font_size": 12,//提示框文本字体大小
        "text_font_family": "Arial",//提示框文本字体
        "background": "#000000",//提示框背景色
        "border_radius": 6,//提示框圆角
        "difftext_color": "#FF0000",//频率差框文本颜色
        "difftext_font_size": 12,//频率差文本字体大小
        "difftext_font_family": "Arial",//频率差文本字体
        "diff_background": "#000000",//频率差背景色
        "diff_border_radius": 6,//频率差圆角
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
      "sptm_area":{ //FFT频谱区域
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
        "text_font_size": 12,//谱值提示文本字体大小
        "is_draw":false,//*是否绘制鼠标在网格区域内，有数据值
        "point": {//*鼠标所在x轴坐标
          "pointx": 0,//鼠标所在x轴坐标
          "pointy": 0,//鼠标所在y轴坐标
        },
      }
    }
    const mergedOptions = deepMerge({}, defaultOptions);
    this.options = deepMerge(mergedOptions,options);
    //初始化参数和DPR计算
    this.options.grid.left=Math.floor(this.options.grid.left*this.devicePixelRatio);
    this.options.grid.bottom=Math.floor(this.options.grid.bottom*this.devicePixelRatio);
    this.options.grid.top=Math.floor(this.options.grid.top*this.devicePixelRatio);
    this.options.grid.right=Math.floor(this.options.grid.right*this.devicePixelRatio);
    this.options.yaxis.init_min_value=this.options.yaxis.min_value
    this.options.yaxis.init_max_value=this.options.yaxis.max_value
    this.yLabelGridInfo={}//y轴标签网格信息
    this.xLabelGridInfo=[]//x轴标签网格信息
    
    //if(this.options.yaxis.max_value-this.options.yaxis.min_value<=this.options.yaxis.fixedStep||){
      this.options.yaxis.fixedStep=(this.options.yaxis.ceiling_value-this.options.yaxis.floor_value)/(this.options.yaxis.number-1)
    //}
    console.log("初始化配置",this.options.yaxis.fixedStep)
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
    //const xLabelStep = (this.width - this.options.grid.left - this.options.grid.right) / (this.options.xaxis.labels.length - 1);
    this.options.xaxis.labels.forEach((data, index) => {
      for (let j = 0; j < data.length; j++) {
        const items = data[j];
        const texts = truncateNumber(items.text, this.options.xaxis.decimals);
        let angleInRadians = this.options.xaxis.label_angle * Math.PI / 180; // 将角度转换为弧度

        var x = this.options.grid.left + items.offsetx ;
        var y = this.height - this.options.grid.bottom + 8;

        if (this.options.xaxis.label_two_line) {
          this.ctx.textAlign = 'center';
          // 第一个点错位
          if (index > 0 && j == 0) {
            y = this.height - this.options.grid.bottom + this.options.grid.bottom / 2;
          }
          this.ctx.fillText(texts, x, y); // 绘制文字
        } else {
          if (this.options.xaxis.label_angle > 0) {
            this.ctx.save(); // 保存当前绘图状态
            this.ctx.translate(x, y); // 原点移动到移动到标签位置
            this.ctx.rotate(angleInRadians); // 应用旋转变换
            this.ctx.fillText(texts, 0, 0); // 绘制旋转后的文字
            this.ctx.restore(); // 恢复上下文状态
          } else {
            this.ctx.textAlign = 'center';
            let halfWidth = this.ctx.measureText(texts).width / 2

            if (j === data.length - 1 && index < this.options.xaxis.labels.length - 1) {
              x = this.options.grid.left + items.offsetx - halfWidth;
            }
            if (index > 0 && j == 0) {
              x = this.options.grid.left + items.offsetx + halfWidth;
            }
            this.ctx.fillText(texts, x, y); // 绘制文字
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

    // 绘制y轴标签
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
  /**
   * 绘制图例
   */
  drawLegend() {
    const { grid, legend } = this.options;
    if(!legend.visible)return false;
    // 计算每个标签的宽度并累加
    const legendItems = this.tracesData.map((data, index) => {
        if(data.visible){
          const label = data.name || `数据 ${index + 1}`;
          const color=data.color;
          const width = this.ctx.measureText(label).width + 20; // 加上间距
          return { label, width ,color};
        }
    });

    // 计算总宽度

    const totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width + 15, 0)-20; // 15是方块宽度加间距

    // 设置图例的X坐标，确保水平居中
    const legendX = (this.width - totalLegendWidth) / 2;

    const legendY = grid.top/2;

    this.ctx.fillStyle = legend.color;

    // 绘制每个数据集的图例
    let currentX = legendX; // 当前X坐标，用于排列图例
    legendItems.forEach((item, index) => {
        this.ctx.fillStyle = item.color;
        this.ctx.fillRect(currentX, legendY-5, 10, 10); // 绘制颜色方块
        this.ctx.fillStyle = legend.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(item.label, currentX + 20, legendY); // 绘制标签
        currentX += item.width+15; // 更新当前X坐标
    });
  }
  /**
   * 绘制网格
   */
  drawGrid(){
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
    const gridLength = this.yLabelGridInfo.gridLabels.length
    this.ctx.strokeStyle = this.options.grid.color;
    this.ctx.setLineDash(this.options.grid.xgrid_line_dash);
    this.ctx.beginPath();
    if(this.options.grid.xgrid_show&&gridLength>0){
      
      for (let j = 0; j <= gridLength; j ++) {
        let items=this.yLabelGridInfo.gridLabels[j];
        let y=(items-this.options.yaxis.min_value)*this.yLabelGridInfo.pxStep
        this.ctx.moveTo(this.options.grid.left, this.height - this.options.grid.bottom - y);
        this.ctx.lineTo(this.width - this.options.grid.right, this.height - this.options.grid.bottom - y);
        this.ctx.stroke();
      }
    }
    //恢复线样式
    this.ctx.setLineDash([]);
    if(this.options.grid.center_line_show){
      //y中心线
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
      //门限线
      
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
   * 绘制谱线
   */
  drawTraces(){
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].datainfo.length>0&&this.tracesData[i].visible) {
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
    //console.log("绘制谱线数据",lineData)
    let data=lineData.datainfo[order]
    data.width=lineData.width
    data.color=lineData.color
    data.type=lineData.type
    data.drawData=data.data.slice(0);
    data.order=order//数据序号
    //X轴标签网格信息
    let labelInfo=this.xLabelGridInfo[data.order]
    let drawWidth=labelInfo.width

    //截取区域内点数
    if(labelInfo.start_freq!==labelInfo.show_start_freq||labelInfo.end_freq!==labelInfo.show_end_freq){
      //需要截取数据
      // let startOrder=Math.floor((labelInfo.show_start_freq-labelInfo.start_freq)*(labelInfo.end_freq-labelInfo.start_freq)/data.point)
      // let endOrder=Math.floor((labelInfo.show_end_freq-labelInfo.start_freq)*(labelInfo.end_freq-labelInfo.start_freq)/data.point)
      let startOrder=Math.floor((labelInfo.show_start_freq-labelInfo.start_freq)*data.point/(labelInfo.end_freq-labelInfo.start_freq))
      let endOrder=Math.floor((labelInfo.show_end_freq-labelInfo.start_freq)*data.point/(labelInfo.end_freq-labelInfo.start_freq))
      data.drawData=data.data.slice(startOrder,endOrder)
    }
    if(data.drawData.length>drawWidth){
      //数据过多抽点
      let type="maxmin"
      let pointdata=""
      if(type=="maxmin"){
        data.lineType='pointline'
        pointdata=this.extractTwoPolesTraceLine(data.data,data.data.length,drawWidth)
        data.drawData=pointdata
        //this.drawPointLineTrace(data)
      }else{
        data.lineType='line'
        pointdata=this.extractTraceData(data.data,data.data.length,drawWidth)
        data.drawData=pointdata
        //this.drawLineTrace(data)
      }
    }else if(data.drawData.length==drawWidth){
      data.lineType='line'
      data.drawData=data.data
      //this.drawLineTrace(data)
    }else{
      data.lineType='step'
      //this.drawStepTrace(data)
    }
    this.drawLine(data)
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
    // 裁剪谱线超过图表区域的部分
    this.ctx.clip(); 
    this.ctx.beginPath();
    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth = data.width || 1;
    let linedata=data.drawData
    if(data.lineType=='pointline'){
      linedata=data.drawData.targetData
    }
    //X轴标签网格信息
    let labelInfo=this.xLabelGridInfo[data.order]
    //console.log("绘制线",data,labelInfo)
    let drawStepPx=labelInfo.width/(linedata.length-1)
    // if(data.lineType=='step'){
    //   drawStepPx=labelInfo.width/(linedata.length-1)
    // }
    
    //数据不完整
    // if(data.point>data.data.length){
      
    //   let drawWidth=data.data.length/data.point*labelInfo.width
    //   drawStepPx=drawWidth/(linedata.length-1)
    // }
    //更新当前绘制点间隔像素
    labelInfo.drawStepPx=drawStepPx;
    labelInfo.lineType=data.lineType
    if(data.lineType=='line'){
      //线性
      for (let i = 0; i < linedata.length; i++) {
        let point = linedata[i];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        let x = startx + i * drawStepPx;
        if(x>this.width-this.options.grid.right||x<this.options.grid.left){
          break;
        }
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        // if(y>(this.height -this.options.grid.bottom)){
        //   y=this.height -this.options.grid.bottom
        // }
        // if(y<this.options.grid.top){
        //   y=this.options.grid.top
        // }
        if(i==0){
          this.ctx.moveTo(x, y);
        }else{
          this.ctx.lineTo(x, y);
        }
      }
    }else if(data.lineType=='step'){
      //步进线
      for (let j = 0; j < data.drawData.length; j++) {
        let point = data.drawData[j];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        //第一个点一半
        let x1 = startx + j * drawStepPx-drawStepPx/2;
        let x2 = startx+ j * drawStepPx+drawStepPx/2;
        // let x1 = startx + j * drawStepPx;
        // let x2 = startx+ j * drawStepPx+drawStepPx;
        if(x1<this.options.grid.left){
          x1=this.options.grid.left;
        }
        if(x2>(this.width-this.options.grid.right)){
          x2=this.width-this.options.grid.right
        }
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        // if(y>(this.height -this.options.grid.bottom)){
        //   y=this.height -this.options.grid.bottom
        // }
        // if(y<this.options.grid.top){
        //   y=this.options.grid.top
        // }
        
        if(j==0){
          this.ctx.moveTo(startx, y);
          this.ctx.lineTo(x2, y);
        }else{
          // 先水平线到下一个 x，再垂直线到下一个 y
          this.ctx.lineTo(x1, y); // 水平线
          this.ctx.lineTo(x2, y); // 垂直线
        }
      }
    }else if(data.lineType=='pointline'){
      //大小点线
      for (let i = 0; i < linedata.length; i++) {
        let point = linedata[i][0];
        let minpoint = linedata[i][1];
        let startPointPx=labelInfo.start_x;
        let startx=this.options.grid.left+startPointPx;
        let x = startx+ i * drawStepPx;
        if(x>this.width-this.options.grid.right||x<this.options.grid.left){
          break;
        }
        let y = this.height - this.options.grid.bottom - ((point - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        let y1 = this.height - this.options.grid.bottom - ((minpoint - this.options.yaxis.min_value) /(this.options.yaxis.max_value - this.options.yaxis.min_value)) * this.chartHeight;
        
        // if(y>(this.height -this.options.grid.bottom)){
        //   y=this.height -this.options.grid.bottom
        // }
        // if(y<this.options.grid.top){
        //   y=this.options.grid.top
        // }
        // if(y1>(this.height -this.options.grid.bottom)){
        //   y1=this.height -this.options.grid.bottom
        // }
        // if(y1<this.options.grid.top){
        //   y1=this.options.grid.top
        // }
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
    this.isDraw=true
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
        this.tracesData[i].datainfo=data;
        break;
      }
    }
    this.isDraw=true
    this.drawChart();
  }
  /**
   * 设置单频谱线数据
   * @param {*} id 
   * @param {*} dataInfo 
   */
  setFFTTraceData(id,dataInfo){
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].id === id) {
        this.tracesData[i].datainfo=dataInfo;
        break;
      }
    }
    this.isDraw=true
    this.drawChart();
  }
  /**
   * 设置频段谱线数据
   * @param {*} id 
   * @param {*} dataInfo 
   */
  setDScanTraceData(id,dataInfo){
    for (let i = 0; i < this.tracesData.length; i++) {
      if (this.tracesData[i].id === id) {
        this.tracesData[i].datainfo=dataInfo;
        break;
      }
    }
    this.drawChart();
  }
  /**
   * 计算标签
   */
  cumputeLabels(){
    this.options.xaxis.labels=[];
    this.options.yaxis.labels=[];
    
    //计算图表宽高
    this.chartWidth=Math.floor(this.width - this.options.grid.left - this.options.grid.right)
    this.chartHeight=Math.floor(this.height - this.options.grid.top - this.options.grid.bottom)
    //计算网格步进
    const yWidth=this.chartHeight/(this.options.yaxis.number-1);
    const yStepLabels=calculateStepValues(yWidth,this.options.yaxis.min_value,this.options.yaxis.max_value,this.options.yaxis.fixedStep,this.yZoom,this.options.yaxis.floor_value,this.options.yaxis.ceiling_value,this.options.yaxis.number);
    this.yLabelGridInfo=yStepLabels;
    //更新Y轴范围
    this.options.yaxis.min_value=yStepLabels.minValue;
    this.options.yaxis.max_value=yStepLabels.maxValue;
    console.log("cumputeLabels计算y轴",this.options.yaxis.max_value,this.options.yaxis.min_value)
    this.options.grid.right = this.width - this.options.grid.left - this.chartWidth;
    this.options.grid.bottom = this.height - this.options.grid.top - this.chartHeight;
    this.ygridStep=yStepLabels.labelStep
    if(this.options.type=="DScan"){
      //一条频段
      let xCoutWidth=[this.chartWidth];
      let dscan_freq=this.options.xaxis.dscan_freq
      let dscan_space=this.options.xaxis.dscan_space
      let drawArray=[]//x轴标签
      
      //计算起始点
      let startPointPx=0;
      let widths=[]
      for(let j=0;j<dscan_freq.length;j++){
        let itemdata=dscan_freq[j];
        widths.push(itemdata.width)
      }
      //计算宽度
      let widthVal=calculateWidths(this.chartWidth,widths,dscan_space)
      xCoutWidth=widthVal.widths;
      for(let i=0;i<dscan_freq.length;i++){
        let itemdata=dscan_freq[i];
        let datastartFreq=itemdata.start_freq;
        let dataendFreq=itemdata.end_freq;
        let datacenterFreq=datastartFreq+(dataendFreq-datastartFreq)/2;
        let dataspan=dataendFreq-datastartFreq;
        //初始
        let centerFreq=datacenterFreq
        let span=dataspan
        let zoom=1;
        if(this.xLabelGridInfo.length>0){
          let drawInfo=this.xLabelGridInfo[i]
          if(drawInfo.draw_zoom_freq!==""){
            centerFreq=drawInfo.draw_zoom_freq
          }
          if(drawInfo.draw_zoom!==""){
            zoom=drawInfo.draw_zoom
          }
        }

        //缩放显宽
        let xspan=Math.floor(span/zoom/2)*2;
        let startFreq=centerFreq-xspan/2
        let endFreq=startFreq+xspan
        let labelCout= this.options.xaxis.number
        let freqStep=xspan/(labelCout-1)
        let labelStepPx=xCoutWidth[i]/(labelCout-1)

        if(startFreq&&freqStep){
          let labels=[];
          
          for(let j=0;j<labelCout;j++){
            var xVal=startFreq+j*freqStep;
            let labelObj={
              "text":xVal/1000000,
              "offsetx":startPointPx+labelStepPx*j
            };
            labels.push(labelObj);
          }
          this.options.xaxis.labels.push(labels);
        }
        let drawAxis={
          "start_freq": datastartFreq,//X轴起始频率
          "end_freq": dataendFreq,//X轴结束频率
          "width":xCoutWidth[i],//X轴绘制宽度
          "span":dataspan,//当前显示显宽
          "freqStep":freqStep,//*X轴频率刻度间隔
          "labelStepPx":labelStepPx,//X轴label间隔像素
          "show_start_freq":startFreq,//显示起始频率
          "show_end_freq":endFreq,//显示结束频率
          "start_x":startPointPx,//*X轴起始位置
          "end_x":startPointPx+xCoutWidth[i],//*X轴结束位置
          "drawStepPx":"",//*X轴当前绘制点间隔像素
          "draw_zoom":zoom,//*缩放层级
          "draw_zoom_freq":centerFreq,//*缩放位置的频率
          "draw_zoom_span":xspan//*缩放时显宽
        }
        drawArray.push(drawAxis)
        //增加初始位置
        startPointPx+=(xCoutWidth[i]+widthVal.spacing)
      }
      this.xLabelGridInfo=drawArray
    }else{
      //单频
      let zoom=1;
      if(this.options.center_freq!==""&&this.options.span!==""){
        let centerFreq=this.options.center_freq;
        let span=this.options.span;
        if(this.xLabelGridInfo.length>0){
          let drawInfo=this.xLabelGridInfo[0]
          if(drawInfo.draw_zoom_freq!==""){
            centerFreq=drawInfo.draw_zoom_freq
          }
          if(drawInfo.draw_zoom!==""){
            zoom=drawInfo.draw_zoom
          }
        }
        
        //缩放显宽
        let xspan=Math.floor(span/zoom/2)*2;
        let startFreq=centerFreq-xspan/2
        let endFreq=startFreq+xspan
        let labelCout=this.options.xaxis.number
        let freqStep=xspan/(labelCout-1)
        let labelStepPx=this.chartWidth/(labelCout-1)
        if(startFreq&&freqStep){
          let labels=[];
          for(let j=0;j<this.options.xaxis.number;j++){
            var xVal=startFreq+j*freqStep;
            let labelObj={
              "text":xVal/1000000,
              "offsetx":labelStepPx*j
            };
            labels.push(labelObj);
          }
          this.options.xaxis.labels.push(labels);
        }
        let drawAxis={
          "start_freq": this.options.center_freq-this.options.span/2,//X轴初始起始频率
          "end_freq": this.options.center_freq+this.options.span/2,//X轴初始结束频率
          "width":this.chartWidth,//X轴绘制宽度
          "span":this.options.span,//初始显宽
          "freqStep":freqStep,//*X轴频率刻度间隔
          "labelStepPx":labelStepPx,//X轴label间隔像素
          "show_start_freq":startFreq,//显示起始频率
          "show_end_freq":endFreq,//显示结束频率
          "start_x":0,//*X轴起始位置
          "end_x":this.chartWidth,//*X轴结束位置
          "drawStepPx":"",//*X轴当前绘制点间隔像素
          "draw_zoom":zoom,//*缩放层级
          "draw_zoom_freq":centerFreq,//*缩放位置的频率
          "draw_zoom_span":xspan//*缩放时显宽
        }
        this.xLabelGridInfo=[drawAxis]
      }
    }
    
    if(this.options.yaxis.min_value!==""){
      if(this.options.yaxis.zoom_value==""){
        this.options.yaxis.init_min_value=this.options.yaxis.min_value;
        this.options.yaxis.init_max_value=this.options.yaxis.max_value;
        this.options.yaxis.zoom_value=this.options.yaxis.min_value+(this.options.yaxis.max_value-this.options.yaxis.min_value)/2;
      }
      for(var i=0;i<yStepLabels.labels.length;i++){
        let yVal=yStepLabels.labels[i]
        let labelObj={
          "text":yVal,
          "offsetY":(yVal-this.options.yaxis.min_value)*yStepLabels.pxStep
        };
        this.options.yaxis.labels.push(labelObj);
      }
    }
  }
  /**
   * 频谱源数据索引值（映射区最右侧点，抽取最大值）
   * @param {*} dataLen 源数据长度
   * @param {*} targetIndex 目标索引值
   * @param {*} targetLen 目标长度
   */
  selectDataIndex(dataLen,targetIndex,targetLen){
    if(targetIndex>=dataLen||dataLen==0||targetLen==0){
      return 0
    }
    if(targetLen==1){
      return Math.floor(dataLen/2)
    }else if(targetLen==dataLen){
      return targetIndex
    }else if(dataLen>targetLen){
      //源数据长度大于目标长度，则取源数据映射区
      let order=Math.floor((targetIndex+1)*dataLen/targetLen)-1
      return order
    }else{
      //源数据长度小于目标长度
      let order=Math.floor(targetIndex*dataLen/targetLen)
      return order
    }
  }
  /**
   * 谱线最大点抽点
   * @param {*} data 源数据
   * @param {*} dataLen 源数据长度
   * @param {*} targetLen 目标长度
   * @return
   */
  extractTraceData(data,dataLen,targetLen){
    let targetData=[];//目标数据
    let dataIndex=[];//源数据索引值
    let selectIndex=0;//抽取索引值
      //抽点最大值
      let targetCout=0;
      selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen)
      let isMaxSelected=false;
      let maxValue=0;
      let maxIndex=-1;
      for(let j=0;j<dataLen;j++){
        if(isMaxSelected){
          if(data[j]>maxValue){
            maxValue=data[j];
            maxIndex=j;
          }
        }else{
          maxValue=data[j];
          maxIndex=j;
          isMaxSelected=true;
        }
        if(selectIndex==j){
          //找到抽取索引值
          targetData[targetCout]=maxValue;
          dataIndex[targetCout]=maxIndex;
          targetCout++;
          isMaxSelected=false;
          selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen)
        }
      }
    
    return {
      targetData,
      dataIndex
    }
  }
  /**
   * 保留最大最小方式抽点
   * @param {*} data 源数据长度
   * @param {*} dataLen 源数据长度
   * @param {*} targetLen 目标长度
   */
  extractTwoPolesTraceLine(data,dataLen,targetLen){
    let targetData=[];//目标数据
    let dataIndex=[];//源数据索引值
    let selectIndex=0;//抽取索引值
      //抽点最大值
      let targetCout=0;
      selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen)
      let isMaxSelected=false;
      let maxValue=0;
      let minValue=0;
      let minIndex=-1;
      let maxIndex=-1;
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
          //找到抽取索引值
          targetData[targetCout]=[maxValue,minValue];
          dataIndex[targetCout]=[maxIndex,minIndex];
          targetCout++;
          isMaxSelected=false;
          selectIndex=this.selectDataIndex(dataLen,targetCout,targetLen)
        }
      }
      return {
        targetData,
        dataIndex
      }
  }
  //监听事件
  /**
   * 鼠标按下事件
   * @param {*} event 
   */
  mousedown(event) {
    this.mousedownInfo={
      isMouseDown:true,
      startX:event.offsetX,
      startY:event.offsetY,
      mouseupx:0,
      mouseupy:0,
      button:event.button
    }
    if (event.button === 0) { // 左键
        // isDragging = true;
        // startY = event.clientY;
        this.ctx.canvas.style.cursor = 'grabbing';
    } else if (event.button === 2) { // 右键
        this.ctx.canvas.style.cursor = 'grab';
    }
  }
  /**
   * 鼠标松开事件
   * @param {*} event
   */
  mouseup(event) {
    
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
    let x = event.offsetX;
    let y = event.offsetY;
    if (this.mousedownInfo.isMouseDown) {
      if(this.moveInfo.preX==0){
        this.moveInfo.preX = this.mousedownInfo.startX;
        this.moveInfo.preY = this.mousedownInfo.startY;
      }
      const moveX = event.offsetX - this.moveInfo.preX;
      const moveY = this.moveInfo.preY-event.offsetY;
      const moveDirX = event.offsetX - this.mousedownInfo.startX;
      const moveDirY = event.offsetY - this.mousedownInfo.startY;
      let moveDir = "horizontally";
      // 判断移动方向
      if (Math.abs(moveDirX) > Math.abs(moveDirY)) {
          moveDir = "horizontally";
          let mouseVal=this.getMouseVal(event);
          let order=mouseVal.order;
          if(order==null){
            //全部水平移动
          }else{
            let labelInfo=this.xLabelGridInfo[order];
            let moveVal=Math.ceil(Math.abs(labelInfo.show_end_freq-labelInfo.show_start_freq)/labelInfo.width*moveX)
            if(moveVal==0){moveVal=Math.sign(moveY)}
            let minval=labelInfo.show_start_freq-moveVal
            let maxval=labelInfo.show_end_freq-moveVal
            if(minval>=labelInfo.start_freq&&maxval<=labelInfo.end_freq){
              this.xLabelGridInfo[order].show_start_freq=minval
              this.xLabelGridInfo[order].show_end_freq=maxval
              let newCenter=minval+Math.floor((maxval-minval)/2);
              this.xLabelGridInfo[order].draw_zoom_freq =newCenter;
              this.drawChart();
            }
          }
          
      } else {
          moveDir = "vertically";
          let moveVal=Math.ceil(Math.abs(this.options.yaxis.max_value-this.options.yaxis.min_value)/this.chartHeight*moveY)
          if(moveVal==0){moveVal=Math.sign(moveY)}
          let minval=this.options.yaxis.min_value-moveVal
          let maxval=this.options.yaxis.max_value-moveVal
          
          if(minval>=this.options.yaxis.floor_value&&maxval<=this.options.yaxis.ceiling_value){
            this.options.yaxis.min_value=minval
            this.options.yaxis.max_value=maxval
            console.log("移动更改y值",this.options.yaxis.max_value,this.options.yaxis.min_value)
            this.drawChart();
          }
      }
      // 鼠标按下移动
      if (this.mousedownInfo.button === 0) { // 左键
        
      } else if (this.mousedownInfo.button === 2) { // 右键
        
      }
    }else{
      // 鼠标移动
      let type=this.getMousePosition()
      if(type=="grid"){
        let point=this.getMousePoint(event);
        //设置鼠标移动坐标
        this.options.level_tipline.point=point;
        this.drawChart();
      }else{
        if(this.options.level_tipline.is_draw){
          this.options.level_tipline.point.pointx=null;
          this.options.level_tipline.is_draw=false;
        }
        
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
    this.mousedownInfo.isMouseDown=false
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
    event.preventDefault(); // 阻止默认滚动行为
    const delta = event.deltaY < 0 ? 1 : -1; //下滚缩小，上滚放大
    //const delta = Math.sign(event.deltaY);
    this.throttle(()=>{
      console.log("执行频谱节流")
      this.handleZoom(event,delta);
    })
    
  }
  throttle(callback){
    const now=Date.now();
    if(now-this.lastCallTime>=this.throttleDelay){
      this.lastCallTime=now;
      callback()
    }
  }
  /**
   * 双击事件
   * @param {*} event 
   */
  handleDblClick(event) {
    console.log("handleDblClick", event);
  }
  /**
   * 点击事件
   * @param {*} event 
   */
  handleClick(event) {
    console.log("handleClick", event);
    let points=this.getMousePosition(event)
    console.log("points",points);
  }
  /*
   * 鼠标右键事件
   * @param {*} event
   */
  handleContextMenu(event) {
    console.log("handleContextMenu", event);
  }
  /**
   * 按键按下事件
   * @param {*} event
   */
  handleKeydown(event) {
    //console.log("handleKeydown", event);
    switch (event.keyCode) {
      case 37: // 左箭头
        console.log("左箭头");
        break;
      case 38: // 上箭头
        console.log("上箭头");
        this.changeThreshold(+0.5)
        break;
      case 39: // 右箭头
        console.log("右箭头");
        break;
      case 40: // 下箭头
        this.changeThreshold(-0.5)
      default:
        break;
    }
  }
  /**
   * 按键松开事件
   * @param {*} event 
   */
  handleKeyup(event) {
    console.log("handleKeyup按键松开事件", event);
    switch (event.keyCode) {
      case 37: // 左箭头
        console.log("左箭头松开");
        break;
      case 38: // 上箭头
        console.log("上箭头松开");
        this.options.threshold.is_mouse=false;
        break;
      case 39: // 右箭头
        console.log("右箭头松开");
        break;
      case 40: // 下箭头
        console.log("下箭头松开");
        this.options.threshold.is_mouse=false;
      default:
        break;
    }
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
        //this.drawThreshold();
        this.drawChart();
      }
      
  }
  /**
   * 门限拖动结束事件
   * @param {*} event 
   */
  thresholdMouseout(event) {
      //this.focusType="";
      this.thresholdFouce=false;
      
  }
  /*
  *显示强度提示框
  */
  tipFreqLevel(data){
    if(this.options.level_tipline.is_draw){
      this.fretipDiv.style.display="block";
      // if(data.pointx>this.chartWidth/6*5){
      //   this.fretipDiv.style.right=`${this.width-data.pointx+20}px`;
      //   this.fretipDiv.style.left=``;
      // }else{
      //   this.fretipDiv.style.right=``;
      //   this.fretipDiv.style.left=`${data.pointx+10}px`;
      // }
      if(data.pointx - this.options.grid.left > this.chartWidth/2){
        this.fretipDiv.style.left=``;
        this.fretipDiv.style.right=`${this.width-data.pointx+10}px`;
      }else{
        this.fretipDiv.style.right=``;
        this.fretipDiv.style.left=`${data.pointx+10}px`;
      }
      this.fretipDiv.style.top=`${this.options.grid.top+40}px`;
      let levels=Math.max(...data.y)
      const centtext=this.options.yaxis.axis_function(levels)
      if(this.options.level_tipline.freq_visible){
        this.fretipDiv.innerText=`强度：${centtext}${this.options.yaxis.unit} \n频率：${data.x/1000000} MHz`
      }else{
        this.fretipDiv.innerText=`强度：${centtext}${this.options.yaxis.unit}`
      }
      //this.fretipDiv.innerText=`强度：${centtext}${this.options.yaxis.unit} 频率：${data.x} MHz`
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
    this.setCanvasSize(); // 重新设置 Canvas 尺寸
    this.draw(); // 重新绘制图表以适应新尺寸
  }
  /**
   * 设置图表大小
   * @param {*} widhts 宽度
   *  @param {*} heights 高度
   */
  setChartSize(widths, heights){
    if(widths&&heights){
      this.options.width=widths
      this.options.height=heights
    }
    this.setCanvasSize(widths, heights)
    this.draw(); // 重新绘制图表以适应新尺寸
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
    let type=this.getMousePosition()
    //console.log("handleZoom",event, delta,type);
    const zoomFactor = 1.1;// 缩放因子
    
    if(type=="left"){
      let newZoom = this.yZoom+delta;
      let maxZoom = this.options.yaxis.fixedStep;
      let initMaxStep = (this.options.yaxis.ceiling_value-this.options.yaxis.floor_value)/(this.options.yaxis.number-1)
      if(newZoom<1){
        newZoom=1
        return false;
      }
      if(newZoom>initMaxStep){
        newZoom=initMaxStep
      }
      let stepVal=Math.round(initMaxStep/newZoom)
      
      if(stepVal<1){
        console.log("步进小于1")
        return false;
      }
      let nowCout=stepVal*(this.options.yaxis.number-1);
      let mouseVal=this.getMouseVal(event,0).y;
      let minValue=Math.round(mouseVal-(mouseVal-this.options.yaxis.min_value)/(this.options.yaxis.max_value-this.options.yaxis.min_value)*nowCout)
      let maxValue=Math.floor(minValue+nowCout);
      if(minValue<this.options.yaxis.floor_value){
        minValue=this.options.yaxis.floor_value;
        maxValue=minValue+nowCout;
      }
      if(maxValue>this.options.yaxis.ceiling_value){
        maxValue=this.options.yaxis.ceiling_value;
        minValue=maxValue-nowCout;
      }
      console.log("y轴计算范围",maxValue,minValue,newZoom)
      if(minValue>=this.options.yaxis.floor_value&&maxValue<=this.options.yaxis.ceiling_value&&maxValue-minValue>=(this.options.yaxis.number-1)){
          this.options.yaxis.min_value=minValue;
          this.options.yaxis.max_value=maxValue;
          this.yZoom=newZoom;
          console.log("y轴缩放步进值",stepVal,this.options.yaxis.number-1,minValue,maxValue)
          console.log("y轴缩放范围",this.options.yaxis.max_value,this.options.yaxis.min_value,newZoom)
      }
     }else if(type=="bottom"){
      //x轴缩放计算
      let mouseVal=this.getMouseVal(event,0);
      if(mouseVal.order!==null){
        let order=mouseVal.order;
        let labelInfo=this.xLabelGridInfo[order];
        let initSpan=labelInfo.span;
        let newZoom=labelInfo.draw_zoom+delta*2**2;
        let zoomSpan = Math.floor(initSpan /newZoom/2)*2;
        if(zoomSpan>initSpan){
          return false;
        }else if (zoomSpan < 6) {
          return false;
        }
        let centerVal=mouseVal.x;
        let minValue=Math.floor(centerVal-(centerVal-labelInfo.show_start_freq)/(labelInfo.show_end_freq-labelInfo.show_start_freq)*zoomSpan)
        let maxValue=Math.floor(minValue+zoomSpan);
        if(minValue<labelInfo.start_freq){
          console.log("处理超过最小值",minValue)
          minValue=labelInfo.start_freq;
          maxValue=Math.floor(minValue+zoomSpan);
        }
        if(maxValue>labelInfo.end_freq){
          console.log("处理超过最大值",maxValue)
          
          maxValue=labelInfo.end_freq;
          minValue=Math.ceil(maxValue-zoomSpan);
        }
        if(minValue>=labelInfo.start_freq&&maxValue<=labelInfo.end_freq){
          this.xLabelGridInfo[order].draw_zoom = newZoom;
          let newCenter=minValue+Math.floor((maxValue-minValue)/2);
          this.xLabelGridInfo[order].draw_zoom_freq =newCenter;
          console.log("bottom newZoom 缩放中心频率",newCenter,newZoom,"显宽",zoomSpan)
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
    // let pointx = event.offsetX;
    // let pointy = event.offsetY;
    const rect = this.canvas.getBoundingClientRect(); // 获取 Canvas 的位置和大小
    let pointx = event.clientX - rect.left; // 计算鼠标相对于 Canvas 的 X 坐标
    let pointy = event.clientY - rect.top; // 计算鼠标相对于 Canvas 的 Y 坐标
    let x=null;//x轴频率
    let y=null;//y轴频率
    let order =null;//x轴标签组序号
    if(pointy<this.options.grid.top){
      y=this.options.yaxis.max_value;
    }else if(pointy>this.height-this.options.grid.bottom){
      y=this.options.yaxis.min_value;
    }else{
      y=this.options.yaxis.max_value-(pointy-this.options.grid.top)/this.chartHeight*(this.options.yaxis.max_value-this.options.yaxis.min_value);
    }

    if(pointx<this.options.grid.left){
      x=this.xLabelGridInfo[0].show_start_freq;
      order=0
    }else{
      pointx=pointx-this.options.grid.left;
      for(let i=0;i<this.xLabelGridInfo.length;i++){
        if(pointx>=this.xLabelGridInfo[i].start_x&&pointx<=this.xLabelGridInfo[i].end_x){
          x=this.xLabelGridInfo[i].show_start_freq+(pointx-this.xLabelGridInfo[i].start_x)/this.xLabelGridInfo[i].width*(this.xLabelGridInfo[i].show_end_freq-this.xLabelGridInfo[i].show_start_freq);
          x=Math.floor(x)
          order=i;
          break;
        }
      }
    }
    if(digit==0){
      y=Math.floor(y);
    }else{
      y=y.toFixed(digit)*1;
    }
    return {x,y,order};
  }
  /**
   * 获取当前鼠标所在位置频率和强度
   * @param {*} event 
   */
  getMousePoint(event,digit=0){
    const rect = this.canvas.getBoundingClientRect(); // 获取 Canvas 的位置和大小
    let pointx = event.clientX - rect.left; // 计算鼠标相对于 Canvas 的 X 坐标
    let pointy = event.clientY - rect.top; // 计算鼠标相对于 Canvas 的 Y 坐标
    return{pointx,pointy}
  }
  /**
   * 获取鼠标当前强度
   * @param {*} data 点坐标
   * @returns 
   */
  getMousePositionLevel(data){
    let pointx=data.pointx
    let pointy=data.pointy
    let x=null;//x轴频率
    let xorder =null;//x轴线数据序号
    let y=[];//y轴强度
    let order =null;//x轴段序号
    if(pointx<this.options.grid.left||pointx>this.options.grid.left+this.chartWidth){
      return {x,y,xorder,order,pointx,pointy};
    }else{
      let diff_x=pointx-this.options.grid.left;
      for(let i=0;i<this.xLabelGridInfo.length;i++){
        if(diff_x>=this.xLabelGridInfo[i].start_x&&diff_x<=this.xLabelGridInfo[i].end_x){
          if(this.xLabelGridInfo[i].lineType=="step"){
            diff_x=diff_x-this.xLabelGridInfo[i].drawStepPx/2
            if(diff_x<0){
              diff_x=0;
            }
          }
          x=this.xLabelGridInfo[i].show_start_freq+(diff_x-this.xLabelGridInfo[i].start_x)/this.xLabelGridInfo[i].width*(this.xLabelGridInfo[i].show_end_freq-this.xLabelGridInfo[i].show_start_freq);
          x=Math.floor(x)
          order=i;
          if(this.tracesData[0].datainfo[i]==undefined||this.tracesData[0].datainfo[i]==null){
            y=[]
            break;
          }
          xorder=Math.round((x-this.xLabelGridInfo[i].start_freq)/(this.xLabelGridInfo[i].end_freq-this.xLabelGridInfo[i].start_freq)*(this.tracesData[0].datainfo[i].data.length-1));
          if(xorder!==undefined&&xorder!==null){
            for (let j = 0; j < this.tracesData.length; j++) {
                let linedata=this.tracesData[j].datainfo[order].data
                y.push(linedata[xorder]);
            }
          }else{
            y=[]
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
    var event = window.event;
    const rect = this.canvas.getBoundingClientRect(); // 获取 Canvas 的位置和大小
    const x = event.clientX - rect.left; // 计算鼠标相对于 Canvas 的 X 坐标
    const y = event.clientY - rect.top; // 计算鼠标相对于 Canvas 的 Y 坐标
    var result=""
    // 检查鼠标是否在 Canvas 内部
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
  }
}


// Compatibility for ES5 environments
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = sptmChart;
// }

export default sptmChart;