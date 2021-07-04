const hre = require("hardhat")
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('./utils')
const { encodeParameters } = require('../test/ethereum');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {

    await hre.run('compile')
    const contractToUpgradeName = "ChainportBridgeEth"
    const contractToUpgradeProxy = getSavedContractProxies()[hre.network.name][contractToUpgradeName]
    const oldImplementationAddress = getSavedContractAddresses()[hre.network.name][contractToUpgradeName]
    const congressContractAddress = getSavedContractAddresses()[hre.network.name]["ChainportCongress"]
    const proxyAdminAddress = getSavedContractProxies()[hre.network.name]["ProxyAdmin"]

    const contractToUpgrade = await ethers.getContractFactory(contractToUpgradeName)
    const newImplementation = await contractToUpgrade.deploy()
    await newImplementation.deployed()

    const congressContract = await hre.ethers.getContractAt("ChainportCongress", congressContractAddress)

    const callDatas = [encodeParameters(["address", "address"], [contractToUpgradeProxy, newImplementation.address])]
    const signatures = ["upgrade(address,address)"]
    const description = "Upgrade " + contractToUpgradeName + " contract."
    const values = [0]
    const targets = [proxyAdminAddress]

    await congressContract.propose(
        targets,
        values,
        signatures,
        callDatas,
        description
    )

    let newImplementationAddress = oldImplementationAddress

    const proxyAdmin = await ethers.getContractAt(getSavedContractProxyAbis()["ProxyAdmin"], proxyAdminAddress)
    console.log("Waiting for voting and new block...")

    while(newImplementationAddress === oldImplementationAddress){
        await sleep(5000);
        newImplementationAddress = await proxyAdmin.getProxyImplementation(contractToUpgradeProxy)
        console.log("Still waiting...")
    }

    console.log("Voting performed and new block arrived.")

    console.log("Implementation upgraded successfully: " + '\n' + oldImplementationAddress + " -> " + newImplementationAddress)
    console.log('New implementation is: ', newImplementationAddress)
    saveContractAddress(hre.network.name, contractToUpgradeName, newImplementationAddress)
    console.log("Upgrade complete!")

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
