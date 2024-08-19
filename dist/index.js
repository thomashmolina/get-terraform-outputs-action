/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 623:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 886:
/***/ ((module) => {

module.exports = eval("require")("axios");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(623);
const axios = __nccwpck_require__(886);

const PAGE_SIZE = 100;

async function getCurrentStateVersion(client, workspaceId) {
  try {
    const { data } = await client.get(`/workspaces/${workspaceId}/current-state-version`);

    const stateVersionId = data?.data?.id;
    if (!stateVersionId) throw new Error('No current state was found.');

    return stateVersionId;
  } catch (err) {
    throw new Error(`Failed to get the current state version: ${err.message}`);
  }
}

async function getOutputs(client, stateVersionId) {
  const tfOutputs = await getOutputsPages(client, stateVersionId, 1);

  return tfOutputs.reduce((outputs, { attributes }) => {
    const { name, sensitive, value } = attributes;
    if (sensitive) core.setSecret(value);
    outputs[name] = value;
    return outputs;
  }, {});
}

async function getOutputsPages(client, stateVersionId, pageNumber) {
  try {
    const { data } = await client.get(`/state-versions/${stateVersionId}/outputs`, {
      params: { 'page[number]': pageNumber, 'page[size]': PAGE_SIZE }
    });

    let outputs = data?.data;
    if (!outputs) throw new Error('No outputs were found.');

    const totalPages = data.meta?.pagination['total-pages'];
    if (totalPages > pageNumber) {
      const rest = await getOutputsPages(client, stateVersionId, pageNumber + 1);
      outputs = outputs.concat(rest);
    }

    return outputs;
  } catch (err) {
    throw new Error(`Failed to get the outputs for page ${pageNumber}: ${err.message}`);
  }
}

async function setOutputs(outputs, desiredOutputs) {
  desiredOutputs.forEach((outputName) => {
    const value = outputs[outputName];
    if (value === undefined) {
      core.error(`No Terraform output was found with the name ${outputName}. The following outputs were found: ${Object.keys(outputs).join(', ')}`);
    }

    core.setOutput(outputName, value);
  });
}

async function run() {
  const apiToken = core.getInput('api-token', { required: true });
  const workspaceId = core.getInput('workspace-id', { required: true });
  const desiredOutputs = core.getMultilineInput('outputs', { required: true });

  // Make sure we don't leak the API token in the logs
  core.setSecret(apiToken);

  const client = axios.create({
    baseURL: 'https://app.terraform.io/api/v2',
    timeout: 10000,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/vnd.api+json',
    }
  });

  try {
    const stateVersionId = await getCurrentStateVersion(client, workspaceId);
    const outputs = await getOutputs(client, stateVersionId);
    setOutputs(outputs, desiredOutputs);
  } catch (err) {
    console.error(err.message);
    core.setFailed(err.message);
  }
}

run();

})();

module.exports = __webpack_exports__;
/******/ })()
;