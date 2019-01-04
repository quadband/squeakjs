"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const events = require("events");
class SqueakWatch extends events.EventEmitter {
    constructor(basePath, squeakPath, _debug = false) {
        super();
        this.basePath = basePath;
        this.squeakPath = squeakPath;
        this._debug = _debug;
        this._watchStore = {};
        this._itemCount = 0;
    }
    add(watch) {
        if (!watch.filePath || !watch.watchContext) {
            console.error('Error: Invalid Squeak Watch Object');
            return false;
        }
        if (this._debug)
            console.log(`Setting up watcher for ${watch.filePath}`);
        if (!fs.existsSync(watch.filePath)) {
            console.error(`Error: File does not exist ${watch.filePath}`);
            return false;
        }
        // TODO: ADD TIMER LOGIC
        if (watch.watchStrategy == 'WATCH_IMMEDIATE') {
            this._watchStore[watch.trigger] = new SqueakWatcher(watch);
            this._watchStore[watch.trigger].on('watchEvt', () => {
                let alertPkg = {
                    trigger: this._watchStore[watch.trigger].trigger,
                    watchContext: this._watchStore[watch.trigger].watchContext
                };
                this._alert(alertPkg);
            });
            this._itemCount++;
            return true;
        }
    }
    clear(manualDebug = false) {
        if (this._debug || manualDebug)
            console.log('Clearing Watchers');
        let currentCount = this._itemCount;
        for (let key in this._watchStore) {
            this._watchStore[key].kill();
            delete this._watchStore[key];
        }
        if (this._debug || manualDebug)
            console.log(`Watchers removed successfully. Removed ${currentCount} items`);
    }
    _alert(alertPkg) {
        this.emit('watchEvt', alertPkg);
    }
    _checkFile(filePath) {
        console.log(filePath);
        return fs.existsSync(filePath);
    }
}
exports.SqueakWatch = SqueakWatch;
class SqueakWatcher extends events.EventEmitter {
    constructor(cfgPkg) {
        super();
        this.filePath = undefined;
        this.fileWatcher = undefined;
        this.watchTimer = undefined;
        this.timerMillis = undefined;
        this.watchContext = undefined;
        this.trigger = undefined;
        this.watchStrategy = undefined;
        this.watchDebounce = undefined;
        for (let key in cfgPkg) {
            this[key] = cfgPkg[key];
        }
        this.init();
    }
    init() {
        this.fileWatcher = fs.watch(this.filePath, (evt, filename) => {
            clearTimeout(this.watchDebounce);
            this.watchDebounce = setTimeout(() => {
                //console.log('Watcher Fired for:', this.trigger);
                //console.log(evt);
                //console.log(filename);
                this.emit('watchEvt');
            }, 100);
        });
    }
    kill() {
        this.fileWatcher.close();
    }
}
exports.SqueakWatcher = SqueakWatcher;
