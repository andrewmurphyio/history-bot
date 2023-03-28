import axios from 'axios';
import { config } from 'dotenv';

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
// console.log("process.env", process.env) // remove this after you've confirmed it is working

const previouslySeenMessages = [];
const chatLog = [
    {
        role: "system",
        content: prompt
    }
];

export async function handler(event, context) {
    // Extract the event data from the event
    // console.log("event.body", event.body);
    const eventData = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    // console.log("eventData", eventData);

    if (eventData.event.type == "app_mention" || (eventData.event.type == "message" && eventData.event.channel_type == "im")) {
        if (eventData.event.user === process.env.SLACK_BOT_USER_ID) {
            console.log(`message is from ${process.env.SLACK_BOT_USER_ID} so I am returning`);
            return;
        };

        // Check to see if we've seen this message before
        console.log("eventData.event.client_msg_id", eventData.event.client_msg_id);
        if (previouslySeenMessages[eventData.event.client_msg_id]) {
            console.log(`previous seen message id ${eventData.event.client_msg_id} so I am returning`);
            return;
        }

        previouslySeenMessages[eventData.event.client_msg_id] = true;

        // Check if the event is a challenge
        if ('challenge' in eventData) {
            const challenge = eventData.challenge;
            console.log(`it's a challenge! ${challenge}`);

            return {
                statusCode: 200,
                body: JSON.stringify({ challenge }),
                headers: {
                    "Content-Type": "application/json"
                }
            };
        } else {
            // If it's not a challenge, extract the message
            const requestMessage = eventData.event.text;
            // console.log("requestMessage", requestMessage);
            // console.log("process.env.OPENAPI_KEY", process.env.OPENAPI_KEY);

            const channel = eventData.event.channel;

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
                temperature: 1,
                // max_tokens: 1024,
                user: eventData.event.user,
                // stop: ["user:", "assistant:"],
                model: "gpt-4",
            }, { headers: headers });


            // console.log("openApiResponse", openApiResponse);

            // console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
            const returnMessage = openApiResponse.data.choices[0].message.content;
            chatLog.push(openApiResponse.data.choices[0].message);
            console.log("returnMessage", returnMessage);
            try {
                // Use axios to make the POST request
                const response = await axios({
                    method: 'post',
                    url: 'https://slack.com/api/chat.postMessage',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
                    },
                    data: {
                        channel: channel,
                        text: returnMessage
                    }
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify(response.data),
                    headers: {
                        "Content-Type": "application/json"
                    }
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: 'Error posting message to Slack', error }),
                    headers: {
                        "Content-Type": "application/json"
                    }
                };
            }
        }
    } else {

        console.log("unkown event type", eventData.event);
        return {
            statusCode: 200,
            body: "{\"result\": \"OK\"}",
            headers: {
                "Content-Type": "application/json"
            }
        };
    }
};