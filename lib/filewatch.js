"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class FileWatch {
    constructor(cfg, instance) {
        this.cfg = cfg;
        this.watchDirs = [];
        this.watchers = [];
        if (cfg.watchDir)
            this.watchDirs.push(cfg.watchDir);
        if (cfg.watchDirs)
            this.watchDirs.push(...cfg.watchDirs);
        for (let watcher in this.watchDirs) {
            this.watchers.push(new FileWatcher(this.watchDirs[watcher], instance));
        }
    }
}
exports.FileWatch = FileWatch;
class FileWatcher {
    constructor(dir, instance) {
        this.dir = dir;
        console.log('Watching:', this.dir);
        fs.watch(dir, (eventType, filename) => {
            console.log('Event Type:', eventType);
            console.log('File Changed:', this.dir + '/' + filename);
        });
    }
}
exports.FileWatcher = FileWatcher;
