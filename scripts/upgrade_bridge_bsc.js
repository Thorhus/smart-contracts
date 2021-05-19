const { ethers, upgrades } = require("hardhat");

let bridgeBscAddress = "0x917881E536AE486cBbB7CAcaDb0493a938Bf4549";

async function main() {
    const bridgeBscV2 = await ethers.getContractFactory("ChainportBridgeBscV2");
    console.log("Upgrading bridgeBsc...");
    const bridgeBsc = await upgrades.upgradeProxy(bridgeBscAddress, bridgeBscV2);
    console.log("BridgeBsc upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
