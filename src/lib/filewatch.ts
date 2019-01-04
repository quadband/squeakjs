import * as fs from 'fs';

export class FileWatch {

    watchDirs = [];
    watchers = [];

    constructor(private cfg: FileWatchConfig, instance){
        if(cfg.watchDir) this.watchDirs.push(cfg.watchDir);
        if(cfg.watchDirs) this.watchDirs.push(...cfg.watchDirs);

        for(let watcher in this.watchDirs){
            this.watchers.push(new FileWatcher(this.watchDirs[watcher], instance));
        }
    }
}

export class FileWatcher {
    constructor(private dir: string, instance){
        console.log('Watching:', this.dir);
        fs.watch(dir, (eventType, filename)=>{
            console.log('Event Type:', eventType);


            console.log('File Changed:', this.dir + '/' + filename);
        })
    }
}

export interface FileWatchConfig {
    watchDir?: string;
    watchDirs?: Array<string>;
}