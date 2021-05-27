const { expect } = require("chai");

describe("Bridge Binance Side", function () {

    let maintainersRegistry, maintainersRegistryInstance, bridgeBsc, bridgeBscInstance,
    validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
    tokenAmount = 50, nonceIncrease = 1, decimals = 18, zeroAddress = "0x0000000000000000000000000000000000000000";

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("", "", decimals);

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();

        bridgeBsc = await ethers.getContractFactory("ChainportBridgeBsc");
        bridgeBscInstance = await bridgeBsc.deploy();
    });

    it("Initialization", async function () {
        await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Main functions", function () {

        beforeEach(async function () {
            await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await bridgeBscInstance.connect(chainportCongress).unfreezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(bridgeBscInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not unfreeze the bridge (by maintianer)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(maintainer).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Token Minting", function () {

            it("Should mint a new token (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
            });

            it("Should not mint same token second time", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                await expect(bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("MintNewToken: Token already exists.");
            });

            it("Should not mint a new token (by user)", async function () {
                await expect(bridgeBscInstance.connect(user1).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint a new token when bridge is frozen", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });

            it("Should not mint tokens (by non bridge contract)", async function () {
                // current bridge contract address is chainportCongress
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await expect(bridgeBscInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Only Bridge contract can mint new tokens.");
            });

            it("Should not change the bridge contract address (by user)", async function() {
                expect(await token.binanceBridgeContract()).to.equal(chainportCongress.address);
                await expect(token.connect(user1).setBinanceBridgeContract(maintainer.address)).to.be.reverted;
            });

            it("Should change the bridge contract address", async function() {
                expect(await token.binanceBridgeContract()).to.equal(chainportCongress.address);
                await token.connect(chainportCongress).setBinanceBridgeContract(bridgeBscInstance.address);
                expect(await token.binanceBridgeContract()).to.equal(bridgeBscInstance.address);
            });

            it("Should mint tokens", async function () {
                await token.connect(chainportCongress).setBinanceBridgeContract(bridgeBscInstance.address);
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);
            });

            it("Should not mint tokens (by user)", async function () {
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await expect(bridgeBscInstance.connect(user1).mintTokens(token.address, user2.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint tokens with invalid nonce", async function () {
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await expect(bridgeBscInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, 435))
                    .to.be.revertedWith("Nonce is not correct");
            });

            it("Should not mint tokens when amount is below or equal to zero", async function () {
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await expect(bridgeBscInstance.connect(maintainer).mintTokens(token.address, user2.address, 0, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not mint tokens when bridge is frozen", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await expect(bridgeBscInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Burning", function () {

            it("Should burn a token made by the bridge (by maintainer)", async function () {

                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepTokenAddress = await bridgeBscInstance.erc20ToBep20Address(token.address);

                let bepToken = await ethers.getContractAt("BridgeMintableToken", bepTokenAddress);

                await bepToken.connect(maintainer).approve(bridgeBscInstance.address, tokenAmount);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer).mintTokens(
                    bepToken.address, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await bridgeBscInstance.connect(maintainer).burnTokens(bepToken.address, 1);

                expect(await bepToken.balanceOf(maintainer.address)).to.equal(tokenAmount - 1);
            });

            it("Should not burn a token if amount exceeds allowance", async function () {

                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepToken = await bridgeBscInstance.erc20ToBep20Address(token.address);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer).mintTokens(
                    bepToken, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await expect(bridgeBscInstance.connect(maintainer).burnTokens(bepToken, 1))
                    .to.be.revertedWith("ERC20: burn amount exceeds allowance");
            });

            it("Should not burn a token if amount is below or equal to zero", async function () {

                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepToken = await bridgeBscInstance.erc20ToBep20Address(token.address);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer).mintTokens(
                    bepToken, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await expect(bridgeBscInstance.connect(maintainer).burnTokens(bepToken, 0))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not burn a token which was not created by the bridge", async function () {
                await expect(bridgeBscInstance.connect(maintainer).burnTokens(
                    await bridgeBscInstance.erc20ToBep20Address(token.address), 1))
                    .to.be.revertedWith("BurnTokens: Token is not created by the bridge.");
            });
        });

        describe("Delete Minted Tokens", function () {

            it("Should not delete minted tokens (by user))", async function () {
                bscTokenAddr = await bridgeBscInstance.erc20ToBep20Address(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                bscTokenAddr = await bridgeBscInstance.erc20ToBep20Address(token.address);
                expect(bscTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.true;

                await expect(bridgeBscInstance.connect(user1).deleteMintedTokens([token.address]))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should delete minted tokens (by maintainer))", async function () {
                bscTokenAddr = await bridgeBscInstance.erc20ToBep20Address(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                bscTokenAddr = await bridgeBscInstance.erc20ToBep20Address(token.address);
                expect(bscTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.true;

                newToken = await ethers.getContractFactory("BridgeMintableToken");
                newToken = await newToken.deploy("Fake Token", "FKT", decimals);

                bscNewTokenAddr = await bridgeBscInstance.erc20ToBep20Address(newToken.address);
                expect(bscNewTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.false;
                await bridgeBscInstance.connect(maintainer).mintNewToken(newToken.address, "", "", decimals);
                bscNewTokenAddr = await bridgeBscInstance.erc20ToBep20Address(newToken.address);
                expect(bscNewTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.true;

                await bridgeBscInstance.connect(maintainer).deleteMintedTokens([token.address, newToken.address]);
                bscTokenAddr = await bridgeBscInstance.erc20ToBep20Address(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                bscNewTokenAddr = await bridgeBscInstance.erc20ToBep20Address(newToken.address);
                expect(bscNewTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await bridgeBscInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.false;
            });
        });
    });
});
