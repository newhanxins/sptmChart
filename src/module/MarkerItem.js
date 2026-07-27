/**
 * @brief MarkerItem 频谱标记类
 * @description 实现频谱控件中的Marker标记功能，包含图标、标牌、焦点状态、碰撞检测等
 * @date 2026-03-17
 */

class MarkerItem {
    // ========== 静态枚举定义 ==========
    
    /**
     * Marker形状枚举
     */
    static Shape = {
        Shape_Normal: 0,    // 常规锥形（箭头向上）
        Shape_TurnOver: 1,   // 倒置锥形（箭头向下）
        Count: 2
    };

    /**
     * Marker变更类型枚举
     */
    static ChangeType = {
        Type_Pos: 0,        // 位置改变
        Type_Focus: 1,      // 焦点改变
        Type_Visible: 2,    // 显示改变
        Type_Count: 3
    };

    /**
     * Marker配置类型枚举
     */
    static ConfigType = {
        MarkerConfig_Diff: 0,       // 两个Marker频差信息计算
        MarkerConfig_DrawYHeight: 1, // 绘制Marker在Y轴高度
        MarkerConfig_GetFreq: 2       // Marker取频率值
    };

    /**
     * Marker菜单类型枚举
     */
    static MenuType = {
        MarkerMenu_Invalid: 0,          // 无效
        MarkerMenu_SwitchMarker: 1,     // 切换Marker
        MarkerMenu_CloseMarker: 2,      // 关闭Marker
        MarkerMenu_ExitMenu: 3,         // 退出菜单
        MarkerMenu_SetCenterFreq: 4,    // 设为中心频率
        MarkerMenu_ZoomIn: 5,           // 放大
        MarkerMenu_ZoomOut: 6,          // 缩小
        MarkerMenu_LockMarker: 7,       // 锁定Marker
        MarkerMenu_AppCustom: 8         // 应用自定义
    };

    // ========== 默认配置 ==========

    /**
     * 默认颜色配置
     */
    static defaultColorGroup = {
        activeForeground: '#239ee7',           // 激活前景色（蓝色）
        inactiveForeground: '#535353',         // 未激活前景色（深灰）
        noFocusBackground: '#bfbfbf',          // 无焦点背景色（浅灰）
        focusBackground: '#ff9800',            // 有焦点背景色（橙色）
        crossBorderText: '#ff0000',            // 越界文本颜色（红色）
        lineColor: '#9e9e9e',                    // 准线颜色（灰色）
        scutchonBackground: 'rgba(49, 52, 69, 0.9)',  // 标牌背景色（半透明深色）
        scutchonForeground: '#ffffff'            // 标牌前景色（白色）
    };

    /**
     * 默认Marker配置
     */
    static defaultOptions = {
        visible: true,              // 是否显示
        shape: 0,                   // 形状 0-常规 1-倒置
        verticalLine: true,         // 是否显示垂直线
        crossLine: false,           // 是否显示十字线
        flickLine: false,           // 线是否闪烁
        hBorderDraw: true,          // 水平边界绘制效果
        vBorderDraw: false,         // 垂直边界绘制效果
        scutchonVisible: true,      // 是否显示标牌
        pressEffectEnable: true,    // 按下效果
        followTraceY: false,        // 是否跟随谱线 Y 轴位置
        traceYOffset: -10,          // 相对于谱线 Y 轴的偏移量（像素）
        traceId: 0,                 // 跟随的谱线 ID，0 表示第一条
        colorGroup: null            // 颜色组（null 使用默认）
    };

    // ========== 构造函数 ==========

    /**
     * 创建Marker实例
     * @param {number} markerID - Marker唯一标识ID
     * @param {Object} sceneRect - 绘制场景矩形 {x, y, width, height}
     * @param {Object} options - Marker配置选项
     */
    constructor(markerID, sceneRect, options = {}) {
        // 基础属性
        this._markerID = markerID;              // Marker唯一ID
        this._rect = sceneRect || { x: 0, y: 0, width: 0, height: 0 };  // 场景矩形
        
        // 合并配置
        const opts = { ...MarkerItem.defaultOptions, ...options };
        
        // 状态属性
        this._focus = false;                      // 是否有焦点
        this._visible = opts.visible;             // 是否显示
        this._markerShape = opts.shape;           // 当前形状
        this._pressEffectEnable = opts.pressEffectEnable;  // 按下效果
        
        // 位置属性
        this._markerPt = { x: 0, y: 0 };         // Marker当前位置
        this._scutchonAnchor = { x: 0, y: 0 };    // 标牌锚点位置
        this._pointIndex = -1;                   // 数据点序号
        this._frameIndex = -1;                   // 帧序号
        this._crossBorder = false;                // 是否越界
        
        // 显示属性
        this._verticalLine = opts.verticalLine;   // 垂直线
        this._crossLine = opts.crossLine;         // 十字线
        this._flickLine = opts.flickLine;         // 闪烁线
        this._hBorderDraw = opts.hBorderDraw;     // 水平边界绘制
        this._vBorderDraw = opts.vBorderDraw;      // 垂直边界绘制
        this._scutchonVisible = opts.scutchonVisible;  // 标牌显示
        this._followTraceY = opts.followTraceY;   // 跟随谱线 Y 轴位置
        this._traceYOffset = opts.traceYOffset || -10; // 谱线 Y 轴偏移
        this._traceId = opts.traceId || 0;        // 跟随的谱线 ID
        // 颜色配置
        this._colorGroup = { ...MarkerItem.defaultColorGroup, ...(opts.colorGroup || {}) };
        
        // 标牌属性
        this._scutchonList = [];                  // 标牌文本列表
        this._rectScutchon = { x: 0, y: 0, width: 0, height: 0 };  // 标牌矩形
        
        // 交互状态
        this._itemPressed = false;                // 是否按下
        this._sendPosChangeSignal = false;        // 是否发送位置变更信号
        
        // 扩展数据
        this._frequency = 0;                      // 当前频率值(Hz)
        this._collidingFunc = null;               // 碰撞检测回调
        
        // 事件回调
        this._onFocusChanged = null;              // 焦点变更回调
        this._onVisibleChanged = null;            // 显示变更回调
        this._onMarkerPtChanged = null;           // 位置变更回调
    }

    // ========== ID属性 ==========

    /**
     * 获取Marker ID
     * @returns {number} Marker唯一标识
     */
    getMarkerID() {
        return this._markerID;
    }

    // ========== 场景属性 ==========

    /**
     * 设置绘制场景矩形
     * @param {Object} rect - 场景矩形 {x, y, width, height}
     */
    setRect(rect) {
        this._rect = rect;
    }

    /**
     * 获取绘制场景矩形
     * @returns {Object} 场景矩形
     */
    getRect() {
        return this._rect;
    }

    // ========== 线属性 ==========

    /**
     * 设置是否绘制垂直线
     * @param {boolean} verticalLine - 是否绘制垂直线
     */
    setVerticalLine(verticalLine) {
        this._verticalLine = verticalLine;
    }

    /**
     * 设置是否绘制十字线（水平线）
     * @param {boolean} crossLine - 是否绘制十字线
     */
    setCrossLine(crossLine) {
        this._crossLine = crossLine;
    }

    /**
     * 设置线是否闪烁
     * @param {boolean} flickLine - 是否闪烁
     */
    setFlickLine(flickLine) {
        this._flickLine = flickLine;
    }

    /**
     * 设置水平边界绘制效果
     * @param {boolean} hBorderDraw - 是否开启
     */
    setHBorder(hBorderDraw) {
        this._hBorderDraw = hBorderDraw;
    }

    /**
     * 设置垂直边界绘制效果
     * @param {boolean} vBorderDraw - 是否开启
     */
    setVBorder(vBorderDraw) {
        this._vBorderDraw = vBorderDraw;
    }

    // ========== 焦点属性 ==========

    /**
     * 设置焦点状态
     * @param {boolean} focus - 焦点状态
     */
    setFocus(focus) {
        if (this._focus === focus) return;
        this._focus = focus;
        if (this._onFocusChanged) {
            this._onFocusChanged(focus);
        }
    }

    /**
     * 获取焦点状态
     * @returns {boolean} 是否有焦点
     */
    hasFocus() {
        return this._focus;
    }

    /**
     * 设置焦点变更回调
     * @param {Function} callback - 回调函数 function(focus)
     */
    onFocusChanged(callback) {
        this._onFocusChanged = callback;
    }

    // ========== 显示属性 ==========

    /**
     * 设置显示状态
     * @param {boolean} visible - 显示状态
     */
    setVisible(visible) {
        if (this._visible === visible) return;
        this._visible = visible;
        if (this._onVisibleChanged) {
            this._onVisibleChanged(visible);
        }
    }

    /**
     * 获取显示状态
     * @returns {boolean} 是否显示
     */
    isVisible() {
        return this._visible;
    }

    /**
     * 设置显示变更回调
     * @param {Function} callback - 回调函数 function(visible)
     */
    onVisibleChanged(callback) {
        this._onVisibleChanged = callback;
    }

    // ========== 形状属性 ==========

    /**
     * 设置Marker形状
     * @param {number} markerShape - 形状类型 0-常规 1-倒置
     */
    setMarkerShape(markerShape) {
        this._markerShape = markerShape;
    }

    /**
     * 获取Marker形状
     * @returns {number} 当前形状
     */
    getMarkerShape() {
        return this._markerShape;
    }

    /**
     * 获取按下效果有效性
     * @returns {boolean} 是否启用按下效果
     */
    pressEffectEnable() {
        return this._pressEffectEnable;
    }

    /**
     * 设置按下效果有效性
     * @param {boolean} pressEffectEnable - 是否启用
     */
    setPressEffectEnable(pressEffectEnable) {
        this._pressEffectEnable = pressEffectEnable;
    }

    // ========== 位置属性 ==========

    /**
     * 设置Marker位置
     * @param {Object} markerPt - 位置坐标 {x, y}
     */
    setMarkerPt(markerPt) {
        if (this._markerPt.x === markerPt.x && this._markerPt.y === markerPt.y) {
            this._sendPosChangeSignal = false;
            return;
        }
        this._markerPt = { x: markerPt.x, y: markerPt.y };
        if (!this._sendPosChangeSignal) return;
        this._sendPosChangeSignal = false;
        if (this._onMarkerPtChanged) {
            this._onMarkerPtChanged(this._markerPt);
        }
    }

    /**
     * 获取Marker位置
     * @returns {Object} 当前位置 {x, y}
     */
    markerPt() {
        return { x: this._markerPt.x, y: this._markerPt.y };
    }

    /**
     * 设置位置变更回调
     * @param {Function} callback - 回调函数 function(markerPt)
     */
    onMarkerPtChanged(callback) {
        this._onMarkerPtChanged = callback;
    }

    // ========== 颜色属性 ==========

    /**
     * 设置颜色组
     * @param {Object} colorGroup - 颜色配置对象
     */
    setColorGroup(colorGroup) {
        this._colorGroup = { ...this._colorGroup, ...colorGroup };
    }

    /**
     * 获取颜色组
     * @returns {Object} 当前颜色配置
     */
    getColorGroup() {
        return { ...this._colorGroup };
    }

    // ========== 数据属性 ==========

    /**
     * 获取点序号
     * @returns {number} 点序号
     */
    pointIndex() {
        return this._pointIndex;
    }

    /**
     * 设置点序号
     * @param {number} pointIndex - 点序号
     */
    setPointIndex(pointIndex) {
        this._pointIndex = pointIndex;
    }

    /**
     * 获取帧序号
     * @returns {number} 帧序号
     */
    frameIndex() {
        return this._frameIndex;
    }

    /**
     * 设置帧序号
     * @param {number} frameIndex - 帧序号
     */
    setFrameIndex(frameIndex) {
        this._frameIndex = frameIndex;
    }

    /**
     * 获取越界状态
     * @returns {boolean} 是否越界
     */
    crossBorder() {
        return this._crossBorder;
    }

    /**
     * 设置越界状态
     * @param {boolean} crossBorder - 越界状态
     */
    setCrossBorder(crossBorder) {
        this._crossBorder = crossBorder;
    }

    /**
     * 获取当前频率
     * @returns {number} 频率值(Hz)
     */
    getFrequency() {
        return this._frequency;
    }

    /**
     * 设置当前频率
     * @param {number} frequency - 频率值(Hz)
     */
    setFrequency(frequency) {
        this._frequency = frequency;
    }

    // ========== 谱线跟踪属性 ==========

    /**
     * 设置跟踪的谱线 ID
     * @param {number} traceId - 谱线 ID，0 表示第一条谱线
     */
    setTraceId(traceId) {
        if (this._traceId === traceId) return;
        this._traceId = traceId || 0;
    }

    /**
     * 获取当前跟踪的谱线 ID
     * @returns {number} 谱线 ID
     */
    getTraceId() {
        return this._traceId || 0;
    }

    // ========== 跟随谱线属性 ==========

    /**
     * 设置是否跟随谱线 Y 轴位置
     * @param {boolean} follow - 是否跟随
     */
    setFollowTraceY(follow) {
        this._followTraceY = follow;
    }

    /**
     * 获取是否跟随谱线 Y 轴位置
     * @returns {boolean} 是否跟随
     */
    isFollowTraceY() {
        return this._followTraceY;
    }

    /**
     * 设置谱线 Y 轴偏移量
     * @param {number} offset - 偏移量（像素）
     */
    setTraceYOffset(offset) {
        this._traceYOffset = offset;
    }

    /**
     * 获取谱线 Y 轴偏移量
     * @returns {number} 偏移量
     */
    getTraceYOffset() {
        return this._traceYOffset;
    }
    
    // ========== 标牌属性 ==========

    /**
     * 设置标牌显示状态
     * @param {boolean} scutchonVisible - 是否显示标牌
     */
    setScutchonVisible(scutchonVisible) {
        this._scutchonVisible = scutchonVisible;
    }

    /**
     * 获取标牌显示状态
     * @returns {boolean} 是否显示标牌
     */
    getScutchonVisible() {
        return this._scutchonVisible;
    }

    /**
     * 设置标牌文本列表
     * @param {Array} lstText - 标牌文本列表 [[{text, format}], ...]
     */
    setScutchonList(lstText) {
        this._scutchonList = lstText;
    }

    /**
     * 获取标牌文本列表
     * @returns {Array} 标牌文本列表
     */
    getScutchonList() {
        return this._scutchonList;
    }

    /**
     * 获取标牌矩形框
     * @returns {Object} 标牌矩形 {x, y, width, height}
     */
    getRectScutchon() {
        return { ...this._rectScutchon };
    }

    /**
     * 获取标牌锚点
     * @returns {Object} 锚点坐标 {x, y}
     */
    getScutchonAnchor() {
        return { ...this._scutchonAnchor };
    }

    /**
     * 设置标牌锚点
     * @param {Object} scutchonAnchor - 锚点坐标 {x, y}
     */
    setScutchonAnchor(scutchonAnchor) {
        this._scutchonAnchor = { x: scutchonAnchor.x, y: scutchonAnchor.y };
    }

    /**
     * 设置标牌碰撞检测函数
     * @param {Function} collidingFunc - 碰撞检测函数 function(marker, sourceRect, advisedRect)
     */
    setCollidingFunc(collidingFunc) {
        this._collidingFunc = collidingFunc;
    }

    // ========== 事件处理 ==========

    /**
     * 处理按下消息
     * @param {Object} pressPos - 按下位置 {x, y}
     */
    handlePressEvent(pressPos) {
        this._itemPressed = true;
        this.setFocus(true);
    }

    /**
     * 处理移动消息
     * @param {Object} movePos - 移动位置 {x, y}
     * @returns {boolean} 是否处理成功
     */
    handleMoveEvent(movePos) {
        this._sendPosChangeSignal = true;
        this.setMarkerPt(movePos);
        return true;
    }

    /**
     * 处理点击事件
     * @param {Object} clickPos - 点击位置 {x, y}
     * @returns {boolean} 是否处理成功
     */
    handleClickEvent(clickPos) {
        this._sendPosChangeSignal = true;
        this.setMarkerPt(clickPos);
        return true;
    }

    /**
     * 处理释放消息
     * @param {Object} releasePos - 释放位置 {x, y}
     * @returns {boolean} 是否处理成功
     */
    handleReleaseEvent(releasePos) {
        this._itemPressed = false;
        return true;
    }

    // ========== 绘制方法 ==========

    /**
     * 绘制Marker（主入口）
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {Object} dpiPair - DPI值 {x, y}
     * @param {Object} fontPixelPair - 字体范围 {min, max}
     * @param {boolean} active - 是否活跃状态
     * @param {Function} userPaintFunc - 自定义绘制函数
     */
    paint(ctx, dpiPair, fontPixelPair, active = false, userPaintFunc = null) {
        // console.log('paint MarkerItem',dpiPair,fontPixelPair,active,userPaintFunc);
        if (!this._rect || this._rect.width <= 0 || this._rect.height <= 0) return;
        if (!this._visible) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(this._rect.x, this._rect.y, this._rect.width, this._rect.height);
        ctx.clip();
        ctx.translate(this._rect.x, this._rect.y);

        const ptMarker = {
            x: this._markerPt.x - this._rect.x,
            y: this._markerPt.y - this._rect.y
        };

        ctx.strokeStyle = active ? this._colorGroup.inactiveForeground : this._colorGroup.activeForeground;
        ctx.fillStyle = this._focus ? this._colorGroup.focusBackground : this._colorGroup.noFocusBackground;
        ctx.lineWidth = 2;

        const pathPoints = this._getMarkerShapePath(
            this._markerShape,
            dpiPair,
            this._pressEffectEnable && this._itemPressed,
            ptMarker,
            !this._crossBorder
        );

        let paintShape = true;
        if (userPaintFunc) {
            ctx.save();
            const result = userPaintFunc(this, ctx, pathPoints);
            paintShape = !result;
            ctx.restore();
        }

        if (paintShape) {
            this._paintMarkerPath(ctx, ptMarker, dpiPair, fontPixelPair, pathPoints);
        }

        ctx.restore();
        this._paintScutchon(ctx, dpiPair, fontPixelPair);
    }

    /**
     * 绘制线（垂直线/十字线）
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    paintLine(ctx) {
        if (!this._rect || this._rect.width <= 0 || this._rect.height <= 0) return;
        if (!this._visible) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(this._rect.x, this._rect.y, this._rect.width, this._rect.height);
        ctx.clip();
        ctx.translate(this._rect.x, this._rect.y);

        const ptMarker = {
            x: this._markerPt.x - this._rect.x,
            y: this._markerPt.y - this._rect.y
        };

        let lineColor = this._colorGroup.lineColor;
        if (this._flickLine) {
            const now = Date.now();
            // 每隔500ms切换颜色，实现闪烁效果
            if (Math.floor(now / 500) % 2 === 1) {
                lineColor = this._colorGroup.activeForeground;
            }
        }

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;

        if (this._verticalLine) {
            ctx.beginPath();
            ctx.moveTo(ptMarker.x, 0);
            ctx.lineTo(ptMarker.x, this._rect.height);
            ctx.stroke();
        }

        if (this._crossLine) {
            ctx.beginPath();
            ctx.moveTo(0, ptMarker.y);
            ctx.lineTo(this._rect.width, ptMarker.y);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * 检测点是否在Marker内
     * @param {Object} point - 检测点 {x, y}
     * @param {Object} dpiPair - DPI值 {x, y}
     * @returns {boolean} 是否在Marker内
     */
    containsPoint(point, dpiPair) {
        if (!this._visible) return false;

        const localPoint = {
            x: point.x - this._rect.x,
            y: point.y - this._rect.y
        };

        const ptMarker = {
            x: this._markerPt.x - this._rect.x,
            y: this._markerPt.y - this._rect.y
        };

        const pathPoints = this._getMarkerShapePath(
            this._markerShape,
            dpiPair,
            false,
            ptMarker,
            !this._crossBorder
        );

        const minX = Math.min(...pathPoints.map(p => p.x));
        const maxX = Math.max(...pathPoints.map(p => p.x));
        const minY = Math.min(...pathPoints.map(p => p.y));
        const maxY = Math.max(...pathPoints.map(p => p.y));

        const hitPadding = 10; // 增加点击容差范围
        return localPoint.x >= minX - hitPadding &&
               localPoint.x <= maxX + hitPadding &&
               localPoint.y >= minY - hitPadding &&
               localPoint.y <= maxY + hitPadding;
    }

    // ========== 私有绘制方法 ==========

    /**
     * 获取Marker形状路径点（私有）
     */
    _getMarkerShapePath(shape, dpiPair, pressed, ptTarget, hasArrow = true) {
        const scale = pressed ? 1.5 : 1;
        const points = [];
        
        // 根据DPI计算尺寸，使图形在不同分辨率下大小合适
        const width = dpiPair.x * 35 / 100 * scale;
        const height = dpiPair.y * 35 / 100 * scale;
        const height0 = hasArrow ? dpiPair.y * 20 / 100 * scale : 0;
        const actualHeight = hasArrow ? height : dpiPair.y * 55 / 100 * scale;

        if (shape === MarkerItem.Shape.Shape_Normal) {
            // 常规锥形 - 尖头朝上
            points.push({ x: ptTarget.x, y: ptTarget.y });
            points.push({ x: ptTarget.x + width / 2, y: ptTarget.y - height0 });
            points.push({ x: ptTarget.x + width / 2, y: ptTarget.y - height0 - actualHeight });
            points.push({ x: ptTarget.x - width / 2, y: ptTarget.y - height0 - actualHeight });
            points.push({ x: ptTarget.x - width / 2, y: ptTarget.y - height0 });
        } else {
            // 倒置锥形 - 尖头朝下
            points.push({ x: ptTarget.x, y: ptTarget.y });
            points.push({ x: ptTarget.x - width / 2, y: ptTarget.y + height0 });
            points.push({ x: ptTarget.x - width / 2, y: ptTarget.y + height0 + actualHeight });
            points.push({ x: ptTarget.x + width / 2, y: ptTarget.y + height0 + actualHeight });
            points.push({ x: ptTarget.x + width / 2, y: ptTarget.y + height0 });
        }

        return points;
    }

    /**
     * 自适应字体大小（私有）
     */
    _adaptFontSize(ctx, targetRect, text, minFontPixel, maxFontPixel) {
        let fontSize = maxFontPixel;
        // 测量字体宽度
        if(ctx.measureText){
            ctx.font = `${fontSize}px Arial`;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            if (textWidth > targetRect.width || fontSize > targetRect.height) {
                const scale = Math.min(targetRect.width / textWidth, targetRect.height / fontSize);
                fontSize = Math.max(minFontPixel, Math.floor(fontSize * scale * 0.8));
            }
            
            return Math.min(fontSize, maxFontPixel);
        } else{
            return maxFontPixel;
        }
        
    }

    /**
     * 绘制Marker路径（私有）
     */
    _paintMarkerPath(ctx, markerPoint, dpiPair, fontPixelPair, pathPoints) {
        ctx.save();
        ctx.translate(markerPoint.x, markerPoint.y);

        const localPath = this._getMarkerShapePath(
            this._markerShape,
            dpiPair,
            this._pressEffectEnable && this._itemPressed,
            { x: 0, y: 0 },
            !this._crossBorder
        );

        // 计算旋转角度（边界处理）
        let rotateAngle = this._calculateRotation(localPath, markerPoint);
        ctx.rotate(rotateAngle * Math.PI / 180);

        // 绘制路径
        ctx.beginPath();
        ctx.moveTo(localPath[0].x, localPath[0].y);
        for (let i = 1; i < localPath.length; i++) {
            ctx.lineTo(localPath[i].x, localPath[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 计算文本区域
        let rectSymbol = this._calculateTextRect(localPath);
        
        // 反向旋转并绘制文本
        const centerX = rectSymbol.x + rectSymbol.width / 2;
        const centerY = rectSymbol.y + rectSymbol.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(-rotateAngle * Math.PI / 180);

        let { width, height } = this._adjustRectForRotation(rectSymbol, rotateAngle);
        
        const text = String(this._markerID);
        const fontSize = this._adaptFontSize(ctx, { width: width * 0.8, height: height * 0.8 }, text, fontPixelPair.min, fontPixelPair.max);

        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this._crossBorder ? this._colorGroup.crossBorderText : this._colorGroup.scutchonForeground;
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }

    /**
     * 计算旋转角度（私有）
     * 根据Marker是否超出场景边界决定旋转方向，使图形始终朝向场景内部
     */
    _calculateRotation(localPath, markerPoint) {
        let rotateAngle = 0;
        
        const pathRect = {
            left: Math.min(...localPath.map(p => p.x)),
            right: Math.max(...localPath.map(p => p.x)),
            top: Math.min(...localPath.map(p => p.y)),
            bottom: Math.max(...localPath.map(p => p.y))
        };

        // 将局部坐标转换为场景世界坐标
        const worldPathRect = {
            left: pathRect.left + markerPoint.x + this._rect.x,
            right: pathRect.right + markerPoint.x + this._rect.x,
            top: pathRect.top + markerPoint.y + this._rect.y,
            bottom: pathRect.bottom + markerPoint.y + this._rect.y
        };

        const vTurn = worldPathRect.top <= this._rect.y;          // 超出上边界
        const hTurnLeft = worldPathRect.left <= this._rect.x;    // 超出左边界
        const hTurnRight = worldPathRect.right >= this._rect.x + this._rect.width; // 超出右边界

        if (this._markerShape === MarkerItem.Shape.Shape_Normal) {
            // 常规形状（尖头向上）的旋转逻辑
            if (vTurn && (hTurnLeft || hTurnRight)) {
                // 同时超出上边界和左右边界之一：旋转90度（水平）
                if (this._hBorderDraw && hTurnLeft) rotateAngle = 90;
                if (this._hBorderDraw && hTurnRight) rotateAngle = -90;
            } else if (this._vBorderDraw && vTurn) {
                // 仅超出上边界：旋转180度（尖头向下）
                rotateAngle = 180;
            } else if (this._hBorderDraw && hTurnLeft) {
                // 仅超出左边界：旋转90度（尖头向右）
                rotateAngle = 90;
            } else if (this._hBorderDraw && hTurnRight) {
                // 仅超出右边界：旋转-90度（尖头向左）
                rotateAngle = -90;
            }
        } else {
            // 倒置形状（尖头向下）的旋转逻辑
            if (vTurn && (hTurnLeft || hTurnRight)) {
                if (this._hBorderDraw && hTurnLeft) rotateAngle = -90;
                if (this._hBorderDraw && hTurnRight) rotateAngle = 90;
            } else if (this._vBorderDraw && vTurn) {
                rotateAngle = 180;
            } else if (this._hBorderDraw && hTurnLeft) {
                rotateAngle = -90;
            } else if (this._hBorderDraw && hTurnRight) {
                rotateAngle = 90;
            }
        }

        return rotateAngle;
    }

    /**
     * 计算文本矩形（私有）
     * 根据形状调整文本显示区域，使文字位于图形主体内
     */
    _calculateTextRect(localPath) {
        let rectSymbol = {
            x: Math.min(...localPath.map(p => p.x)),
            y: Math.min(...localPath.map(p => p.y)),
            width: Math.max(...localPath.map(p => p.x)) - Math.min(...localPath.map(p => p.x)),
            height: Math.max(...localPath.map(p => p.y)) - Math.min(...localPath.map(p => p.y))
        };

        if (this._markerShape === MarkerItem.Shape.Shape_Normal && !this._crossBorder) {
            // 常规形状：文本区域下移，高度缩小（避开箭头部分）
            rectSymbol.height *= 0.7;
        } else if (this._markerShape === MarkerItem.Shape.Shape_TurnOver && !this._crossBorder) {
            // 倒置形状：文本区域上移，高度缩小
            rectSymbol.y += rectSymbol.height * 0.3;
            rectSymbol.height *= 0.7;
        }

        return rectSymbol;
    }

    /**
     * 根据旋转调整矩形（私有）
     * 当矩形旋转90度或-90度时，宽高互换
     */
    _adjustRectForRotation(rectSymbol, rotateAngle) {
        let width = rectSymbol.width;
        let height = rectSymbol.height;
        
        if ((rotateAngle % 180) !== 0) {
            [width, height] = [height, width];
        }
        
        return { width, height };
    }

    /**
     * 绘制标牌（私有）
     */
    _paintScutchon(ctx, dpiPair, fontPixelPair) {
        if (!this._scutchonVisible || this._scutchonList.length === 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(this._rect.x, this._rect.y, this._rect.width, this._rect.height);
        ctx.clip();
        ctx.translate(this._rect.x, this._rect.y);

        const ptMarker = {
            x: this._markerPt.x - this._rect.x,
            y: this._markerPt.y - this._rect.y
        };

        // 计算标牌位置和大小
        this._calculateScutchonRect(ptMarker, dpiPair, fontPixelPair);
        
        // 碰撞检测和调整
        this._adjustScutchonPosition();

        // 绘制圆角矩形背景
        this._drawScutchonBackground(ctx);

        // 绘制文本
        this._drawScutchonText(ctx, fontPixelPair);

        ctx.restore();
    }

    /**
     * 计算标牌矩形（私有）
     */
    _calculateScutchonRect(ptMarker, dpiPair, fontPixelPair) {
        const pathPoints = this._getMarkerShapePath(
            this._markerShape,
            dpiPair,
            false,
            ptMarker,
            !this._crossBorder
        );

        const rectSymbol = {
            x: Math.min(...pathPoints.map(p => p.x)),
            y: Math.min(...pathPoints.map(p => p.y)),
            width: Math.max(...pathPoints.map(p => p.x)) - Math.min(...pathPoints.map(p => p.x)),
            height: Math.max(...pathPoints.map(p => p.y)) - Math.min(...pathPoints.map(p => p.y))
        };

        const fontSize = this._adaptFontSize(
            ctx => { ctx.font = '16px Arial'; return ctx; },
            rectSymbol,
            String(this._markerID),
            fontPixelPair.min,
            fontPixelPair.max
        );

        // 计算文本尺寸（粗略估算）
        let maxTextWidth = 0;
        for (const line of this._scutchonList) {
            let lineWidth = 0;
            for (const unit of line) {
                const text = unit.format || unit.text;
                lineWidth += 16 * text.length * 0.6; // 估算宽度
            }
            maxTextWidth = Math.max(maxTextWidth, lineWidth);
        }

        const lineHeight = 16;
        const maxTextHeight = lineHeight * this._scutchonList.length;
        const SCUTCHON_MARGIN = 10;

        const rectScutchonSize = {
            width: maxTextWidth + SCUTCHON_MARGIN,
            height: maxTextHeight + SCUTCHON_MARGIN
        };

        // 默认标牌位置：位于Marker图形正上方
        let defaultRectPoint = {
            x: (this._scutchonAnchor.x - this._rect.x) + rectSymbol.width / 2,
            y: (this._scutchonAnchor.y - this._rect.y) - rectSymbol.height - rectScutchonSize.height
        };

        this._rectScutchon = {
            x: defaultRectPoint.x,
            y: defaultRectPoint.y,
            width: rectScutchonSize.width,
            height: rectScutchonSize.height
        };
    }

    /**
     * 调整标牌位置（私有）
     * 通过碰撞检测回调或边界约束调整标牌位置，避免重叠和越界
     */
    _adjustScutchonPosition() {
        const SCUTCHON_MARGIN = 10;

        if (this._collidingFunc) {
            const resultRect = { ...this._rectScutchon };
            this._collidingFunc(this, this._rectScutchon, resultRect);
            this._rectScutchon = resultRect;
        }

        // 确保标牌不超出上边界
        if (this._rectScutchon.y < SCUTCHON_MARGIN) {
            this._rectScutchon.y = SCUTCHON_MARGIN;
        }

        // 确保标牌不超出右边界
        if (this._rectScutchon.x + this._rectScutchon.width > this._rect.width - SCUTCHON_MARGIN) {
            this._rectScutchon.x = this._rect.width - SCUTCHON_MARGIN - this._rectScutchon.width;
        }
    }

    /**
     * 绘制标牌背景（私有）
     * 绘制圆角矩形作为标牌背景
     */
    _drawScutchonBackground(ctx) {
        const rounded = Math.min(
            Math.min(this._rectScutchon.height, this._rectScutchon.width) / 5,
            10
        );

        ctx.strokeStyle = this._colorGroup.scutchonForeground;
        ctx.fillStyle = this._colorGroup.scutchonBackground;
        ctx.lineWidth = 2;

        const r = rounded;
        const x = this._rectScutchon.x;
        const y = this._rectScutchon.y;
        const w = this._rectScutchon.width;
        const h = this._rectScutchon.height;

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
    }

    /**
     * 绘制标牌文本（私有）
     */
    _drawScutchonText(ctx, fontPixelPair) {
        ctx.save();
        ctx.translate(this._rectScutchon.x, this._rectScutchon.y);

        const SCUTCHON_MARGIN = 10;
        const textPoint = { x: SCUTCHON_MARGIN / 2, y: SCUTCHON_MARGIN / 2 };
        const lineHeight = 16;

        for (let i = 0; i < this._scutchonList.length; i++) {
            const lineTextPoint = {
                x: textPoint.x,
                y: textPoint.y + i * lineHeight
            };

            const line = this._scutchonList[i];
            let currentX = lineTextPoint.x;

            for (const unit of line) {
                const displayText = unit.format || unit.text;
                const textWidth = displayText.length * 16 * 0.6; // 估算宽度

                ctx.fillStyle = this._colorGroup.scutchonForeground;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = `${fontPixelPair.max}px Arial`;
                ctx.fillText(displayText, currentX, lineTextPoint.y);

                currentX += textWidth;
            }
        }

        ctx.restore();
    }

    // ========== 静态工具方法 ==========

    /**
     * 获取建议的标牌位置（静态）
     * @param {Object} sourceRect - 原位置 {x, y, width, height}
     * @param {Array} otherMarkers - 其他Marker数组
     * @param {Object} containerRect - 容器矩形
     * @returns {Object} 建议位置
     */
    static getAdvisedRect(sourceRect, otherMarkers, containerRect) {
        let advisedRect = { ...sourceRect };
        const offsetStep = 25;
        const maxAttempts = 15;

        // 尝试多次偏移，直到没有碰撞或达到最大尝试次数
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let hasCollision = false;

            for (const other of otherMarkers) {
                const otherRect = other.getRectScutchon();
                if (!otherRect || otherRect.width === 0 || otherRect.height === 0) continue;

                if (MarkerItem._rectsIntersect(advisedRect, otherRect)) {
                    hasCollision = true;
                    // 向下偏移
                    advisedRect.y += offsetStep;

                    // 如果超出容器底部，则换到下一列（向右偏移）
                    if (containerRect && advisedRect.y + advisedRect.height > containerRect.y + containerRect.height - 10) {
                        advisedRect.y = sourceRect.y + offsetStep;
                        advisedRect.x += offsetStep;
                    }
                    break;
                }
            }

            if (!hasCollision) break;
        }

        return advisedRect;
    }

    /**
     * 检测矩形相交（静态私有）
     */
    static _rectsIntersect(rect1, rect2) {
        return !(rect2.x > rect1.x + rect1.width ||
                 rect2.x + rect2.width < rect1.x ||
                 rect2.y > rect1.y + rect1.height ||
                 rect2.y + rect2.height < rect1.y);
    }
}

// 导出
export { MarkerItem };
export default MarkerItem;