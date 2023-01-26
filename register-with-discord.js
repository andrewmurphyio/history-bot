require('dotenv').config()
const axios = require('axios').default;

let url = `https://discord.com/api/v8/applications/${process.env.DISCORD_APP_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`

const headers = {
  "Authorization": `Bot ${process.env.DISCORD_TOKEN}`,
  "Content-Type": "application/json"
}

let command_data = {
  "name": "historybot",
  "type": 1,
  "description": "replies with sarcasm",
  "dm_permission": true,
  "options": [
    {
        "name": "question",
        "description": "What do you want to know?",
        "type": 3,
        "required": true
    }],
}

axios.post(url, JSON.stringify(command_data), {
  headers: headers,
})