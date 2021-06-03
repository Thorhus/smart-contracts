const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { saveContractAddress , getSavedContractProxies, saveContractProxies } = require('./utils');
let c = require('../deployments/deploymentConfig.json');

async function main() {

    await hre.run('compile');
    const config = c[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];
    let contractName = 'ChainportBridgeEth';

    const contract = await ethers.getContractFactory(contractName);
    const upgradedContract = await upgrades.upgradeProxy(proxies[contractName], contract);

    const admin = await upgrades.admin.getInstance();

    const implementation = await admin.getProxyImplementation(proxies[contractName]);
    console.log('New implementation is: ', implementation);
    saveContractAddress(hre.network.name, contractName, implementation);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
