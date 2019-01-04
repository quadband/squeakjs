"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// **********
// File Cache Strategy
var FileCacheStrategy;
(function (FileCacheStrategy) {
    function onFirstLoad() {
        return ({
            cacheStrategy: 'CACHE_ON_FIRST_LOAD'
        });
    }
    FileCacheStrategy.onFirstLoad = onFirstLoad;
    function specificList(fileArr) {
        return ({
            cacheStrategy: 'CACHE_SPECIFIC_LIST',
            cacheList: fileArr
        });
    }
    FileCacheStrategy.specificList = specificList;
    function specificFolders(folderArr) {
        return ({
            cacheStrategy: 'CACHE_SPECIFIC_FOLDERS',
            cacheList: folderArr
        });
    }
    FileCacheStrategy.specificFolders = specificFolders;
    function customStrategy(fn) {
        return ({
            cacheStrategy: 'CACHE_CUSTOM_FUNCTION',
            cacheFunction: fn
        });
    }
    FileCacheStrategy.customStrategy = customStrategy;
})(FileCacheStrategy = exports.FileCacheStrategy || (exports.FileCacheStrategy = {}));
// File Watchers
var FileWatchStrategy;
(function (FileWatchStrategy) {
    function onTimer(millis) {
        return ({
            watchStrategy: 'WATCH_ON_TIMER',
            watchTimer: millis
        });
    }
    FileWatchStrategy.onTimer = onTimer;
    function immediate() {
        return ({
            watchStrategy: 'WATCH_IMMEDIATE'
        });
    }
    FileWatchStrategy.immediate = immediate;
})(FileWatchStrategy = exports.FileWatchStrategy || (exports.FileWatchStrategy = {}));
var WatchContext;
(function (WatchContext) {
    WatchContext["FILE"] = "FILE";
    WatchContext["VIEW"] = "VIEW";
    WatchContext["VIEW_DEPENDENCY"] = "VIEW_DEPENDENCY";
    WatchContext["VIEW_ROOT"] = "VIEW_ROOT";
    WatchContext["INTERFACE"] = "INTERFACE";
    WatchContext["MAIN"] = "MAIN";
})(WatchContext = exports.WatchContext || (exports.WatchContext = {}));
