"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// External Libs
const fs = require("fs");
const events = require("events");
// **********
// Internal Imports
const squeakconst_1 = require("./squeakconst");
const squeakutils_1 = require("./squeakutils");
function SqueakView(config) {
    return function (constructor) {
        return class extends constructor {
            constructor() {
                super(...arguments);
                this.type = 'view';
                this.squeakName = config.squeakName;
                this.squeakPath = config.squeakPath;
                this.squeakFile = config.squeakFile || undefined;
                this.urlPath = config.urlPath;
                this.views = config.views;
                this.styleUrls = config.styleUrls != undefined ? config.styleUrls : undefined;
                this.clientJs = config.clientJs != undefined ? config.clientJs : undefined;
                this.squeakTitle = config.title != undefined ? config.title : undefined;
                this.__config = JSON.stringify(config);
                this.viewString = '.';
                this.viewRender = '.';
                this.viewPreRender = '.';
                this.__emitter = new events.EventEmitter();
            }
            __emit(evtType, data = {}) {
                this.__emitter.emit('viewEvt', { type: evtType, from: this.squeakName, data: data });
            }
            __build() {
                console.log('BUILDING ', this.squeakName);
                this.viewString = readSqueakView(this.views, this.squeakPath);
                let _desugar = desugar.bind(this);
                this.viewPreRender = _desugar(this.viewString);
                let _parseTemplateVars = parseTemplateVars.bind(this);
                this.viewPreRender = _parseTemplateVars(this.viewPreRender);
            }
            __preRender(roots) {
                this.viewPreRender = checkLayouts(this.viewPreRender, roots);
                let _checkIterators = checkIterators.bind(this);
                this.viewPreRender = _checkIterators(this.viewPreRender);
                if (this.squeakTitle != undefined)
                    this.viewPreRender = applyTitle(this.viewPreRender, this.squeakTitle);
                if (this.styleUrls != undefined)
                    this.viewPreRender = applyClientStyles(this.viewPreRender, this.styleUrls);
                if (this.clientJs != undefined)
                    this.viewPreRender = applyClientScripts(this.viewPreRender, this.clientJs);
            }
            __lastPassRender() {
                let _parseTemplateVars = parseTemplateVars.bind(this);
                this.viewRender = _parseTemplateVars(this.viewPreRender);
            }
        };
    };
}
exports.SqueakView = SqueakView;
function SqueakInterface(config) {
    return function (constructor) {
        return class extends constructor {
            constructor() {
                super(...arguments);
                this.type = 'interface';
                this.squeakName = config.squeakName;
                this.squeakPath = config.squeakPath;
                this.squeakFile = config.squeakFile || undefined;
                this.urlPath = config.urlPath;
                this.__config = JSON.stringify(config);
            }
            __request(req, res) {
                //console.log(req.method);
                if (this[squeakconst_1.METHODMAP[req.method]])
                    return this[squeakconst_1.METHODMAP[req.method]](req, res);
                return undefined;
            }
        };
    };
}
exports.SqueakInterface = SqueakInterface;
function SqueakMain(config) {
    return function (constructor) {
        var _a;
        return _a = class extends constructor {
                static bootstrap() {
                    return ({
                        roots: config.roots,
                        declarations: config.declarations
                    });
                }
            },
            _a.viewDir = config.viewDir,
            _a.publicDir = config.publicDir || undefined,
            _a.squeakFile = config.squeakFile || undefined,
            _a.fileCache = config.fileCache || false,
            _a.fileCacheStrategy = config.fileCacheStrategy || { cacheStrategy: 'NONE' },
            _a.fileWatchStrategy = config.fileWatchStrategy || { watchStrategy: 'NONE' },
            _a.__config = JSON.stringify(config),
            _a;
    };
}
exports.SqueakMain = SqueakMain;
// Other Decorators
function SqueakReRender(before = false) {
    return function (target, propertyKey, descriptor) {
        let originalMethod = descriptor.value;
        descriptor.value = function () {
            if (before)
                this.__emit('reRender');
            originalMethod.apply(this, arguments);
            if (!before)
                this.__emit('reRender');
        };
        return descriptor;
    };
}
exports.SqueakReRender = SqueakReRender;
// View Manipulation
function readRootView(viewObj, viewDir) {
    console.log('Reading Root View');
    return viewRead(viewDir + '/' + viewObj.file);
}
exports.readRootView = readRootView;
function viewRead(path) {
    try {
        let content = fs.readFileSync(path);
        return content.toString();
    }
    catch (e) {
        throw e;
    }
}
exports.viewRead = viewRead;
function readSqueakView(views, viewDir) {
    let vm = {};
    // Read View
    for (let view in views) {
        if (views.hasOwnProperty(view)) {
            vm[views[view].selector] = views[view];
            vm[views[view].selector]['viewString'] = viewRead(viewDir + '/' + views[view].file);
        }
    }
    // Quick Sanitize anything sketchy
    // TODO: Make this smarter
    for (let key in vm) {
        vm[key].viewString = squeakutils_1.sanitizeText(vm[key].viewString);
    }
    // TODO: Check for attributes
    // Mux View
    for (let key in vm) {
        vm = squeakutils_1.viewMux(vm, key, vm[key], 'viewString', 'viewString');
    }
    return vm['index'].viewString;
}
exports.readSqueakView = readSqueakView;
function parseTemplateVars(vs) {
    let doc = squeakutils_1.makeDoc(vs);
    let _parseBranch = squeakutils_1.parseBranch.bind(this);
    for (let i = 0, len = doc.childNodes.length; i < len; i++) {
        if (doc.childNodes[i].hasChildNodes())
            _parseBranch(doc.childNodes[i], _parseBranch, doc);
    }
    return squeakutils_1.serialize(doc);
}
exports.parseTemplateVars = parseTemplateVars;
function desugar(vs) {
    let doc = squeakutils_1.makeDoc(vs);
    let _desugarBranch = squeakutils_1.desugarBranch.bind(this);
    for (let i = 0, len = doc.childNodes.length; i < len; i++) {
        if (doc.childNodes[i].hasChildNodes())
            _desugarBranch(doc.childNodes[i], _desugarBranch, doc);
    }
    return squeakutils_1.serialize(doc);
}
exports.desugar = desugar;
function checkLayouts(vs, roots) {
    let doc = squeakutils_1.makeDoc(vs);
    let sTemps = doc.getElementsByTagName('s-template');
    let hasLayout = false;
    let rendersAt;
    if (sTemps.length > 0) {
        for (let i = 0, len = sTemps.length; i < len; i++) {
            if (sTemps[i].hasAttribute('s-rendersat')) {
                hasLayout = true;
                rendersAt = sTemps[i].getAttribute('s-rendersat');
            }
        }
    }
    if (hasLayout && roots[rendersAt]) {
        let layoutDoc = squeakutils_1.makeDoc(roots[rendersAt].viewPreRender);
        let outlet = layoutDoc.getElementsByTagName('s-render-outlet');
        if (outlet.length > 0) {
            let repInside = doc.createDocumentFragment();
            for (let i = 0, len = sTemps[0].childNodes.length; i < len; i++) {
                repInside.appendChild(sTemps[0].childNodes[i].cloneNode(true));
            }
            layoutDoc.replaceChild(repInside, outlet[0]);
        }
        else {
            throw 'ERROR: NO RENDER TAG IN LAYOUT';
        }
        return squeakutils_1.serialize(layoutDoc);
    }
    else {
        return vs;
    }
}
exports.checkLayouts = checkLayouts;
function checkIterators(vs) {
    let doc = squeakutils_1.makeDoc(vs);
    let sTemps = doc.getElementsByTagName('s-template');
    if (sTemps.length > 0) {
        for (let i = 0, len = sTemps.length; i < len; i++) {
            let sLet = sTemps[i].getAttribute('s-let');
            let sOf = sTemps[i].getAttribute('s-of');
            if (sLet != undefined && sOf != undefined && this[sOf]) {
                let _makeIterator = squeakutils_1.makeIterator.bind(this);
                _makeIterator(sTemps[i], doc, _makeIterator, sLet, sOf);
            }
        }
    }
    else {
        return vs;
    }
    return squeakutils_1.serialize(doc);
}
exports.checkIterators = checkIterators;
// Style Files
function applyClientStyles(vs, sArr) {
    let doc = squeakutils_1.makeDoc(vs);
    let head = doc.getElementsByTagName('head');
    try {
        for (let i = 0, len = sArr.length; i < len; i++) {
            let newEl = doc.createElement('link');
            newEl.setAttribute('rel', 'stylesheet');
            newEl.setAttribute('href', sArr[i]);
            head[0].appendChild(newEl);
        }
    }
    catch (e) { }
    return squeakutils_1.serialize(doc);
}
exports.applyClientStyles = applyClientStyles;
// Title
function applyTitle(vs, title) {
    let doc = squeakutils_1.makeDoc(vs);
    let tEl = doc.getElementsByTagName('title');
    try {
        if (tEl[0] != undefined) {
            tEl[0].textContent = title;
        }
        else {
            let head = doc.getElementsByTagName('head');
            let newTitle = doc.createElement('title');
            newTitle.textContent = title;
            head[0].appendChild(newTitle);
        }
    }
    catch (e) { }
    return squeakutils_1.serialize(doc);
}
exports.applyTitle = applyTitle;
// JS Files
function applyClientScripts(vs, sArr) {
    let doc = squeakutils_1.makeDoc(vs);
    let head = doc.getElementsByTagName('head');
    try {
        for (let i = 0, len = sArr.length; i < len; i++) {
            let newEl = doc.createElement('script');
            newEl.setAttribute('src', sArr[i]);
            head[0].appendChild(newEl);
        }
    }
    catch (e) { }
    return squeakutils_1.serialize(doc);
}
exports.applyClientScripts = applyClientScripts;
