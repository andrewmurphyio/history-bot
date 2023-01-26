import axios from 'axios';
import { config } from 'dotenv';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

config();
// console.log("process.env", process.env) // remove this after you've confirmed it is working

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
        if (eventData.data.name == 'historybot') {
            const requestMessage = eventData.data.options[0].value;
            const headers = {
                'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
                'Content-Type': 'application/json'
            };

            const openApiResponse = await axios.post('https://api.openai.com/v1/engines/curie/completions', {
                prompt: `The following is a conversation with an AI assistant called HistoryBot. The assistant is helpful, creative, clever, and very friendly.
        Human: Hello, who are you? I am using Discord so please use Discord syntax for all messages. 
        HistoryBot: I am an AI created by Andrew Murphy. My name is HistoryBot. Sure, I will use Discord syntax! How can I help you today?
        Human: ${requestMessage}
        HistoryBot: `,
                temperature: 0.9,
                max_tokens: 1024,
                user: eventData.member.user.id,
                stop: ["Human:", "HistoryBot:"]//,
                //session_id: "HistoryBot"
            }, { headers: headers });


            console.log("openApiResponse", openApiResponse);

            console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
            const returnMessage = openApiResponse.data.choices[0].text;

            return JSON.stringify({
                "type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,  // This type stands for answer with invocation shown
                "data": { "content": returnMessage }
            })
        }
    }
};