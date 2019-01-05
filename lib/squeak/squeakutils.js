"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// External Libs
const xmldom = require("../xmldom/dom-parser");
const DOMParser = xmldom.DOMParser;
const XMLSerializer = xmldom.XMLSerializer;
// **********
const squeakconst_1 = require("./squeakconst");
const path = require("path");
// Request URL Params
function getParams(cf, url, paramCfg) {
    let pString = url.replace(cf, '');
    let pArr = pString.split('/');
    return extractParams(pArr, paramCfg);
}
exports.getParams = getParams;
function extractParams(pArr, paramCfg, idx = 0, paramPkg = {}) {
    if (paramCfg[pArr[idx]]) {
        let pc = paramCfg[pArr[idx]];
        for (let i = 0, len = pc.length; i < len; i++) {
            paramPkg[pc[i]] = pArr[i + 1] || undefined;
        }
        paramPkg['request'] = pArr[idx];
        return paramPkg;
    }
    else {
        return paramPkg = undefined;
    }
}
exports.extractParams = extractParams;
// **********
/**
 * View Manipulation
 */
// Iterators
function makeIterator(node, doc, mfn, sLet, sOf) {
    let fragment = doc.createDocumentFragment();
    let len = this[sOf].length;
    let _traceDown = traceDown.bind(this);
    for (let i = 0; i < len; i++) {
        let copy = node.childNodes[0].cloneNode(true);
        _traceDown(copy, sLet, this[sOf][i], _traceDown);
        fragment.appendChild(copy);
    }
    doc.replaceChild(fragment, node);
}
exports.makeIterator = makeIterator;
function traceDown(node, sLet, val, tfn) {
    if (node.nodeName == '#text' && checkForTemplateTags(node.textContent)) {
        let tagPkg = getTagPkg(node.textContent);
        let ctxPkg = {};
        ctxPkg[sLet] = val;
        for (let i = 0, len = tagPkg.length; i < len; i++) {
            tagPkg[i] = getContextTagValue(tagPkg[i], ctxPkg);
            if (tagPkg[i].val) {
                let orig = node.textContent;
                node.textContent = orig.replace('{{' + tagPkg[i].tVar + '}}', tagPkg[i].val);
            }
        }
    }
    if (node.hasChildNodes()) {
        for (let i = 0, len = node.childNodes.length; i < len; i++) {
            if (node.childNodes[i].hasChildNodes()) {
                tfn(node.childNodes[i], sLet, val, tfn);
            }
            else {
                tfn(node.childNodes[i], sLet, val, tfn);
            }
        }
    }
}
exports.traceDown = traceDown;
// Template Variables
function parseBranch(node, pfn, doc) {
    if (node.nodeName == '#text' && checkForTemplateTags(node.textContent)) {
        let tagPkg = getTagPkg(node.textContent);
        let _getTagValue = getTagValue.bind(this);
        for (let i = 0, len = tagPkg.length; i < len; i++) {
            tagPkg[i] = _getTagValue(tagPkg[i]);
            if (tagPkg[i].val) {
                let orig = node.textContent;
                node.textContent = orig.replace('{{' + tagPkg[i].tVar + '}}', tagPkg[i].val);
            }
            else {
                let look = traverseTree(tagPkg[i].firstObj, node);
            }
        }
    }
    if (node.hasChildNodes()) {
        for (let i = 0, len = node.childNodes.length; i < len; i++) {
            if (node.childNodes[i].hasChildNodes()) {
                pfn(node.childNodes[i], pfn, doc);
            }
            else {
                pfn(node.childNodes[i], pfn, doc);
            }
        }
    }
}
exports.parseBranch = parseBranch;
function traverseTree(lookFor, node) {
    if (node.parentNode) {
        try {
            if (node.parentNode.hasAttributes && node.parentNode.hasAttribute('s-let') && node.parentNode.getAttribute('s-let') == lookFor) {
                console.log('Found Match for:', lookFor);
                return true;
            }
            else {
                console.log('Looking');
                return traverseTree(lookFor, node.parentNode);
            }
        }
        catch (e) {
            return false;
        }
    }
    return false;
}
exports.traverseTree = traverseTree;
function checkForTemplateTags(tc) {
    let tempSplit = tc.split('{{').join('***').split('}}').join('***').split('***');
    return (tempSplit.length > 1);
}
exports.checkForTemplateTags = checkForTemplateTags;
function getTagPkg(tc, idx = 0, tagPkg = []) {
    let oTag = tc.indexOf('{{', idx);
    let cTag = tc.indexOf('}}', idx);
    idx = cTag + 1;
    if (oTag == -1 || cTag == -1)
        return tagPkg;
    tagPkg.push({
        oTag: oTag,
        cTag: cTag,
        tVar: tc.substring(oTag + 2, cTag)
    });
    return getTagPkg(tc, idx, tagPkg);
}
exports.getTagPkg = getTagPkg;
function getTagValue(tag) {
    let objSplit = tag.tVar.split('.');
    if (this[objSplit[0]])
        tag['val'] = objSplit.reduce((o, i) => o[i], this);
    tag['firstObj'] = objSplit[0];
    return tag;
}
exports.getTagValue = getTagValue;
function getContextTagValue(tag, ctx) {
    let objSplit = tag.tVar.split('.');
    if (ctx[objSplit[0]])
        tag['val'] = objSplit.reduce((o, i) => o[i], ctx);
    return tag;
}
exports.getContextTagValue = getContextTagValue;
function serialize(doc) {
    let s = new XMLSerializer();
    let ns = ' xmlns="http://www.w3.org/1999/xhtml"';
    let str = s.serializeToString(doc);
    return str.replace(ns, '');
}
exports.serialize = serialize;
function viewMux(vm, key, cur, muxFrom, muxTo) {
    let vs = cur[muxFrom];
    let doc = makeDoc(vs);
    for (let tag in vm) {
        let tagMatch = doc.getElementsByTagName(tag);
        if (tagMatch.length > 0) {
            let repDoc = makeDoc(vm[tag][muxFrom]);
            for (let i = 0, len = tagMatch.length; i < len; i++) {
                doc.replaceChild(repDoc, tagMatch[i]);
            }
        }
    }
    vm[key][muxTo] = serialize(doc);
    return vm;
}
exports.viewMux = viewMux;
function sanitizeText(vs) {
    return vs.split('*sFor').join('desugar="true" s-for');
}
exports.sanitizeText = sanitizeText;
function desugarBranch(el, dfn, doc) {
    try {
        if (el.hasAttributes && el.hasAttribute('desugar')) {
            let fragment = doc.createDocumentFragment();
            let newEl = doc.createElement('s-template');
            el.removeAttribute('desugar');
            cloneDistinctAttributes(newEl, el);
            newEl.appendChild(el.cloneNode(true));
            fragment.appendChild(newEl);
            doc.replaceChild(fragment, el);
            if (fragment.hasChildNodes()) {
                for (let i = 0, len = fragment.childNodes.length; i < len; i++) {
                    dfn(fragment.childNodes[i], dfn, doc);
                }
            }
        }
        else {
            if (el.hasChildNodes()) {
                for (let i = 0, len = el.childNodes.length; i < len; i++) {
                    dfn(el.childNodes[i], dfn, doc);
                }
            }
        }
    }
    catch (e) { }
}
exports.desugarBranch = desugarBranch;
function cloneDistinctAttributes(newNode, oldNode) {
    let atts = oldNode.attributes;
    for (let i = 0, len = atts.length; i < len; i++) {
        if (squeakconst_1.ATTMAP.indexOf(atts[i].name) != -1) {
            if (atts[i].name == 's-for') {
                let sForPkg = checkFor(atts[i].value);
                if (sForPkg != undefined) {
                    newNode.setAttribute('s-let', sForPkg.let);
                    newNode.setAttribute('s-of', sForPkg.of);
                }
            }
            else {
                newNode.setAttribute(atts[i].name, atts[i].value);
            }
            oldNode.removeAttribute(atts[i].name);
        }
    }
}
exports.cloneDistinctAttributes = cloneDistinctAttributes;
function checkFor(val) {
    let vSplit = val.split(' ');
    if (vSplit.length < 4 || vSplit[0] != 'let' || vSplit[2] != 'of')
        return undefined;
    return ({
        let: vSplit[1],
        of: vSplit[3]
    });
}
exports.checkFor = checkFor;
function shouldDesugar(el) {
    return el.hasAttribute('desugar');
}
exports.shouldDesugar = shouldDesugar;
function makeDoc(domString) {
    return new DOMParser().parseFromString(domString, 'text/html');
}
exports.makeDoc = makeDoc;
function resolveContentType(fileName) {
    const extname = String(path.extname(fileName)).toLowerCase();
    return squeakconst_1.MIMETYPES[extname] || 'application/octet-stream';
}
exports.resolveContentType = resolveContentType;
function trackingPixelHelper(pixelData = squeakconst_1.BLANK_PIXEL_PNG) {
    return Buffer.from(pixelData, 'base64');
}
exports.trackingPixelHelper = trackingPixelHelper;
