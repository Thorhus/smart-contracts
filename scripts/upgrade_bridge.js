const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { saveContractAddress , getSavedContractProxies } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];


    const ChainportBridgeEth = await hre.ethers.getContractFactory("ChainportBridgeEth");
    const chainportBridgeEth = await ChainportBridgeEth.deploy();
    await chainportBridgeEth.deployed();
    console.log("ChainportBridge ETH contract deployed to:", chainportBridgeEth.address);
    saveContractAddress(hre.network.name, 'ChainportBridgeEth', chainportBridgeEth.address);

    let admin = await upgrades.admin.getInstance();

    await admin.upgrade(proxies['ChainportBridgeEth'], chainportBridgeEth.address);
    console.log('Upgraded successfully.');

    // Upgrade Validator
    const ValidatorContract = await ethers.getContractFactory('Validator')
    const upgradedValidator = await upgrades.upgradeProxy(proxies['Validator'], ValidatorContract);

    let implementation = await admin.getProxyImplementation(proxies['Validator']);
    console.log('New implementation is: ', implementation);
    saveContractAddress(hre.network.name, 'Validator', implementation);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
