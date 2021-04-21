const hre = require("hardhat");
const { hexify, toChainportDenomination: toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
const config = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');

    const ChainportBridgeBsc = await hre.ethers.getContractFactory("ChainportBridgeBsc");
    const chainportBridgeBsc = await ChainportBridgeBsc.deploy();
    await chainportBridgeBsc.deployed();
    console.log("chainport bsc contract deployed to:", chainportBridgeBsc.address);
    saveContractAddress(hre.network.name, 'ChainportBridgeBsc', chainportBridgeBsc.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
