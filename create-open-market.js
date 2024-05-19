const { PublicKey, sendAndConfirmTransaction } = require("@solana/web3.js");
const {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  PROGRAMIDS,
  addLookupTableInfo,
  makeTxVersion,

  xWeiAmount,
  xReadableAmount,
  getWalletSOLBalance,
  getWalletTokenBalance,
  BUNDLR_URL,
  NET_URL,
  sleep,
  customSendAndConfirmTransactions,
} = require("./global");
const { getMint, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const {
  Token,
  MarketV2,
  TxVersion,
  buildSimpleTransaction,
} = require("@raydium-io/raydium-sdk");
const { Transaction } = require("jito-ts/dist/gen/geyser/confirmed_block");
const { VersionedTransaction } = require("@solana/web3.js/lib/index.cjs");

const createOpenMarket = async () => {
  console.log("Creating OpenBook market...".blue);
  if (!process.env.MINT_ADDRESS) {
    console.log("Please set MINT_ADDRESS environment value!!!".red);
    return;
  }

  const MIN_ORDER_SIZE = !process.env.MIN_ORDER_SIZE
    ? 1
    : Number(process.env.MIN_ORDER_SIZE);
  const TICK_SIZE = !process.env.TICK_SIZE
    ? 0.01
    : Number(process.env.TICK_SIZE);
  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const mintInfo = await getMint(connection, mint);

  const baseToken = new Token(
    TOKEN_PROGRAM_ID,
    process.env.MINT_ADDRESS,
    mintInfo.decimals
  );
  const quoteToken = new Token(
    TOKEN_PROGRAM_ID,
    process.env.QUOTE_TOKEN_ADDRESS,
    Number(process.env.QUOTE_TOKEN_DECIMAL),
    process.env.QUOTE_TOKEN_SYMBOL,
    process.env.QUOTE_TOKEN_SYMBOL
  );

  const { innerTransactions, address } =
    await MarketV2.makeCreateMarketInstructionSimple({
      connection: connection,
      wallet: owner.publicKey,
      baseInfo: baseToken,
      quoteInfo: quoteToken,
      lotSize: MIN_ORDER_SIZE,
      tickSize: TICK_SIZE,
      dexProgramId: PROGRAMIDS.OPENBOOK_MARKET,
      makeTxVersion: makeTxVersion,
    });

  const transactions = await buildSimpleTransaction({
    connection: connection,
    makeTxVersion: makeTxVersion,
    payer: owner.publicKey,
    innerTransactions: innerTransactions,
    addLookupTableInfo: addLookupTableInfo,
  });

  //   for (const tx of transactions) {
  //     if (tx instanceof VersionedTransaction) {
  //       tx.sign([owner]);
  //     }
  //   }

  await customSendAndConfirmTransactions(owner, transactions);
  console.log("Created open market id: ".blue, address.marketId.toBase58());
};

createOpenMarket();
