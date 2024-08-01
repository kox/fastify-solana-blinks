import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  MEMO_PROGRAM_ID,
} from '@solana/actions';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { STANDARD } from '../constants';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  Connection,
  clusterApiUrl,
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

const downloadPath = path.resolve(__dirname, 'downloads');

// Ensure the download directory exists
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath);
}

// Function to copy the file using UUID
const copyFileWithUUID = (sourcePath) => {
  const id = uuidv4();
  const newFilename = `${uuidv4()}.png`;
  const newPath = path.join(path.dirname(sourcePath), newFilename);
  fs.copyFile(sourcePath, newPath, (err) => {
    if (err) throw err;
    console.log(`File copied to ${newFilename}`);
  });

  return id;
};

async function generateRug(fastify: FastifyInstance) {
  fastify.route({
    method: ['GET', 'OPTIONS'],
    url: '/',
    schema: {},
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      console.log(request.hostname);
      const payload: ActionGetResponse = {
        icon: `${request.protocol}://localhost:5000/public/generug_cover.png`,
        label: 'Mint your Generug!',
        description: 'Get Rug with your unique generug',
        title: 'Mint your Generug',
      };

      return reply
        .code(STANDARD.OK.statusCode)
        .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
        .send(payload);
    },
  });

  fastify.post(
    '/',
    {},
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const id = uuidv4();

        console.log(id);

        // Launch Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadPath,
        });

        // Configure the download behavior
        await page.goto('https://deanmlittle.github.io/generug/', {
          waitUntil: 'networkidle2',
        });

        console.log('goto');
        const searchResultSelector = 'a#downloadLink';
        await page.waitForSelector(searchResultSelector);
        console.log('waitfor');
        await page.click(searchResultSelector);

        console.log('click');

        const generugId = await copyFileWithUUID(
          `${downloadPath}\\generug.png`,
        );

        console.log(generugId);

        const body = request.body as ActionPostRequest;

        let account: PublicKey;
        account = new PublicKey(body.account);

        const transaction = new Transaction();

        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1000,
          }),
          new TransactionInstruction({
            programId: new PublicKey(MEMO_PROGRAM_ID),
            data: Buffer.from('this is a simple memo message', 'utf8'),
            keys: [],
          }),
        );

        transaction.feePayer = account;

        const connection = new Connection(clusterApiUrl('devnet'));
        transaction.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;

        const RPC_ENDPOINT = "https://api.devnet.solana.com";
        const umi = createUmi(RPC_ENDPOINT);

        const payload: ActionPostResponse = await createPostResponse({
          fields: {
            transaction,
            message: 'Thanks for the coffee',
          },
          // signers: []
        });

        console.log(payload);

        return reply
          .code(STANDARD.ACCEPTED.statusCode)
          .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
          .send(payload);
      } catch (err) {
        console.log(err);
      }

      return reply
        .code(STANDARD.OK.statusCode)
        .headers(ACTIONS_CORS_HEADERS as Record<string, string>);
    },
  );
}

export default generateRug;
