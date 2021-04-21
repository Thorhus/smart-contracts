const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];

    const ChainportCongress = await hre.ethers.getContractFactory("ChainportCongress");
    const chainportCongress = await ChainportCongress.deploy();
    await chainportCongress.deployed();
    console.log("ChainportCongress contract deployed to:", chainportCongress.address);
    saveContractAddress(hre.network.name, 'ChainportCongress', chainportCongress.address);

    const ChainportCongressMembersRegistry = await hre.ethers.getContractFactory("ChainportCongressMembersRegistry");
    const chainportCongressMembersRegistry = await ChainportCongressMembersRegistry.deploy(
        config.initialCongressMembers,
        hexify(config.initialCongressMembersNames),
        chainportCongress.address
    );
    await chainportCongressMembersRegistry.deployed();
    console.log("ChainportCongressMembersRegistry contract deployed to:", chainportCongressMembersRegistry.address);
    saveContractAddress(hre.network.name, 'ChainportCongressMembersRegistry', chainportCongressMembersRegistry.address);


    const ChainportToken = await hre.ethers.getContractFactory("ChainportToken");
    const chainportToken = await ChainportToken.deploy(
        config.tokenName,
        config.tokenSymbol,
        toChainportDenomination(config.totalSupply.toString()),
        chainportCongress.address
    );
    await chainportToken.deployed();
    console.log("Chainport token deployed to:", chainportToken.address);
    saveContractAddress(hre.network.name, 'ChainportToken', chainportToken.address);

    await chainportCongress.setMembersRegistry(chainportCongressMembersRegistry.address);
    console.log('ChainportCongress.setMembersRegistry(',chainportCongressMembersRegistry.address,') set successfully.');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
