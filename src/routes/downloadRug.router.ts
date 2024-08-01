import { ActionGetResponse, ACTIONS_CORS_HEADERS } from "@solana/actions";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { STANDARD } from "../constants";
import puppeteer from 'puppeteer';
import path from "path";
import fs from 'fs';

const downloadPath = path.resolve(__dirname, 'downloads');

// Ensure the download directory exists
if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
}

async function generateRug(fastify: FastifyInstance) {
    fastify.route({
        method: ['GET'],
        url: '/',
        schema: {},
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                // Launch Puppeteer
                const browser = await puppeteer.launch({ headless: true });
                const page = await browser.newPage();
            
                // Configure the download behavior
                await page.goto('https://deanmlittle.github.io/generug/', { waitUntil: 'networkidle2' });
                const searchResultSelector = 'a#downloadLink';
                await page.waitForSelector(searchResultSelector);
                await page.click(searchResultSelector);
                /*c lient.send('Page.setDownloadBehavior', {
                  behavior: 'allow',
                  downloadPath: downloadPath,
                }); */
            
                // Navigate to the website
                /* await page.goto('https://deanmlittle.github.io/generug/', { waitUntil: 'networkidle2' }); */
            

                /* const payload: ActionGetResponse = {
                    icon: `${request.protocol}://localhost:5000/public/generug_cover.png`,
                    label: "Mint your Generug!",
                    description: "Get Rug with your unique generug",
                    title: "Mint your Generug",
                } */
            /* return reply
                .code(STANDARD.OK.statusCode)
                .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
                .send(payload); */
            } catch(err) {
                console.log(err);
            }

            return reply
                .code(STANDARD.OK.statusCode)
                .headers(ACTIONS_CORS_HEADERS as Record<string, string>);
        }
    });
};

export default generateRug;
