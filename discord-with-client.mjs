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

import { Client, IntentsBitField, Events, Partials, ChannelType, Message, ThreadChannel } from 'discord.js';

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
  console.log("MessageCreate", message);
  if (message.author.bot) return;
  // console.log("mentions bot", message.mentions.users.has(process.env.DISCORD_BOT_ID));

  // console.log("message.channel", message.channel);

  if (message.channel.type === ChannelType.DM) {
    // console.log("DM");
    await respondToMessage(message);

  } else if (message.channel.type === ChannelType.PublicThread && message.channel.name === "FinanceBot") {
    await respondToMessage(message);
  } else if (message.mentions.users && message.mentions.users.has(process.env.DISCORD_BOT_ID)) {
    // console.log("mentions bot");
    await respondToMessage(message);
  }

});

/**
 * 
 * @param {Message<boolean>} message 
 */
async function respondToMessage(message) {
  const requestMessage = message.content.replace(`<@${process.env.DISCORD_BOT_ID}>`, "").trim();

  console.log("message.channel.type ", message.channel.type);

  if (requestMessage === 'ping') {
    await message.reply('Pong!');
  } else {
    let chatLog = [];

    if (message.channel.type === ChannelType.DM) {
      // Get the previous chatLog
      chatLog = threads[message.channelId];
    } else if (message.channel.type === ChannelType.PublicThread) {
      chatLog = threads[message.channel.id];
    } else if (message.reference) {
      // Get the previous chatLog
      chatLog = threads[message.reference.messageId];
    }

    chatLog = chatLog ?? [{ role: "system", content: prompt }];

    chatLog.push({
      role: message.author.bot ? "assistant" : "user",
      content: requestMessage
    });

    const openApiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: chatLog,
      temperature: 0.7,
      user: message.author.id,
      model: "gpt-4",
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // console.log("openApiResponse", openApiResponse);

    // console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
    const returnMessage = openApiResponse.data.choices[0].message.content;
    chatLog.push(openApiResponse.data.choices[0].message);
    // console.log("returnMessage", returnMessage);

    /** @type {Message} */
    let repliedMessage;
    let command;
    // try {
    const obj = JSON.parse(returnMessage);

    /** @type {ThreadChannel} */
    let thread;
    if (message.channel.type === ChannelType.DM) {
      thread = null;
      repliedMessage = message.channel.send(obj.message);
    } else if (message.channel.type === ChannelType.PublicThread) {
      thread = message.channel;
      repliedMessage = await thread.send(obj.message);
    } else {
      thread = await message.startThread({ name: "FinanceBot" });
      repliedMessage = await thread.send(obj.message);
    }

    command = obj.command;
    // } catch (error) {
    //   if (message.channel.type === ChannelType.DM) {
    //     repliedMessage = message.channel.send(obj.message);
    //   } else {
    //     repliedMessage = message.channel.send(obj.message);
    //   }
    // }

    // console.log(repliedMessage);

    if (message.channel.type === ChannelType.DM) {
      // console.log("DM repliedMessage.channelId", message.channelId);
      threads[message.channelId] = chatLog;
    } else if (thread) {
      threads[thread.id] = chatLog;
    } else {
      // console.log("Channel repliedMessage.id", repliedMessage.id);
      threads[repliedMessage.id] = chatLog;
    }
    // console.log("threads", threads);

    if (command && command.command) {
      const commandValue = await callCommand(command.command, command.arguments);
      // console.log("commandValue", commandValue);
      const modelResponse = { command: command.command, uuid: command.uuid, value: commandValue };
      const modelResponseString = `Model: ${JSON.stringify(modelResponse)}`;
      message.content = modelResponseString;
      await respondToMessage(message);
    }
  }
}


async function callCommand(commandName, args) {
  if (commandName === "calculateBalance") {
    return await calculateBalance(args);
  } else {
    throw Error(`Invalid commandName: ${commandName}`);
  }
}

async function calculateBalance(args) {
  const currentValue = args.find(v => v.name === "currentValue").value;
  // console.log("currentValue", currentValue);
  const yearsToInvest = args.find(v => v.name === "yearsToInvest").value;
  // console.log("yearsToInvest", yearsToInvest);
  const returnPercentage = args.find(v => v.name === "returnPercentage").value;
  // console.log("returnPercentage", returnPercentage);
  const annualRegularContribution = args.find(v => v.name === "annualRegularContribution").value;
  // console.log("annualRegularContribution", annualRegularContribution);

  const annualReturnRate = 1 + (returnPercentage / 100);
  let futureValue = currentValue;

  for (let i = 0; i < yearsToInvest; i++) {
    futureValue *= annualReturnRate;
    futureValue += annualRegularContribution;
  }

  return futureValue;
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
