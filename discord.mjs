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
const prompt = fs.readFileSync(promptPath, 'utf8');
// console.log("prompt", prompt);

const chatLog = [
    {
        role: "system",
        content: prompt
    }
];

export async function handler(event, context) {
    // Extract the event data from the event
    // console.log("event", event);
    // console.log("context", context);
    console.log("event.body", event.body);
    const eventData = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    console.log("eventData", eventData);

    if (event.headers) {
        const signature = event.headers['x-signature-ed25519'];
        console.log("signature", signature);
        const timestamp = event.headers['x-signature-timestamp'];
        console.log("timestamp", timestamp);

        const isValidRequest = await verifyKey(event.body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);
        if (!isValidRequest) {
            console.log("Invalid token");
            return {
                statusCode: 401,
                body: "Bad request signature"
            };
        }
    }

    if (eventData.type == InteractionType.PING) {
        console.log("Ping");
        return {
            statusCode: 200,
            body: JSON.stringify({ "type": InteractionResponseType.PONG }),
            headers: {
                "Content-Type": "application/json"
            }
        };
    }

    if (eventData.type == InteractionType.APPLICATION_COMMAND) {
        if (eventData.data.name == 'financebot') {
            const requestMessage = eventData.data.options[0].value;
            const headers = {
                'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
                'Content-Type': 'application/json'
            };

            chatLog.push({
                role: "user",
                content: requestMessage
            });

            const openApiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                messages: chatLog,
                temperature: 0.5,
                // max_tokens: 1024,
                user: eventData.member.user.id,
                // stop: ["user:", "assistant:"],
                model: "gpt-4",
            }, { headers: headers });

            console.log("openApiResponse", openApiResponse);

            console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
            const returnMessage = openApiResponse.data.choices[0].message.content;
            chatLog.push(openApiResponse.data.choices[0].message);
            console.log("returnMessage", returnMessage);

            return JSON.stringify({
                "type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,  // This type stands for answer with invocation shown
                "data": { "content": returnMessage }
            })
        }
    }
};