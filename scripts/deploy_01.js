const hre = require("hardhat");
const { hexify, toChainportDenomination: toChainportDenomination } = require('../test/setup');
// const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
const config = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');

    const ChainportCongress = await hre.ethers.getContractFactory("ChainportCongress");
    const chainportCongress = await ChainportCongress.deploy();
    await chainportCongress.deployed();

    console.log("HordCongress contract deployed to:", chainportCongress.address);

    saveContractAddress(hre.network.name, 'chainportCongress', chainportCongress.address);
    saveContractBytecode(hre.network.name,'chainportCongress', (await hre.artifacts.readArtifact("ChainportCongress")).bytecode);

    const ChainportCongressMembersRegistry = await hre.ethers.getContractFactory("ChainportCongressMembersRegistry");
    const chainportCongressMembersRegistry = await ChainportCongressMembersRegistry.deploy(
        config.initialCongressMembers,
        hexify(config.initialCongressMembersNames),
        chainportCongress.address
    );
    await chainportCongressMembersRegistry.deployed();

    console.log("ChainportCongressMembersRegistry contract deployed to:", chainportCongressMembersRegistry.address);

    saveContractAddress(hre.network.name, 'chainportCongressMembersRegistry', chainportCongressMembersRegistry.address);
    saveContractBytecode(hre.network.name,'chainportCongressMembersRegistry', (await hre.artifacts.readArtifact("ChainportCongressMembersRegistry")).bytecode);


    const chainportToken = await hre.ethers.getContractFactory("chainportToken");
    const chainport = await chainportToken.deploy(
        config.chainportTokenName,
        config.chainportTokenSymbol,
        toChainportDenomination(config.chainportTotalSupply.toString()),
        chainportCongress.address
    );
    await chainport.deployed();

    console.log("Chainport token deployed to:", hord.address);

    saveContractAddress(hre.network.name, 'chainportToken', hord.address);
    saveContractBytecode(hre.network.name,'chainportToken', (await hre.artifacts.readArtifact("ChainportToken")).bytecode);


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
