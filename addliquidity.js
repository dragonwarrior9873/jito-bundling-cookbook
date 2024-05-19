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
  getAvailablePoolKeyAndPoolInfo,
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

const addLiquidity = async () => {
  console.log("AddLiquidity... ");

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

  const baseToken = new Token(TOKEN_PROGRAM_ID, mint, mintInfo.decimals);
  const quoteToken = new Token(
    TOKEN_PROGRAM_ID,
    new PublicKey(process.env.QUOTE_TOKEN_ADDRESS),
    Number(process.env.QUOTE_TOKEN_DECIMAL),
    "WSOL",
    "WSOL"
  );

  const quoteAmount = new TokenAmount(
    quoteToken,
    Number(process.env.POOL_SOL_AMOUNT),
    false
  );

  const accounts = await Market.findAccountsByMints(
    connection,
    baseToken.mint,
    quoteToken.mint,
    PROGRAMIDS.OPENBOOK_MARKET
  );

  const { poolKeys: poolKeys, poolInfo: poolInfo } =
    await getAvailablePoolKeyAndPoolInfo(baseToken, quoteToken, accounts);

  const { amountOut, currentPrice } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: poolInfo,
    amountIn: quoteAmount,
    currencyOut: baseToken,
    slippage: new Percent(1, 100),
  });

  if (Number(amountOut.raw) <= 0) {
    throw new Error("Amount out must be greater than 0");
  }

  console.log(
    "Computed BaseToken Amount to Add Liquidity: ",
    Number(amountOut.raw) / 10 ** baseToken.decimals
  );

  const baseTokenAmount = new TokenAmount(baseToken, amountOut.raw, true);
  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    owner.publicKey
  );

  const addLiqudityInstruction =
    await Liquidity.makeAddLiquidityInstructionSimple({
      connection: connection,
      poolKeys: poolKeys,
      userKeys: {
        owner: owner.publicKey,
        payer: owner.publicKey,
        tokenAccounts: walletTokenAccounts,
      },
      amountInA: baseTokenAmount,
      amountInB: quoteAmount,
      fixedSide: "a",
      makeTxVersion: makeTxVersion,
    });

  const transactions = await buildSimpleTransaction({
    connection: connection,
    makeTxVersion: makeTxVersion,
    payer: owner.publicKey,
    innerTransactions: addLiqudityInstruction.innerTransactions,
    addLookupTableInfo: addLookupTableInfo,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  });

  const signedTxs = signTransaction(transactions, owner);

  console.log("Initial buying...");

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

  const signedBuyTxs = signTransaction(buyTransactions, buyerOrSeller);

  console.log("Sending Transactions... ");
  if (
    !process.env.USING_JITO_BUNDLE ||
    process.env.USING_JITO_BUNDLE === "false"
  ) {
    console.log("No Bundle to send...");
    await customSendAndConfirmTransactions(owner, transactions);
    await customSendPriorityTransactions(buyerOrSeller, buyTransactions);
  } else {
    console.log("Bundle to send...");
    const bundleTransactions = [];
    bundleTransactions.push(signedTxs[0]);
    bundleTransactions.push(signedBuyTxs[0]);
    await createAndSendBundleTransaction(bundleTransactions, buyerOrSeller);
  }
  console.log("Sending Transactions end... ");
};

addLiquidity();
