const { PublicKey } = require("@solana/web3.js");
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
  freezeAccount,
} = require("@solana/spl-token");

const freezeToken = async () => {
  console.log("Freeze tokens... ".blue);

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set the token address!!!".red);
    return;
  }

  if (!process.env.FREEZE_ADDRESS) {
    console.log("Please set the freeze address!!!".red);
    return;
  }

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const freezePubKey = new PublicKey(process.env.FREEZE_ADDRESS);

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    freezePubKey
  );

  const res = await freezeAccount(
    connection,
    owner,
    tokenAccount.address,
    mint,
    owner
  );

  if (res) {
    console.log("Freezing success...".blue);
    return;
  }

  console.log("Freezing failed!!!".red);
};

freezeToken();
