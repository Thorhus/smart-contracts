const { ethers, upgrades } = require("hardhat");

let bridgeEthAddress = "0xf33615916DCA70d334b28ADd26bA5ED3D32E0086";

async function main() {
    const bridgeEthV2 = await ethers.getContractFactory("ChainportBridgeEthV2");
    console.log("Upgrading bridgeEth...");
    const bridgeEth = await upgrades.upgradeProxy(bridgeEthAddress, bridgeEthV2);
    console.log("BridgeEth upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
