import testIm from './test-slack-im.json' assert { type: 'json' };
import testImIncomplete from './test-slack-im-incomplete.json' assert { type: 'json' };
import testChannel from './test-slack-channel-message.json' assert { type: 'json' };
import testDiscord from './test-discord.json' assert { type: 'json' };

import { handler as slack } from "./slack.mjs";
import { handler as discord } from "./discord.mjs";

console.log(await slack(testImIncomplete));
console.log(await slack(testIm));
// console.log(await slack(testChannel));
// console.log(await discord(testDiscord));