/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@ducanh2912/next-pwa/dist/fallback.js":
/*!************************************************************!*\
  !*** ./node_modules/@ducanh2912/next-pwa/dist/fallback.js ***!
  \************************************************************/
/***/ (function(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\nself.fallback=async _=>{let{destination:e,url:A}=_,s={document:\"/src/app/offline\",image:false,audio:false,video:false,font:false}[e];return s?caches.match(s,{ignoreSearch:!0}):\"\"===e&&false&&0?0:Response.error()};//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9ub2RlX21vZHVsZXMvQGR1Y2FuaDI5MTIvbmV4dC1wd2EvZGlzdC9mYWxsYmFjay5qcyIsIm1hcHBpbmdzIjoiO0FBQUEsd0JBQXdCLElBQUksb0JBQW9CLE1BQU0sU0FBUyxrQkFBcUMsT0FBTyxLQUFrQyxPQUFPLEtBQWtDLE9BQU8sS0FBa0MsTUFBTSxLQUFpQyxDQUFDLElBQUkseUJBQXlCLGdCQUFnQixVQUFVLEtBQWlDLEVBQUUsQ0FBd0MsQ0FBQyxDQUFpRSIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi9ub2RlX21vZHVsZXMvQGR1Y2FuaDI5MTIvbmV4dC1wd2EvZGlzdC9mYWxsYmFjay5qcz8zOTdhIl0sInNvdXJjZXNDb250ZW50IjpbInNlbGYuZmFsbGJhY2s9YXN5bmMgXz0+e2xldHtkZXN0aW5hdGlvbjplLHVybDpBfT1fLHM9e2RvY3VtZW50OnByb2Nlc3MuZW52Ll9fUFdBX0ZBTExCQUNLX0RPQ1VNRU5UX18saW1hZ2U6cHJvY2Vzcy5lbnYuX19QV0FfRkFMTEJBQ0tfSU1BR0VfXyxhdWRpbzpwcm9jZXNzLmVudi5fX1BXQV9GQUxMQkFDS19BVURJT19fLHZpZGVvOnByb2Nlc3MuZW52Ll9fUFdBX0ZBTExCQUNLX1ZJREVPX18sZm9udDpwcm9jZXNzLmVudi5fX1BXQV9GQUxMQkFDS19GT05UX199W2VdO3JldHVybiBzP2NhY2hlcy5tYXRjaChzLHtpZ25vcmVTZWFyY2g6ITB9KTpcIlwiPT09ZSYmcHJvY2Vzcy5lbnYuX19QV0FfRkFMTEJBQ0tfREFUQV9fJiZBLm1hdGNoKC9cXC9fbmV4dFxcL2RhdGFcXC8uK1xcLy4rXFwuanNvbiQvaSk/Y2FjaGVzLm1hdGNoKHByb2Nlc3MuZW52Ll9fUFdBX0ZBTExCQUNLX0RBVEFfXyx7aWdub3JlU2VhcmNoOiEwfSk6UmVzcG9uc2UuZXJyb3IoKX07Il0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./node_modules/@ducanh2912/next-pwa/dist/fallback.js\n"));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types policy */
/******/ 	!function() {
/******/ 		var policy;
/******/ 		__webpack_require__.tt = function() {
/******/ 			// Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
/******/ 			if (policy === undefined) {
/******/ 				policy = {
/******/ 					createScript: function(script) { return script; }
/******/ 				};
/******/ 				if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
/******/ 					policy = trustedTypes.createPolicy("nextjs#bundler", policy);
/******/ 				}
/******/ 			}
/******/ 			return policy;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script */
/******/ 	!function() {
/******/ 		__webpack_require__.ts = function(script) { return __webpack_require__.tt().createScript(script); };
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/react refresh */
/******/ 	!function() {
/******/ 		if (__webpack_require__.i) {
/******/ 		__webpack_require__.i.push(function(options) {
/******/ 			var originalFactory = options.factory;
/******/ 			options.factory = function(moduleObject, moduleExports, webpackRequire) {
/******/ 				var hasRefresh = typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
/******/ 				var cleanup = hasRefresh ? self.$RefreshInterceptModuleExecution$(moduleObject.id) : function() {};
/******/ 				try {
/******/ 					originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
/******/ 				} finally {
/******/ 					cleanup();
/******/ 				}
/******/ 			}
/******/ 		})
/******/ 		}
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	
/******/ 	// noop fns to prevent runtime errors during initialization
/******/ 	if (typeof self !== "undefined") {
/******/ 		self.$RefreshReg$ = function () {};
/******/ 		self.$RefreshSig$ = function () {
/******/ 			return function (type) {
/******/ 				return type;
/******/ 			};
/******/ 		};
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval-source-map devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./node_modules/@ducanh2912/next-pwa/dist/fallback.js"](0, __webpack_exports__, __webpack_require__);
/******/ 	
/******/ })()
;