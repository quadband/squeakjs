"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const squeakutils_1 = require("./squeakutils");
class SqueakCache {
    constructor(_debug = false) {
        this._debug = _debug;
        this._cache = {};
        this._itemCount = 0;
        if (SqueakCache._instance) {
            throw new Error('Error: Squeak Cache is already instantiated. Please use SqueakCache.getInstance() instead');
        }
        else {
            console.log('Creating Squeak Cache');
            SqueakCache._instance = this;
        }
    }
    static getInstance() {
        return SqueakCache._instance;
    }
    static __destroy() {
        delete SqueakCache._instance;
    }
    put(obj, overwrite = false) {
        if (!obj.urlPath || !obj.contentType || !obj.buffer) {
            console.error('Error: Invalid Squeak Cache Object');
            return false;
        }
        if (this._debug)
            console.log(`Caching ${obj.urlPath}`);
        if (obj.encoding == undefined || !obj.encoding)
            obj['encoding'] = 'utf-8';
        if (this._cache[obj.urlPath] && overwrite === false) {
            console.error(`Error: ${obj.urlPath} already exists in cache and overwrite is set to FALSE - Not Caching`);
            return false;
        }
        this._cache[obj.urlPath] = obj;
        this._itemCount++;
        if (this._debug)
            console.log(`Cache successful. Items in cache: ${this._itemCount}`);
        return true;
    }
    get(key) {
        if (key === undefined) {
            console.error(`Error: No key specified`);
            return null;
        }
        if (this._debug)
            console.log(`Getting ${key} from cache`);
        if (!this._cache[key]) {
            console.error(`Error: No item matching ${key} in Squeak Cache to GET`);
            return null;
        }
        return this._cache[key];
    }
    del(key) {
        if (key === undefined) {
            console.error(`Error: No key specified`);
            return;
        }
        if (this._debug)
            console.log(`Deleting ${key} from cache`);
        if (!this._cache[key]) {
            console.error(`Error: No item matching ${key} in Squeak Cache to DELETE`);
            return;
        }
        delete this._cache[key];
        this._itemCount--;
        if (this._debug)
            console.log(`Delete successful. Items in cache: ${this._itemCount}`);
    }
    keys() {
        return Object.keys(this._cache);
    }
    check(key) {
        return !!this._cache[key];
    }
    clear(manualDebug = false) {
        if (this._debug || manualDebug)
            console.log(`Clear cache`);
        let currentCount = this._itemCount;
        for (let key in this._cache) {
            this.del(key);
        }
        if (this._debug || manualDebug)
            console.log(`Cached cleared successfully. Removed ${currentCount} items`);
    }
    putFile(obj, filePath, overwrite = false) {
        if (this._debug)
            console.log(`Starting File Cache Operation`);
        obj.buffer = this._readFile(filePath);
        if (this.put(obj, overwrite)) {
            if (this._debug)
                console.log(`Successfully wrote ${filePath} to cache`);
        }
    }
    putFiles(basePath, fileList, overwrite = false) {
        if (this._debug)
            console.log(`Starting File Cache Operation`);
        let success = 0;
        for (let i = 0, len = fileList.length; i < len; i++) {
            let filePath = basePath + fileList[i];
            let newFile = this._readFile(filePath);
            if (newFile == null)
                continue;
            if (this.put({
                urlPath: fileList[i],
                contentType: squeakutils_1.resolveContentType(fileList[i]),
                buffer: newFile
            }, overwrite)) {
                success++;
            }
        }
        console.log(`${success} out of ${fileList.length} written`);
    }
    runCustomCache(fn) {
        if (this._debug)
            console.log('Running custom cache function');
        try {
            let cusRet = fn();
            if (Array.isArray(cusRet)) {
                for (let i = 0, len = cusRet.length; i < len; i++) {
                    this.put(cusRet[i]);
                }
            }
            else {
                throw 'Return type is not an array';
            }
        }
        catch (e) {
            console.error('Error: Something went wrong with Custom Cache Function - ' + e);
        }
    }
    _readFile(filePath) {
        try {
            return fs.readFileSync(filePath);
        }
        catch (e) {
            if (this._debug)
                console.error(`Error reading ${filePath}: ${e}`);
            return null;
        }
    }
}
exports.SqueakCache = SqueakCache;
