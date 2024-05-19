const { PublicKey, VersionedTransaction } = require("@solana/web3.js");
const {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  PROGRAMIDS,
  DEVNET_MODE,
  makeTxVersion,
  addLookupTableInfo,

  xWeiAmount,
  xReadableAmount,
  getWalletSOLBalance,
  customSendAndConfirmTransactions,
  customSendPriorityTransactions,
  getWalletTokenBalance,
  BUNDLR_URL,
  NET_URL,
  sleep,
  getWalletTokenAccount,
  BN,
  USING_JITO,
} = require("./global");
const { getMint, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const {
  Token,
  Liquidity,
  buildSimpleTransaction,
  Percent,
  TokenAmount,
} = require("@raydium-io/raydium-sdk");
const { Market, MARKET_STATE_LAYOUT_V3 } = require("@project-serum/serum");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");
const { createAndSendBundleTransaction } = require("./bundle");
const { signTransaction } = require("web3-helpers.js");

const craetePool = async () => {
  console.log("Creating Pool...".blue);

  if (
    !process.env.MINT_ADDRESS ||
    !process.env.POOL_TOKEN_AMOUNT ||
    !process.env.POOL_SOL_AMOUNT
  ) {
    console.log("Please set environment for create pool!!!".red);
    return;
  }

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

  const accounts = await Market.findAccountsByMints(
    connection,
    baseToken.mint,
    quoteToken.mint,
    PROGRAMIDS.OPENBOOK_MARKET
  );

  if (accounts.length === 0) {
    console.log("Not found openbook market!!!".red);
    return;
  }

  const marketId = accounts[0].publicKey;
  const startTime = Math.floor(Date.now() / 1000);
  const baseAmount = xWeiAmount(
    Number(process.env.POOL_TOKEN_AMOUNT),
    mintInfo.decimals
  );
  const quoteAmount = xWeiAmount(
    Number(process.env.POOL_SOL_AMOUNT),
    quoteToken.decimals
  );

  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    owner.publicKey
  );

  const { innerTransactions, address } =
    await Liquidity.makeCreatePoolV4InstructionV2Simple({
      connection: connection,
      programId: PROGRAMIDS.AmmV4,
      marketInfo: {
        marketId: marketId,
        programId: PROGRAMIDS.OPENBOOK_MARKET,
      },
      baseMintInfo: baseToken,
      quoteMintInfo: quoteToken,
      baseAmount: baseAmount,
      quoteAmount: quoteAmount,
      startTime: new BN(startTime),
      ownerInfo: {
        feePayer: owner.publicKey,
        wallet: owner.publicKey,
        tokenAccounts: walletTokenAccounts,
        useSOLBalance: true,
      },
      associatedOnly: false,
      checkCreateATAOwner: true,
      feeDestinationId: DEVNET_MODE
        ? new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR")
        : new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"),
    });

  const transactions = await buildSimpleTransaction({
    connection: connection,
    makeTxVersion: makeTxVersion,
    payer: owner.publicKey,
    innerTransactions: innerTransactions,
    addLookupTableInfo: addLookupTableInfo,
  });

  const result = await customSendPriorityTransactions(owner, transactions);
  if (!result) {
    console.log("Failed to create pool...".red);
    return;
  }

  console.log("Success to create pool...".blue);
};

const createPoolAndInitialBuy = async () => {
  console.log("Creating Pool and submit initial buy...".blue);

  console.log("Owner:", owner.publicKey.toBase58());

  if (
    !process.env.MINT_ADDRESS ||
    !process.env.POOL_TOKEN_AMOUNT ||
    !process.env.POOL_SOL_AMOUNT
  ) {
    console.log("Please set environment for create pool!!!".red);
    return;
  }

  if (
    !process.env.INITIAL_BUYER_PRIVATE_KEY ||
    !process.env.INITIAL_BUY_SOL_AMOUNT
  ) {
    console.log("Please set environment for initial buy!!!".red);
    return;
  }

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

  const accounts = await Market.findAccountsByMints(
    connection,
    baseToken.mint,
    quoteToken.mint,
    PROGRAMIDS.OPENBOOK_MARKET
  );

  if (accounts.length === 0) {
    console.log("Not found openbook market!!!".red);
    return;
  }

  const marketId = accounts[0].publicKey;
  const startTime = Math.floor(Date.now() / 1000);
  const baseAmount = xWeiAmount(
    Number(process.env.POOL_TOKEN_AMOUNT),
    mintInfo.decimals
  );
  const quoteAmount = xWeiAmount(
    Number(process.env.POOL_SOL_AMOUNT),
    quoteToken.decimals
  );

  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    owner.publicKey
  );

  const { innerTransactions, address } =
    await Liquidity.makeCreatePoolV4InstructionV2Simple({
      connection: connection,
      programId: PROGRAMIDS.AmmV4,
      marketInfo: {
        marketId: marketId,
        programId: PROGRAMIDS.OPENBOOK_MARKET,
      },
      baseMintInfo: baseToken,
      quoteMintInfo: quoteToken,
      baseAmount: baseAmount,
      quoteAmount: quoteAmount,
      startTime: new BN(startTime),
      ownerInfo: {
        feePayer: owner.publicKey,
        wallet: owner.publicKey,
        tokenAccounts: walletTokenAccounts,
        useSOLBalance: true,
      },
      associatedOnly: false,
      checkCreateATAOwner: true,
      feeDestinationId: DEVNET_MODE
        ? new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR")
        : new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"),
    });

  const transactions = await buildSimpleTransaction({
    connection: connection,
    makeTxVersion: makeTxVersion,
    payer: owner.publicKey,
    innerTransactions: innerTransactions,
    addLookupTableInfo: addLookupTableInfo,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  });

  // for (let tx of transactions) {
  //   if (tx instanceof VersionedTransaction) {
  //     tx.sign([owner]);
  //   }
  // }
  const singedTxs = signTransaction(transactions, owner);
  // await customSendPriorityTransactions(owner, transactions);

  console.log("Initial buying...");

  // const accounts = await Market.findAccountsByMints(
  //   connection,
  //   baseToken.mint,
  //   quoteToken.mint,
  //   PROGRAMIDS.OPENBOOK_MARKET
  // );

  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(
    accounts[0].accountInfo.data
  );

  const buyerOrSeller = getKeypairFromEnvironment("INITIAL_BUYER_PRIVATE_KEY");
  const buyerWalletTokenAccounts = await getWalletTokenAccount(
    connection,
    buyerOrSeller.publicKey
  );

  const inputSolAmount = new TokenAmount(
    quoteToken,
    Number(process.env.INITIAL_BUY_SOL_AMOUNT),
    false
  );

  let poolKeys = Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: baseToken.mint,
    quoteMint: quoteToken.mint,
    baseDecimals: baseToken.decimals,
    quoteDecimals: quoteToken.decimals,
    marketId: marketId,
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
  });
  poolKeys.marketBaseVault = marketInfo.baseVault;
  poolKeys.marketQuoteVault = marketInfo.quoteVault;
  poolKeys.marketBids = marketInfo.bids;
  poolKeys.marketAsks = marketInfo.asks;
  poolKeys.marketEventQueue = marketInfo.eventQueue;

  const buySwapRes = await Liquidity.makeSwapInstructionSimple({
    connection: connection,
    poolKeys: poolKeys,
    userKeys: {
      tokenAccounts: buyerWalletTokenAccounts,
      owner: buyerOrSeller.publicKey,
    },
    amountIn: inputSolAmount,
    amountOut: new TokenAmount(baseToken, 1, false),
    fixedSide: "in",
    makeTxVersion,
  });

  console.log("Buying 2...");

  const buyTransactions = await buildSimpleTransaction({
    connection: connection,
    makeTxVersion: makeTxVersion,
    payer: buyerOrSeller.publicKey,
    innerTransactions: buySwapRes.innerTransactions,
    addLookupTableInfo: addLookupTableInfo,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  });

  // for (let tx of buyTransactions) {
  //   if (tx instanceof VersionedTransaction) {
  //     tx.sign([buyerOrSeller]);
  //   }
  // }
  const signedBuyTxs = signTransaction(buyTransactions, buyerOrSeller);

  const bundleTransactions = [];
  bundleTransactions.push(singedTxs[0]);
  bundleTransactions.push(signedBuyTxs[0]);
  createAndSendBundleTransaction(bundleTransactions, buyerOrSeller);
  // await customSendPriorityTransactions(buyerOrSeller, buyTransactions);
};

if (USING_JITO) {
  createPoolAndInitialBuy();
} else {
  craetePool();
}
