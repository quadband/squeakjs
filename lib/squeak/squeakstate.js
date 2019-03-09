"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
class SqueakSimpleState {
    constructor(fileLocation) {
        this._state = {};
        this._persistQueue = [];
        this._queueTimer = undefined;
        this._timerVal = 10000;
        this._debug = false;
        if (SqueakSimpleState._instance) {
            throw new Error('Error: Squeak Simple State is already instantiated. Please use SqueakSimpleState.getInstance() instead.');
        }
        else {
            console.log('Creating Squeak Simple State');
            this._init(fileLocation);
            SqueakSimpleState._instance = this;
        }
    }
    static getInstance() {
        if (SqueakSimpleState._instance)
            return SqueakSimpleState._instance;
        console.error('Error: No instance of SqueakSimpleState exists. It must be instantiated first!');
        return undefined;
    }
    set(moduleName, keyName, data, persist = false) {
        if (!this._state[moduleName])
            this._state[moduleName] = { name: moduleName, _data: {}, persist: false };
        if (!this._state[moduleName]._data[keyName])
            this._state[moduleName]._data[keyName] = { persist: false, _value: undefined };
        this._state[moduleName]._data[keyName].persist = persist;
        this._state[moduleName]._data[keyName]._value = data;
        if (persist || this._state[moduleName].persist)
            this._queuePersist(moduleName);
    }
    get(moduleName, keyName = undefined) {
        if (!this._checkModule)
            return undefined;
        if (keyName == undefined)
            return this._getModule(moduleName);
        if (!this._checkValue(moduleName, keyName))
            return undefined;
        return this._getValue(moduleName, keyName);
    }
    check(moduleName, keyName = undefined) {
        if (!this._state[moduleName])
            return false;
        if (keyName == undefined)
            return true;
        return !!this._state[moduleName]._data[keyName];
    }
    setPersist(moduleName, keyName = undefined) {
        if (!this._checkModule(moduleName))
            return;
        if (keyName == undefined) {
            this._state[moduleName].persist = true;
        }
        else {
            if (!this._checkValue(moduleName, keyName))
                return;
            this._state[moduleName]._data[keyName]['persist'] = true;
        }
        this._queuePersist(moduleName);
    }
    unsetPersist(moduleName, keyName = undefined) {
        if (!this._checkModule(moduleName))
            return;
        if (keyName == undefined) {
            this._state[moduleName].persist = false;
        }
        else {
            if (!this._checkValue(moduleName, keyName))
                return;
            this._state[moduleName]._data[keyName]['persist'] = false;
        }
        this._queuePersist(moduleName);
    }
    setDebug() {
        this._debug = true;
    }
    _checkModule(moduleName) {
        if (!this._state[moduleName]) {
            console.error(`Error: No module matching ${moduleName} exists in Simple State`);
            return false;
        }
        return true;
    }
    _checkValue(moduleName, keyName) {
        if (!this._state[moduleName]._data[keyName]) {
            console.error(`Error: No data source mathing ${keyName} in ${moduleName} exists in Simple State`);
            return false;
        }
        return true;
    }
    _getValue(moduleName, keyName) {
        return this._state[moduleName]._data[keyName]._value;
    }
    _getModule(moduleName) {
        let retModule = {};
        for (let key in this._state[moduleName]._data) {
            retModule[key] = this._state[moduleName]._data[key]._value;
        }
        return retModule;
    }
    _queuePersist(moduleName) {
        this._setQueueTimer();
        if (this._persistQueue.indexOf(moduleName) == -1)
            this._persistQueue.push(moduleName);
    }
    _setQueueTimer() {
        clearTimeout(this._queueTimer);
        this._queueTimer = setTimeout(() => {
            this._writeQueue();
        }, this._timerVal);
    }
    _writeQueue() {
        let queue = this._persistQueue.slice(0);
        this._persistQueue = [];
        let stateCopy = JSON.parse(JSON.stringify(this._state));
        this._readFile((readData) => {
            if (readData == undefined)
                return;
            let lastWrite = Date.now();
            readData['__squeakState']._data['__lastWrite'] = lastWrite;
            // Write New Data
            queue.forEach((moduleName) => {
                if (!readData[moduleName])
                    readData[moduleName] = {
                        name: stateCopy[moduleName].name,
                        persist: stateCopy[moduleName].persist,
                        _data: {}
                    };
                if (stateCopy[moduleName].persist) {
                    readData[moduleName] = stateCopy[moduleName];
                    for (let key in readData[moduleName]._data) {
                        readData[moduleName]._data[key]._lastWrite = lastWrite;
                    }
                }
                else {
                    for (let key in stateCopy[moduleName]._data) {
                        if (stateCopy[moduleName]._data[key].persist) {
                            readData[moduleName]._data[key] = stateCopy[moduleName]._data[key];
                            readData[moduleName]._data[key]._lastWrite = lastWrite;
                        }
                    }
                }
            });
            // Sanitize
            for (let moduleName in readData) {
                let persistCheck = false;
                if (!readData[moduleName].persist) {
                    for (let key in readData[moduleName]._data) {
                        if (!readData[moduleName]._data[key].persist) {
                            delete readData[moduleName]._data[key];
                        }
                        else {
                            persistCheck = true;
                        }
                    }
                }
                else {
                    persistCheck = true;
                }
                if (!persistCheck)
                    delete readData[moduleName];
            }
            let writeData = JSON.stringify(readData);
            this._writeFile(writeData, (e) => {
                if (e == undefined && this._debug)
                    console.log('Squeak State written successfully.');
            });
        });
    }
    _init(fileLocation = undefined) {
        if (fileLocation == undefined)
            fileLocation = path.dirname(require.main.filename) + '/_squeakpersist.json';
        if (!this._checkFile(fileLocation))
            this._createFile(fileLocation);
        this._persistFile = fileLocation;
        this._state = this._firstRead();
        if (this._debug)
            console.log('Current State:', this._state);
    }
    _checkFile(fileLocation) {
        return fs.existsSync(fileLocation);
    }
    _createFile(fileLocation) {
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
    _firstRead() {
        let tempData = fs.readFileSync(this._persistFile, 'utf8');
        try {
            return JSON.parse(tempData);
        }
        catch (e) {
            console.error(`Error: Invalid data in ${this._persistFile}`);
            return undefined;
        }
    }
    _writeFile(data, cb) {
        fs.writeFile(this._persistFile, data, 'utf8', (err) => {
            if (err) {
                console.error(`Error: Squeak State file write failed for ${this._persistFile} with the following error: ${err}`);
                cb(err);
            }
            else {
                cb(undefined);
            }
        });
    }
    _readFile(cb) {
        fs.readFile(this._persistFile, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error: Squeak State file read failed for ${this._persistFile} with the following error: ${err}`);
                cb(undefined);
            }
            else {
                try {
                    let decoded = JSON.parse(data);
                    cb(decoded);
                }
                catch (e) {
                    console.error(`Error: Invalid data in ${this._persistFile}`);
                    cb(undefined);
                }
            }
        });
    }
}
exports.SqueakSimpleState = SqueakSimpleState;
