import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
export default {
  input: 'src/index.js',
  output: [
    {
        file: 'dist/sptmChart.js',
        format: 'umd',//UMD 格式的输出（适用于浏览器和 Node.js）
        name: 'sptmChart',
        sourcemap: true  // 生成 sourcemap 文件，方便调试
    },
    {
        file: 'dist/sptmChart.esm.js',// ES Modules 格式的输出（适用于 npm 包）
        format: 'esm',
        sourcemap: true
    },
    {
        file: 'dist/sptmChart.cjs.js',  // CommonJS 格式的输出（适用于 Node.js 和 CommonJS）
        format: 'cjs',
        sourcemap: true,
        exports: 'auto', // 或 'default' 根据需要选择合适的导出方式
    }
  ],
  plugins: [
    nodeResolve(), // 处理模块导入 // 处理 node_modules 中的模块
    commonjs(), // 处理 CommonJS 模块
    //typescript(), // 处理 TypeScript 文件
    terser({
      compress: {
        drop_console: true,   // 移除所有的 console.log() 和其他 console.* 语句
      },
    }),// 压缩代码
    postcss({  // 处理 CSS 文件
        extract: true,  // 可选：将 CSS 提取到单独的文件
        minimize: true, // 可选：压缩 CSS
    }),
    babel({
        exclude: 'node_modules/**',  // 不转换 node_modules 中的代码
        presets: ['@babel/preset-env'], // 使用 @babel/preset-env 转译为 ES5
        babelHelpers: 'bundled' // 确保 Babel helpers 被正确处理
    }) 
  ],
  external: []// 外部依赖
};
