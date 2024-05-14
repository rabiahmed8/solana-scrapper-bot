const { Connection, PublicKey } = require("@solana/web3.js");

const RAYDIUM_PUBLIC_KEY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

const SESSION_HASH = 'QNDEMO' + Math.ceil(Math.random() * 1e9); // Random unique identifier for your session
let credits = 0;

const URI = 'https://serene-sleek-diamond.solana-mainnet.quiknode.pro/94e6b5d29f2e957ecc305c51c19feb52d85f0d56/';
const WSS = 'wss://serene-sleek-diamond.solana-mainnet.quiknode.pro/94e6b5d29f2e957ecc305c51c19feb52d85f0d56/';

// const URI = 'https://api.mainnet-beta.solana.com';
// const WSS = 'wss://api.mainnet-beta.solana.com';

const raydium = new PublicKey(RAYDIUM_PUBLIC_KEY);

const connection = new Connection(URI, {
    wsEndpoint: WSS,
    httpHeaders: {"x-session-hash": SESSION_HASH}
});
if(connection) {
    credits+=50;
}

// Monitor logs
async function main(connection, programAddress) {
    console.log("Monitoring logs for program:", programAddress.toString());
    connection.onLogs(
        programAddress,
        (obj) => {
            // console.log("Logging",obj)
            // console.log("Logs:", obj);
            const { logs, err, signature } = obj;
            if (err) return;

            if (logs && logs.some(log => log.includes("initialize2"))) {
                console.log("Signature for 'initialize2':", signature);
                fetchRaydiumAccounts(signature, connection);
            }
        },
        "finalized"
    );
}

// Parse transaction and filter data
async function fetchRaydiumAccounts(txId, connection) {
    const tx = await connection.getParsedTransaction(
        txId,
        {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
    
    credits += 50;
    
    const accounts = tx?.transaction.message.instructions.find(ix => ix.programId.toBase58() === RAYDIUM_PUBLIC_KEY).accounts;

    if (!accounts) {
        console.log("No accounts found in the transaction.");
        return;
    }

    const tokenAIndex = 8;
    const tokenBIndex = 9;

    const tokenAAccount = accounts[tokenAIndex];
    const tokenBAccount = accounts[tokenBIndex];

    const displayData = [
        { "Token": "A", "Account Public Key": tokenAAccount.toBase58() },
        { "Token": "B", "Account Public Key": tokenBAccount.toBase58() }
    ];
    console.log("New LP Found");
    console.log(generateExplorerUrl(txId));
    console.table(displayData);
    console.log("Total QuickNode Credits Used in this session:", credits);
}

function generateExplorerUrl(txId) {
    return `https://solscan.io/tx/${txId}`;
}

main(connection, raydium).catch(console.error);