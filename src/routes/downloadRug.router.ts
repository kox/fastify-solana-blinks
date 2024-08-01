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
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createGenericFile,
  createNoopSigner,
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  publicKey,
  signerIdentity,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import wallet from '../../wba-wallet.json';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import {
  createNft,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  toWeb3JsInstruction,
  toWeb3JsKeypair,
} from '@metaplex-foundation/umi-web3js-adapters';

const downloadPath = path.resolve(__dirname, 'downloads');

// Ensure the download directory exists
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath);
}

// Function to copy the file using UUID
const copyFileWithUUID = (sourcePath, id) => {
  // const id = uuidv4();
  const newFilename = `${id}.png`;
  const newPath = path.join(path.dirname(sourcePath), newFilename);
  fs.copyFile(sourcePath, newPath, (err) => {
    if (err) throw err;
    console.log(`File copied to ${newFilename}`);
  });

  return id;
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

        const searchResultSelector = 'a#downloadLink';
        await page.waitForSelector(searchResultSelector);
        await page.click(searchResultSelector);
        await delay(1000); // Delay for 1 second (1000 milliseconds)

        await copyFileWithUUID(`${downloadPath}\\generug.png`, id);

        const body = request.body as ActionPostRequest;

        const account = new PublicKey(body.account);

        const connection = new Connection(clusterApiUrl('devnet'));

        const RPC_ENDPOINT = 'https://api.devnet.solana.com';
        const umi = createUmi(RPC_ENDPOINT);

        const keypair = umi.eddsa.createKeypairFromSecretKey(
          new Uint8Array(wallet.secret_key),
        );
        const signer = createSignerFromKeypair(umi, keypair);

        umi.use(irysUploader());
        umi.use(signerIdentity(signer));
        umi.use(mplTokenMetadata());

        const imageSrc = `${downloadPath}\\${id}.png`;

        console.log('Image Src: ', imageSrc);

        const imageFile = fs.readFileSync(imageSrc);

        const umiImageFile = createGenericFile(imageFile, `${id}.png`, {
          tags: [{ name: 'Content-Type', value: 'image/png' }],
        });

        const imageUri = await umi.uploader
          .upload([umiImageFile])
          .catch((err) => {
            throw new Error(err);
          });

        console.log(imageUri);

        const metadata = {
          name: 'WBA GENERUG',
          symbol: 'WGRUG',
          description:
            'Your personal generator of RUGs created Dean and blinked by kox',
          image: imageUri[0],
          external_url: 'https://deanmlittle.github.io/generug/',
          attributes: [],
          properties: {
            files: [
              {
                type: 'image/png',
                uri: imageUri[0],
              },
            ],
          },
          creators: [
            {
              address: wallet.pubkey,
              share: 100,
            },
          ],
        };

        const metadataUri = await umi.uploader
          .uploadJson(metadata)
          .catch((err) => {
            throw new Error(err);
          });

        console.log('Your metadata URI: ', metadataUri);

        const lastBlockhash = await connection.getLatestBlockhash();
        const mint = generateSigner(umi);
        const timestamp = Date.now();
        console.log('mint pubkey: ', mint.publicKey);

        const frontendUmi = createUmi(RPC_ENDPOINT);
        const frontendSigner = createNoopSigner(publicKey(account));
        frontendUmi.use(signerIdentity(frontendSigner));
        frontendUmi.use(mplTokenMetadata());

        const createNftTransactionBuilder: TransactionBuilder = createNft(
          frontendUmi,
          {
            mint,
            name: `WBA GENERUG ${timestamp}`,
            uri: metadataUri,
            sellerFeeBasisPoints: percentAmount(5.5),
          },
        );
        // setting lastest blockhash
        createNftTransactionBuilder.setBlockhash(lastBlockhash.blockhash);
        // Get only instructions as umi signer is different than action signer
        const instructions = createNftTransactionBuilder.getInstructions();
        // Convert intestruction to old Web
        const web3Instruction: TransactionInstruction = toWeb3JsInstruction(
          instructions[0],
        );
        // Create a Transaction Message and convert it to VersionedMessage
        const messageV0 = new TransactionMessage({
          payerKey: account,
          recentBlockhash: lastBlockhash.blockhash,
          instructions: [web3Instruction],
        }).compileToV0Message();
        // Createa a VersionedTransaction
        const transactionWithLookupTable = new VersionedTransaction(messageV0);
        // Sign the transaction with the mint authority (server-side signer)

        const mintKeypair = toWeb3JsKeypair(mint);
        transactionWithLookupTable.sign([mintKeypair]);
        /* const walletKeypair = toWeb3JsKeypair(keypair); */

        /* transactionWithLookupTable.sign([mintKeypair, walletKeypair]); */

        console.log('signatures');
        console.log(transactionWithLookupTable.signatures);
        // Create the payload to return to the blink
        const payload = await createPostResponse({
          fields: {
            transaction: transactionWithLookupTable,
            message: 'Congrats for Generug minting',
          },
        });

        console.log(payload);

        return reply
          .code(STANDARD.ACCEPTED.statusCode)
          .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
          .send(payload);
      } catch (error) {
        console.log(error);

        if (hasGetLogsMethod(error)) {
          const logs = await error.getLogs();
          console.error('Transaction logs: ', logs);
        }
      }

      return reply
        .code(STANDARD.OK.statusCode)
        .headers(ACTIONS_CORS_HEADERS as Record<string, string>);
    },
  );
}

function hasGetLogsMethod(
  error: unknown,
): error is { getLogs: () => Promise<string[]> } {
  return typeof error === 'object' && error !== null && 'getLogs' in error;
}

export default generateRug;
