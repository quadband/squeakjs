"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const bpFolder = 'TEST_FOLDER';
const cwd = process.cwd();
function init() {
    let args = parseArgs();
    console.log('Args:', args);
    console.log('CWD:', cwd);
    try {
        //console.log(foldCmd(args));
        madness = foldCmd(args);
        console.log(dummy);
        //console.log(JSON.stringify(dummy));
    }
    catch (e) {
        console.error(e);
    }
}
function parseArgs() {
    let foundArg = false;
    return process.argv.filter((val) => {
        if (foundArg)
            return true;
        if (val.substr(val.length - 13) == 'squeak-cli.js' || val.substr(val.length - 10) == 'squeak-cli') {
            foundArg = true;
        }
        return false;
    });
}
let madness;
function foldCmd(cmd) {
    return cmd.reduce((o, i) => o[i], proxyMaker(dummy));
}
let dummy = {};
function proxyMaker(objRef) {
    return new Proxy(objRef, {
        get(target, name) {
            if (typeof name === "string") {
                if (!target[name] && !dummy[name]) {
                    target[name] = proxyMaker({});
                    if (!dummy[name]) {
                        dummy[name] = target[name];
                        return dummy[name];
                    }
                }
                if (target[name] && !dummy[name]) {
                    dummy[name] = target[name];
                }
                return dummy[name];
            }
            return 'this';
        }
    });
}
function proxyMakerCirc(objRef) {
    return new Proxy(objRef, {
        get(target, name) {
            if (typeof name === "string") {
                if (!target[name] && !dummy[name]) {
                    target[name] = proxyMaker({});
                    if (!dummy[name]) {
                        dummy[name] = target[name];
                        return dummy[name];
                    }
                }
                if (target[name] && !dummy[name]) {
                    dummy[name] = target[name];
                }
                return dummy[name];
            }
            //return target.toJSON;
        }
    });
}
const proxy = new Proxy(dummy, {
    get(target, name) {
        if (typeof name === "string") {
            if (!target[name]) {
                target[name] = proxyMaker({});
                return proxy;
            }
            if (target[name]) {
                return proxyMaker(target[name]);
            }
        }
        return { name };
    }
});
//console.log(proxy['e']);
// Yay
const cmdMap = {
    "generate": {
        "boilerplate": () => {
            return checkForFolder(bpFolder) ? (() => { throw ('Folder already exists'); })() : boilerplate();
        }
    },
    "check": {
        "structure": () => { console.log('Test Check'); }
    },
    "test": proxy
};
function boilerplate() {
}
function checkForFolder(folder) {
    console.log(`Checking Folder: ${folder}`);
    return fs.existsSync(cwd + '/' + folder);
}
init();
