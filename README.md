SqueakJS
=======

## Installation
```$xslt
$ npm install squeakjs
```

## Example Usage
```$xslt
./
|-- dist/
    |-- client/
        |-- js/
            |-- home.js
        |-- styles/
            |-- home.css
            |-- layout.css
|-- src
    |-- squeak/
        |-- main.ts
        |-- interfaces/
        	|-- someapi.ts
        |-- views/
            |-- layout.html
            |-- index/
                |-- index.html
                |-- index.ts
    |-- server.ts
    |-- app.ts
    |-- tsconfig.json
```
---
#### tsconfig.json
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es6",
    "experimentalDecorators": true,
    "lib": [
      "es2018",
      "scripthost",
      "dom"
    ],
    "sourceMap": false,
    "outDir": "../dist",
    "allowSyntheticDefaultImports": true
  },
  "files": [
    "./app.ts",
    "./squeak/main.ts",
    "./squeak/views/index/index.ts",
    "./squeak/views/interfaces/someapi.ts",
    "./server/server.ts"
  ]
}
```
---
#### server.ts
```typescript
import * as http from 'http';
import { serverIp, randomId } from 'squeakjs/lib/utilities';
import { SqueakServer } from 'squeakjs';

import { Squeak } from "../squeak/main";

export class Server {
    squeakServer: SqueakServer;
    instances: ServerInstances = {};

    constructor(){
        this.squeakServer = new SqueakServer(Squeak);
    }

    createInstance(id: string = undefined, port: number = 8010,): string {
        if(id === undefined) id = randomId();
        this.instances[id] = http.createServer((req,res)=>{
            console.log(`Instance [${id}] Request: ${req.url}`);
            this.squeakServer.serve(req,res);
        }).listen(port);
        console.log(`Server instance [${id}] running at http://${serverIp(this.instances[id])}`);
        return id;
    }
}

export interface ServerInstances {
    [key: string]: any;
}
```
---
#### app.ts
```typescript
import { Server } from './server';
global['__basedir'] = __dirname;
const server = new Server();
let instance = server.createInstance('test', 8010);
```
---
#### main.ts
```typescript
import { SqueakMain, FileCacheStrategy, FileWatchStrategy } from 'squeakjs';

// Views
import { IndexView } from "./views/index";

// Interfaces
import { SomeApiInterface } from "./interfaces/someapi";

@SqueakMain({
    viewDir: __dirname + '/views',
    publicDir: './dist/client',
    squeakFile: __filename,
    fileCacheStrategy: FileCacheStrategy.onFirstLoad(),
    fileWatchStrategy: FileWatchStrategy.immediate(),
    declarations: [
        IndexView,
        SomeApiInterface
    ],
    roots: [
        {selector: 'layout', file: 'layout.html'}
    ]
}) export class Squeak {}
```
---
#### someapi.ts
```typescript
import { SqueakInterface, OnGet } from 'squeakjs';

@SqueakInterface({
    squeakName: 'api',
    squeakPath: __dirname,
    squeakFile: __filename,
    urlPath: '/api'
}) export class SomeApiInterface implements OnGet {
    
    constructor(){}

    onGet(req,res){
        console.log('Test Get');
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('testApiInterface', 'utf-8');
    }
}
```
---
#### index.ts
```typescript
import { SqueakView } from 'squeakjs';

@SqueakView({
    squeakName: 'index',
    squeakPath: __dirname,
    squeakFile: __filename,
    urlPath: '/',
    title: 'Squeak Home',
    views: [
        {selector: 'index', file: 'index.html'}
    ],
    styleUrls: ['/styles/home.css'],
    clientJs: ['/js/home.js']
}) export class IndexView {
    
    constructor(){}
    
}
```
---
#### layout.html
```html
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Default Title</title>
		<link rel="stylesheet" href="/styles/layout.css">
	</head>
	<body>
		<s-render-outlet></s-render-outlet>
	</body>
</html>
```
---
#### index.html
```html
<s-template s-rendersat="layout">
	<h1>Hello, Squeak!</h1>
</s-template>
```