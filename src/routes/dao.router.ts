import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  MEMO_PROGRAM_ID,
} from '@solana/actions';
import { STANDARD } from '../constants';
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
/* import * as controllers from '../controllers'; */
/* import { utils } from '../utils'; */
/* import { loginSchema, signupSchema } from '../schemas/User'; */

async function daoRouter(fastify: FastifyInstance) {
  fastify.route({
    method: ['GET', 'OPTIONS'],
    url: '/',
    schema: {},
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      console.log(request.hostname);
      const payload: ActionGetResponse = {
        icon: `${request.protocol}://${request.hostname}/public/solana_talent_olympics.png`,
        label: 'Talent Olympics Test',
        description: 'This is a test for the Talent Olympics demo',
        title: 'Talent Olympics',
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
        const body = request.body as ActionPostRequest;

        let account: PublicKey;

        try {
          account = new PublicKey(body.account);
        } catch (err) {
          return reply
            .code(STANDARD.ERROR.statusCode)
            .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
            .send({
              errorMessage:
                'Wrong account. Check again you send a body parameter a correct Publickey',
            });
        }

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

        const payload: ActionPostResponse = await createPostResponse({
          fields: {
            transaction,
            message: 'Thanks for signing the transaction',
          },
          // signers: []
        });

        return reply
          .code(STANDARD.ACCEPTED.statusCode)
          .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
          .send(payload);
      } catch (err) {
        console.log(err);

        return reply
          .code(STANDARD.ERROR.statusCode)
          .headers(ACTIONS_CORS_HEADERS as Record<string, string>)
          .send({
            errorMessage: 'Something went wrong',
          });
      }
    },
  );
}

export default daoRouter;
