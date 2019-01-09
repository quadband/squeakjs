"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const url = require("url");
const squeakcore_1 = require("./squeakcore");
const squeakutils_1 = require("./squeakutils");
const squeakcache_1 = require("./squeakcache");
const squeakwatch_1 = require("./squeakwatch");
const utilities_1 = require("../utilities");
class SqueakServer {
    constructor(squeak) {
        this.squeak = squeak;
        this._debug = false;
        this.viewMap = {};
        this.viewStore = {};
        this.interfaceMap = {};
        this.interfaceStore = {};
        this.eventListeners = {};
        this.fileCache = false;
        this.consumeMap = {};
        this.notFound = 'Squeak!';
        console.log('Path Res:', utilities_1.pathRes());
        this.setup();
    }
    setup() {
        this.publicPath = this.squeak.publicDir;
        this.fileCacheStrategy = this.squeak.fileCacheStrategy;
        this.fileWatchStrategy = this.squeak.fileWatchStrategy;
        this.init();
    }
    init() {
        const bootstrap = this.squeak.bootstrap();
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
    }
    viewBuilder() {
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
        for (let view in this.viewMap) {
            this.viewMap[view].viewRender = this.viewMap[view].viewPreRender;
        }
        // Set Watchers
        this.setWatchers();
        // Set Event Listeners
        this.setEventListeners();
        // Make Paths
        this.pathMaker();
    }
    // Serve
    serve(req, res) {
        req.parsed = url.parse(req.url, true);
        if (this._debug)
            if (this._debug)
                console.log('URL TARGET: ', req.url);
        if (this.squeakCache.check(req.parsed.pathname))
            return this.serveCache(req, res);
        if (this.interfaceStore[req.parsed.pathname])
            return this.serveInterface(req, res);
        if (this.checkConsume(req.parsed.pathname) != undefined)
            return this.serveConsume(req, res);
        let wildcard = this.checkWildcard(req.parsed.pathname);
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
    }
    // Serve Methods
    serveInterface(req, res, wildPath = undefined) {
        let urlTar = (wildPath == undefined) ? req.parsed.pathname : wildPath;
        if (this.interfaceStore[urlTar].onRequest)
            this.interfaceStore[urlTar].onRequest(req);
        this.interfaceStore[urlTar].__request(req, res);
        if (this.interfaceStore[urlTar].afterRequest)
            this.interfaceStore[urlTar].afterRequest(req);
        return;
    }
    serveConsume(req, res) {
        let tar = this.checkConsume(req.parsed.pathname);
        if (this.consumeMap[tar].onRequest)
            this.consumeMap[tar].onRequest(req);
        this.consumeMap[tar].__request(req, res);
        if (this.consumeMap[tar].afterRequest)
            this.consumeMap[tar].afterRequest(req);
        return;
    }
    serveCache(req, res, wildPath = undefined) {
        let urlTar = (wildPath == undefined) ? req.parsed.pathname : wildPath;
        if (this.viewStore[urlTar] && this.viewStore[urlTar].onRequest)
            this.viewStore[urlTar].onRequest(req);
        let cacheObj = this.squeakCache.get(urlTar);
        res.writeHead(200, { 'Content-Type': cacheObj.contentType });
        res.end(cacheObj.buffer, cacheObj.encoding);
        if (this.viewStore[urlTar] && this.viewStore[urlTar].afterRequest)
            this.viewStore[urlTar].afterRequest(req);
        return;
    }
    tryFile(req, res) {
        let filePath = '' + req.parsed.pathname;
        filePath = this.publicPath + filePath;
        const contentType = squeakutils_1.resolveContentType(filePath);
        fs.readFile(filePath, (error, content) => {
            if (error) {
                console.log(error.code);
                if (error.code == 'ENOENT') {
                    return this.serveNotFound(req, res);
                }
                else {
                    res.writeHead(500);
                    res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                }
            }
            else {
                if (this.fileCache && this.fileCacheStrategy.cacheStrategy == 'CACHE_ON_FIRST_LOAD') {
                    this.squeakCache.put({
                        urlPath: req.parsed.pathname,
                        contentType: contentType,
                        buffer: content,
                        encoding: 'utf-8'
                    });
                    this.setFileWatcher(req.parsed.pathname, filePath);
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    checkWildcard(url) {
        let wildcard = undefined;
        let urlArray = url.split('/');
        if (this._debug)
            console.log('URL ARRAY: ', urlArray);
        for (let i = 0, reqPath = '', len = urlArray.length; i < len; i++) {
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
    }
    serveNotFound(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.notFound, 'utf-8');
    }
    // INTERNAL METHODS
    gatherDeclarations(bootstrap) {
        for (let dec in bootstrap.declarations) {
            if (this.viewMap[bootstrap.declarations[dec]]) {
                throw "NAME COLLISION IN VIEW MAP AT VIEWS";
            }
            else {
                let newView = new bootstrap.declarations[dec]();
                if (newView.onInit) {
                    newView.onInit();
                }
                if (newView.type == 'interface')
                    this.interfaceMap[newView.squeakName] = newView;
                if (newView.type == 'view')
                    this.viewMap[newView.squeakName] = newView;
            }
        }
    }
    gatherRootViews(bootstrap) {
        for (let root in bootstrap.roots) {
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
    }
    applyInterfaces() {
        for (let view in this.interfaceMap) {
            this.interfaceStore[this.interfaceMap[view].urlPath] = this.interfaceMap[view];
            if (this.interfaceMap[view].consumeFrom)
                this.consumeMap[this.interfaceMap[view].urlPath] = this.interfaceStore[this.interfaceMap[view].urlPath];
        }
    }
    readRootViews() {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                this.viewMap[view].viewString = squeakcore_1.readRootView(this.viewMap[view], this.squeak.viewDir);
            }
        }
    }
    runViewBuilds() {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'view') {
                this.viewMap[view].__build();
            }
        }
    }
    buildRoots() {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                this.viewMap = squeakutils_1.viewMux(this.viewMap, view, this.viewMap[view], 'viewString', 'viewPreRender');
            }
        }
    }
    extractRoots() {
        let roots = {};
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'root')
                roots[view] = this.viewMap[view];
        }
        return roots;
    }
    applyRoots(roots) {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'view')
                this.viewMap[view].__preRender(roots);
        }
    }
    lastPassRender() {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'view')
                this.viewMap[view].__lastPassRender();
        }
    }
    setWatchers() {
        let watchObjArr = [];
        if (this.squeak['squeakFile']) {
            let watchObj = {
                filePath: this.squeak.squeakFile,
                watchContext: 'SQUEAK_MAIN',
                watchStrategy: this.fileWatchStrategy.watchStrategy,
                trigger: 'SQUEAK_MAIN'
            };
            watchObjArr.push(watchObj);
        }
        for (let view in this.interfaceMap) {
            if (this.interfaceMap[view]['squeakFile']) {
                let watchObj = {
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
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'root') {
                let watchObj = {
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
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'view') {
                let watchObj = {
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
        for (let i = 0, len = watchObjArr.length; i < len; i++) {
            this.squeakWatch.add(watchObjArr[i]);
        }
    }
    setFileWatcher(url, filePath) {
        let watchObj = {
            filePath: filePath,
            watchContext: 'FILE',
            watchStrategy: this.fileWatchStrategy.watchStrategy,
            trigger: url
        };
        this.squeakWatch.add(watchObj);
    }
    setEventListeners() {
        for (let view in this.viewMap) {
            if (this.viewMap[view].type == 'view') {
                this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
            }
        }
    }
    viewEventHandler(evt) {
        if (evt.type == 'reRender')
            return this.reRenderView(evt.from);
    }
    pathMaker(overwrite = false) {
        for (let view in this.viewMap) {
            if (this.viewMap[view].urlPath) {
                this.viewStore[this.viewMap[view].urlPath] = this.viewMap[view];
                this.squeakCache.put({
                    urlPath: this.viewStore[this.viewMap[view].urlPath].urlPath,
                    contentType: 'text/html',
                    buffer: Buffer.from(this.viewStore[this.viewMap[view].urlPath].viewRender),
                    encoding: 'utf-8'
                }, overwrite);
            }
        }
    }
    checkConsume(url) {
        for (let view in this.consumeMap) {
            if (url.indexOf(view) == 0)
                return view;
        }
        return undefined;
    }
    checkCacheStrategy() {
        this.squeakCache = new squeakcache_1.SqueakCache(this._debug);
        if (this.fileCacheStrategy.cacheStrategy === 'NONE')
            return;
        this.fileCache = true;
        if (this.fileCacheStrategy.cacheStrategy === 'CACHE_SPECIFIC_LIST')
            return this.squeakCache.putFiles(this.publicPath, this.fileCacheStrategy.cacheList);
        if (this.fileCacheStrategy.cacheStrategy === 'CACHE_CUSTOM_FUNCTION')
            return this.squeakCache.runCustomCache(this.fileCacheStrategy.cacheFunction);
    }
    checkWatchStrategy() {
        this.squeakWatch = new squeakwatch_1.SqueakWatch(this.publicPath, this.squeak.viewDir, this._debug);
        this.squeakWatch.on('watchEvt', (alertPkg) => {
            this.changeAlert(alertPkg);
        });
        if (this.fileWatchStrategy.watchStrategy === 'NONE')
            return;
        // TODO: Add more
    }
    changeAlert(alertPkg) {
        let manualDebug = false;
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
    }
    rebuildRoot(view) {
        console.log('Rebuilding Root');
        if (!this.viewMap[view] || !(this.viewMap[view].type == 'root')) {
            console.error(`Error: ${view} not in ViewMap or is not a root view`);
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
        // TODO: Fix this
        for (let view in this.viewMap) {
            this.viewMap[view].viewRender = this.viewMap[view].viewPreRender;
        }
        // Make Paths
        this.pathMaker(true);
    }
    rebuildFull() {
        console.log('Full rebuild is currently disabled.');
        let fullRebuild = false;
        if (fullRebuild) {
            console.log('REBUILDING FULL');
            let fileLocation = this.squeak.squeakFile;
            let config = JSON.parse(this.squeak.__config);
            this.squeak = null;
            delete require.cache[fileLocation];
            let reqBuild = require(fileLocation);
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
    }
    rebuildInterface(trigger) {
        console.log(`Rebuilding ${trigger}`);
        // The following will destroy and reinstantiate the interface
        if (this.interfaceMap[trigger]['squeakFile']) {
            console.log('Destroying View Constructor');
            let fileLocation = this.interfaceMap[trigger].squeakFile;
            let config = JSON.parse(this.interfaceMap[trigger].__config);
            this.interfaceMap[trigger] = null;
            delete require.cache[fileLocation];
            let reqBuild = require(fileLocation);
            let buildFn = reqBuild[Object.keys(reqBuild)[0]];
            let rebuild = squeakcore_1.SqueakInterface(config)(buildFn);
            this.interfaceMap[trigger] = new rebuild();
            if (this.interfaceMap[trigger]['onInit'])
                this.interfaceMap[trigger].onInit();
        }
        // **********
        if (this.interfaceMap[trigger].consumeFrom)
            this.consumeMap[this.interfaceMap[trigger].urlPath] = this.interfaceStore[this.interfaceMap[trigger].urlPath];
    }
    rebuildView(view) {
        console.log(`Rebuilding: ${view}`);
        if (!this.viewMap[view]) {
            console.error(`Error: Attempting to rebuild ${view} failed. Not present in View Map!`);
            return;
        }
        let backupView = JSON.parse(JSON.stringify(this.viewMap[view]));
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
    }
    reRenderView(view) {
        this.viewMap[view].__build();
        this.viewMap[view].__preRender(this.extractRoots());
        this.viewMap[view].viewRender = this.viewMap[view].viewPreRender;
        if (this.viewMap[view].urlPath) {
            this.viewStore[this.viewMap[view].urlPath] = this.viewMap[view];
            this.squeakCache.put({
                urlPath: this.viewStore[this.viewMap[view].urlPath].urlPath,
                contentType: 'text/html',
                buffer: Buffer.from(this.viewStore[this.viewMap[view].urlPath].viewRender),
                encoding: 'utf-8'
            }, true);
        }
    }
    reloadViewClass(view) {
        console.log('Destroying View Constructor');
        if (this.eventListeners[view]) {
            this.eventListeners[view].removeListener('viewEvt', this.viewEventHandler.bind(this));
            delete this.eventListeners[view];
        }
        let fileLocation = this.viewMap[view].squeakFile;
        let config = JSON.parse(this.viewMap[view].__config);
        this.viewMap[view] = null;
        delete require.cache[fileLocation];
        let reqBuild = require(fileLocation);
        let buildFn = reqBuild[Object.keys(reqBuild)[0]];
        let rebuild = squeakcore_1.SqueakView(config)(buildFn);
        this.viewMap[view] = new rebuild();
        this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
        if (this.viewMap[view]['onInit'])
            this.viewMap[view].onInit();
    }
    rebuildFile(fileTar) {
        console.log(`Rebuilding file: ${fileTar}`);
        let filePath = this.publicPath + fileTar;
        this.squeakCache.putFile({
            urlPath: fileTar,
            contentType: squeakutils_1.resolveContentType(filePath),
            buffer: undefined,
            encoding: 'utf-8'
        }, filePath, true);
    }
}
exports.SqueakServer = SqueakServer;
