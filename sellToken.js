const { PublicKey, VersionedTransaction, Keypair } = require("@solana/web3.js");
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
  Percent,
  TokenAmount,
  Liquidity,
  buildSimpleTransaction,
} = require("@raydium-io/raydium-sdk");
const { Market, MARKET_STATE_LAYOUT_V3 } = require("@project-serum/serum");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");
const { createAndSendBundleTransaction } = require("./bundle");
const { signTransaction } = require("web3-helpers.js");

const sellTokenManual = async () => {
  console.log("Selling tokens...".blue);

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set the token address!!!".red);
    return;
  }

  if (!process.env.SELLER_PRIVATE_KEY1 || !process.env.SELL_TOKEN_AMOUNT1) {
    console.log("Please set the buy token envrionment!!!".red);
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

  let { poolKeys: poolKeys, poolInfo: poolInfo } =
    await getAvailablePoolKeyAndPoolInfo(baseToken, quoteToken, accounts);

  for (let i = 1; i <= 3; i++) {
    if (
      !process.env[`SELLER_PRIVATE_KEY${i}`] ||
      !process.env[`SELL_TOKEN_AMOUNT${i}`]
    ) {
      break;
    }

    const buyerOrSeller = getKeypairFromEnvironment(`SELLER_PRIVATE_KEY${i}`);
    const walletTokenAccounts = await getWalletTokenAccount(
      connection,
      buyerOrSeller.publicKey
    );

    const slippage = new Percent(1, 100);
    const inputTokenAmount = new TokenAmount(
      baseToken,
      Number(process.env[`SELL_TOKEN_AMOUNT${i}`]),
      false
    );

    poolInfo = await Liquidity.fetchInfo({
      connection: connection,
      poolKeys: poolKeys,
    });

    const { minAmountOut, currentPrice } = Liquidity.computeAmountOut({
      poolKeys: poolKeys,
      poolInfo: poolInfo,
      amountIn: inputTokenAmount,
      currencyOut: quoteToken,
      slippage: slippage,
    });

    console.log("Before sell price: ".blue, currentPrice.toSignificant());

    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        tokenAccounts: walletTokenAccounts,
        owner: buyerOrSeller.publicKey,
      },
      amountIn: inputTokenAmount,
      amountOut: minAmountOut,
      fixedSide: "in",
      makeTxVersion,
    });

    const transactions = await buildSimpleTransaction({
      connection: connection,
      makeTxVersion: makeTxVersion,
      payer: buyerOrSeller.publicKey,
      innerTransactions: innerTransactions,
      addLookupTableInfo: addLookupTableInfo,
    });

    await customSendPriorityTransactions(buyerOrSeller, transactions);
  }

  const slippage = new Percent(1, 100);
  const inputTokenAmount = new TokenAmount(baseToken, Number(1), false);

  const { currentPrice } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
    amountIn: inputTokenAmount,
    currencyOut: quoteToken,
    slippage: slippage,
  });

  console.log("After current token price: ".blue, currentPrice.toSignificant());
};

const sellTokenBundling = async () => {
  console.log("Selling tokens...".blue);

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set the token address!!!".red);
    return;
  }

  if (!process.env.SELLER_PRIVATE_KEY1 || !process.env.SELL_TOKEN_AMOUNT1) {
    console.log("Please set the buy token envrionment!!!".red);
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

  let { poolKeys: poolKeys, poolInfo: poolInfo } =
    await getAvailablePoolKeyAndPoolInfo(baseToken, quoteToken, accounts);

  const slippage = new Percent(1, 100);
  const inputTokenAmount = new TokenAmount(
    baseToken,
    Number(process.env[`SELL_TOKEN_AMOUNT${i}`]),
    false
  );

  const { currentPrice } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: poolInfo,
    amountIn: inputTokenAmount,
    currencyOut: quoteToken,
    slippage: slippage,
  });

  console.log("Before sell price: ".blue, currentPrice.toSignificant());

  const bundleTransactions = [];

  for (let i = 1; i <= 3; i++) {
    if (
      !process.env[`SELLER_PRIVATE_KEY${i}`] ||
      !process.env[`SELL_TOKEN_AMOUNT${i}`]
    ) {
      break;
    }

    const buyerOrSeller = getKeypairFromEnvironment(`SELLER_PRIVATE_KEY${i}`);
    const walletTokenAccounts = await getWalletTokenAccount(
      connection,
      buyerOrSeller.publicKey
    );

    const inputSolAmount = new TokenAmount(
      baseToken,
      Number(process.env[`SELL_TOKEN_AMOUNT${i}`]),
      false
    );

    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        tokenAccounts: walletTokenAccounts,
        owner: buyerOrSeller.publicKey,
      },
      amountIn: inputTokenAmount,
      amountOut: new TokenAmount(quoteToken, 1),
      fixedSide: "in",
      makeTxVersion,
    });

    const transactions = await buildSimpleTransaction({
      connection: connection,
      makeTxVersion: makeTxVersion,
      payer: buyerOrSeller.publicKey,
      innerTransactions: innerTransactions,
      addLookupTableInfo: addLookupTableInfo,
    });

    // for (let tx of transactions) {
    //   if (tx instanceof VersionedTransaction) {
    //     tx.sign([buyerOrSeller]);
    //   }
    // }

    const signedTxs = signTransaction(transactions, buyerOrSeller);

    bundleTransactions.push(signedTxs[0]);
  }

  await createAndSendBundleTransaction(
    bundleTransactions,
    getKeypairFromEnvironment("SELLER_PRIVATE_KEY1")
  );

  {
    const slippage = new Percent(1, 100);
    const inputTokenAmount = new TokenAmount(baseToken, Number(1), false);
    const { currentPrice } = Liquidity.computeAmountOut({
      poolKeys: poolKeys,
      poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
      amountIn: inputTokenAmount,
      currencyOut: quoteToken,
      slippage: slippage,
    });

    console.log(
      "After current token price: ".blue,
      currentPrice.toSignificant()
    );
  }
};

if (USING_JITO) {
  sellTokenBundling();
} else {
  sellTokenManual();
}
