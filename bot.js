const {
    Connection,
    PublicKey,
    TransactionInstruction,
    TransactionResponse
} = require('@solana/web3.js');
const WebSocket = require('ws');
const fs = require('fs');
const util = require('util');

const URI = 'https://api.mainnet-beta.solana.com';
const WSS = 'wss://api.mainnet-beta.solana.com';
const RaydiumLPV4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const logInstruction = 'initialize2';

const connection = new Connection(URI, 'finalized');

const seenSignatures = new Set();

const subscribeToLogs = async (ws) => {
    const filter = {
        mentions: [RaydiumLPV4.toBase58()],
    };

    ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'logsSubscribe',
        params: [
            {
                mentions: filter.mentions,
            },
            'finalized',
        ],
        id: 1,
    }));

    const message = await new Promise((resolve) => {
        ws.on('message', (data) => {
            const response = JSON.parse(data);
            resolve(response);
        });
    });

    return message.result;
};

const processMessages = async (ws) => {
    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.method !== 'logsNotification') return;
        
        const logsNotification = msg.params.result;
        const { logs, signature } = logsNotification.value;

        for (const log of logs) {
            if (log.includes(logInstruction)) {
                console.log(`Found instruction: ${log}`);

                fs.appendFileSync('messages.json', util.format('Signature: %s\n%s\n ########## \n', signature, data));

                await getTokens(signature);
            }
        }
    });
};

const getTokens = async (signature) => {
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    const transaction = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
    });

    fs.appendFileSync('transactions.json', util.format('Signature: %s\n%s\n ########## \n', signature, JSON.stringify(transaction)));

    const instructions = transaction.transaction.message.instructions;
    const filteredInstructions = instructions.filter(
        (instruction) => instruction.programId.equals(RaydiumLPV4)
    );

    filteredInstructions.forEach((instruction) => {
        const tokens = getTokensInfo(instruction);
        printTable(tokens);
        console.log(`True, https://solscan.io/tx/${signature}`);
    });
};

const getTokensInfo = (instruction) => {
    const accounts = instruction.accounts;
    const Pair = accounts[4];
    const Token0 = accounts[8];
    const Token1 = accounts[9];
    console.log('Found LP!');
    console.log(`Token0: ${Token0}, Token1: ${Token1}, Pair: ${Pair}`);
    return { Token0, Token1, Pair };
};

const printTable = ({ Token0, Token1, Pair }) => {
    console.log('============NEW POOL DETECTED====================');
    console.log('│ Token_Index       │ Account Public Key   │');
    console.log(`│ Token0            │ ${Token0}           │`);
    console.log(`│ Token1            │ ${Token1}           │`);
    console.log(`│ LP Pair           │ ${Pair}             │`);
};

const main = async () => {
    const ws = new WebSocket(WSS);

    ws.on('open', async () => {
        console.log('WebSocket connected.');

        const subscriptionId = await subscribeToLogs(ws);
        console.log('Subscribed to logs with subscription ID:', subscriptionId);

        await processMessages(ws);

        ws.on('close', () => {
            console.log('WebSocket connection closed.');
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    });
};

main();
