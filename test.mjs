import testIm from './test-im.json' assert { type: 'json' };
import testChannel from './test-channel-message.json' assert { type: 'json' };

import { handler } from "./index.mjs";

console.log(await handler(testIm));
console.log(await handler(testChannel));