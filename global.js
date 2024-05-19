const dotenv = require("dotenv");
const bs58 = require("bs58");
const BigNumber = require("bignumber.js");
const BN = require("bn.js");
var colors = require("colors");
const {
  Connection,
  clusterApiUrl,
  PublicKey,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
  VersionedTransaction,
  Keypair,
} = require("@solana/web3.js");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const {
  SPL_ACCOUNT_LAYOUT,
  DEVNET_PROGRAM_ID,
  MAINNET_PROGRAM_ID,
  TxVersion,
  LOOKUP_TABLE_CACHE,
  Liquidity,
} = require("@raydium-io/raydium-sdk");
const { default: lookup } = require("socket.io-client");
const { TransactionMessage } = require("@solana/web3.js/lib/index.cjs");
const { MARKET_STATE_LAYOUT_V3 } = require("@project-serum/serum");

dotenv.config();

const DEVNET_MODE = process.env.DEVNET_MODE === "true";
const NET_URL = DEVNET_MODE
  ? clusterApiUrl("devnet")
  : process.env.MAINNET_RPC_URL;
const connection = new Connection(NET_URL, "confirmed");
const BUNDLR_URL =
  DEVNET_MODE === false
    ? "https://node1.bundlr.network"
    : "https://devnet.bundlr.network";
const PROGRAMIDS = DEVNET_MODE ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID;
const addLookupTableInfo = DEVNET_MODE ? undefined : LOOKUP_TABLE_CACHE;

const USING_JITO = process.env.USING_JITO_BUNDLE === "true" ? true : false;

const owner = getKeypairFromEnvironment("OWNER_PRIVATE_KEY");

const makeTxVersion = TxVersion.V0; // LEGACY

const xWeiAmount = (amount, decimals) => {
  return new BN(
    new BigNumber(amount.toString() + "e" + decimals.toString()).toFixed(0)
  );
};

const xReadableAmount = (amount, decimals) => {
  return new BN(
    new BigNumber(amount.toString() + "e-" + decimals.toString()).toFixed(0)
  );
};

const getWalletTokenAccount = async (connection, wallet) => {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
};

const getWalletTokenBalance = async (wallet, tokenAddress, tokenDecimals) => {
  let walletPub = wallet;
  if (typeof wallet === "string") {
    walletPub = new PublicKey(wallet);
  }

  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    walletPub
  );

  let tokenBalance = 0;
  if (walletTokenAccounts && walletTokenAccounts.length > 0) {
    for (const acc of walletTokenAccounts) {
      if (acc.accountInfo.mint.toBase58() === tokenAddress.toBase58()) {
        tokenBalance = Number(acc.accountInfo.amount) / 10 ** tokenDecimals;
        break;
      }
    }
  }

  return tokenBalance;
};

const getWalletSOLBalance = async (wallet) => {
  try {
    let balance = (await connection.getBalance(wallet)) / LAMPORTS_PER_SOL;
    return balance;
  } catch (error) {
    console.log(error);
  }

  return 0;
};

const customSendAndConfirmTransactions = async (payer, transactions) => {
  for (const tx of transactions) {
    let signature;
    if (tx instanceof VersionedTransaction) {
      tx.sign([payer]);
      signature = await connection.sendTransaction(tx);
    } else {
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      signature = await connection.sendTransaction(tx, [payer]);
    }

    const trxid = await connection.confirmTransaction({
      signature: signature,
      abortSignal: AbortSignal.timeout(90000),
    });
  }
};

const sendPriorityTransaction = async (payer, tx) => {
  const signer = {
    publicKey: payer.publicKey,
    secretKey: payer.secretKey,
  };

  if (tx instanceof VersionedTransaction) {
    tx.sign([signer]);
  } else {
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(signer);
  }
  console.log("Sending Transaction...");
  const rawTransaction = tx.serialize();

  while (true) {
    try {
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: "singleGossip",
        maxRetries: 2,
      });
      console.log("Transaction Signature:", txid);
      let res = await connection.confirmTransaction({
        signature: txid,
        abortSignal: AbortSignal.timeout(120000),
      });
      if (res.value.err) {
        console.log(res.value.err);
        console.log(
          `Failed to confirm transaction. https://solscan.io/tx/${txid}`
        );
        break;
      }
      console.log(
        `Transaction has been confirmed. https://solscan.io/tx/${txid}`
      );
      return txid;
    } catch (error) {
      console.log("Tx Error: ", error);
      return;
    }
  }

  return null;
};

const customSendPriorityTransactions = async (payer, transactions) => {
  const PRIORITY_RATE = !process.env.PRIORITY_RATE
    ? 20000
    : Number(process.env.PRIORITY_RATE);

  let ret = {};
  for (const transaction of transactions) {
    const PRIORITY_FEE_IX = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: PRIORITY_RATE,
    });

    const addressLookupTableAccounts = await Promise.all(
      transaction.message.addressTableLookups.map(async (lookup) => {
        return new AddressLookupTableAccount({
          key: lookup.accountKey,
          state: AddressLookupTableAccount.deserialize(
            await connection
              .getAccountInfo(lookup.accountKey)
              .then((res) => res.data)
          ),
        });
      })
    );

    var message = TransactionMessage.decompile(transaction.message, {
      addressLookupTableAccounts: addressLookupTableAccounts,
    });
    message.instructions.push(PRIORITY_FEE_IX);
    // compile the message and update the transaction
    transaction.message = message.compileToV0Message(
      addressLookupTableAccounts
    );

    ret = await sendPriorityTransaction(payer, transaction);
    if (!ret) {
      break;
    }
  }

  return ret;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getAvailablePoolKeyAndPoolInfo = async (
  baseToken,
  quoteToken,
  marketAccounts
) => {
  let bFound = false;
  let count = 0;
  let poolKeys;
  let poolInfo;

  while (bFound === false && count < marketAccounts.length) {
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(
      marketAccounts[count].accountInfo.data
    );

    poolKeys = Liquidity.getAssociatedPoolKeys({
      version: 4,
      marketVersion: 3,
      baseMint: baseToken.mint,
      quoteMint: quoteToken.mint,
      baseDecimals: baseToken.decimals,
      quoteDecimals: quoteToken.decimals,
      marketId: marketAccounts[count].publicKey,
      programId: PROGRAMIDS.AmmV4,
      marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
    });
    poolKeys.marketBaseVault = marketInfo.baseVault;
    poolKeys.marketQuoteVault = marketInfo.quoteVault;
    poolKeys.marketBids = marketInfo.bids;
    poolKeys.marketAsks = marketInfo.asks;
    poolKeys.marketEventQueue = marketInfo.eventQueue;

    try {
      poolInfo = await Liquidity.fetchInfo({
        connection: connection,
        poolKeys: poolKeys,
      });

      bFound = true;
      console.log("Success to get pool infos...");
    } catch (error) {
      bFound = false;
      poolInfo = undefined;
      poolKeys = undefined;
      console.log("Failed to get pool infos...");
    }

    count++;
  }

  return {
    poolKeys: poolKeys,
    poolInfo: poolInfo,
  };
};

module.exports = {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  BUNDLR_URL,
  NET_URL,
  PROGRAMIDS,
  BN,
  addLookupTableInfo,
  USING_JITO,
  DEVNET_MODE,
  makeTxVersion,

  sleep,
  customSendAndConfirmTransactions,
  customSendPriorityTransactions,
  xWeiAmount,
  xReadableAmount,
  getWalletTokenBalance,
  getWalletSOLBalance,
  getWalletTokenAccount,
  getAvailablePoolKeyAndPoolInfo,
};
