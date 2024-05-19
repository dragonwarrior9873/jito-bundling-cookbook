const { PublicKey } = require("@solana/web3.js");
const {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  xWeiAmount,
  xReadableAmount,
  getWalletSOLBalance,
  getWalletTokenBalance,
  BUNDLR_URL,
  NET_URL,
  sleep,
} = require("./global");
const { setAuthority, AuthorityType } = require("@solana/spl-token");

const revokeToken = async () => {
  console.log("Revoking token...");

  if (!process.env.MINT_ADDRESS) {
    console.log("Please set MINT_ADDRESS environment value!!!".red);
    return;
  }

  const mint = new PublicKey(process.env.MINT_ADDRESS);

  await setAuthority(
    connection,
    owner,
    mint,
    owner,
    AuthorityType.FreezeAccount,
    null
  );
  await setAuthority(
    connection,
    owner,
    mint,
    owner,
    AuthorityType.MintTokens,
    null
  );

  console.log("Revoke succeeded".blue);
};

revokeToken();
