import axios from 'axios';
import { config } from 'dotenv';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();
// console.log("process.env", process.env) // remove this after you've confirmed it is working

const promptPath = path.join(__dirname, 'prompt.md');
let prompt = fs.readFileSync(promptPath, 'utf8');
// console.log("prompt", prompt);

prompt = prompt.replace("formatted in HTML", "formatted as a discord message");
prompt = prompt.replace("AI Chatbot called FinanceBot that", "AI Chatbot called FinanceBot that talks to people over Discord. FinanceBot");

const threads = {};

import { Client, IntentsBitField, Events, Partials, ChannelType, Message } from 'discord.js';

const myIntents = new IntentsBitField();
myIntents.add(
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMembers,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.GuildMessageReactions,
  IntentsBitField.Flags.GuildMessageTyping,
  IntentsBitField.Flags.DirectMessages,
  IntentsBitField.Flags.DirectMessageReactions,
  IntentsBitField.Flags.DirectMessageTyping,
  IntentsBitField.Flags.MessageContent
);


const client = new Client({
  intents: myIntents,
  partials: [
    Partials.Channel,
  ]
});

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});


client.on(Events.MessageCreate, async message => {
  // console.log("MessageCreate", message);
  if (message.author.bot) return;
  // console.log("mentions bot", message.mentions.users.has(process.env.DISCORD_BOT_ID));

  // console.log("message.channel", message.channel);

  if (message.channel.type === ChannelType.DM) {
    // console.log("DM");
    await responseToMessage(message);

  } else if (message.mentions.users && message.mentions.users.has(process.env.DISCORD_BOT_ID)) {
    // console.log("mentions bot");
    await responseToMessage(message);
  }

});

/**
 * 
 * @param {Message<boolean>} message 
 */
async function responseToMessage(message) {
  const requestMessage = message.content.replace(`<@${process.env.DISCORD_BOT_ID}>`, "").trim();

  if (requestMessage === 'ping') {
    await message.reply('Pong!');
  } else {
    const headers = {
      'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
      'Content-Type': 'application/json'
    };

    let chatLog = [];

    if (message.channel.type === ChannelType.DM) {
      // Get the previous chatLog
      chatLog = threads[message.channelId] ?? [{ role: "system", content: prompt }];
    }
    else if (message.reference) {
      // Get the previous chatLog
      chatLog = threads[message.reference.messageId];
    } else {
      chatLog = [{ role: "system", content: prompt }];
    }

    chatLog.push({
      role: "user",
      content: requestMessage
    });

    const openApiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [...chatLog, { role: "user", content: requestMessage }],
      temperature: 0.5,
      user: message.author.id,
      model: "gpt-4",
    }, { headers: headers });

    // console.log("openApiResponse", openApiResponse);

    // console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
    const returnMessage = openApiResponse.data.choices[0].message.content;
    chatLog.push(openApiResponse.data.choices[0].message);
    // console.log("returnMessage", returnMessage);

    let repliedMessage;
    try {
      const obj = JSON.parse(returnMessage);

      if (message.channel.type === ChannelType.DM) {
        repliedMessage = message.channel.send(obj.message);
      } else {
        repliedMessage = await message.reply(obj.message);
      }
    } catch (error) {
      if (message.channel.type === ChannelType.DM) {
        repliedMessage = message.channel.send(obj.message);
      } else {
        repliedMessage = await message.reply(error);
      }
    }

    // console.log(repliedMessage);

    if (message.channel.type === ChannelType.DM) {
      // console.log("DM repliedMessage.channelId", message.channelId);
      threads[message.channelId] = chatLog;
    } else {
      // console.log("Channel repliedMessage.id", repliedMessage.id);
      threads[repliedMessage.id] = chatLog;
    }
    // console.log("threads", threads);
  }

}


client.on(Events.InteractionCreate, async interaction => {
  console.log("InteractionCreate", interaction);
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}`);
    console.error(error);
  }
});

//make sure this line is the last line
client.login(process.env.CLIENT_TOKEN); //login bot using token
