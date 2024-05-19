const { PublicKey, Keypair } = require("@solana/web3.js");
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
const {
  getMint,
  getOrCreateAssociatedTokenAccount,
  burn,
} = require("@solana/spl-token");

const burnToken = async () => {
  console.log("Burning token from...".blue);
  if (!process.env.MINT_ADDRESS) {
    console.log("Please set your token address!!".red);
    return;
  }

  if (!process.env.BURNFROM_PRIVATEKEY || !process.env.BURNFROM_AMOUNT) {
    console.log("Please set the environment variable for burning!!".red);
    return;
  }

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  let mintInfo = await getMint(connection, mint);
  const burnKeypair = Keypair.fromSecretKey(
    bs58.decode(process.env.BURNFROM_PRIVATEKEY)
  );
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    burnKeypair.publicKey
  );
  const tokenAmount = xWeiAmount(
    Number(process.env.BURNFROM_AMOUNT),
    mintInfo.decimals
  );

  await burn(
    connection,
    owner,
    tokenAccount.address,
    mint,
    burnKeypair,
    tokenAmount
  );

  mintInfo = await getMint(connection, mint);
  const supply = xReadableAmount(mintInfo.supply, mintInfo.decimals);
  console.log("Total supply: ".blue, supply.toString());

  const walletTokenAmount = await getWalletTokenBalance(
    burnKeypair.publicKey.toBase58(),
    new PublicKey(process.env.MINT_ADDRESS),
    mintInfo.decimals
  );

  console.log(
    "Wallet Balance: ".blue,
    burnKeypair.publicKey.toBase58(),
    walletTokenAmount.toString()
  );
};

burnToken();
