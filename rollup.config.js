import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import serve from 'rollup-plugin-serve';
import net from 'net';

const isDev = process.env.NODE_ENV === 'development';

function findFreePort(startPort = 8080, autoIncrement = true) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        if (autoIncrement) {
          findFreePort(startPort + 1, true).then(resolve).catch(reject);
        } else {
          // 不自动递增，继续使用原端口
          resolve(startPort);
        }
      } else {
        reject(err);
      }
    });
  });
}

export default async () => {
  let port = 8080;
  if (isDev) {
    port = await findFreePort(8080,false);
    console.log(`[serve] 开发服务器运行在 http://localhost:${port}`);
  }

  return {
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
          drop_console: false,   // 移除所有的 console.log() 和其他 console.* 语句
        },
        format: {
          comments: false,      // 删除所有注释，包括中文注释
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
      }),
      isDev && serve({
        open: true,
        openPage: '/index.html',
        contentBase: ['examples', '.'],
        port: port,
        historyApiFallback: '/index.html',
      })
    ],
  external: []// 外部依赖
  }
};
