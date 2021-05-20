const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { saveContractAddress } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];

    const ChainportBridgeEth = await hre.ethers.getContractFactory("ChainportBridgeEth");
    const chainportBridgeEth = await ChainportBridgeEth.deploy();
    await chainportBridgeEth.deployed();
    console.log("ChainportBridgeEth deployed to:", chainportBridgeEth.address);
    saveContractAddress(hre.network.name, 'ChainportBridgeEth', chainportBridgeEth.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
