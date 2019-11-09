const slsw = require("serverless-webpack");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  target: "node",
  entry: slsw.lib.entries,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
          projectReferences: true,
        },
      },
    ],
  },
  mode: slsw.lib.webpack.isLocal ? "development" : "production",
  resolve: {
    extensions: [".wasm", ".mjs", ".js", ".json", ".ts"],
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, "node-noop"),
    new ForkTsCheckerWebpackPlugin(),
  ],
};
