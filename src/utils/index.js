/**
 * 深度合并对象
 * @param {*} target 目标对象
 * @param {*} source 源对象
 * @returns 
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) && !Array.isArray(target[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

//拷贝
function deepCopy(obj) {
  // 如果传入的不是对象，则直接返回该值（基本类型数据会被直接返回）
  if (typeof obj !== 'object' || obj === null) {
      return obj;
  }

  // 根据传入对象的类型创建一个新的目标对象或数组
  let newObj = Array.isArray(obj) ? [] : {};

  // 遍历原始对象的属性或数组元素
  for (let key in obj) {
      // 只复制对象自身的属性，不复制原型链上的属性
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // 递归调用深拷贝函数，复制每个属性的值
          newObj[key] = deepCopy(obj[key]);
      }
  }

  return newObj;
}
/**
 * 获取设备像素比 (DPR)
 * @returns {number} 当前设备的设备像素比
 */
function getDevicePixelRatio() {
  return window.devicePixelRatio || 1; // 如果没有定义，则返回 1
}

/**
 * y轴刻度计算
 * @param {*} width 高度
 * @param {*} minValue 最小值
 * @param {*} maxValue 最大值
 * @param {*} fixedStep 固定步长
 * @param {*} zooms 层级
 * @param {*} stepStart 最小刻度范围
 * @param {*} stepEnd 最大刻度范围
 * @returns 
 */
function calculateStepValues(width,minValue, maxValues, fixedStep,zooms,stepStart, stepEnd,labelnum) {
  console.log("计算",width,minValue, maxValues, fixedStep,zooms,stepStart, stepEnd,labelnum)
  let labels = [];
  let gridLabels=[]
  let zoom=zooms||1;
  let stepValue = Math.round(fixedStep / zoom);
  if(stepValue<1){
    stepValue=1
  }
  let pxStep = width / stepValue;
  let labelStep =width
  
  let maxValue = minValue+stepValue*(labelnum-1);
  console.log("计算步进值",stepValue,labelnum-1,minValue,maxValue,"传入最大值",maxValues)
  let gridstepValue=stepValue/2
  // 从第一个步进值开始，找到在 minValue 和 maxValue 范围内的所有步进值
  for (let value = stepStart; value <= stepEnd; value += stepValue) {
      if (value >= minValue && value <= maxValue) {
        labels.push(value);
      }
  }
  for (let value = stepStart; value <= stepEnd; value += gridstepValue) {
    if (value >= minValue && value <= maxValue) {
      gridLabels.push(value);
    }
  }
  let minDiff=labels[0]-minValue
  return {labelStep,pxStep,labels,stepValue,minDiff,gridLabels,maxValue,minValue};
}

/**
 * 计算x轴的宽度
 * @param {*} widths 总宽度 
 * @param {*} widths 数据宽度 
 * @param {*} minSpacing 
 * @returns 
 */
function calculateWidths(clientWidth,widths, minSpacing = 0) {
  const totalWidth = clientWidth; // 总宽度
  const numberOfSegments = widths.length; // 段数
  const defaultMinWidth = 50; // 默认最小宽度
  const maxSpacing = 30; // 最大间距

  // 检查输入的 widths 数组长度是否为 5
  if (widths.length !== numberOfSegments) {
      throw new Error("Widths array must have exactly 5 elements."); // 抛出错误
  }

  // 计算当前需求
  
  const totalDemand = widths.reduce((a, b) => a + Math.max(b, defaultMinWidth), 0);
  const totalSpacing = (numberOfSegments - 1) * minSpacing; // 计算总间距

  // 如果当前需求加上间距大于总宽度，调整最小宽度
  let minWidth = defaultMinWidth;
  if (totalDemand + totalSpacing > totalWidth) {
      let minWidthNum = widths.filter(w => w === 1).length;
      if(totalDemand - totalSpacing-minWidthNum*1 <totalWidth){
        minWidth = Math.floor((totalWidth - totalSpacing) / minWidthNum);
      }
      
  }
  const finalWidths = widths.map((w) => w === 1 ? minWidth : w);
  // 调整 finalWidths 根据新的最小宽度
  

  // 计算已分配的宽度
  const assignedWidth = finalWidths.reduce((a, b) => a + b, 0);
  const assignedSpacing = (numberOfSegments - 1) * minSpacing;

  // 如果总需求加上间距小于总宽度，进行宽度调整
  if (assignedWidth + assignedSpacing < totalWidth) {
    // 计算剩余宽度
    let remainingWidth = totalWidth - (assignedWidth + assignedSpacing);
    
    // 计算当前宽度为1的元素数量
    const countOfOnes = finalWidths.filter(w => w === minWidth).length;

    // 计算每个段可以增加的间距
    let extraSpacing = Math.floor(remainingWidth / (numberOfSegments - 1));
    if(countOfOnes>1){
        // 如果有元素为1，则平均增加到那些元素上
        const increasePerOne = Math.floor(remainingWidth / countOfOnes);
        for (let i = 0; i < numberOfSegments; i++) {
            if (finalWidths[i] == minWidth) {
                finalWidths[i] += increasePerOne;
            }
        }
    }else{
        // 如果没有元素为1，均匀增加剩余宽度
        const extraWidthPerSegment = Math.floor(remainingWidth / numberOfSegments);
        for (let i = 0; i < numberOfSegments; i++) {
            finalWidths[i] += extraWidthPerSegment;
        }
    }
  }else{
    // 如果总需求加上间距大于总宽度，则按比例缩小宽度
    const widthDecrease = Math.ceil((assignedWidth + assignedSpacing - totalWidth) / numberOfSegments);
    const minval=Math.min(...finalWidths)
    for (let i = 0; i < numberOfSegments; i++) {
        finalWidths[i] -= widthDecrease;
    }
  }

  // 返回最终宽度数组，确保所有宽度为整数
  let result={
    widths: finalWidths.map(Math.floor).map(w => Math.max(w, 0)),
    spacing:minSpacing,
    sumCout:finalWidths.reduce((a, b) => a + b, 0)
  }
  return result; // 确保返回整数
}

/**
 * 截取数字的小数点后指定的位数（支持负数，且不足位数补零）
 * @param {number} num - 要格式化的数字
 * @param {number} decimalPlaces - 要保留的小数位数
 * @param {boolean} isnum - 是否为数字
 * @returns {number} 截取后的小数位数的数字
 */
function truncateNumber(num, decimalPlaces,isnum=false) {
  // 处理无效输入
  if (isNaN(num) || isNaN(decimalPlaces)) {
      throw new Error('Invalid input: num and decimalPlaces must be numbers.');
  }
  if(decimalPlaces === ""){
    return num
  }
  // 确保小数位数为正整数
  decimalPlaces = Math.max(0, Math.floor(decimalPlaces));

  // 将数字乘以10的decimalPlaces次方并截取
  const factor = Math.pow(10, decimalPlaces);
  const truncated = Math.trunc(num * factor) / factor; // 截取
  if(isnum){
    //返回浮点数，确保尾数正确
    return parseFloat(truncated.toFixed(decimalPlaces));
  }else{
    // 返回字符串，确保尾数正确
    return truncated.toFixed(decimalPlaces)
  }
  
}



export {
  deepMerge,
  deepCopy,
  getDevicePixelRatio,
  calculateStepValues,
  calculateWidths,
  truncateNumber
}