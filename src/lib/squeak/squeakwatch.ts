import { FileWatchStoreObj } from "./squeakcommon";

import * as fs from 'fs';
import * as events from 'events';

export class SqueakWatch extends events.EventEmitter {

    constructor(private basePath: string, private squeakPath: string, private _debug: boolean = false){
        super();
    }

    private _watchStore = {};
    private _itemCount: number = 0;



    public add(watch: FileWatchStoreObj){
        if(!watch.filePath || !watch.watchContext){
            console.error('Error: Invalid Squeak Watch Object');
            return false;
        }
        if(this._debug) console.log(`Setting up watcher for ${watch.filePath}`);
        if(!fs.existsSync(watch.filePath)) {
            console.error(`Error: File does not exist ${watch.filePath}`);
            return false;
        }
        // TODO: ADD TIMER LOGIC

        if(watch.watchStrategy == 'WATCH_IMMEDIATE'){
            this._watchStore[watch.trigger] = new SqueakWatcher(watch);
            this._watchStore[watch.trigger].on('watchEvt', ()=>{
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

    public clear(manualDebug: boolean = false){
        if(this._debug || manualDebug) console.log('Clearing Watchers');
        let currentCount = this._itemCount;
        for(let key in this._watchStore){
            this._watchStore[key].kill();
            delete this._watchStore[key];
        }
        if(this._debug || manualDebug) console.log(`Watchers removed successfully. Removed ${currentCount} items`);
    }

    private _alert(alertPkg){
        this.emit('watchEvt', alertPkg);
    }



    private _checkFile(filePath): boolean {
        console.log(filePath);
        return fs.existsSync(filePath);
    }
}

export class SqueakWatcher extends events.EventEmitter {
    filePath: string = undefined;
    fileWatcher: any = undefined;
    watchTimer: any = undefined;
    timerMillis: number = undefined;
    watchContext: string = undefined;
    trigger: string = undefined;
    watchStrategy: string = undefined;

    watchDebounce: any = undefined;

    constructor(cfgPkg: FileWatchStoreObj){
        super();
        for(let key in cfgPkg){
            this[key] = cfgPkg[key];
        }
        this.init();
    }

    init(){
        this.fileWatcher = fs.watch(this.filePath, (evt, filename)=>{

            clearTimeout(this.watchDebounce);
            this.watchDebounce = setTimeout(()=>{
                //console.log('Watcher Fired for:', this.trigger);
                //console.log(evt);
                //console.log(filename);
                this.emit('watchEvt');
            },100);
        });
    }

    kill(){
        this.fileWatcher.close();
    }

}