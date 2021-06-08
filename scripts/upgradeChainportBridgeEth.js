const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress , getSavedContractProxies, saveContractProxies } = require('./utils');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    await hre.run('compile');
    const contractName = 'ChainportBridgeBsc';
    const proxy = getSavedContractProxies()[hre.network.name][contractName];
    const oldImplementation = getSavedContractAddresses()[hre.network.name][contractName];

    console.log("Upgrading proxy...");
    const contract = await ethers.getContractFactory(contractName);
    await upgrades.upgradeProxy(proxy, contract);
    let implementation = oldImplementation;
    console.log("Proxy upgraded.");

    let admin = await upgrades.admin.getInstance();
    console.log("Waiting for a new block...");

    while(implementation === oldImplementation){
        await sleep(5000);
        implementation = await admin.getProxyImplementation(proxy);
        console.log("Still waiting...")
    }

    console.log("Block arrived.");

    console.log("Implementation changed successfully: " + '\n' + oldImplementation + " -> " + implementation);
    console.log('New implementation is: ', implementation);
    saveContractAddress(hre.network.name, contractName, implementation);
    console.log("Upgrade complete!")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
