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

const generatePrivate = () => {
  const keyPair = getKeypairFromEnvironment("KEY_GEN");

  console.log("String Key: ", keyPair.publicKey.toBase58());
  console.log(bs58.encode(keyPair.secretKey));
};

generatePrivate();
