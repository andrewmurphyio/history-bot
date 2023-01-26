import axios from 'axios';
import { config } from 'dotenv';
import { ChatGPTAPIBrowser } from 'chatgpt'

config();
console.log("process.env", process.env) // remove this after you've confirmed it is working

const openAIBrowser = new ChatGPTAPIBrowser({
    email: process.env.OPENAI_EMAIL,
    password: process.env.OPENAI_PASSWORD
})

const useChatGPT = false;

const previouslySeenMessages = [];

export async function handler(event, context) {
    // Extract the event data from the event
    console.log("event.body", event.body);
    const eventData = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

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
    
    previouslySeenMessages[eventData.client_msg_id] = true;

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
        console.log("requestMessage", requestMessage);
        // console.log("process.env.OPENAPI_KEY", process.env.OPENAPI_KEY);

        const channel = eventData.event.channel;

        let returnMessage = "";
        if (!useChatGPT) {
            const headers = {
                'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
                'Content-Type': 'application/json'
            };

            const openApiResponse = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
                prompt: `The following is a conversation with an AI assistant called HistoryBot. The assistant is helpful, creative, clever, and very friendly.
            Human: Hello, who are you? I am using Slack so please use Slack syntax for all messages. 
            HistoryBot: I am an AI created by Andrew Murphy. My name is HistoryBot. Sure, I will use Slack syntax! How can I help you today?
            Human: ${requestMessage.replace(/\<\@U04L23YAH38\>/g, "")}
            HistoryBot: `,
                temperature: 0.9,
                max_tokens: 1024,
                user: eventData.event.user,
                stop: ["Human:", "HistoryBot:"]//,
                //session_id: "HistoryBot"
            }, { headers: headers });


            console.log("openApiResponse", openApiResponse);

            console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
            returnMessage = openApiResponse.data.choices[0].text;
        } else {
            await openAIBrowser.initSession();
            const chatGptResponse = await openAIBrowser.sendMessage(`${requestMessage.replace(/\<\@U04L23YAH38\>/g, "")}`);
            await openAIBrowser.closeSession();

            returnMessage = chatGptResponse.response;
        }
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
};