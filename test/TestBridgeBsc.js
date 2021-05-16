const { expect } = require("chai");

describe("Bridge Binance Side", function () {

    let maintainersRegistry, maintainersRegistryInstance, bridgeBsc, bridgeBscInstance,
    validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
    tokenAmount = 50, nonceIncrease = 1, decimals = 18;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("","",decimals);

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

            it("Should mint tokens", async function () {
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

            it("Should not burn a token which was not created by the bridge", async function () {
                await expect(bridgeBscInstance.connect(maintainer).burnTokens(
                    await bridgeBscInstance.erc20ToBep20Address(token.address), 1))
                    .to.be.revertedWith("BurnTokens: Token is not created by the bridge.");
            });
        });
    });
});
