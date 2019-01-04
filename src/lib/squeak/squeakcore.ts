// External Libs
import * as fs from 'fs';
import * as events from 'events';
// **********

// Internal Imports
import { METHODMAP } from "./squeakconst";
import {makeDoc, desugarBranch, makeIterator, parseBranch, serialize, viewMux, sanitizeText} from "./squeakutils";
import { FileCacheStrategyType, FileWatchStrategyType } from "./squeakcommon";
// **********

// View
export interface SqueakViewConfig {
    squeakName: string;
    squeakPath: string;
    squeakFile?: string;
    urlPath: string;
    title?: string;
    views: Array<SqueakViewSelector>;
    styleUrls?: Array<string>;
    clientJs?: Array<string>;
}

export interface SqueakViewSelector {
    selector: string;
    file: string;
}

export function SqueakView(config: SqueakViewConfig){
    return function<T extends {new(...args:any[]):{}}>(constructor:T){
        return class extends constructor {
            public type: string = 'view';
            public squeakName: string = config.squeakName;
            public squeakPath: string = config.squeakPath;
            public squeakFile: string = config.squeakFile || undefined;
            public urlPath: string = config.urlPath;
            public views: Array<SqueakViewSelector> = config.views;
            public styleUrls: Array<string> = config.styleUrls != undefined ? config.styleUrls : undefined;
            public clientJs: Array<string> = config.clientJs != undefined ? config.clientJs : undefined;
            public squeakTitle: string = config.title != undefined ? config.title : undefined;
            public __config: string = JSON.stringify(config);
            public viewString: string = '.';
            public viewRender: string = '.';
            public viewPreRender: string = '.';
            public __emitter = new events.EventEmitter();
            public __emit(evtType, data: any = {}){
                this.__emitter.emit('viewEvt', {type: evtType, from: this.squeakName, data: data});
            }

            public __build(){
                console.log('BUILDING ', this.squeakName);
                this.viewString = readSqueakView(this.views, this.squeakPath);
                let _desugar = desugar.bind(this);
                this.viewPreRender = _desugar(this.viewString);
                let _parseTemplateVars = parseTemplateVars.bind(this);
                this.viewPreRender = _parseTemplateVars(this.viewPreRender);
            }
            public __preRender(roots){
                this.viewPreRender = checkLayouts(this.viewPreRender, roots);
                let _checkIterators = checkIterators.bind(this);
                this.viewPreRender = _checkIterators(this.viewPreRender);
                if(this.squeakTitle != undefined) this.viewPreRender = applyTitle(this.viewPreRender, this.squeakTitle);
                if(this.styleUrls != undefined) this.viewPreRender = applyClientStyles(this.viewPreRender, this.styleUrls);
                if(this.clientJs != undefined) this.viewPreRender = applyClientScripts(this.viewPreRender, this.clientJs);
            }
        }
    }
}

// API and Interface

export interface SqueakInterfaceConfig {
    squeakName: string;
    squeakPath: string;
    squeakFile?: string;
    urlPath: string;
}
export function SqueakInterface(config: SqueakInterfaceConfig) {
    return function<T extends {new(...args:any[]):{}}>(constructor:T){
        return class extends constructor {
            public type: string = 'interface';
            public squeakName: string = config.squeakName;
            public squeakPath: string = config.squeakPath;
            public squeakFile?: string = config.squeakFile || undefined;
            public urlPath: string = config.urlPath;
            public __config: string = JSON.stringify(config);

            public __request(req, res){
                console.log(req.method);
                if(this[METHODMAP[req.method]]) return this[METHODMAP[req.method]](req,res);
                return undefined;
            }
        }
    }
}

// Main
export interface SqueakMainConfigRoots {
    selector: string;
    file: string;
}

export interface SqueakMainConfig {
    viewDir: string;
    publicDir?: string;
    squeakFile: string;
    fileCache?: boolean;
    fileCacheStrategy?: FileCacheStrategyType;
    fileWatchStrategy?: FileWatchStrategyType;
    declarations: Array<any>;
    roots?: Array<SqueakMainConfigRoots>;
}

export interface SqueakMainBootstrap {
    roots: Array<any>;
    declarations: Array<any>;
}

export function SqueakMain(config: SqueakMainConfig){
    return function<T extends {new(...args:any[]):{}}>(constructor:T){
        return class extends constructor {
            public static viewDir: string = config.viewDir;
            public static publicDir: string = config.publicDir || undefined;
            public static squeakFile: string = config.squeakFile || undefined;
            public static fileCache: boolean = config.fileCache || false;
            public static fileCacheStrategy: any = config.fileCacheStrategy || { cacheStrategy: 'NONE' };
            public static fileWatchStrategy: any = config.fileWatchStrategy || { watchStrategy: 'NONE' };
            public static __config: string = JSON.stringify(config);
            public static bootstrap(): SqueakMainBootstrap{
                return({
                    roots: config.roots,
                    declarations: config.declarations
                });
            }
        }
    }
}

// Other Decorators
export function SqueakReRender(before: boolean = false){
    return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor){
        let originalMethod = descriptor.value;
        descriptor.value = function(){
            if(before) this.__emit('reRender');
            originalMethod.apply(this,arguments);
            if(!before) this.__emit('reRender');
        };
        return descriptor;
    }
}


// View Manipulation
export function readRootView(viewObj, viewDir: string): string {
    console.log('Reading Root View');
    return viewRead(viewDir + '/' + viewObj.file);
}

export function viewRead(path): string {
    try {
        let content = fs.readFileSync(path);
        return content.toString();
    } catch(e){
        throw e;
    }
}

export function readSqueakView(views, viewDir: string): string {
    let vm = {};

    // Read View
    for(let view in views){
        if(views.hasOwnProperty(view)){
            vm[views[view].selector] = views[view];
            vm[views[view].selector]['viewString'] = viewRead(viewDir + '/' + views[view].file);
        }
    }

    // Quick Sanitize anything sketchy
    // TODO: Make this smarter
    for(let key in vm){
        vm[key].viewString = sanitizeText(vm[key].viewString);
    }

    // TODO: Check for attributes

    // Mux View
    for(let key in vm){
        vm = viewMux(vm, key, vm[key], 'viewString', 'viewString');
    }

    return vm['index'].viewString;
}

export function parseTemplateVars(vs){
    let doc = makeDoc(vs);
    let _parseBranch = parseBranch.bind(this);
    for(let i=0,len=doc.childNodes.length;i<len;i++){
        if(doc.childNodes[i].hasChildNodes()) _parseBranch(doc.childNodes[i], _parseBranch, doc);
    }
    return serialize(doc);
}

export function desugar(vs): string {
    let doc = makeDoc(vs);
    let _desugarBranch = desugarBranch.bind(this);
    for(let i=0,len=doc.childNodes.length;i<len;i++){
        if(doc.childNodes[i].hasChildNodes()) _desugarBranch(doc.childNodes[i], _desugarBranch, doc);
    }
    return serialize(doc);
}

export function checkLayouts(vs, roots): string{
    let doc = makeDoc(vs);

    let sTemps = doc.getElementsByTagName('s-template');
    let hasLayout: boolean = false;
    let rendersAt: string;
    if(sTemps.length > 0){
        for(let i=0,len=sTemps.length;i<len;i++){
            if(sTemps[i].hasAttribute('s-rendersat')){
                hasLayout = true;
                rendersAt = sTemps[i].getAttribute('s-rendersat');
            }
        }
    }
    if(hasLayout && roots[rendersAt]){
        let layoutDoc = makeDoc(roots[rendersAt].viewPreRender);
        let outlet = layoutDoc.getElementsByTagName('s-render-outlet');
        if(outlet.length > 0){
            let repInside = doc.createDocumentFragment();
            for(let i=0, len=sTemps[0].childNodes.length;i<len;i++){
                repInside.appendChild(sTemps[0].childNodes[i].cloneNode(true));
            }
            layoutDoc.replaceChild(repInside, outlet[0]);
        } else {
            throw 'ERROR: NO RENDER TAG IN LAYOUT';
        }
        return serialize(layoutDoc);
    } else {
        return vs;
    }
}

export function checkIterators(vs): string {
    let doc = makeDoc(vs);
    let sTemps = doc.getElementsByTagName('s-template');
    if(sTemps.length > 0){
        for(let i=0, len=sTemps.length;i<len;i++){
            let sLet = sTemps[i].getAttribute('s-let');
            let sOf = sTemps[i].getAttribute('s-of');
            if(sLet != undefined && sOf != undefined && this[sOf]){
                let _makeIterator = makeIterator.bind(this);
                _makeIterator(sTemps[i], doc, _makeIterator, sLet, sOf);
            }
        }
    } else {
        return vs;
    }
    return serialize(doc);
}

// Style Files
export function applyClientStyles(vs: string, sArr: Array<string>): string {
    let doc = makeDoc(vs);
    let head = doc.getElementsByTagName('head');
    try {
        for(let i=0,len=sArr.length;i<len;i++){
            let newEl = doc.createElement('link');
            newEl.setAttribute('rel', 'stylesheet');
            newEl.setAttribute('href', sArr[i]);
            head[0].appendChild(newEl);
        }
    } catch(e){}
    return serialize(doc);
}

// Title
export function applyTitle(vs: string, title: string): string {
    let doc = makeDoc(vs);
    let tEl = doc.getElementsByTagName('title');
    try {
        if(tEl[0] != undefined){
            tEl[0].textContent = title;
        } else {
            let head = doc.getElementsByTagName('head');
            let newTitle = doc.createElement('title');
            newTitle.textContent = title;
            head[0].appendChild(newTitle);
        }
    } catch(e){}

    return serialize(doc);
}

// JS Files
export function applyClientScripts(vs: string, sArr: Array<string>): string {
    let doc = makeDoc(vs);
    let head = doc.getElementsByTagName('head');
    try {
        for(let i=0,len=sArr.length;i<len;i++){
            let newEl = doc.createElement('script');
            newEl.setAttribute('src', sArr[i]);
            head[0].appendChild(newEl);
        }
    } catch(e){}
    return serialize(doc);
}