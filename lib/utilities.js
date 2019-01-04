"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Helper Utilities
function serverIp(serverObj) {
    // TODO: Make this shit work
    let address = serverObj.address().address;
    let port = serverObj.address().port;
    return address + ':' + port;
}
exports.serverIp = serverIp;
function randomId() {
    const letterMap = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    const letterMapLen = letterMap.length - 1;
    let randId = '';
    for (let i = 0; i < 10; i++) {
        randId += letterMap[Math.floor(Math.random() * letterMapLen)];
    }
    return randId;
}
exports.randomId = randomId;
