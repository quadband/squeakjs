"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var url = require("url");
var zlib = require("zlib");
var squeakcore_1 = require("./squeakcore");
var squeakutils_1 = require("./squeakutils");
var squeakcache_1 = require("./squeakcache");
var squeakwatch_1 = require("./squeakwatch");
var utilities_1 = require("../utilities");
var SqueakServer = /** @class */ (function () {
    function SqueakServer(squeak, debug) {
        if (debug === void 0) { debug = false; }
        this.squeak = squeak;
        this._debug = false;
        this.viewMap = {};
        this.viewStore = {};
        this.interfaceMap = {};
        this.interfaceStore = {};
        this.componentMap = {};
        this.eventListeners = {};
        this.fileCache = false;
        this.consumeMap = {};
        this.notFound = 'Squeak!';
        this._debug = debug;
        console.log('Path Res:', utilities_1.pathRes());
        this.setup();
    }
    SqueakServer.prototype.setup = function () {
        this.publicPath = this.squeak.publicDir;
        this.fileCacheStrategy = this.squeak.fileCacheStrategy;
        this.fileWatchStrategy = this.squeak.fileWatchStrategy;
        this.init();
    };
    SqueakServer.prototype.init = function () {
        var bootstrap = this.squeak.bootstrap();
        if (this._debug)
            console.log('Bootstrapping:', bootstrap);
        // Check Cache Strategy
        this.checkCacheStrategy();
        // Check Watch Strategy
        this.checkWatchStrategy();
        // Gather Views
        this.gatherDeclarations(bootstrap);
        // Gather Root Views
        this.gatherRootViews(bootstrap);
        // Build
        this.viewBuilder();
    };
    SqueakServer.prototype.viewBuilder = function () {
        // Apply Interfaces
        this.applyInterfaces();
        // Read Root Views
        this.readRootViews();
        // Run View Builds
        this.runViewBuilds();
        // Build Roots
        this.buildRoots();
        // Extract and Apply roots
        this.applyRoots(this.extractRoots());
        // Last Pass Render
        this.lastPassRender();
        // TODO: Finish shit ree
        // Set Watchers
        this.setWatchers();
        // Set Event Listeners
        this.setEventListeners();
        // Make Paths
        this.pathMaker();
    };
    // Serve
    SqueakServer.prototype.serve = function (req, res) {
        req.parsed = url.parse(req.url, true);
        if (this._debug) {
            console.log('URL TARGET:', req.url);
            console.log('HEADERS:', req.headers);
        }
        if (this.squeakCache.check(req.parsed.pathname))
            return this.serveCache(req, res);
        if (this.interfaceStore[req.parsed.pathname])
            return this.serveInterface(req, res);
        if (this.checkConsume(req.parsed.pathname) != undefined)
            return this.serveConsume(req, res);
        var wildcard = this.checkWildcard(req.parsed.pathname);
        if (wildcard != undefined) {
            if (this.interfaceStore[wildcard.path])
                return this.serveInterface(req, res, wildcard.path);
            if (this.squeakCache.check(wildcard.path))
                return this.serveCache(req, res, wildcard.path);
        }
        if (this.fileCache && this.squeakCache.check(req.parsed.pathname))
            return this.serveCache(req, res);
        if (this.publicPath != undefined)
            return this.tryFile(req, res);
        // Nothing Found in anything
        return this.serveNotFound(req, res);
    };
    // Serve Methods
    SqueakServer.prototype.serveInterface = function (req, res, wildPath) {
        if (wildPath === void 0) { wildPath = undefined; }
        var urlTar = (wildPath == undefined) ? req.parsed.pathname : wildPath;
        if (this.interfaceStore[urlTar].onRequest)
            this.interfaceStore[urlTar].onRequest(req);
        this.interfaceStore[urlTar].__request(req, res);
        if (this.interfaceStore[urlTar].afterRequest)
            this.interfaceStore[urlTar].afterRequest(req);
        return;
    };
    SqueakServer.prototype.serveConsume = function (req, res) {
        var tar = this.checkConsume(req.parsed.pathname);
        if (this.consumeMap[tar].onRequest)
            this.consumeMap[tar].onRequest(req);
        this.consumeMap[tar].__request(req, res);
        if (this.consumeMap[tar].afterRequest)
            this.consumeMap[tar].afterRequest(req);
        return;
    };
    SqueakServer.prototype.serveCache = function (req, res, wildPath) {
        if (wildPath === void 0) { wildPath = undefined; }
        var urlTar = (wildPath == undefined) ? req.parsed.pathname : wildPath;
        if (this.viewStore[urlTar] && this.viewStore[urlTar].onRequest)
            this.viewStore[urlTar].onRequest(req);
        var cacheObj = this.squeakCache.get(urlTar);
        this.sendData(req, res, cacheObj);
        if (this.viewStore[urlTar] && this.viewStore[urlTar].afterRequest)
            this.viewStore[urlTar].afterRequest(req);
        return;
    };
    SqueakServer.prototype.sendData = function (req, res, dataObj) {
        var acceptEncoding;
        if (req.headers['accept-encoding']) {
            acceptEncoding = req.headers['accept-encoding'];
        }
        else {
            acceptEncoding = '';
        }
        if (acceptEncoding.match(/\bgzip\b/)) {
            this.sendZipped(req, res, dataObj);
        }
        else {
            this.sendNormal(req, res, dataObj);
        }
    };
    SqueakServer.prototype.sendZipped = function (req, res, dataObj) {
        var _this = this;
        if (dataObj['zbuffer']) {
            if (this._debug) {
                console.log('Using Cached Zip Buffer');
                console.log('Serving: gzip');
            }
            try {
                res.writeHead(200, { 'Content-Type': dataObj.contentType, 'Content-Encoding': 'gzip' });
                res.end(dataObj['zbuffer']);
            }
            catch (e) {
                if (this._debug)
                    console.error("Error: Unable to send response. " + e);
            }
        }
        else {
            if (this._debug)
                console.log('Zipping Data');
            zlib.gzip(dataObj.buffer, function (err, zipped) {
                if (err) {
                    _this.sendNormal(req, res, dataObj);
                }
                else {
                    try {
                        if (_this._debug)
                            console.log('Serving: gzip');
                        res.writeHead(200, { 'Content-Type': dataObj.contentType, 'Content-Encoding': 'gzip' });
                        res.end(zipped);
                    }
                    catch (e) {
                        if (_this._debug)
                            console.error("Error: Unable to send response. " + e);
                    }
                }
            });
        }
    };
    SqueakServer.prototype.sendNormal = function (req, res, dataObj) {
        try {
            if (this._debug)
                console.log('Serving:', dataObj.encoding);
            res.writeHead(200, { 'Content-Type': dataObj.contentType });
            res.end(dataObj.buffer, dataObj.encoding);
        }
        catch (e) {
            if (this._debug)
                console.error("Error: Unable to send response. " + e);
        }
    };
    SqueakServer.prototype.tryFile = function (req, res) {
        var _this = this;
        var filePath = '' + req.parsed.pathname;
        filePath = this.publicPath + filePath;
        var contentType = squeakutils_1.resolveContentType(filePath);
        fs.readFile(filePath, function (error, content) {
            if (error) {
                console.log(error.code);
                if (error.code == 'ENOENT') {
                    return _this.serveNotFound(req, res);
                }
                else {
                    try {
                        res.writeHead(500);
                        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                    }
                    catch (e) {
                        if (_this._debug)
                            console.error("Error: Unable to send response. " + e);
                    }
                }
            }
            else {
                var dataObj = {
                    urlPath: req.parsed.pathname,
                    contentType: contentType,
                    buffer: content,
                    encoding: 'utf-8'
                };
                if (_this.fileCache && _this.fileCacheStrategy.cacheStrategy == 'CACHE_ON_FIRST_LOAD') {
                    _this.squeakCache.put(dataObj);
                    _this.setFileWatcher(req.parsed.pathname, filePath);
                }
                _this.sendData(req, res, dataObj);
            }
        });
    };
    SqueakServer.prototype.checkWildcard = function (url) {
        var wildcard = undefined;
        var urlArray = url.split('/');
        if (this._debug)
            console.log('URL ARRAY: ', urlArray);
        for (var i = 0, reqPath = '', len = urlArray.length; i < len; i++) {
            if (urlArray[i] == '') {
                reqPath += '/';
            }
            else {
                reqPath += urlArray[i];
            }
            if (this.viewStore[reqPath] && this.viewStore[reqPath].hasWildcard) {
                return ({
                    path: reqPath,
                    wildPath: url
                });
            }
        }
        return wildcard;
    };
    SqueakServer.prototype.serveNotFound = function (req, res) {
        var dataObj = {
            urlPath: req.parsed.pathname,
            contentType: 'text/html',
            buffer: this.notFound,
            encoding: 'utf-8'
        };
        this.sendData(req, res, dataObj);
    };
    // INTERNAL METHODS
    SqueakServer.prototype.gatherDeclarations = function (bootstrap) {
        for (var dec in bootstrap.declarations) {
            if (this.viewMap[bootstrap.declarations[dec]]) {
                throw "NAME COLLISION IN VIEW MAP AT VIEWS";
            }
            else {
                var newView = new bootstrap.declarations[dec]();
                if (newView.onInit) {
                    newView.onInit();
                }
                if (newView.type == 'interface')
                    this.interfaceMap[newView.squeakName] = newView;
                if (newView.type == 'view')
                    this.viewMap[newView.squeakName] = newView;
                if (newView.type == 'component')
                    this.componentMap[newView.squeakName] = newView;
            }
        }
    };
    SqueakServer.prototype.gatherRootViews = function (bootstrap) {
        for (var root in bootstrap.roots) {
            if (this.viewMap[bootstrap.roots[root].selector]) {
                throw "NAME COLLISION IN VIEW MAP AT ROOTS";
            }
            else {
                this.viewMap[bootstrap.roots[root].selector] = {
                    type: 'root',
                    viewString: undefined,
                    viewPreRender: undefined,
                    viewRender: undefined,
                    file: bootstrap.roots[root].file
                };
            }
        }
    };
    SqueakServer.prototype.applyInterfaces = function () {
        for (var view in this.interfaceMap) {
            this.interfaceStore[this.interfaceMap[view].urlPath] = this.interfaceMap[view];
            if (this.interfaceMap[view].consumeFrom)
                this.consumeMap[this.interfaceMap[view].urlPath] = this.interfaceStore[this.interfaceMap[view].urlPath];
        }
    };
    SqueakServer.prototype.readRootViews = function () {
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                this.viewMap[view].viewString = squeakcore_1.readRootView(this.viewMap[view], this.squeak.viewDir);
            }
        }
    };
    SqueakServer.prototype.runViewBuilds = function () {
        var globals = {};
        var globalFound = false;
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view' && this.viewMap[view].squeakGlobal) {
                this.viewMap[view].__build();
                globals[view] = this.viewMap[view];
                globalFound = true;
            }
        }
        if (!globalFound)
            globals = undefined;
        for (var view in this.componentMap) {
            this.componentMap[view].__build(globals);
        }
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view' && !this.viewMap[view].squeakGlobal) {
                this.viewMap[view].__build(globals);
            }
        }
    };
    SqueakServer.prototype.buildRoots = function () {
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                this.viewMap = squeakutils_1.viewMux(this.viewMap, view, this.viewMap[view], 'viewString', 'viewPreRender');
            }
        }
    };
    SqueakServer.prototype.extractRoots = function () {
        var roots = {};
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'root')
                roots[view] = this.viewMap[view];
        }
        return roots;
    };
    SqueakServer.prototype.applyRoots = function (roots) {
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view')
                this.viewMap[view].__preRender(roots);
        }
    };
    SqueakServer.prototype.lastPassRender = function () {
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view')
                this.viewMap[view].__lastPassRender(this.componentMap);
        }
    };
    SqueakServer.prototype.setWatchers = function () {
        var watchObjArr = [];
        if (this.squeak['squeakFile']) {
            var watchObj = {
                filePath: this.squeak.squeakFile,
                watchContext: 'SQUEAK_MAIN',
                watchStrategy: this.fileWatchStrategy.watchStrategy,
                trigger: 'SQUEAK_MAIN'
            };
            watchObjArr.push(watchObj);
        }
        for (var view in this.interfaceMap) {
            if (this.interfaceMap[view]['squeakFile']) {
                var watchObj = {
                    filePath: this.interfaceMap[view].squeakFile,
                    watchContext: 'INTERFACE',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if (this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER')
                    watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                var watchObj = {
                    filePath: this.squeak.viewDir + '/' + this.viewMap[view].file,
                    watchContext: 'VIEW_ROOT',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if (this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER')
                    watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view') {
                var watchObj = {
                    filePath: this.viewMap[view].squeakPath,
                    watchContext: 'VIEW',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if (this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER')
                    watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }
        for (var i = 0, len = watchObjArr.length; i < len; i++) {
            this.squeakWatch.add(watchObjArr[i]);
        }
    };
    SqueakServer.prototype.setFileWatcher = function (url, filePath) {
        var watchObj = {
            filePath: filePath,
            watchContext: 'FILE',
            watchStrategy: this.fileWatchStrategy.watchStrategy,
            trigger: url
        };
        this.squeakWatch.add(watchObj);
    };
    SqueakServer.prototype.setEventListeners = function () {
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view') {
                this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
            }
        }
    };
    SqueakServer.prototype.viewEventHandler = function (evt) {
        if (evt.type == 'reRender')
            return this.reRenderView(evt.from);
    };
    SqueakServer.prototype.pathMaker = function (overwrite) {
        if (overwrite === void 0) { overwrite = false; }
        for (var view in this.viewMap) {
            if (this.viewMap[view].type == 'view' && !this.viewMap[view].squeakGlobal && this.viewMap[view].urlPath) {
                this.viewStore[this.viewMap[view].urlPath] = this.viewMap[view];
                this.squeakCache.put({
                    urlPath: this.viewStore[this.viewMap[view].urlPath].urlPath,
                    contentType: 'text/html',
                    buffer: Buffer.from(this.viewStore[this.viewMap[view].urlPath].viewRender),
                    encoding: 'utf-8'
                }, overwrite);
            }
        }
    };
    SqueakServer.prototype.checkConsume = function (url) {
        for (var view in this.consumeMap) {
            if (url.indexOf(view) == 0)
                return view;
        }
        return undefined;
    };
    SqueakServer.prototype.checkCacheStrategy = function () {
        this.squeakCache = new squeakcache_1.SqueakCache(this._debug);
        if (this.fileCacheStrategy.cacheStrategy === 'NONE')
            return;
        this.fileCache = true;
        if (this.fileCacheStrategy.cacheStrategy === 'CACHE_SPECIFIC_LIST')
            return this.squeakCache.putFiles(this.publicPath, this.fileCacheStrategy.cacheList);
        if (this.fileCacheStrategy.cacheStrategy === 'CACHE_CUSTOM_FUNCTION')
            return this.squeakCache.runCustomCache(this.fileCacheStrategy.cacheFunction);
    };
    SqueakServer.prototype.checkWatchStrategy = function () {
        var _this = this;
        this.squeakWatch = new squeakwatch_1.SqueakWatch(this.publicPath, this.squeak.viewDir, this._debug);
        this.squeakWatch.on('watchEvt', function (alertPkg) {
            _this.changeAlert(alertPkg);
        });
        if (this.fileWatchStrategy.watchStrategy === 'NONE')
            return;
        // TODO: Add more
    };
    SqueakServer.prototype.changeAlert = function (alertPkg) {
        var manualDebug = false;
        if (this._debug || manualDebug)
            console.log('CHANGE ALERT PACKAGE:', alertPkg);
        if (alertPkg.watchContext == 'VIEW_ROOT')
            this.rebuildRoot(alertPkg.trigger);
        if (alertPkg.watchContext == 'VIEW')
            this.rebuildView(alertPkg.trigger);
        if (alertPkg.watchContext == 'FILE')
            this.rebuildFile(alertPkg.trigger);
        if (alertPkg.watchContext == 'INTERFACE')
            this.rebuildInterface(alertPkg.trigger);
        if (alertPkg.watchContext == 'SQUEAK_MAIN')
            this.rebuildFull();
    };
    SqueakServer.prototype.rebuildRoot = function (view) {
        console.log('Rebuilding Root');
        if (!this.viewMap[view] || !(this.viewMap[view].type == 'root')) {
            console.error("Error: " + view + " not in ViewMap or is not a root view");
            return;
        }
        // Read Root Views
        this.readRootViews();
        // Run View Builds
        this.runViewBuilds();
        // Build Roots
        this.buildRoots();
        // Extract roots
        this.applyRoots(this.extractRoots());
        // Last Pass Render
        this.lastPassRender();
        // Make Paths
        this.pathMaker(true);
    };
    SqueakServer.prototype.rebuildFull = function () {
        console.log('Full rebuild is currently disabled.');
        var fullRebuild = false;
        if (fullRebuild) {
            console.log('REBUILDING FULL');
            var fileLocation = this.squeak.squeakFile;
            var config = JSON.parse(this.squeak.__config);
            this.squeak = null;
            delete require.cache[fileLocation];
            var reqBuild = require(fileLocation);
            /*
            console.log(reqBuild);
            let buildFn = reqBuild[Object.keys(reqBuild)[0]];
            console.log(buildFn.toString());
            */
            this.squeakCache.clear(true);
            this.squeakWatch.clear(true);
            this.interfaceMap = {};
            this.interfaceStore = {};
            this.viewMap = {};
            this.viewMap = {};
            squeakcache_1.SqueakCache.__destroy();
            delete this.squeakCache;
            /*
            let rebuild = SqueakMain(config)(buildFn);
            console.log(rebuild.toString());
            */
            this.squeak = reqBuild;
            console.log(this.squeak);
            console.log('Reinitializing Squeak');
            this.setup();
        }
    };
    SqueakServer.prototype.rebuildInterface = function (trigger) {
        console.log("Rebuilding " + trigger);
        // The following will destroy and reinstantiate the interface
        if (this.interfaceMap[trigger]['squeakFile']) {
            console.log('Destroying View Constructor');
            var fileLocation = this.interfaceMap[trigger].squeakFile;
            var config = JSON.parse(this.interfaceMap[trigger].__config);
            this.interfaceMap[trigger] = null;
            delete require.cache[fileLocation];
            var reqBuild = require(fileLocation);
            var buildFn = reqBuild[Object.keys(reqBuild)[0]];
            var rebuild = squeakcore_1.SqueakInterface(config)(buildFn);
            this.interfaceMap[trigger] = new rebuild();
            if (this.interfaceMap[trigger]['onInit'])
                this.interfaceMap[trigger].onInit();
        }
        // **********
        if (this.interfaceMap[trigger].consumeFrom)
            this.consumeMap[this.interfaceMap[trigger].urlPath] = this.interfaceStore[this.interfaceMap[trigger].urlPath];
    };
    SqueakServer.prototype.rebuildView = function (view) {
        console.log("Rebuilding: " + view);
        if (!this.viewMap[view]) {
            console.error("Error: Attempting to rebuild " + view + " failed. Not present in View Map!");
            return;
        }
        var backupView = JSON.parse(JSON.stringify(this.viewMap[view]));
        try {
            // Destroy and Reinstantiate
            if (this.viewMap[view]['squeakFile'])
                this.reloadViewClass(view);
            this.reRenderView(view);
        }
        catch (e) {
            console.error(e);
            this.viewMap[view] = backupView;
        }
    };
    SqueakServer.prototype.reRenderView = function (view) {
        var globals = {};
        var globalFound = false;
        for (var view_1 in this.viewMap) {
            if (this.viewMap[view_1].type == 'view' && this.viewMap[view_1].squeakGlobal) {
                this.viewMap[view_1].__build();
                globals[view_1] = this.viewMap[view_1];
                globalFound = true;
            }
        }
        if (!globalFound)
            globals = undefined;
        // TODO: MAKE COMPONENTS HERE
        this.viewMap[view].__build(globals);
        this.viewMap[view].__preRender(this.extractRoots());
        this.viewMap[view].__lastPassRender(this.componentMap);
        if (this.viewMap[view].urlPath) {
            this.viewStore[this.viewMap[view].urlPath] = this.viewMap[view];
            this.squeakCache.put({
                urlPath: this.viewStore[this.viewMap[view].urlPath].urlPath,
                contentType: 'text/html',
                buffer: Buffer.from(this.viewStore[this.viewMap[view].urlPath].viewRender),
                encoding: 'utf-8'
            }, true);
        }
    };
    SqueakServer.prototype.reloadViewClass = function (view) {
        console.log('Destroying View Constructor');
        if (this.eventListeners[view]) {
            this.eventListeners[view].removeListener('viewEvt', this.viewEventHandler.bind(this));
            delete this.eventListeners[view];
        }
        var fileLocation = this.viewMap[view].squeakFile;
        var config = JSON.parse(this.viewMap[view].__config);
        this.viewMap[view] = null;
        delete require.cache[fileLocation];
        var reqBuild = require(fileLocation);
        var buildFn = reqBuild[Object.keys(reqBuild)[0]];
        var rebuild = squeakcore_1.SqueakView(config)(buildFn);
        this.viewMap[view] = new rebuild();
        this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
        if (this.viewMap[view]['onInit'])
            this.viewMap[view].onInit();
    };
    SqueakServer.prototype.rebuildFile = function (fileTar) {
        console.log("Rebuilding file: " + fileTar);
        var filePath = this.publicPath + fileTar;
        this.squeakCache.putFile({
            urlPath: fileTar,
            contentType: squeakutils_1.resolveContentType(filePath),
            buffer: undefined,
            encoding: 'utf-8'
        }, filePath, true);
    };
    return SqueakServer;
}());
exports.SqueakServer = SqueakServer;
