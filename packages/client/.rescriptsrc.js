const { allPass, prop, propSatisfies, includes } = require("ramda");
const prettyFormat = require("pretty-format");

const { edit, getPaths } = require("@rescripts/utilities");

const isSrcBabelLoader = allPass([
  prop("loader"),
  propSatisfies(includes("babel-loader"), "loader"),
  prop("include"),
]);

const babelRootUpwarder = {
  webpack(config) {
    return edit(
      subconfig => {
        const includePath = subconfig.include;
        return {
          ...subconfig,
          include: [
            includePath,
            includePath.replace(/client\/src$/, "common/src"),
          ],
          exclude: [
            includePath.replace(/src$/, "node_modules"),
            includePath.replace(/client\/src$/, "common/node_modules"),
          ],
        };
      },
      getPaths(isSrcBabelLoader, config),
      config,
    );
  },
};
module.exports = [["use-eslint-config", "package"], babelRootUpwarder];
