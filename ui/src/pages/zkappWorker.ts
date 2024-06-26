import { Mina, PublicKey, fetchAccount } from 'o1js';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { Lottery } from '../../../contracts/src/Lottery';
import { DistibutionProgram } from '../../../contracts/build/src/index';

import { WebFileSystem, fetchCache } from '@/lib/cache';
import { LOTTERY_CACHE } from '@/lib/contracts_cache';

const state = {
  Lottery: null as null | typeof Lottery,
  DistibutionProgram: null as null | typeof DistibutionProgram,
  zkapp: null as null | Lottery,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToDevnet: async (args: {}) => {
    const Network = Mina.Network(
      'https://api.minascan.io/node/devnet/v1/graphql'
    );
    console.log('Devnet network instance configured.');
    Mina.setActiveInstance(Network);
  },
  loadContract: async (args: {}) => {
    const { Lottery } = await import('../../../contracts/build/src/Lottery.js');
    state.Lottery = Lottery;

    const { DistributionProof } = await import('../../../contracts/build/src/DistributionProof.js');
    state.DistibutionProgram = DistributionProof;
  },
  compileContract: async (args: {}) => {
    const lotteryCache = await fetchCache(LOTTERY_CACHE);
    console.log('[Worker] compiling distribution contracts');

    await DistibutionProgram!.compile({
      cache: WebFileSystem(lotteryCache),
    });
    
    console.log('[Worker] compiling distr contracts ended');

    console.log('[Worker] compiling lottery contracts');

    await state.Lottery!.compile({
      cache: WebFileSystem(lotteryCache),
    });

    console.log('[Worker] compiling lottery contracts ended');

    // await state.Add!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Add!(publicKey);
  },
  getNum: async (args: {}) => {
    const currentNum = await state.zkapp!.num.get();
    return JSON.stringify(currentNum.toJSON());
  },
  createUpdateTransaction: async (args: {}) => {
    const transaction = await Mina.transaction(async () => {
      await state.zkapp!.update();
    });
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};

if (typeof window !== 'undefined') {
  addEventListener(
    'message',
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}

console.log('Web Worker Successfully Initialized.');
