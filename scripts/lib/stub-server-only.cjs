/** Preload: permite importar módulos server-only desde scripts Node. */
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const orig = Module.prototype.require;
Module.prototype.require = function (id, ...rest) {
  if (id === "server-only") return {};
  return orig.apply(this, [id, ...rest]);
};
/* eslint-enable @typescript-eslint/no-require-imports */
