import * as fs from 'fs';
import * as path from "path";

import { readRootView, SqueakView, SqueakInterface, SqueakMain } from './squeakcore';
import { viewMux } from "./squeakutils";
import { SqueakCache } from "./squeakcache";
import { FileCacheStrategyObject, FileWatchStrategyObject, FileWatchStoreObj } from "./squeakcommon";
import { MIMETYPES } from "./squeakconst";
import { SqueakWatch } from "./squeakwatch";

export class SqueakServer {

    private _debug: boolean = false;

    viewMap = {};
    viewStore = {};
    interfaceMap = {};
    interfaceStore = {};

    eventListeners = {};

    fileCacheStrategy: FileCacheStrategyObject;
    fileCache: boolean = false;
    squeakCache: SqueakCache;

    fileWatchStrategy: FileWatchStrategyObject;
    squeakWatch: SqueakWatch;

    consumeMap = {};

    public notFound = 'Squeak!';

    publicPath: string;

    constructor(private squeak){
        this.setup();
    }

    setup(): void {
        this.publicPath = this.squeak.publicDir;
        this.fileCacheStrategy = this.squeak.fileCacheStrategy;
        this.fileWatchStrategy = this.squeak.fileWatchStrategy;
        this.init();
    }

    init(): void {
        const bootstrap = this.squeak.bootstrap();
        if(this._debug) console.log('Bootstrapping:', bootstrap);
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

    viewBuilder(): void {
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
        // TODO: Finish shit ree
        for(let view in this.viewMap){
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
    public serve(req,res) {
        if(this._debug) if(this._debug) console.log('URL TARGET: ', req.url);

        if(this.squeakCache.check(req.url)) return this.serveCache(req, res);

        if(this.interfaceStore[req.url]) return this.serveInterface(req,res);
        //if(this.viewStore[req.url]) return this.serveView(req, res);
        if(this.checkConsume(req.url) != undefined) return this.serveConsume(req, res);

        let wildcard: Wildcard = this.checkWildcard(req.url);
        if(wildcard){
            if(this.interfaceStore[wildcard.path]) return this.serveInterface(req,res);
            if(this.squeakCache.check(wildcard.path)) return this.serveCache(req, res);
        }
        if(this.fileCache && this.squeakCache.check(req.url)) return this.serveCache(req, res);
        if(this.publicPath != undefined) return this.tryFile(req, res);

        // Nothing Found in anything
        return this.serveNotFound(req, res);
    }

    // Serve Methods
    serveView(req, res){
        if(this.viewStore[req.url].onRequest) this.viewStore[req.url].onRequest(req);
        res.writeHead(200, {'Content-Type': 'text/html'});
        return res.end(this.viewStore[req.url].viewRender, 'utf-8');
    }

    serveInterface(req,res){
        if(this.interfaceStore[req.url].onRequest) this.interfaceStore[req.url].onRequest(req);
        this.interfaceStore[req.url].__request(req,res);
        if(this.interfaceStore[req.url].afterRequest) this.interfaceStore[req.url].afterRequest(req);
        return;
    }

    serveConsume(req, res){
        let tar = this.checkConsume(req.url);
        if(this.consumeMap[tar].onRequest) this.consumeMap[tar].onRequest(req);
        this.consumeMap[tar].__request(req, res);
        if(this.consumeMap[tar].afterRequest) this.consumeMap[tar].afterRequest(req);
        return;
    }

    serveCache(req, res){
        if(this.viewStore[req.url] && this.viewStore[req.url].onRequest) this.viewStore[req.url].onRequest(req);
        let cacheObj = this.squeakCache.get(req.url);
        res.writeHead(200, {'Content-Type': cacheObj.contentType});
        res.end(cacheObj.buffer, cacheObj.encoding);
        if(this.viewStore[req.url] && this.viewStore[req.url].afterRequest) this.viewStore[req.url].afterRequest(req);
        return;
    }

    tryFile(req, res){
        let filePath = '' + req.url;
        filePath = this.publicPath + filePath;
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = MIMETYPES[extname] || 'application/octet-stream';
        fs.readFile(filePath, (error, content) => {
            if (error) {
                console.log(error.code);
                if(error.code == 'ENOENT') {
                    return this.serveNotFound(req,res);
                }
                else {
                    res.writeHead(500);
                    res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                }
            }
            else {
                if(this.fileCache && this.fileCacheStrategy.cacheStrategy == 'CACHE_ON_FIRST_LOAD') {
                    this.squeakCache.put({
                        urlPath: req.url,
                        contentType: contentType,
                        buffer: content,
                        encoding: 'utf-8'
                    });
                    this.setFileWatcher(req.url, filePath);
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }

    private checkWildcard(url): Wildcard {
        let wildcard = undefined;
        let urlArray = url.split('/');
        if(this._debug) console.log('URL ARRAY: ', urlArray);
        for(let i=0,reqPath='',len=urlArray.length;i<len;i++){
            if(urlArray[i] == ''){
                reqPath += '/'
            } else {
                reqPath += urlArray[i];
            }
            if(this.viewStore[reqPath] && this.viewStore[reqPath].hasWildcard){
                return({
                    path: reqPath,
                    wildPath: url
                });
            }
        }
        return wildcard;
    }

    serveNotFound(req, res){
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.notFound, 'utf-8');
    }

    // INTERNAL METHODS
    private gatherDeclarations(bootstrap): void {
        for(let dec in bootstrap.declarations){
            if(this.viewMap[bootstrap.declarations[dec]]){
                throw "NAME COLLISION IN VIEW MAP AT VIEWS";
            } else {
                let newView = new bootstrap.declarations[dec]();
                if(newView.onInit){
                    newView.onInit();
                }
                if(newView.type == 'interface') this.interfaceMap[newView.squeakName] = newView;
                if(newView.type == 'view') this.viewMap[newView.squeakName] = newView;
            }
        }
    }

    private gatherRootViews(bootstrap): void {
        for(let root in bootstrap.roots){
            if(this.viewMap[bootstrap.roots[root].selector]){
                throw "NAME COLLISION IN VIEW MAP AT ROOTS";
            } else {
                this.viewMap[bootstrap.roots[root].selector] = {
                    type: 'root',
                    viewString: undefined,
                    viewPreRender: undefined,
                    viewRender: undefined,
                    file: bootstrap.roots[root].file
                }
            }
        }
    }

    private applyInterfaces(): void {
        for(let view in this.interfaceMap){
            this.interfaceStore[this.interfaceMap[view].urlPath] = this.interfaceMap[view];
            if(this.interfaceMap[view].consumeFrom)
                this.consumeMap[this.interfaceMap[view].urlPath] = this.interfaceStore[this.interfaceMap[view].urlPath];
        }
    }

    private readRootViews(): void {
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'root'){
                this.viewMap[view].viewString = readRootView(this.viewMap[view], this.squeak.viewDir);
            }
        }
    }

    private runViewBuilds(): void {
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'view'){
                this.viewMap[view].__build();
            }
        }
    }

    private buildRoots(): void {
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'root'){
                this.viewMap = viewMux(this.viewMap, view, this.viewMap[view], 'viewString', 'viewPreRender');
            }
        }
    }

    private extractRoots() {
        let roots = {};
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'root') roots[view] = this.viewMap[view];
        }
        return roots;
    }

    private applyRoots(roots) {
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'view') this.viewMap[view].__preRender(roots);
        }
    }

    private setWatchers() {
        let watchObjArr = [];

        if(this.squeak['squeakFile']){
            let watchObj: FileWatchStoreObj = {
                filePath: this.squeak.squeakFile,
                watchContext: 'SQUEAK_MAIN',
                watchStrategy: this.fileWatchStrategy.watchStrategy,
                trigger: 'SQUEAK_MAIN'
            };
            watchObjArr.push(watchObj);
        }

        for(let view in this.interfaceMap){
            if(this.interfaceMap[view]['squeakFile']){
                let watchObj: FileWatchStoreObj = {
                    filePath: this.interfaceMap[view].squeakFile,
                    watchContext: 'INTERFACE',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if(this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER') watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }

        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'root') {
                let watchObj: FileWatchStoreObj = {
                    filePath: this.squeak.viewDir + '/' + this.viewMap[view].file,
                    watchContext: 'VIEW_ROOT',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if(this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER') watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }

        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'view'){
                let watchObj: FileWatchStoreObj = {
                    filePath: this.viewMap[view].squeakPath,
                    watchContext: 'VIEW',
                    watchStrategy: this.fileWatchStrategy.watchStrategy,
                    trigger: view
                };
                if(this.fileWatchStrategy.watchStrategy == 'WATCH_ON_TIMER') watchObj['timerMillis'] = this.fileWatchStrategy.watchTimer;
                watchObjArr.push(watchObj);
            }
        }

        for(let i=0,len=watchObjArr.length;i<len;i++){
            this.squeakWatch.add(watchObjArr[i]);
        }
    }

    private setFileWatcher(url, filePath): void {
        let watchObj: FileWatchStoreObj = {
            filePath: filePath,
            watchContext: 'FILE',
            watchStrategy: this.fileWatchStrategy.watchStrategy,
            trigger: url
        };
        this.squeakWatch.add(watchObj);
    }

    setEventListeners(){
        for(let view in this.viewMap){
            if(this.viewMap[view].type == 'view'){
                this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
            }
        }
    }

    viewEventHandler(evt){
        if(evt.type == 'reRender') return this.reRenderView(evt.from);
    }

    private pathMaker(overwrite: boolean = false): void {
        for(let view in this.viewMap){
            if(this.viewMap[view].urlPath){
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

    private checkConsume(url) {
        for(let view in this.consumeMap){
            if(url.indexOf(view) == 0) return view;
        }
        return undefined;
    }

    private checkCacheStrategy() {
        this.squeakCache = new SqueakCache(this._debug);
        if(this.fileCacheStrategy.cacheStrategy === 'NONE') return;
        this.fileCache = true;
        if(this.fileCacheStrategy.cacheStrategy === 'CACHE_SPECIFIC_LIST') return this.squeakCache.putFiles(this.publicPath, this.fileCacheStrategy.cacheList);
        if(this.fileCacheStrategy.cacheStrategy === 'CACHE_CUSTOM_FUNCTION') return this.squeakCache.runCustomCache(this.fileCacheStrategy.cacheFunction);
    }

    private checkWatchStrategy() {
        this.squeakWatch = new SqueakWatch(this.publicPath, this.squeak.viewDir, this._debug);
        this.squeakWatch.on('watchEvt', (alertPkg)=>{
            this.changeAlert(alertPkg);
        });
        if(this.fileWatchStrategy.watchStrategy === 'NONE') return;
        // TODO: Add more
    }

    private changeAlert(alertPkg) {
        let manualDebug = false;
        if(this._debug || manualDebug) console.log('CHANGE ALERT PACKAGE:', alertPkg);
        if(alertPkg.watchContext == 'VIEW_ROOT') this.rebuildRoot(alertPkg.trigger);
        if(alertPkg.watchContext == 'VIEW') this.rebuildView(alertPkg.trigger);
        if(alertPkg.watchContext == 'FILE') this.rebuildFile(alertPkg.trigger);
        if(alertPkg.watchContext == 'INTERFACE') this.rebuildInterface(alertPkg.trigger);
        if(alertPkg.watchContext == 'SQUEAK_MAIN') this.rebuildFull();
    }

    private rebuildRoot(view){
        console.log('Rebuilding Root');
        if(!this.viewMap[view] || !(this.viewMap[view].type == 'root')){
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
        for(let view in this.viewMap){
            this.viewMap[view].viewRender = this.viewMap[view].viewPreRender;
        }

        // Make Paths
        this.pathMaker(true);
    }

    private rebuildFull(){
        console.log('Full rebuild is currently disabled.');
        let fullRebuild = false;

        if(fullRebuild){
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

            SqueakCache.__destroy();
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

    private rebuildInterface(trigger){
        console.log(`Rebuilding ${trigger}`);
        // The following will destroy and reinstantiate the interface
        if(this.interfaceMap[trigger]['squeakFile']){
            console.log('Destroying View Constructor');
            let fileLocation = this.interfaceMap[trigger].squeakFile;
            let config = JSON.parse(this.interfaceMap[trigger].__config);
            this.interfaceMap[trigger] = null;
            delete require.cache[fileLocation];
            let reqBuild = require(fileLocation);
            let buildFn = reqBuild[Object.keys(reqBuild)[0]];
            let rebuild = SqueakInterface(config)(buildFn);
            this.interfaceMap[trigger] = new rebuild();
            if(this.interfaceMap[trigger]['onInit']) this.interfaceMap[trigger].onInit();
        }
        // **********
        if(this.interfaceMap[trigger].consumeFrom)
            this.consumeMap[this.interfaceMap[trigger].urlPath] = this.interfaceStore[this.interfaceMap[trigger].urlPath];

    }

    private rebuildView(view){
        console.log(`Rebuilding: ${view}`);
        if(!this.viewMap[view]){
            console.error(`Error: Attempting to rebuild ${view} failed. Not present in View Map!`);
            return;
        }
        // The following will destroy and reinstantiate the view
        if(this.viewMap[view]['squeakFile']) this.reloadViewClass(view);
        // **********
        this.reRenderView(view);
    }

    private reRenderView(view){
        this.viewMap[view].__build();
        this.viewMap[view].__preRender(this.extractRoots());
        this.viewMap[view].viewRender = this.viewMap[view].viewPreRender;
        if(this.viewMap[view].urlPath){
            this.viewStore[this.viewMap[view].urlPath] = this.viewMap[view];
            this.squeakCache.put({
                urlPath: this.viewStore[this.viewMap[view].urlPath].urlPath,
                contentType: 'text/html',
                buffer: Buffer.from(this.viewStore[this.viewMap[view].urlPath].viewRender),
                encoding: 'utf-8'
            }, true);
        }
    }

    private reloadViewClass(view){
        console.log('Destroying View Constructor');
        if(this.eventListeners[view]){
            this.eventListeners[view].removeListener('viewEvt', this.viewEventHandler.bind(this));
            delete this.eventListeners[view];
        }
        let fileLocation = this.viewMap[view].squeakFile;
        let config = JSON.parse(this.viewMap[view].__config);
        this.viewMap[view] = null;
        delete require.cache[fileLocation];
        let reqBuild = require(fileLocation);
        let buildFn = reqBuild[Object.keys(reqBuild)[0]];
        let rebuild = SqueakView(config)(buildFn);
        this.viewMap[view] = new rebuild();
        this.eventListeners[view] = this.viewMap[view].__emitter.on('viewEvt', this.viewEventHandler.bind(this));
        if(this.viewMap[view]['onInit']) this.viewMap[view].onInit();
    }

    private rebuildFile(fileTar){
        console.log(`Rebuilding file: ${fileTar}`);
        let filePath = this.publicPath + fileTar;
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = MIMETYPES[extname] || 'application/octet-stream';
        this.squeakCache.putFile({
            urlPath: fileTar,
            contentType: contentType,
            buffer: undefined,
            encoding: 'utf-8'
        }, filePath, true);
    }
}

export interface Wildcard {
    path: string;
    wildPath: string;
}


