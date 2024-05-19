const {
  PublicKey,
  ComputeBudgetProgram,
  VersionedTransaction,
  TransactionMessage,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
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
const {
  getOrCreateAssociatedTokenAccount,
  getMint,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
} = require("@solana/spl-token");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");
const { Keypair } = require("@solana/web3.js/lib/index.cjs");

const transferToken = async () => {
  console.log("Transferring tokens...".blue);

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set your token address!!".red);
    return;
  }

  if (
    !process.env.FROM_PRIVATE_KEY ||
    !process.env.TO_ADDRESS1 ||
    !process.env.TO_AMOUNT1
  ) {
    console.log("Please set transfer token envrionment!!!".red);
    return;
  }

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const mintInfo = await getMint(connection, mint);
  const formKeypair = getKeypairFromEnvironment("FROM_PRIVATE_KEY");
  const fromAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    formKeypair,
    mint,
    formKeypair.publicKey,
    undefined,
    "confirmed",
    undefined,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  for (let i = 1; i <= 3; i++) {
    if (!process.env[`TO_ADDRESS${i}`] || !process.env[`TO_AMOUNT${i}`]) {
      break;
    }

    const toPubkey = getKeypairFromEnvironment(`TO_ADDRESS${i}`);
    const toAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      mint,
      toPubkey.publicKey,
      undefined,
      "confirmed",
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transferAmount =
      Number(process.env[`TO_AMOUNT${i}`]) * Math.pow(10, mintInfo.decimals);

    const txInstructions = [];
    txInstructions.push(
      createTransferCheckedInstruction(
        fromAccount.address,
        mint,
        toAccount.address,
        formKeypair.publicKey,
        transferAmount,
        mintInfo.decimals,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const messageV0 = new TransactionMessage({
      payerKey: formKeypair.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed"))
        .blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const trx = new VersionedTransaction(messageV0);
    await customSendPriorityTransactions(formKeypair, [trx]);
    // await sendAndConfirmTransaction(connection, trx, toPubkey);
  }

  console.log("Transfer done...".blue);
};

transferToken();
