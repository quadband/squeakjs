import * as fs from 'fs';
import * as path from 'path';

export class SqueakSimpleState {
    private static _instance: SqueakSimpleState;
    public static getInstance(): SqueakSimpleState {
        if(SqueakSimpleState._instance) return SqueakSimpleState._instance;
        console.error('Error: No instance of SqueakSimpleState exists. It must be instantiated first!');
        return undefined;
    }

    constructor(fileLocation?: string){
        if(SqueakSimpleState._instance){
            throw new Error('Error: Squeak Simple State is already instantiated. Please use SqueakSimpleState.getInstance() instead.');
        } else {
            console.log('Creating Squeak Simple State');
            this._init(fileLocation);
            SqueakSimpleState._instance = this;
        }
    }

    private _state: SimpleStateMap = {};
    private _persistQueue = [];
    private _queueTimer: any = undefined;
    private _timerVal: number = 10000;
    private _persistFile: string;
    private _debug: boolean = false;

    public set(moduleName: string, keyName: string, data: any, persist: boolean = false){
        if(!this._state[moduleName]) this._state[moduleName] = {name: moduleName, _data: {}, persist: false};
        if(!this._state[moduleName]._data[keyName]) this._state[moduleName]._data[keyName] = {persist: false, _value: undefined};
        this._state[moduleName]._data[keyName].persist = persist;
        this._state[moduleName]._data[keyName]._value = data;
        if(persist || this._state[moduleName].persist) this._queuePersist(moduleName);
    }

    public get(moduleName: string, keyName: string = undefined){
        if(!this._checkModule) return undefined;
        if(keyName == undefined) return this._getModule(moduleName);
        if(!this._checkValue(moduleName, keyName)) return undefined;
        return this._getValue(moduleName, keyName);
    }

    public check(moduleName: string, keyName: string = undefined): boolean {
        if(!this._state[moduleName]) return false;
        if(keyName == undefined) return true;
        return !!this._state[moduleName]._data[keyName];
    }

    public setPersist(moduleName: string, keyName: string = undefined){
        if(!this._checkModule(moduleName)) return;
        if(keyName == undefined){
            this._state[moduleName].persist = true;
        } else {
            if(!this._checkValue(moduleName, keyName)) return;
            this._state[moduleName]._data[keyName]['persist'] = true;
        }
        this._queuePersist(moduleName);
    }

    public unsetPersist(moduleName: string, keyName: string = undefined){
        if(!this._checkModule(moduleName)) return;
        if(keyName == undefined){
            this._state[moduleName].persist = false;
        } else {
            if(!this._checkValue(moduleName, keyName)) return;
            this._state[moduleName]._data[keyName]['persist'] = false;
        }
        this._queuePersist(moduleName);
    }

    public setDebug(){
        this._debug = true;
    }

    private _checkModule(moduleName): boolean {
        if(!this._state[moduleName]){
            console.error(`Error: No module matching ${moduleName} exists in Simple State`);
            return false;
        }
        return true;
    }

    private _checkValue(moduleName: string, keyName: string): boolean {
        if(!this._state[moduleName]._data[keyName]){
            console.error(`Error: No data source mathing ${keyName} in ${moduleName} exists in Simple State`);
            return false;
        }
        return true;
    }

    private _getValue(moduleName: string, keyName: string){
        return this._state[moduleName]._data[keyName]._value;
    }

    private _getModule(moduleName: string){
        let retModule = {};
        for(let key in this._state[moduleName]._data){
            retModule[key] = this._state[moduleName]._data[key]._value;
        }
        return retModule;
    }

    private _queuePersist(moduleName: string){
        this._setQueueTimer();
        if(this._persistQueue.indexOf(moduleName) == -1) this._persistQueue.push(moduleName);
    }

    private _setQueueTimer(){
        clearTimeout(this._queueTimer);
        this._queueTimer = setTimeout(()=>{
            this._writeQueue();
        }, this._timerVal);
    }

    private _writeQueue(){
        let queue = this._persistQueue.slice(0);
        this._persistQueue = [];
        let stateCopy = JSON.parse(JSON.stringify(this._state));
        this._readFile((readData)=>{
            if(readData == undefined) return;

            let lastWrite = Date.now();
            readData['__squeakState']._data['__lastWrite'] = lastWrite;
            // Write New Data
            queue.forEach((moduleName: string)=>{
                if(!readData[moduleName]) readData[moduleName] = {
                    name: stateCopy[moduleName].name,
                    persist: stateCopy[moduleName].persist,
                    _data: {}
                };
                if(stateCopy[moduleName].persist){
                    readData[moduleName] = stateCopy[moduleName];
                    for(let key in readData[moduleName]._data){
                        readData[moduleName]._data[key]._lastWrite = lastWrite;
                    }
                } else {
                    for(let key in stateCopy[moduleName]._data){
                        if(stateCopy[moduleName]._data[key].persist){
                            readData[moduleName]._data[key] = stateCopy[moduleName]._data[key];
                            readData[moduleName]._data[key]._lastWrite = lastWrite;
                        }
                    }
                }
            });

            // Sanitize
            for(let moduleName in readData){
                let persistCheck: boolean = false;
                if(!readData[moduleName].persist){
                    for(let key in readData[moduleName]._data){
                        if(!readData[moduleName]._data[key].persist){
                            delete readData[moduleName]._data[key];
                        } else {
                            persistCheck = true;
                        }
                    }
                } else {
                    persistCheck = true;
                }
                if(!persistCheck) delete readData[moduleName];
            }
            let writeData = JSON.stringify(readData);
            this._writeFile(writeData, (e)=>{
                if(e == undefined && this._debug) console.log('Squeak State written successfully.');
            });

        });
    }

    private _init(fileLocation: string = undefined){
        if(fileLocation == undefined) fileLocation = path.dirname(require.main.filename) + '/_squeakpersist.json';
        if(!this._checkFile(fileLocation)) this._createFile(fileLocation);
        this._persistFile = fileLocation;
        this._state = this._firstRead();
        if(this._debug) console.log('Current State:', this._state);
    }

    private _checkFile(fileLocation): boolean {
        return fs.existsSync(fileLocation);
    }

    private _createFile(fileLocation){
        console.log(`Creating ${fileLocation}`);
        let firstCreate = {
            "__squeakState": {
                persist: true,
                name: "__squeakState",
                _data: {
                    __created: Date.now(),
                    __lastWrite: Date.now()
                }
            }
        };
        fs.writeFileSync(fileLocation, JSON.stringify(firstCreate), 'utf8');
    }

    private _firstRead(){
        let tempData = fs.readFileSync(this._persistFile, 'utf8');
        try {
            return JSON.parse(tempData);
        } catch(e) {
            console.error(`Error: Invalid data in ${this._persistFile}`);
            return undefined;
        }
    }

    private _writeFile(data, cb?){
        fs.writeFile(this._persistFile, data, 'utf8', (err)=>{
            if(err) {
                console.error(`Error: Squeak State file write failed for ${this._persistFile} with the following error: ${err}`);
                cb(err);
            } else {
                cb(undefined);
            }
        })
    }

    private _readFile(cb){
        fs.readFile(this._persistFile, 'utf8', (err, data)=>{
            if(err) {
                console.error(`Error: Squeak State file read failed for ${this._persistFile} with the following error: ${err}`);
                cb(undefined);
            } else {
                try {
                    let decoded = JSON.parse(data);
                    cb(decoded);
                } catch (e){
                    console.error(`Error: Invalid data in ${this._persistFile}`);
                    cb(undefined);
                }
            }
        })
    }

}

export interface SimpleStateMap {
    [key: string]: SimpleStateObj;
}

export interface SimpleStateObj {
    persist?: boolean;
    _lastWrite?: number;
    name: string;
    _data: SimpleStateDataObj;
}

export interface SimpleStateDataObj {
    [key: string]: SimpleStateDataObjItem;
}

export interface SimpleStateDataObjItem {
    persist?: boolean;
    _lastWrite?: number;
    _value: any;
}