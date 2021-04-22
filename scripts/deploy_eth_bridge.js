const hre = require("hardhat");
const { hexify, toChainportDenomination: toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
const config = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');

    const ChainportBridgeEth = await hre.ethers.getContractFactory("ChainportBridgeEth");
    const chainportBridgeEth = await ChainportBridgeEth.deploy();
    await chainportBridgeEth.deployed();
    console.log("ChainportBridgeEth contract deployed to:", chainportBridgeEth.address);
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
