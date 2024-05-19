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
  thawAccount,
} = require("@solana/spl-token");

const thawToken = async () => {
  console.log("Thaw tokens... ".blue);

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set the token address!!!".red);
    return;
  }

  if (!process.env.THAW_ADDRESS) {
    console.log("Please set the Thaw address!!!".red);
    return;
  }

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const thawPubKey = new PublicKey(process.env.THAW_ADDRESS);

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    thawPubKey
  );

  const res = await thawAccount(
    connection,
    owner,
    tokenAccount.address,
    mint,
    owner
  );

  if (res) {
    console.log("Thawing success...".blue);
    return;
  }

  console.log("Thawing failed!!!".red);
};

thawToken();
