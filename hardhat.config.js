require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-web3");
require('@openzeppelin/hardhat-upgrades');
require("@tenderly/hardhat-tenderly");
require('ethereumjs-util')
require("solidity-coverage");
require('dotenv').config()

let PK = process.env.PK

if(typeof PK === 'undefined'){
  // *** PK STATED BELOW IS DUMMY PK EXCLUSIVELY FOR TESTING PURPOSES ***
  PK = `0x${"32c069bf3d38a060eacdc072eecd4ef63f0fc48895afbacbe185c97037789875"}`
}

const { generateTenderlySlug } = require('./scripts/helpers/helpers');

task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners();
  for (const account of accounts) {
    console.log(await account.getAddress())
  }
});


// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more

module.exports = {
  defaultNetwork: 'local',
  networks: {
    hecotest: {
      url: 'https://http-testnet.hecochain.com/',
      accounts: [PK],
      chainId: 256,
      gasPrice: 40000000000,
      timeout: 50000
    },
    hecotestStaging: {
      url: 'https://http-testnet.hecochain.com/',
      accounts: [PK],
      chainId: 256,
      gasPrice: 40000000000,
      timeout: 50000
    },
    hecoMainnet: {
      url: 'https://http-mainnet.hecochain.com/',
      accounts: [PK],
      chainId: 128,
      gasPrice: 41000000000,
      timeout: 500000000
    },
    polygonMumbai: {
      url: 'https://matic-testnet-archive-rpc.bwarelabs.com',
      accounts: [PK],
      chainId: 80001,
      gasPrice: 40000000000,
      timeout: 50000
    },
    polygonMumbaiStaging: {
      url: 'https://matic-testnet-archive-rpc.bwarelabs.com',
      accounts: [PK],
      chainId: 80001,
      gasPrice: 40000000000,
      timeout: 50000
    },
    polygonMainnet: {
      url: "https://rpc-mainnet.matic.network",
      accounts: [PK],
      chainId: 137,
      gasPrice: 41000000000,
      timeout: 500000000
    },
    kovan: {
      // Infura public nodes
      url: 'https://kovan.infura.io/v3/4fcc38c2bed84e8590473abd8e9f51e8',
      accounts: [PK],
      chainId: 42,
      gasPrice: 40000000000,
      timeout: 50000
    },
    kovanStaging: {
      // Infura public nodes
      url: 'https://kovan.infura.io/v3/4fcc38c2bed84e8590473abd8e9f51e8',
      accounts: [PK],
      chainId: 42,
      gasPrice: 40000000000,
      timeout: 50000
    },
    ropsten: {
      // Infura public nodes
      url: 'https://ropsten.infura.io/v3/34ee2e319e7945caa976d4d1e24db07f',
      accounts: [PK],
      chainId: 3,
      gasPrice: 40000000000,
      timeout: 50000
    },
    ropstenStaging: {
      // Infura public nodes
      url: 'https://ropsten.infura.io/v3/34ee2e319e7945caa976d4d1e24db07f',
      accounts: [PK],
      chainId: 3,
      gasPrice: 80000000000,
      timeout: 100000
    },
    binancetest: {
      // Infura public nodes
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      accounts: [PK],
      chainId: 97,
      gasPrice: 40000000000,
      timeout: 50000
    },
    binancetestStaging: {
      // Infura public nodes
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      accounts: [PK],
      chainId: 97,
      gasPrice: 40000000000,
      timeout: 50000
    },
    mainnet: {
      // Infura public nodes
      url: 'https://mainnet.infura.io/v3/4fcc38c2bed84e8590473abd8e9f51e8',
      accounts: [PK],
      chainId: 1,
      gasPrice: 35000000000,
      timeout: 500000000
    },
    binanceMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [PK],
      chainId: 56,
      gasPrice: 20000000000,
      timeout: 500000000
    },

    local: {
      url: 'http://localhost:8545',
    },
  },
  solidity: {
    version: '0.6.12',
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  tenderly: {
    username: process.env.USERNAME,
    project: generateTenderlySlug()
  },
};
