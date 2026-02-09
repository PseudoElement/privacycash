// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

const isProduction = process.env.NODE_ENV === "production";
const stylesHandler = "style-loader";

const config = {
  entry: "./src/main.ts",
  devtool: "inline-source-map",
  experiments: {
    asyncWebAssembly: true, // Enable async WebAssembly
    syncWebAssembly: true, // Enable sync WebAssembly
  },
  output: {
    filename: "new-bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    open: false,
    host: "localhost",
    hot: true,
    liveReload: true,
    watchFiles: ["src/**/*"],
    static: [
      {
        directory: path.join(__dirname, "circuit2"), // Serve circuit2 directory
        publicPath: "/circuit2",
      },
      {
        directory: path.join(__dirname, "public"), // Serve other static files if needed
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "index.html",
      filename: "index.html",
    }),
    new HtmlWebpackPlugin({
      template: "login.html",
      filename: "login/index.html",
    }),
    // Provide polyfills for Node.js globals
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser",
    }),
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, "");
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "circuit2",
          to: "circuit2",
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/i,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [stylesHandler, "css-loader"],
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        type: "asset",
      },
      {
        test: /\.html$/i,
        use: ["html-loader"],
      },
      {
        test: /\.wasm$/,
        type: "webassembly/async",
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      path: require.resolve("path-browserify"),
      os: require.resolve("os-browserify/browser"),
      https: require.resolve("https-browserify"),
      http: require.resolve("stream-http"),
      url: require.resolve("url"),
      assert: require.resolve("assert"),
      buffer: require.resolve("buffer"),
      vm: require.resolve("vm-browserify"),
      process: require.resolve("process/browser"),
    },
    alias: {
      // Handle node: URI scheme
      "node:path": require.resolve("path-browserify"),
      "node:crypto": require.resolve("crypto-browserify"),
      "node:stream": require.resolve("stream-browserify"),
      "node:buffer": require.resolve("buffer"),
      "node:url": require.resolve("url"),
      "node:util": require.resolve("util"),
      "node:assert": require.resolve("assert"),
      "node:os": require.resolve("os-browserify/browser"),
      "node:http": require.resolve("stream-http"),
      "node:https": require.resolve("https-browserify"),
      "process/browser": require.resolve("process/browser"),
      // Redirect the WASM imports to the correct location
      "./light_wasm_hasher_bg.wasm": path.resolve(
        __dirname,
        "node_modules/@lightprotocol/hasher.rs/dist/light_wasm_hasher_bg.wasm",
      ),
      "./hasher_wasm_simd_bg.wasm": path.resolve(
        __dirname,
        "node_modules/@lightprotocol/hasher.rs/dist/hasher_wasm_simd_bg.wasm",
      ),

      // OR if the import is relative without ./
      "light_wasm_hasher_bg.wasm": path.resolve(
        __dirname,
        "node_modules/@lightprotocol/hasher.rs/dist/light_wasm_hasher_bg.wasm",
      ),
      "hasher_wasm_simd_bg.wasm": path.resolve(
        __dirname,
        "node_modules/@lightprotocol/hasher.rs/dist/hasher_wasm_simd_bg.wasm",
      ),
    },
  },
  experiments: {
    asyncWebAssembly: true,
  },
  ignoreWarnings: [
    // Ignore warnings about WASM files
    /Failed to parse source map/,
  ],
  externals: {
    wbg: "wbg",
  },
  externalsType: "var",
};

module.exports = () => {
  if (isProduction) {
    config.mode = "production";
  } else {
    config.mode = "development";
  }
  return config;
};
