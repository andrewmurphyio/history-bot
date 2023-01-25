import testObj from './test.json' assert { type: 'json' };

import { handler } from "./index.mjs";

console.log(await handler(testObj));