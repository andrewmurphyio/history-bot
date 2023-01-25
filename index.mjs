import axios from 'axios';
import { config } from 'dotenv';
import { ChatGPTAPIBrowser, ChatGPTAPI, getOpenAIAuth } from 'chatgpt'

config();
console.log(process.env) // remove this after you've confirmed it is working

// const openAIBrowser = new ChatGPTAPIBrowser({
//     email: process.env.OPENAI_EMAIL,
//     password: process.env.OPENAI_PASSWORD
// })

export async function handler(event, context) {
    // Extract the event data from the event
    console.log(event.body);
    const eventData = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    if (eventData.event.user === process.env.SLACK_BOT_USER_ID) return;

    // Check if the event is a challenge
    if ('challenge' in eventData) {
        const challenge = eventData.challenge;
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
        
        const headers = {
            'Authorization': `Bearer ${process.env.OPENAPI_KEY}`,
            'Content-Type': 'application/json'
        };

        const openApiResponse = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
            prompt: `The following is a conversation with an AI assistant called HistoryBot. The assistant is helpful, creative, clever, and very friendly
            Human: Hello, who are you?
            HistoryBot: I am an AI created by Andrew Murphy. My name is HistoryBot. How can I help you today?
            Human: ${requestMessage.replace(/\<\@U04L23YAH38\>/g, "")}
            HistoryBot: `,
            temperature: 0.3,
            max_tokens: 1024,
            user: eventData.event.user,
            stop: ["Human:", "HistoryBot:"]//,
            //session_id: "HistoryBot"
        },{headers:headers});

        
        console.log("openApiResponse", openApiResponse);

        console.log("openApiResponse.data.choices[0]", openApiResponse.data.choices[0]);
        const returnMessage = openApiResponse.data.choices[0].text;

        // await openAIBrowser.initSession();
        // const chatGptResponse = await openAIBrowser.sendMessage(`${requestMessage.replace(/\<\@U04L23YAH38\>/g, "")}`);

                
      

        // const returnMessage = chatGptResponse.response;
        // await api.closeSession();

        console.log("returnMessage", returnMessage);
        // return;

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