// Interface and API
export interface OnGet {
    onGet(req, res): any;
}

export interface OnPost {
    onPost(req, res): any;
}

export interface OnPut {
    onPut(req, res): any;
}

export interface OnDelete {
    onDelete(req, res): any;
}

export interface OnAny {
    onAny(req, res): any;
}

export interface ConsumeFrom {
    consumeFrom: string;
}

// Helper Implementations
export interface OnInit {
    onInit(...args: any[]): any;
}

export interface OnRequest {
    onRequest(...args: any[]): any;
}

export interface AfterRequest {
    afterRequest(...args: any[]): any;
}

export interface HasWildcard {
    hasWildcard: boolean;
}

// Experimental
export interface AfterLoad {
    afterLoad(...args: any[]): any;
}

export interface OnLoad {
    onLoad(...args: any[]): any;
}

export interface AfterViewRender {
    afterViewRender(...args: any[]): any;
}
// **********

// File Cache Strategy
export namespace FileCacheStrategy {
    export function onFirstLoad(): FileCacheStrategyType {
        return({
            cacheStrategy: 'CACHE_ON_FIRST_LOAD'
        });
    }

    export function specificList(fileArr: FileCacheList): FileCacheStrategyType {
        return({
            cacheStrategy: 'CACHE_SPECIFIC_LIST',
            cacheList: fileArr
        });
    }

    export function specificFolders(folderArr: FileCacheList): FileCacheStrategyType {
        return({
            cacheStrategy: 'CACHE_SPECIFIC_FOLDERS',
            cacheList: folderArr
        })
    }

    export function customStrategy(fn: FileCacheStrategyFunction): FileCacheStrategyType {
        return({
            cacheStrategy: 'CACHE_CUSTOM_FUNCTION',
            cacheFunction: fn
        })
    }
}

export type FileCacheFile = string;
export type FileCacheList = FileCacheFile[];
export interface FileCacheStrategyFunction {
    (...args: any[]): FileCacheStoreObj;
}
export interface FileCacheStoreObj {
    urlPath: string;
    contentType: string;
    buffer: Buffer;
    encoding?: string;
}
export interface FileCacheStore {
    [key: string]: FileCacheStoreObj;
}
export interface FileCacheStrategyObject {
    cacheStrategy: string;
    cacheFunction?: FileCacheStrategyFunction;
    cacheList?: FileCacheList;
}
export type FileCacheStrategyType = FileCacheStrategyObject;

// File Watchers
export namespace FileWatchStrategy {
    export function onTimer(millis: number): FileWatchStrategyType {
        return({
            watchStrategy: 'WATCH_ON_TIMER',
            watchTimer: millis
        });
    }

    export function immediate(): FileWatchStrategyType {
        return({
            watchStrategy: 'WATCH_IMMEDIATE'
        });
    }
}

export type FileWatchFile = string;
export type FileWatchList = FileWatchFile[];
export interface FileWatchStrategyFunction {
    (...args: any[]): FileWatchStoreObj;
}
export interface FileWatchStore {
    [key: string]: FileWatchStoreObj
}

export interface FileWatchStoreObj {
    filePath: string;
    fileWatcher?: any;
    watchTimer?: ()=> any;
    timerMillis?: number;
    watchContext: string;
    trigger?: string;
    dependencyTriggers?: string[],
    watchStrategy: string;
}

export enum WatchContext {
    FILE = "FILE",
    VIEW = "VIEW",
    VIEW_DEPENDENCY = "VIEW_DEPENDENCY",
    VIEW_ROOT = "VIEW_ROOT",
    INTERFACE = "INTERFACE",
    MAIN = "MAIN"
}

export interface FileWatchStrategyObject {
    watchStrategy: string;
    watchFunction?: any;
    watchList?: FileWatchList;
    watchTimer?: number;
}
export type FileWatchStrategyType = FileWatchStrategyObject;