const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { saveContractAddress , getSavedContractProxies, saveContractProxies } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];

    // Upgrade Validator
    const BinanceBridgeBsc = await ethers.getContractFactory('ValidatoBinanceBridgeBsc')
    const upgradedBSC = await upgrades.upgradeProxy(proxies['BinanceBridgeBsc'], BinanceBridgeBsc);

    const admin = await upgrades.admin.getInstance();

    const implementation = await admin.getProxyImplementation(proxies['BinanceBridgeBsc']);
    console.log('New implementation is: ', implementation);
    saveContractAddress(hre.network.name, 'BinanceBridgeBsc', implementation);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
