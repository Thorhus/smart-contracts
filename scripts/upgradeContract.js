const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { saveContractAddress , getSavedContractProxies, saveContractProxies } = require('./utils')

async function main() {

    let contractName = process.argv[2];
    await hre.run('compile');
    const proxies = getSavedContractProxies()[hre.network.name];

    const contract = await ethers.getContractFactory(contractName);
    await upgrades.upgradeProxy(proxies[contractName], contract);

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
